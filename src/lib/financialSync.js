import { prisma } from '@/lib/prisma';
import { batchReadSheets } from '@/lib/googleSheets';
import { processSiengeData, extractAccountCode, parseBRL } from '@/lib/businessRules';

const SNAPSHOT_ID = 'current';
const REQUIRED_SHEETS = ['EMPRESAS', 'PROJETOS_2026', 'CENTROS_CUSTO', 'PLANOS_FINANCEIROS', 'CP_GERAL', 'CR_GERAL', 'DEPARA'];
const CASH_LOGIC_VERSION = 6;

function parseSortDate(value) {
  if (!value) return 0;
  const raw = String(value).trim();

  let match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) {
    const [, day, month, year] = match;
    return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
  }

  match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) {
    const [, year, month, day] = match;
    return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
  }

  const parsed = new Date(raw).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function isRealizedEntry(row) {
  if (String(row?.natureza || '').toUpperCase() !== 'ENTRADA') return false;
  const status = String(row?.status || '').toUpperCase();
  return status.includes('REALIZADO') || status.includes('RECEBIDO') || status.includes('EFETIVADO');
}

function isForecastRevenueEntry(row) {
  if (String(row?.natureza || '').toUpperCase() !== 'ENTRADA') return false;
  const code = String(row?.contaCodigo || '').replace(/\D/g, '');
  if (code !== '1010101' && code !== '1010107') return false;
  const status = String(row?.status || '').toUpperCase();
  const isRealized = status.includes('REALIZADO') || status.includes('RECEBIDO') || status.includes('EFETIVADO');
  if (isRealized) return false;
  return status.includes('A REALIZAR')
    || status.includes('A RECEBER')
    || status.includes('A PAGAR')
    || status.includes('PREVISTO');
}

function forecastTitleKey(row, index) {
  const lancamento = String(row?.lancamento || '').trim();
  const status = String(row?.status || '').trim().toUpperCase();
  const data = String(row?.data || '').trim();
  if (lancamento) return [lancamento, status, data].join('|');
  const documento = String(row?.documento || '').trim();
  const nome = String(row?.nome || '').trim();
  if (documento) return ['DOC:' + documento, nome, status, data].join('|');
  return 'ROW:' + index;
}

function distributeAmount(rows, total) {
  if (!rows.length) return [];
  const weights = rows.map((row) => Math.abs(Number(row.valorFaturamentoOriginal ?? row.valorFaturamento) || 0));
  const weightTotal = weights.reduce((sum, value) => sum + value, 0);
  let allocated = 0;
  return rows.map((row, index) => {
    const value = index === rows.length - 1
      ? Math.round((total - allocated) * 100) / 100
      : Math.round((total * (weightTotal > 0 ? weights[index] / weightTotal : 1 / rows.length)) * 100) / 100;
    allocated += value;
    return { ...row, valorFaturamento: value, valorTotalTitulo: value, valorBruto: value };
  });
}

function normalizeForecastRevenueBilling(rows) {
  const result = [...rows];
  const groups = new Map();

  rows.forEach((row, index) => {
    if (!isForecastRevenueEntry(row)) return;
    const key = forecastTitleKey(row, index);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(index);
  });

  groups.forEach((indexes) => {
    const groupRows = indexes.map((index) => ({ ...result[index], __index: index }));
    const originals = groupRows.map((row) => Math.abs(Number(row.valorFaturamentoOriginal ?? row.valorFaturamento) || 0)).filter((value) => value > 0);
    const titleValue = originals.length ? Math.max(...originals) : 0;
    if (titleValue <= 0) return;

    const direct = groupRows.filter((row) => String(row.contaCodigo || '').replace(/\D/g, '') === '1010101');
    const admin = groupRows.filter((row) => String(row.contaCodigo || '').replace(/\D/g, '') === '1010107');

    if (direct.length && admin.length) {
      const directTotal = Math.round(titleValue * 0.8 * 100) / 100;
      const adminTotal = Math.round((titleValue - directTotal) * 100) / 100;
      distributeAmount(direct, directTotal).forEach((row) => {
        result[row.__index] = { ...row, valorFaturamentoOriginal: Number(result[row.__index].valorFaturamentoOriginal ?? result[row.__index].valorFaturamento) || 0, previsaoFaturamentoFonte: 'TITULO_UNICO_80_20' };
        delete result[row.__index].__index;
      });
      distributeAmount(admin, adminTotal).forEach((row) => {
        result[row.__index] = { ...row, valorFaturamentoOriginal: Number(result[row.__index].valorFaturamentoOriginal ?? result[row.__index].valorFaturamento) || 0, previsaoFaturamentoFonte: 'TITULO_UNICO_80_20' };
        delete result[row.__index].__index;
      });
      return;
    }

    const normalized = distributeAmount(groupRows, titleValue);
    normalized.forEach((row) => {
      result[row.__index] = { ...row, valorFaturamentoOriginal: Number(result[row.__index].valorFaturamentoOriginal ?? result[row.__index].valorFaturamento) || 0, previsaoFaturamentoFonte: 'TITULO_UNICO' };
      delete result[row.__index].__index;
    });
  });

  return result;
}

