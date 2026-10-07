import { NextResponse } from 'next/server';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { batchReadSheets } from '@/lib/googleSheets';
import { processSiengeData, extractAccountCode, parseBRL } from '@/lib/businessRules';
import { buildDreRevenueItems, consolidateFinancialData } from '@/lib/consolidation';
import { getProjectKey, isProjectOngoing, isAdministrativeProject } from '@/lib/projectRules';

const GITHUB_ISSUER = 'https://token.actions.githubusercontent.com';
const GITHUB_JWKS = createRemoteJWKSet(
  new URL('https://token.actions.githubusercontent.com/.well-known/jwks')
);
const AUDIENCE = 'oae-fin-cr-audit';
const EXPECTED_REPOSITORY = 'financeiroOAE/oae-fin-v2';
const EXPECTED_WORKFLOW_REF =
  'financeiroOAE/oae-fin-v2/.github/workflows/audit-cr-geral.yml@refs/heads/main';
const TARGET_CODES = new Set(['1010101', '1010107']);
const CONFIRMED_HISTORICAL_PROJECT_KEYS = new Set(['438', '499', '443']);

async function verifyGitHubActionsToken(request) {
  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) throw new Error('Token OIDC ausente');

  const token = authHeader.slice('Bearer '.length).trim();
  const { payload } = await jwtVerify(token, GITHUB_JWKS, {
    issuer: GITHUB_ISSUER,
    audience: AUDIENCE,
    algorithms: ['RS256'],
  });

  if (payload.repository !== EXPECTED_REPOSITORY) throw new Error('Repositorio OIDC nao autorizado');
  if (payload.workflow_ref !== EXPECTED_WORKFLOW_REF) throw new Error('Workflow OIDC nao autorizado');
  const eventName = String(payload.event_name || '');
  if (!['push', 'schedule', 'workflow_dispatch'].includes(eventName)) throw new Error('Evento OIDC nao autorizado');
  return payload;
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function normalizeStatus(value) {
  return String(value || '').trim().toUpperCase() || '(VAZIO)';
}

function isRealizedStatus(value) {
  const status = normalizeStatus(value);
  return status.includes('REALIZADO')
    || status.includes('RECEBIDO')
    || status.includes('EFETIVADO')
    || status.includes('PAGO');
}

function parseDateTimestamp(value) {
  const raw = String(value || '').trim();
  let match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1])).getTime();
  match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime();
  const parsed = new Date(raw).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function isYtd2026(value) {
  const ts = parseDateTimestamp(value);
  const start = new Date(2026, 0, 1, 0, 0, 0, 0).getTime();
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
  return ts >= start && ts <= end;
}

function rawAccountSummary(rows, code) {
  const selected = rows.filter((row) => extractAccountCode(row.Conta) === code);
  const byStatus = {};
  let totalK = 0;
  let ytdK = 0;
  let realizedK = 0;
  let realizedYtdK = 0;

  selected.forEach((row) => {
    const value = parseBRL(row.Valor);
    const status = normalizeStatus(row.Status);
    const ytd = isYtd2026(row.Data);
    const realized = isRealizedStatus(row.Status);

    totalK += value;
    if (ytd) ytdK += value;
    if (realized) realizedK += value;
    if (realized && ytd) realizedYtdK += value;

    if (!byStatus[status]) byStatus[status] = { count: 0, totalK: 0, ytdK: 0 };
    byStatus[status].count += 1;
    byStatus[status].totalK += value;
    if (ytd) byStatus[status].ytdK += value;
  });

  Object.values(byStatus).forEach((item) => {
    item.totalK = roundMoney(item.totalK);
    item.ytdK = roundMoney(item.ytdK);
  });

  return {
    count: selected.length,
    totalK: roundMoney(totalK),
    ytdK: roundMoney(ytdK),
    realizedK: roundMoney(realizedK),
    realizedYtdK: roundMoney(realizedYtdK),
    byStatus,
  };
}

function buildProcessedCr(sheetsData) {
  const projetos = sheetsData.PROJETOS_2026 || [];
  const deparaMap = {};
  (sheetsData.DEPARA || []).forEach((row) => {
    const code = extractAccountCode(row.Conta);
    if (code) deparaMap[code] = row;
  });

  const planosMap = {};
  (sheetsData.PLANOS_FINANCEIROS || []).forEach((row) => {
    const code = String(row.ID || '').replace(/\D/g, '') || extractAccountCode(row['PLANO FINANCEIRO']);
    if (code) planosMap[code] = row;
  });

  const processed = processSiengeData(
    sheetsData.CR_GERAL || [],
    'CR_GERAL',
    deparaMap,
    projetos,
    planosMap
  ).map((row) => ({
    ...row,
    valorCaixa: Number(row.valor) || 0,
  }));

  return { projetos, processed };
}

