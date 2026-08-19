import { NextResponse } from 'next/server';
import { batchReadSheets } from '@/lib/googleSheets';
import { processSiengeData, extractAccountCode, parseBRL } from '@/lib/businessRules';
import { PrismaClient } from '@prisma/client';
import { getSession } from '@/lib/auth';

const globalForPrisma = globalThis;
const prisma = globalForPrisma.__oaePrisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.__oaePrisma = prisma;

const globalSyncs = globalThis.__oaeSyncPromises || new Map();
globalThis.__oaeSyncPromises = globalSyncs;

function buildSessionKey(session, username) {
  return String(session?.sessionId || `${username}-${session?.iat || 'legacy'}`);
}

async function performFullSync(username) {
  const sheetsData = await batchReadSheets();
  const rawEmpresas = sheetsData.EMPRESAS || [];

  const cadastroEmpresas = {};
  rawEmpresas.forEach(row => {
    const sigla = String(row.Sigla || '').trim();
    const nome = String(row.Empresa || '').trim();
    if (sigla && nome) cadastroEmpresas[sigla] = nome;
  });

  const empresas = rawEmpresas
    .filter(row => String(row.Empresa_Conta || '').trim())
    .map(row => {
      const sigla = String(row.Empresa_Conta).trim();
      return {
        Empresa_Conta: sigla,
        Sigla: sigla,
        NomeAmigavel: cadastroEmpresas[sigla] || sigla,
        Banco: row.Banco || '',
        Conta: row.Conta || '',
        Data: row.Data || '',
        Saldo: parseBRL(row.Saldo)
      };
    });

  const projetos = (sheetsData.PROJETOS_2026 || [])
    .filter(p => String(p.OBRA || '').trim())
    .map(proj => ({
      ...proj,
      CONTRATO: parseBRL(proj.CONTRATO),
      'NF FATURADAS': parseBRL(proj['NF FATURADAS']),
      'SALDO CONTRATUAL': parseBRL(proj['SALDO CONTRATUAL'])
    }));

  const centrosCusto = sheetsData.CENTROS_CUSTO || [];
  const planos = sheetsData.PLANOS_FINANCEIROS || [];
  const cpGeralRaw = sheetsData.CP_GERAL || [];
  const crGeralRaw = sheetsData.CR_GERAL || [];
  const depara = sheetsData.DEPARA || [];

  const deparaMap = {};
  depara.forEach(row => {
    const code = extractAccountCode(row.Conta);
    if (code) deparaMap[code] = row;
  });

  const cpProcessed = processSiengeData(cpGeralRaw, 'CP_GERAL', deparaMap);
  const crProcessed = processSiengeData(crGeralRaw, 'CR_GERAL', deparaMap);

  const stats = {
    EMPRESAS: empresas.length,
    PROJETOS_2026: projetos.length,
    CENTROS_CUSTO: centrosCusto.length,
    PLANOS_FINANCEIROS: planos.length,
    CP_GERAL: cpProcessed.length,
    CR_GERAL: crProcessed.length,
    DEPARA: depara.length
  };

  const totalRecords = Object.values(stats).reduce((a, b) => a + b, 0);
  if (totalRecords === 0) {
    throw new Error('Sincronização falhou: Todas as abas retornaram 0 registros.');
  }

  const allData = [...cpProcessed, ...crProcessed];
  allData.sort((a, b) => {
    const parseDate = (d) => {
      if (!d) return 0;
      const [dia, mes, ano] = String(d).split('/');
      return new Date(`${ano}-${mes}-${dia}`).getTime();
    };
    return parseDate(b.data) - parseDate(a.data);
  });

  const somaCP = cpProcessed.reduce((acc, row) => acc + row.valor, 0);
  const somaCR = crProcessed.reduce((acc, row) => acc + row.valor, 0);
  const somaProjetosSaldo = projetos.reduce((acc, row) => acc + row['SALDO CONTRATUAL'], 0);

  console.log('--- Resumo Financeiro da Sincronização ---');
  console.log(`Quantidade de registros processados (CP + CR): ${allData.length}`);
  console.log(`Soma de CP_GERAL.Valor (Saídas): ${somaCP}`);
  console.log(`Soma de CR_GERAL.Valor (Entradas): ${somaCR}`);
  console.log(`Soma de PROJETOS_2026.SALDO CONTRATUAL: ${somaProjetosSaldo}`);
  console.log('------------------------------------------');

  await prisma.syncHistory.create({
    data: {
      triggeredBy: username,
      status: 'SUCCESS',
      recordsCount: totalRecords,
      details: JSON.stringify(stats)
    }
  });

  return {
    success: true,
    data: allData,
    stats,
    projetos,
    saldosBancarios: empresas,
    somaProjetosSaldo,
    recordsCount: totalRecords,
    syncedAt: new Date().toISOString(),
    message: 'Sincronização concluída com sucesso!'
  };
}

export async function GET(request) {
  const session = await getSession();
  if (!session?.user?.username) {
    return NextResponse.json({ error: 'Sessão não autenticada' }, { status: 401 });
  }

  const username = session.user.username;
  const sessionKey = buildSessionKey(session, username);
  const force = new URL(request.url).searchParams.get('force') === '1';

  try {
    if (!force) {
      const snapshot = await prisma.financialSnapshot.findUnique({ where: { id: sessionKey } });
      if (snapshot?.payload) {
        const payload = JSON.parse(snapshot.payload);
        return NextResponse.json({ ...payload, fromSnapshot: true, snapshotAt: snapshot.updatedAt });
      }
    }

    let syncPromise = globalSyncs.get(sessionKey);
    if (!syncPromise || force) {
      syncPromise = performFullSync(username);
      globalSyncs.set(sessionKey, syncPromise);
    }

    try {
      const payload = await syncPromise;
      await prisma.financialSnapshot.upsert({
        where: { id: sessionKey },
        update: { username, payload: JSON.stringify(payload) },
        create: { id: sessionKey, username, payload: JSON.stringify(payload) }
      });
      return NextResponse.json({ ...payload, fromSnapshot: false });
    } finally {
      if (globalSyncs.get(sessionKey) === syncPromise) globalSyncs.delete(sessionKey);
    }
  } catch (error) {
    const erroTecnico = {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      apiMessage: error.response?.data?.error?.message
    };

    console.error('Erro Técnico na Sincronização:', JSON.stringify(erroTecnico, null, 2));

    await prisma.syncHistory.create({
      data: {
        triggeredBy: username,
        status: 'ERROR',
        recordsCount: 0,
        errorMessage: erroTecnico.apiMessage || erroTecnico.message
      }
    }).catch(() => {});

    return NextResponse.json({
      error: 'Falha ao sincronizar com o Google Sheets',
      details: erroTecnico
    }, { status: 500 });
  }
}
