import { prisma } from '@/lib/prisma';
import { batchReadSheets } from '@/lib/googleSheets';
import { processSiengeData, extractAccountCode, parseBRL } from '@/lib/businessRules';

const SNAPSHOT_ID = 'current';
const REQUIRED_SHEETS = ['EMPRESAS', 'PROJETOS_2026', 'CENTROS_CUSTO', 'PLANOS_FINANCEIROS', 'CP_GERAL', 'CR_GERAL', 'DEPARA', 'EQUIPE'];
const REFERENCE_RANGES = [
  'EMPRESAS!A:J',
  'PROJETOS_2026!A:Z',
  'CENTROS_CUSTO!A:E',
  'PLANOS_FINANCEIROS!A:E',
  'DEPARA!A:F',
  'EQUIPE!A:T',
];
const CASH_LOGIC_VERSION = 10;

function memorySnapshot(stage) {
  const usage = process.memoryUsage();
  const mb = (value) => Math.round((value / 1024 / 1024) * 10) / 10;
  console.log('[financial-sync] memória', {
    stage,
    rssMB: mb(usage.rss),
    heapUsedMB: mb(usage.heapUsed),
    heapTotalMB: mb(usage.heapTotal),
    externalMB: mb(usage.external),
  });
}

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
  for (const row of rows || []) {
    if (!isForecastRevenueEntry(row)) continue;

    // Regra oficial: A RECEBER / A REALIZAR / PREVISTO usa sempre a coluna K.
    // A atualização é feita no próprio registro para evitar duplicar o CR_GERAL
    // inteiro na memória durante a sincronização.
    const forecastValue = Number(row.valorCaixa ?? row.valor) || 0;
    row.valorFaturamentoOriginal = Number(row.valorFaturamentoOriginal ?? row.valorFaturamento) || 0;
    row.valorFaturamento = forecastValue;
    row.valorTotalTitulo = forecastValue;
    row.valorBruto = forecastValue;
    row.previsaoFaturamentoFonte = 'CR_GERAL_K_VALOR';
  }
  return rows || [];
}

function normalizeTeamRoster(rows) {
  const seen = new Set();
  return (rows || []).map((row, index) => {
    const person = String(row.PESSOA || '').trim();
    if (!person) return null;
    const departmentProject = String(row['DEPARTAMENTO/OBRA'] || '').trim();
    const role = String(row.CARGO || '').trim();
    const account = String(row['PLANO/CONTA'] || '').trim();
    const contractValue = parseBRL(row['VALOR CT']);
    const accountCode = extractAccountCode(account) || '';
    const key = [person, departmentProject, role, account, contractValue].join('|').toUpperCase();
    if (seen.has(key)) return null;
    seen.add(key);
    return {
      row: index + 2,
      person,
      departmentProject,
      role,
      contractValue,
      fixedMonthly: contractValue === 0,
      account,
      accountCode,
      thirdParty: role.toUpperCase() === 'TERCEIRO',
    };
  }).filter(Boolean);
}