async function performFullSync(triggeredBy) {
  const startedAt = Date.now();
  const sheetsData = await batchReadSheets();

  for (const sheetName of REQUIRED_SHEETS) {
    if (!Array.isArray(sheetsData[sheetName]) || sheetsData[sheetName].length === 0) {
      throw new Error(`Sincronização interrompida: a aba obrigatória ${sheetName} está vazia ou indisponível.`);
    }
  }

  const rawEmpresas = sheetsData.EMPRESAS || [];

  const cadastroEmpresas = {};
  rawEmpresas.forEach((row) => {
    const sigla = String(row.Sigla || '').trim();
    const nome = String(row.Empresa || '').trim();
    if (sigla && nome) cadastroEmpresas[sigla] = nome;
  });

  const empresas = rawEmpresas
    .filter((row) => String(row.Empresa_Conta || '').trim())
    .map((row) => {
      const sigla = String(row.Empresa_Conta).trim();
      return {
        Empresa_Conta: sigla,
        Sigla: sigla,
        NomeAmigavel: cadastroEmpresas[sigla] || sigla,
        Banco: row.Banco || '',
        Conta: row.Conta || '',
        Data: row.Data || '',
        Saldo: parseBRL(row.Saldo),
      };
    });

  const projetos = (sheetsData.PROJETOS_2026 || [])
    .filter((p) => String(p.OBRA || '').trim())
    .map((proj) => ({
      ...proj,
      CONTRATO: parseBRL(proj.CONTRATO),
      'NF FATURADAS': parseBRL(proj['NF FATURADAS']),
      FATURADO_2026: parseBRL(proj.FATURADO_2026_COL_L),
      'SALDO CONTRATUAL': parseBRL(proj['SALDO CONTRATUAL']),
    }));

  const centrosCusto = sheetsData.CENTROS_CUSTO || [];
  const planos = sheetsData.PLANOS_FINANCEIROS || [];
  const cpGeralRaw = sheetsData.CP_GERAL || [];
  const crGeralRaw = sheetsData.CR_GERAL || [];
  const depara = sheetsData.DEPARA || [];

  const deparaMap = {};
  depara.forEach((row) => {
    const code = extractAccountCode(row.Conta);
    if (code) deparaMap[code] = row;
  });

  const planosMap = {};
  planos.forEach((row) => {
    const code = String(row.ID || '').replace(/\D/g, '') || extractAccountCode(row['PLANO FINANCEIRO']);
    if (code) planosMap[code] = row;
  });

  const cpProcessed = processSiengeData(cpGeralRaw, 'CP_GERAL', deparaMap, projetos, planosMap);
  const crBase = processSiengeData(crGeralRaw, 'CR_GERAL', deparaMap, projetos, planosMap).map((row) => ({
    ...row,
    valorCaixa: Number(row.valor) || 0,
    valorFaturamentoOriginal: Number(row.valorFaturamento) || 0,
    recebimentoLiquidoFonte: 'CR_GERAL_K_VALOR',
  }));
  // Regra global da receita prevista: J do titulo entra uma unica vez.
  // Quando existem 1010101 + 1010107, o titulo e distribuido 80/20.
  // Realizados nao passam por esta normalizacao: J ja vem rateado na origem.
  const crProcessed = normalizeForecastRevenueBilling(crBase);

  const stats = {
    EMPRESAS: empresas.length,
    PROJETOS_2026: projetos.length,
    CENTROS_CUSTO: centrosCusto.length,
    PLANOS_FINANCEIROS: planos.length,
    CP_GERAL: cpProcessed.length,
    CR_GERAL: crProcessed.length,
    DEPARA: depara.length,
  };

  const totalRecords = Object.values(stats).reduce((a, b) => a + b, 0);
  const allData = [...cpProcessed, ...crProcessed];
  allData.sort((a, b) => parseSortDate(b.data) - parseSortDate(a.data));

  const somaCP = cpProcessed.reduce((acc, row) => acc + (Number(row.valor) || 0), 0);
  const somaCRLiquido = crProcessed.reduce((acc, row) => acc + (Number(row.valorCaixa) || 0), 0);
  const somaCRFaturamento = crProcessed.reduce((acc, row) => acc + (Number(row.valorFaturamento) || 0), 0);
  const somaCRRealizado = crProcessed
    .filter(isRealizedEntry)
    .reduce((acc, row) => acc + (Number(row.valorCaixa) || 0), 0);
  const somaProjetosContrato = projetos.reduce((acc, row) => acc + row.CONTRATO, 0);
  const somaProjetosFaturado = projetos.reduce((acc, row) => acc + row['NF FATURADAS'], 0);
  const somaProjetosSaldo = projetos.reduce((acc, row) => acc + row['SALDO CONTRATUAL'], 0);

  const recebimentosLiquidosStats = {
    source: 'CR_GERAL_K_VALOR',
    sourceNet: Math.round(somaCRRealizado * 100) / 100,
    totalLiquid: Math.round(somaCRLiquido * 100) / 100,
    totalBilling: Math.round(somaCRFaturamento * 100) / 100,
    rule: 'REALIZADO:J_SOMA_RATEIO;PREVISAO:J_TITULO_UNICO_80_20;K=LIQUIDO_RECEBIDO',
  };

  const syncedAt = new Date().toISOString();
  const payload = {
    success: true,
    data: allData,
    stats,
    projetos,
    saldosBancarios: empresas,
    somaProjetosContrato,
    somaProjetosFaturado,
    somaProjetosSaldo,
    somaCRFaturamento,
    somaCRLiquido,
    somaCRRealizado,
    recebimentosLiquidosStats,
    cashLogicVersion: CASH_LOGIC_VERSION,
    recordsCount: totalRecords,
    syncedAt,
    message: 'Sincronização concluída com sucesso!',
  };

  await prisma.syncHistory.create({
    data: {
      triggeredBy,
      status: 'SUCCESS',
      recordsCount: totalRecords,
      details: JSON.stringify({
        ...stats,
        syncedAt,
        somaProjetosContrato,
        somaProjetosFaturado,
        somaProjetosSaldo,
        somaCRFaturamento,
        somaCRLiquido,
        somaCRRealizado,
        cashLogicVersion: CASH_LOGIC_VERSION,
      }),
    },
  }).catch((historyError) => {
    console.error('Falha ao gravar histórico de sincronização:', historyError?.message || historyError);
  });

  return payload;
}