function activeProjectIndex(projetos) {
  const map = new Map();
  (projetos || []).filter(isProjectOngoing).forEach((project) => {
    const key = getProjectKey(project.ID || project.OBRA);
    if (key) map.set(key, String(project.OBRA || '').trim());
  });
  return map;
}

function auditProjectBilling2026(projetos) {
  const rows = (projetos || []).filter((project) => String(project.OBRA || '').trim());
  const headerCandidates = rows[0]
    ? Object.keys(rows[0]).filter((key) => {
        const normalized = String(key || '')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toUpperCase();
        return normalized.includes('FATUR') && normalized.includes('2026');
      })
    : [];

  const byProjectKey = new Map();
  let totalColumnJ = 0;
  let totalHeaderDetected = 0;

  const details = rows.map((project) => {
    const obra = String(project.OBRA || '').trim();
    const key = getProjectKey(project.ID || obra);
    const columnJ = parseBRL(project.FATURADO_2026_COL_J);
    const headerDetected = parseBRL(project.FATURADO_2026_HEADER);

    totalColumnJ += columnJ;
    totalHeaderDetected += headerDetected;

    if (key) {
      if (!byProjectKey.has(key)) byProjectKey.set(key, []);
      byProjectKey.get(key).push({ obra, columnJ, headerDetected });
    }

    return {
      key,
      obra,
      empresa: String(project.EMPRESA || '').trim(),
      tipo: String(project.TIPO || '').trim(),
      columnJ: roundMoney(columnJ),
      headerDetected: roundMoney(headerDetected),
    };
  });

  const duplicates = [...byProjectKey.entries()]
    .filter(([, items]) => items.length > 1)
    .map(([key, items]) => ({
      key,
      count: items.length,
      totalColumnJ: roundMoney(items.reduce((sum, item) => sum + item.columnJ, 0)),
      rows: items,
    }));

  const suspicious = details
    .filter((item) => Math.abs(item.columnJ - item.headerDetected) > 0.01)
    .slice(0, 50);

  return {
    rowCount: rows.length,
    headers: rows[0] ? Object.keys(rows[0]) : [],
    headerCandidates,
    totalColumnJ: roundMoney(totalColumnJ),
    totalHeaderDetected: roundMoney(totalHeaderDetected),
    deltaColumnJVsHeader: roundMoney(totalColumnJ - totalHeaderDetected),
    duplicateProjectKeys: duplicates,
    mismatchedRows: suspicious,
    topColumnJ: [...details]
      .sort((a, b) => Math.abs(b.columnJ) - Math.abs(a.columnJ))
      .slice(0, 30),
  };
}