async function performFullSync(triggeredBy) {
  const startedAt = Date.now();
  console.log('[financial-sync] início', { triggeredBy });

  // As duas bases transacionais são grandes. Ler referências, CP e CR em
  // etapas evita manter todos os arrays brutos simultaneamente na memória do Render.
  const referenceData = await batchReadSheets(REFERENCE_RANGES);
  for (const sheetName of REQUIRED_SHEETS.filter((name) => name !== 'CP_GERAL' && name !== 'CR_GERAL')) {
    if (!Array.isArray(referenceData[sheetName]) || referenceData[sheetName].length === 0) {
      throw new Error(`Sincronização interrompida: a aba obrigatória ${sheetName} está vazia ou indisponível.`);
    }
  }
  console.log('[financial-sync] referências carregadas');
  memorySnapshot('referencias-carregadas');

  const rawEmpresas = referenceData.EMPRESAS || [];

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

  const projetos = (referenceData.PROJETOS_2026 || [])
    .filter((p) => String(p.OBRA || '').trim())
    .map((proj) => ({
      ...proj,
      CONTRATO: parseBRL(proj.CONTRATO),
      'NF FATURADAS': parseBRL(proj['NF FATURADAS']),
      FATURADO_2026: parseBRL(
        proj.FATURADO_2026_COL_L
        ?? proj.FATURADO_2026
        ?? proj['FATURADO 2026']
        ?? proj['FATURADO EM 2026']
        ?? proj['NF FATURADAS 2026']
        ?? proj['NF FATURADO 2026']
        ?? 0
      ),
      'SALDO CONTRATUAL': parseBRL(proj['SALDO CONTRATUAL']),
    }));

  const centrosCusto = referenceData.CENTROS_CUSTO || [];
  const planos = referenceData.PLANOS_FINANCEIROS || [];
  const depara = referenceData.DEPARA || [];
  const equipe = normalizeTeamRoster(referenceData.EQUIPE || []);

  // Libera referências que já foram convertidas para estruturas menores.
  // Não apaga nenhum dado persistido; apenas remove referências temporárias da RAM.
  referenceData.EMPRESAS = null;
  referenceData.PROJETOS_2026 = null;
  referenceData.EQUIPE = null;

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
  referenceData.CENTROS_CUSTO = null;
  referenceData.PLANOS_FINANCEIROS = null;
  referenceData.DEPARA = null;
  memorySnapshot('referencias-normalizadas');

  let transactionData = await batchReadSheets(['CP_GERAL!A:L']);
  let cpGeralRaw = transactionData.CP_GERAL || [];
  if (cpGeralRaw.length === 0) {
    throw new Error('Sincronização interrompida: a aba obrigatória CP_GERAL está vazia ou indisponível.');
  }
  let cpProcessed = processSiengeData(cpGeralRaw, 'CP_GERAL', deparaMap, projetos, planosMap);
  console.log('[financial-sync] CP processado', { records: cpProcessed.length });
  cpGeralRaw = null;
  transactionData = null;
  memorySnapshot('cp-processado');

  transactionData = await batchReadSheets(['CR_GERAL!A:N']);
  let crGeralRaw = transactionData.CR_GERAL || [];
  if (crGeralRaw.length === 0) {
    throw new Error('Sincronização interrompida: a aba obrigatória CR_GERAL está vazia ou indisponível.');
  }
  let crProcessed = processSiengeData(crGeralRaw, 'CR_GERAL', deparaMap, projetos, planosMap);
  for (const row of crProcessed) {
    row.valorCaixa = Number(row.valor) || 0;
    row.valorFaturamentoOriginal = Number(row.valorFaturamento) || 0;
    row.recebimentoLiquidoFonte = 'CR_GERAL_K_VALOR';
  }
  crGeralRaw = null;
  transactionData = null;
  // Regra global da receita prevista: A RECEBER / A REALIZAR / PREVISTO usa K.
  // J fica preservado somente em valorFaturamentoOriginal para auditoria.
  normalizeForecastRevenueBilling(crProcessed);
  console.log('[financial-sync] CR processado', { records: crProcessed.length });
  memorySnapshot('cr-processado');

  const stats = {
    EMPRESAS: empresas.length,
    PROJETOS_2026: projetos.length,
    CENTROS_CUSTO: centrosCusto.length,
    PLANOS_FINANCEIROS: planos.length,
    CP_GERAL: cpProcessed.length,
    CR_GERAL: crProcessed.length,
    DEPARA: depara.length,
    EQUIPE: equipe.length,
  };

  const totalRecords = Object.values(stats).reduce((a, b) => a + b, 0);
  const allData = cpProcessed.concat(crProcessed);
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
    rule: 'REALIZADO:J_FATURAMENTO_K_CAIXA;PREVISAO:K_VALOR;A_RECEBER:K_VALOR',
  };

  const syncedAt = new Date().toISOString();
  const payload = {
    success: true,
    data: allData,
    stats,
    projetos,
    equipe,
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

  // As referências separadas deixam de ser necessárias depois que o payload final
  // passa a apontar para os mesmos objetos. Isso reduz retenção temporária de arrays.
  cpProcessed = null;
  crProcessed = null;
  memorySnapshot('payload-pronto');

  console.log('[financial-sync] processamento concluído', {
    recordsCount: totalRecords,
    durationMs: Date.now() - startedAt,
  });
  return payload;
}

export async function readCurrentSnapshotRecord() {
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

  return snapshot;
}

export async function readCurrentSnapshotMetadata() {
  return prisma.financialSnapshot.findUnique({
    where: { id: SNAPSHOT_ID },
    select: {
      username: true,
      updatedAt: true,
    },
  });
}

export async function readCurrentSnapshot() {
  const snapshot = await readCurrentSnapshotRecord();
  if (!snapshot) return null;

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
    memorySnapshot('antes-serializacao');
    const serializedPayload = JSON.stringify(payload);
    memorySnapshot('depois-serializacao');

    await prisma.financialSnapshot.upsert({
      where: { id: SNAPSHOT_ID },
      update: {
        username: triggeredBy,
        payload: serializedPayload,
      },
      create: {
        id: SNAPSHOT_ID,
        username: triggeredBy,
        payload: serializedPayload,
      },
    });

    memorySnapshot('snapshot-gravado');

    // O histórico só pode indicar sucesso depois que a nova base estiver gravada.
    await prisma.syncHistory.create({
      data: {
        triggeredBy,
        status: 'SUCCESS',
        recordsCount: payload.recordsCount,
        details: JSON.stringify({
          ...payload.stats,
          syncedAt: payload.syncedAt,
          somaProjetosContrato: payload.somaProjetosContrato,
          somaProjetosFaturado: payload.somaProjetosFaturado,
          somaProjetosSaldo: payload.somaProjetosSaldo,
          somaCRFaturamento: payload.somaCRFaturamento,
          somaCRLiquido: payload.somaCRLiquido,
          somaCRRealizado: payload.somaCRRealizado,
          cashLogicVersion: payload.cashLogicVersion,
        }),
      },
    }).catch((historyError) => {
      console.error('Falha ao gravar histórico de sincronização:', historyError?.message || historyError);
    });

    return {
      ok: true,
      syncedAt: payload.syncedAt,
      recordsCount: payload.recordsCount,
      stats: payload.stats,
    };
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
