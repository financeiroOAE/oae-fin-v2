import { PrismaClient } from '@prisma/client';
import { batchReadSheets } from '@/lib/googleSheets';
import { processSiengeData, extractAccountCode, parseBRL } from '@/lib/businessRules';

const globalForPrisma = globalThis;
export const prisma = globalForPrisma.__oaePrisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.__oaePrisma = prisma;

const SNAPSHOT_ID = 'current';
const REQUIRED_SHEETS = ['EMPRESAS', 'PROJETOS_2026', 'CENTROS_CUSTO', 'PLANOS_FINANCEIROS', 'CP_GERAL', 'CR_GERAL', 'DEPARA'];
const CASH_LOGIC_VERSION = 4;

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
  const crProcessed = processSiengeData(crGeralRaw, 'CR_GERAL', deparaMap, projetos, planosMap).map((row) => ({
    ...row,
    // Regra oficial: CR_GERAL coluna K (Valor) é o líquido efetivamente recebido.
    valorCaixa: Number(row.valor) || 0,
    recebimentoLiquidoFonte: 'CR_GERAL_K_VALOR',
  }));

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
    rule: 'J=FATURAMENTO;K=LIQUIDO_RECEBIDO',
  };

  console.log('--- Resumo Financeiro da Sincronização ---');
  console.log(`Disparado por: ${triggeredBy}`);
  console.log(`Quantidade de registros processados (CP + CR): ${allData.length}`);
  console.log(`Soma de CP_GERAL.Valor (Saídas): ${somaCP}`);
  console.log(`Soma de CR_GERAL coluna J / Valor total título (Faturamento): ${somaCRFaturamento}`);
  console.log(`Soma de CR_GERAL coluna K / Valor (Líquido): ${somaCRLiquido}`);
  console.log(`Soma recebida realizada pela coluna K: ${somaCRRealizado}`);
  console.log(`Soma de PROJETOS_2026.CONTRATO: ${somaProjetosContrato}`);
  console.log(`Soma de PROJETOS_2026.NF FATURADAS: ${somaProjetosFaturado}`);
  console.log(`Soma de PROJETOS_2026.SALDO_CONTRATUAL: ${somaProjetosSaldo}`);
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