function summarizeAllocation(baseRows, activeProjects) {
  let allocated = 0;
  let historicalTotal = 0;
  let standaloneAdministrativeTotal = 0;
  let administrativeReviewTotal = 0;
  let unresolvedTotal = 0;
  const historical = [];
  const standaloneAdministrative = [];
  const administrativeReview = [];
  const missing = [];

  const serialize = (item, value) => ({
    data: item.data,
    status: item.status,
    lancamento: item.lancamento,
    projetoConsolidado: item.projeto,
    valor: roundMoney(value),
    valorDireto: roundMoney(item.valorDireto),
    valorAdministrativo: roundMoney(item.valorAdministrativo),
    linhas: (item.linhasOriginais || []).map((row) => ({
      contaCodigo: row.contaCodigo,
      valorK: roundMoney(row.valorCaixa ?? row.valor),
      projeto: row.projeto,
      projetoOriginal: row.projetoNomeOriginal,
      codigoCentroCusto: row.projetoCodigoOriginal,
      resolvidoPor: row.projetoResolvidoPor,
      documento: row.documento,
    })),
  });

  baseRows.forEach((item) => {
    if (String(item.natureza || '').toUpperCase() !== 'ENTRADA') return;
    if (!isRealizedStatus(item.status) || !isYtd2026(item.data)) return;

    const value = Number(item.valor) || 0;
    const key = getProjectKey(item.projeto);

    if (activeProjects.has(key)) {
      allocated += value;
      return;
    }

    if (CONFIRMED_HISTORICAL_PROJECT_KEYS.has(key)) {
      historicalTotal += value;
      historical.push({ ...serialize(item, value), classification: 'PROJETO_FINALIZADO' });
      return;
    }

    if (item.rateioAdministrativoFonte === 'ADMINISTRATIVO_AVULSO_100_PERCENT') {
      standaloneAdministrativeTotal += value;
      standaloneAdministrative.push({ ...serialize(item, value), classification: 'ADMINISTRATIVO_AVULSO_VALIDO' });
      return;
    }

    if (isAdministrativeProject(item.projeto)) {
      administrativeReviewTotal += value;
      administrativeReview.push({ ...serialize(item, value), classification: 'ADMINISTRATIVO_REVISAR' });
      return;
    }

    unresolvedTotal += value;
    missing.push({ ...serialize(item, value), classification: 'NAO_IDENTIFICADO' });
  });

  return {
    allocated: roundMoney(allocated),
    historicalTotal: roundMoney(historicalTotal),
    standaloneAdministrativeTotal: roundMoney(standaloneAdministrativeTotal),
    administrativeReviewTotal: roundMoney(administrativeReviewTotal),
    unresolvedTotal: roundMoney(unresolvedTotal),
    unallocated: roundMoney(historicalTotal + standaloneAdministrativeTotal + administrativeReviewTotal + unresolvedTotal),
    historical,
    standaloneAdministrative,
    administrativeReview,
    missing,
  };
}

function processedTargetBreakdown(processed, activeProjects) {
  const result = {};
  for (const code of TARGET_CODES) {
    const rows = processed.filter((item) => String(item.contaCodigo || '').replace(/\D/g, '') === code);
    let total = 0;
    let realizedYtd = 0;
    let activeProjectRealizedYtd = 0;
    let outsideActiveProjectRealizedYtd = 0;
    const byResolution = {};

    rows.forEach((item) => {
      const value = Number(item.valorCaixa ?? item.valor) || 0;
      const realizedYtdRow = isRealizedStatus(item.status) && isYtd2026(item.data);
      total += value;
      if (realizedYtdRow) {
        realizedYtd += value;
        const key = getProjectKey(item.projeto);
        if (activeProjects.has(key)) activeProjectRealizedYtd += value;
        else outsideActiveProjectRealizedYtd += value;
      }

      const resolution = String(item.projetoResolvidoPor || '(SEM RESOLUCAO)');
      if (!byResolution[resolution]) byResolution[resolution] = { count: 0, totalK: 0, realizedYtdK: 0 };
      byResolution[resolution].count += 1;
      byResolution[resolution].totalK += value;
      if (realizedYtdRow) byResolution[resolution].realizedYtdK += value;
    });

    Object.values(byResolution).forEach((item) => {
      item.totalK = roundMoney(item.totalK);
      item.realizedYtdK = roundMoney(item.realizedYtdK);
    });

    result[code] = {
      count: rows.length,
      totalK: roundMoney(total),
      realizedYtdK: roundMoney(realizedYtd),
      activeProjectRealizedYtdK: roundMoney(activeProjectRealizedYtd),
      outsideActiveProjectRealizedYtdK: roundMoney(outsideActiveProjectRealizedYtd),
      byResolution,
    };
  }
  return result;
}