export async function readCurrentSnapshot() {
  let snapshot = await prisma.financialSnapshot.findUnique({
    where: { id: SNAPSHOT_ID },
  });

  if (!snapshot) {
    const latestLegacySnapshot = await prisma.financialSnapshot.findFirst({
      orderBy: { updatedAt: 'desc' },
    });

    if (latestLegacySnapshot?.payload) {
      snapshot = await prisma.financialSnapshot.upsert({
        where: { id: SNAPSHOT_ID },
        update: {
          username: latestLegacySnapshot.username || 'MIGRADO',
          payload: latestLegacySnapshot.payload,
        },
        create: {
          id: SNAPSHOT_ID,
          username: latestLegacySnapshot.username || 'MIGRADO',
          payload: latestLegacySnapshot.payload,
        },
      });
    }
  }

  if (!snapshot?.payload) return null;

  return {
    payload: JSON.parse(snapshot.payload),
    updatedAt: snapshot.updatedAt,
    updatedBy: snapshot.username,
  };
}

export async function refreshFinancialSnapshot(triggeredBy) {
  if (globalThis.__oaeFinancialSyncPromise) {
    return globalThis.__oaeFinancialSyncPromise;
  }

  const syncPromise = (async () => {
    const payload = await performFullSync(triggeredBy);

    await prisma.financialSnapshot.upsert({
      where: { id: SNAPSHOT_ID },
      update: {
        username: triggeredBy,
        payload: JSON.stringify(payload),
      },
      create: {
        id: SNAPSHOT_ID,
        username: triggeredBy,
        payload: JSON.stringify(payload),
      },
    });

    return payload;
  })();

  globalThis.__oaeFinancialSyncPromise = syncPromise;

  try {
    return await syncPromise;
  } finally {
    if (globalThis.__oaeFinancialSyncPromise === syncPromise) {
      globalThis.__oaeFinancialSyncPromise = null;
    }
  }
}

export async function registerSyncError(triggeredBy, error) {
  const message = error?.response?.data?.error?.message || error?.message || 'Erro desconhecido';

  await prisma.syncHistory.create({
    data: {
      triggeredBy,
      status: 'ERROR',
      recordsCount: 0,
      errorMessage: message,
    },
  }).catch(() => {});
}
