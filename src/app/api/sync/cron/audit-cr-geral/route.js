import { NextResponse } from 'next/server';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { batchReadSheets } from '@/lib/googleSheets';
import { processSiengeData, extractAccountCode, parseBRL } from '@/lib/businessRules';
import { consolidateFinancialData } from '@/lib/consolidation';
import { getProjectKey, isProjectOngoing } from '@/lib/projectRules';

const GITHUB_ISSUER = 'https://token.actions.githubusercontent.com';
const GITHUB_JWKS = createRemoteJWKSet(
  new URL('https://token.actions.githubusercontent.com/.well-known/jwks')
);
const AUDIENCE = 'oae-fin-cr-audit';
const EXPECTED_REPOSITORY = 'financeiroOAE/oae-fin-v2';
const EXPECTED_WORKFLOW_REF =
  'financeiroOAE/oae-fin-v2/.github/workflows/audit-cr-geral.yml@refs/heads/main';
const TARGET_CODES = new Set(['1010101', '1010107']);

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
  if (String(payload.event_name || '') !== 'push') throw new Error('Evento OIDC nao autorizado');
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

function summarizeAllocation(baseRows, activeProjects) {
  let allocated = 0;
  let unallocated = 0;
  const missing = [];

  baseRows.forEach((item) => {
    if (String(item.natureza || '').toUpperCase() !== 'ENTRADA') return;
    if (!isRealizedStatus(item.status) || !isYtd2026(item.data)) return;

    const value = Number(item.valor) || 0;
    const key = getProjectKey(item.projeto);
    if (activeProjects.has(key)) {
      allocated += value;
      return;
    }

    unallocated += value;
    missing.push({
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
  });

  return {
    allocated: roundMoney(allocated),
    unallocated: roundMoney(unallocated),
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

    return NextResponse.json({
      success: true,
      generatedAt: new Date().toISOString(),
      githubRunId: oidc.run_id || null,
      raw,
      processed: processedBreakdown,
      panelSimulation: {
        semAdm,
        comAdm,
        expectedFromRawRealizedYtd: {
          projetos1010101: raw['1010101'].realizedYtdK,
          adm1010107: raw['1010107'].realizedYtdK,
          comAdm: roundMoney(raw['1010101'].realizedYtdK + raw['1010107'].realizedYtdK),
        },
        delta: {
          semAdm: roundMoney(raw['1010101'].realizedYtdK - semAdm.allocated),
          adm: roundMoney(raw['1010107'].realizedYtdK - (comAdm.allocated - semAdm.allocated)),
          comAdm: roundMoney(
            raw['1010101'].realizedYtdK + raw['1010107'].realizedYtdK - comAdm.allocated
          ),
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