export async function POST(request) {
  try {
    const oidc = await verifyGitHubActionsToken(request);
    const sheetsData = await batchReadSheets();
    const rawCr = sheetsData.CR_GERAL || [];
    const { projetos, processed } = buildProcessedCr(sheetsData);
    const activeProjects = activeProjectIndex(projetos);
    const projectBilling2026 = auditProjectBilling2026(projetos);

    const raw = {
      headers: rawCr[0] ? Object.keys(rawCr[0]) : [],
      rows: rawCr.length,
      '1010101': rawAccountSummary(rawCr, '1010101'),
      '1010107': rawAccountSummary(rawCr, '1010107'),
    };

    const baseSemAdm = consolidateFinancialData(processed, {
      isProjetosPage: true,
      incluirRateioAdm: false,
      usarValorCaixa: true,
    });
    const baseComAdm = consolidateFinancialData(processed, {
      isProjetosPage: true,
      incluirRateioAdm: true,
      usarValorCaixa: true,
    });

    const semAdm = summarizeAllocation(baseSemAdm, activeProjects);
    const comAdm = summarizeAllocation(baseComAdm, activeProjects);
    const processedBreakdown = processedTargetBreakdown(processed, activeProjects);

    const rawRealizedTotalYtd = roundMoney(
      raw['1010101'].realizedYtdK + raw['1010107'].realizedYtdK
    );
    const dreRuleRows = buildDreRevenueItems(processed)
      .filter((item) => isRealizedStatus(item.status) && isYtd2026(item.data));
    const expectedProject80 = roundMoney(
      dreRuleRows
        .filter((item) => String(item.contaCodigo || '').replace(/\D/g, '') === '1010101')
        .reduce((sum, item) => sum + (Number(item.valorCaixa ?? item.valor) || 0), 0)
    );
    const expectedAdmin20 = roundMoney(
      dreRuleRows
        .filter((item) => String(item.contaCodigo || '').replace(/\D/g, '') === '1010107')
        .reduce((sum, item) => sum + (Number(item.valorCaixa ?? item.valor) || 0), 0)
    );
    const standaloneSourceProjectValue = roundMoney(
      dreRuleRows
        .filter((item) => item.rateioAdministrativoFonte === 'ADMINISTRATIVO_AVULSO_100_PERCENT')
        .reduce((sum, item) => sum + (item.linhasOriginais || [])
          .filter((row) => String(row.contaCodigo || '').replace(/\D/g, '') === '1010101')
          .reduce((rowSum, row) => rowSum + (Number(row.valorCaixa ?? row.valor) || 0), 0), 0)
    );
    const adjustedSourceProject = roundMoney(raw['1010101'].realizedYtdK - standaloneSourceProjectValue);
    const adjustedSourceAdmin = roundMoney(raw['1010107'].realizedYtdK + standaloneSourceProjectValue);
    const semAdmConserved = roundMoney(semAdm.allocated + semAdm.unallocated);
    const comAdmConserved = roundMoney(comAdm.allocated + comAdm.unallocated);
    const derivedAdminConserved = roundMoney(comAdmConserved - semAdmConserved);

    return NextResponse.json({
      success: true,
      generatedAt: new Date().toISOString(),
      githubRunId: oidc.run_id || null,
      raw,
      projectBilling2026,
      processed: processedBreakdown,
      panelSimulation: {
        semAdm,
        comAdm,
        sourceAccountRealizedYtd: {
          projetos1010101: raw['1010101'].realizedYtdK,
          adm1010107: raw['1010107'].realizedYtdK,
          total: rawRealizedTotalYtd,
        },
        expectedFromBusinessRule: {
          projeto: expectedProject80,
          administrativo: expectedAdmin20,
          total: roundMoney(expectedProject80 + expectedAdmin20),
          rule: '80/20 para receitas de projeto + 100% ADM para receitas avulsas administrativas',
        },
        rawSourceAccountDelta: {
          projetoVsRegra: roundMoney(raw['1010101'].realizedYtdK - expectedProject80),
          administrativoVsRegra: roundMoney(raw['1010107'].realizedYtdK - expectedAdmin20),
        },
        businessClassifiedSource: {
          projeto: adjustedSourceProject,
          administrativo: adjustedSourceAdmin,
          standaloneAdministrativeMovedFrom1010101: standaloneSourceProjectValue,
        },
        sourceAccountDelta: {
          projetoVs80: roundMoney(adjustedSourceProject - expectedProject80),
          administrativoVs20: roundMoney(adjustedSourceAdmin - expectedAdmin20),
        },
        delta: {
          semAdm: roundMoney(expectedProject80 - semAdmConserved),
          adm: roundMoney(expectedAdmin20 - derivedAdminConserved),
          comAdm: roundMoney(rawRealizedTotalYtd - comAdmConserved),
        },
      },
    });
  } catch (error) {
    const message = String(error?.message || 'Erro desconhecido');
    const isAuthError = /OIDC|Token|Repositorio|Workflow|Evento/.test(message);
    return NextResponse.json(
      { error: isAuthError ? 'Auditoria nao autorizada' : 'Falha na auditoria', details: isAuthError ? undefined : message },
      { status: isAuthError ? 401 : 500 }
    );
  }
}

// Trigger de auditoria: leitura agregada somente, sem alterar a planilha.
