import { PrismaClient } from '@prisma/client';
import { batchReadSheets } from '@/lib/googleSheets';
import { processSiengeData, extractAccountCode, parseBRL } from '@/lib/businessRules';

const globalForPrisma = globalThis;
export const prisma = globalForPrisma.__oaePrisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.__oaePrisma = prisma;

const SNAPSHOT_ID = 'current';
const REQUIRED_SHEETS = ['EMPRESAS', 'PROJETOS_2026', 'CENTROS_CUSTO', 'PLANOS_FINANCEIROS', 'CP_GERAL', 'CR_GERAL', 'DEPARA', 'RECEBIMENTOS_2026'];
const CASH_LOGIC_VERSION = 2;

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

function normalizeReceiptTitle(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const direct = raw.match(/^(\d+)(?:\/\d+)?$/);
  if (direct) return direct[1];
  const leading = raw.match(/^(\d+)/);
  return leading?.[1] || '';
}

function normalizeReceiptDocument(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function parseReceiptValue(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const raw = String(value ?? '').trim();
  if (!raw) return 0;
  const cleaned = raw.replace(/R\$/gi, '').replace(/\s/g, '');
  if (cleaned.includes(',')) {
    const parsed = Number(cleaned.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isRealized2026Entry(row) {
  if (String(row?.natureza || '').toUpperCase() !== 'ENTRADA') return false;
  if (!String(row?.status || '').toUpperCase().includes('REALIZADO')) return false;
  const date = String(row?.data || '').trim();
  return /(?:^|\/)2026$/.test(date);
}

function enrichCashReceived(crRows, receiptRows) {
  const receipts = [];
  const byTitle = new Map();
  const byDocument = new Map();

  (receiptRows || []).forEach((row, index) => {
    const title = normalizeReceiptTitle(row['Título'] ?? row.Titulo);
    const document = normalizeReceiptDocument(row.Documento);
    const gross = parseReceiptValue(row['Vl. baixa'] ?? row['Vl, baixa']);
    const discount = parseReceiptValue(row.Desconto);
    const rawNet = parseReceiptValue(row['Vl Recebido']);
    // Um recebimento positivo não pode produzir crédito líquido negativo.
    // Quando a célula da fonte estiver corrompida, recompõe o líquido pela
    // baixa menos o desconto. Valores positivos divergentes são preservados,
    // pois podem representar compensações ou ajustes bancários válidos.
    const invalidNegativeNet = gross >= 0 && rawNet < 0;
    const net = invalidNegativeNet
      ? Math.round((gross - discount) * 100) / 100
      : rawNet;
    if (!title && !document) return;
    const receipt = {
      id: title ? `T:${title}` : `D:${document}:${index}`,
      title,
      document,
      net,
      gross,
      discount,
      correctedInvalidNet: invalidNegativeNet,
    };
    receipts.push(receipt);
    if (title) byTitle.set(title, receipt);
    if (document) byDocument.set(document, receipt);
  });

  const groups = new Map();
  crRows.forEach((row) => {
    if (!isRealized2026Entry(row)) return;
    const title = normalizeReceiptTitle(row.lancamento);
    const document = normalizeReceiptDocument(row.documento);
    const receipt = (title && byTitle.get(title)) || (document && byDocument.get(document));
    if (!receipt) return;
    if (!groups.has(receipt.id)) groups.set(receipt.id, { receipt, rows: [] });
    groups.get(receipt.id).rows.push(row);
  });

  const cashByRow = new Map();
  let matchedNet = 0;
  let matchedGross = 0;
  let matchedRows = 0;

  groups.forEach(({ receipt, rows }) => {
    const totalGroup = rows.reduce((sum, row) => sum + Math.max(0, Number(row.valor) || 0), 0);
    if (totalGroup <= 0) return;
    let remaining = Math.round(receipt.net * 100) / 100;
    rows.forEach((row, index) => {
      let allocated;
      if (index === rows.length - 1) {
        allocated = remaining;
      } else {
        allocated = Math.round((receipt.net * ((Number(row.valor) || 0) / totalGroup)) * 100) / 100;
        remaining = Math.round((remaining - allocated) * 100) / 100;
      }
      cashByRow.set(row, allocated);
      matchedRows += 1;
    });
    matchedNet += receipt.net;
    matchedGross += receipt.gross;
  });

  let unmatchedRealizedRows = 0;
  const rows = crRows.map((row) => {
    const gross = Number(row.valor) || 0;
    const matched = cashByRow.has(row);
    const requiresLiquidValue = isRealized2026Entry(row);
    if (requiresLiquidValue && !matched) unmatchedRealizedRows += 1;
    return {
      ...row,
      valorBruto: gross,
      // Entradas realizadas de 2026 só contam como caixa quando conciliadas
      // com a relação de valores efetivamente creditados. Nunca tratamos o
      // valor bruto do CR_GERAL como se fosse líquido.
      valorCaixa: matched ? cashByRow.get(row) : (requiresLiquidValue ? 0 : gross),
      recebimentoLiquidoFonte: matched
        ? 'RECEBIMENTOS_2026'
        : (requiresLiquidValue ? 'NAO_CONCILIADO' : 'CR_GERAL'),
    };
  });

  return {
    rows,
    stats: {
      sourceTitles: receipts.length,
      matchedTitles: groups.size,
      matchedRows,
      matchedGross: Math.round(matchedGross * 100) / 100,
      matchedNet: Math.round(matchedNet * 100) / 100,
      sourceNet: Math.round(receipts.reduce((sum, item) => sum + item.net, 0) * 100) / 100,
      sourceDiscount: Math.round(receipts.reduce((sum, item) => sum + item.discount, 0) * 100) / 100,
      correctedInvalidNet: receipts.filter((item) => item.correctedInvalidNet).length,
      unmatchedRealizedRows,
    },
  };
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
      'SALDO CONTRATUAL': parseBRL(proj['SALDO CONTRATUAL']),
    }));

  const centrosCusto = sheetsData.CENTROS_CUSTO || [];
  const planos = sheetsData.PLANOS_FINANCEIROS || [];
  const cpGeralRaw = sheetsData.CP_GERAL || [];
  const crGeralRaw = sheetsData.CR_GERAL || [];
  const recebimentosRaw = sheetsData.RECEBIMENTOS_2026 || [];
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

  // O catálogo oficial é usado tanto no CP quanto no CR para padronizar o nome da obra.
  // PLANOS_FINANCEIROS acompanha cada lançamento para auditoria das pendências da DRE.
  const cpProcessed = processSiengeData(cpGeralRaw, 'CP_GERAL', deparaMap, projetos, planosMap);
  const crProcessedBase = processSiengeData(crGeralRaw, 'CR_GERAL', deparaMap, projetos, planosMap);
  const { rows: crProcessed, stats: recebimentosLiquidosStats } = enrichCashReceived(crProcessedBase, recebimentosRaw);

  const stats = {
    EMPRESAS: empresas.length,
    PROJETOS_2026: projetos.length,
    CENTROS_CUSTO: centrosCusto.length,
    PLANOS_FINANCEIROS: planos.length,
    CP_GERAL: cpProcessed.length,
    CR_GERAL: crProcessed.length,
    DEPARA: depara.length,
    RECEBIMENTOS_2026: recebimentosRaw.length,
  };

  const totalRecords = Object.values(stats).reduce((a, b) => a + b, 0);
  const allData = [...cpProcessed, ...crProcessed];
  allData.sort((a, b) => parseSortDate(b.data) - parseSortDate(a.data));

  const somaCP = cpProcessed.reduce((acc, row) => acc + row.valor, 0);
  const somaCR = crProcessed.reduce((acc, row) => acc + row.valor, 0);
  const somaCRCaixa = crProcessed.reduce((acc, row) => acc + (Number(row.valorCaixa) || 0), 0);
  const somaProjetosContrato = projetos.reduce((acc, row) => acc + row.CONTRATO, 0);
  const somaProjetosFaturado = projetos.reduce((acc, row) => acc + row['NF FATURADAS'], 0);
  const somaProjetosSaldo = projetos.reduce((acc, row) => acc + row['SALDO CONTRATUAL'], 0);

  console.log('--- Resumo Financeiro da Sincronização ---');
  console.log(`Disparado por: ${triggeredBy}`);
  console.log(`Quantidade de registros processados (CP + CR): ${allData.length}`);
  console.log(`Soma de CP_GERAL.Valor (Saídas): ${somaCP}`);
  console.log(`Soma de CR_GERAL.Valor (Entradas brutas): ${somaCR}`);
  console.log(`Soma de CR_GERAL.valorCaixa (Entradas liquidas/fallback): ${somaCRCaixa}`);
  console.log(`Recebimentos liquidos conciliados: ${JSON.stringify(recebimentosLiquidosStats)}`);
  console.log(`Soma de PROJETOS_2026.CONTRATO: ${somaProjetosContrato}`);
  console.log(`Soma de PROJETOS_2026.NF FATURADAS: ${somaProjetosFaturado}`);
  console.log(`Soma de PROJETOS_2026.SALDO CONTRATUAL: ${somaProjetosSaldo}`);
  console.log(`Tempo de processamento: ${Date.now() - startedAt}ms`);
  console.log('------------------------------------------');

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
      details: JSON.stringify({ ...stats, syncedAt, somaProjetosContrato, somaProjetosFaturado, somaProjetosSaldo }),
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
