import { createHash } from 'node:crypto';
import { isRealizedFinancialStatus, isForecastFinancialStatus, isTeamExpense, normalizeAccountCode } from '@/lib/financialClassification';

const norm = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase().replace(/\s+/g, ' ');
const amount = (value) => Number(value) || 0;

export function monthOf(value) {
  const raw = String(value || '').trim();
  let match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) return `${match[1]}-${match[2].padStart(2, '0')}`;
  match = raw.match(/^\d{1,2}\/(\d{1,2})\/(\d{4})/);
  return match ? `${match[2]}-${match[1].padStart(2, '0')}` : null;
}

export function cpRows(snapshot) {
  const occurrences = new Map();
  return (snapshot?.payload?.data || []).filter((row) => row.natureza === 'Saída').map((row) => {
    // Status and payment date can change after settlement. The business title stays linked.
    const identity = [row.documento, row.titulo, row.nome, row.contaCodigo, row.projeto, row.valorTotalTitulo || row.valor]
      .map(norm).join('|');
    const ordinal = occurrences.get(identity) || 0;
    occurrences.set(identity, ordinal + 1);
    const sourceKey = createHash('sha256').update(`CP|${identity}|${ordinal}`).digest('hex');
    return {
      sourceKey,
      data: row.data,
      documento: row.documento,
      titulo: row.titulo,
      lancamento: row.lancamento,
      natureza: row.natureza || 'Saída',
      nome: row.nome,
      projeto: row.projeto,
      contaCodigo: row.contaCodigo,
      contaNome: row.contaNome,
      contaDescricao: row.contaDescricao,
      valor: amount(row.valor),
      valorTotalTitulo: amount(row.valorTotalTitulo),
      status: row.status,
      paid: isRealizedFinancialStatus(row),
      teamAccount: isTeamExpense(row),
    };
  });
}

export function revenueTitles(snapshot) {
  const groups = new Map();
  const projectsByCode = new Map((snapshot?.payload?.projetos || []).map((project) => [norm(project.ID), String(project.OBRA || '').trim()]));

  (snapshot?.payload?.data || []).forEach((row, index) => {
    if (row.natureza !== 'Entrada' || !['1010101', '1010107'].includes(normalizeAccountCode(row))) return;

    const forecast = !isRealizedFinancialStatus(row) && isForecastFinancialStatus(row);
    const realized = isRealizedFinancialStatus(row);
    if (!forecast && !realized) return;

    const dateValue = realized ? (row.dataEmissao || row.data) : row.data;
    const month = monthOf(dateValue);
    if (!month) return;

    const reference = norm(row.lancamento) || 'SEM_LANCAMENTO';
    const documentKey = norm(row.documento) || reference || `ROW-${index}`;
    const dateKey = norm(dateValue);
    const stateKey = realized ? 'REALIZADO' : 'PREVISTO';
    const key = [month, reference, documentKey, dateKey, stateKey].join('|');

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        month,
        document: row.documento || row.lancamento || '',
        forecast,
        realized,
        value: 0,
        projectValue: 0,
        adminValue: 0,
        grossValue: 0,
        projectRows: 0,
        adminRows: 0,
        projectCandidates: new Set(),
        dateSource: row.dataEmissao ? 'EMISSAO' : 'DATA',
      });
    }

    const item = groups.get(key);
    const project = projectsByCode.get(norm(row.projetoCodigoValidado)) || String(row.projeto || '').trim();
    if (project && !['ADMINISTRACAO', 'PROJETOS', 'GRUPO OAE', 'SEM PROJETO'].includes(norm(project))) {
      item.projectCandidates.add(project);
    }

    const code = normalizeAccountCode(row);
    const cashValue = amount(row.valorCaixa ?? row.valor);
    item.value += cashValue;

    if (code === '1010101') {
      item.projectValue += cashValue;
      item.projectRows += 1;
    }
    if (code === '1010107') {
      item.adminValue += cashValue;
      item.adminRows += 1;
    }

    const grossValue = amount(row.valorFaturamento ?? row.valorTotalTitulo ?? row.valorBruto);
    if (Math.abs(grossValue) > Math.abs(item.grossValue)) item.grossValue = grossValue;
    if (row.dataEmissao) item.dateSource = 'EMISSAO';
  });

  return [...groups.values()].map((item) => {
    const totalValue = Math.round(item.value * 100) / 100;
    const expectedAdminValue = Math.round(totalValue * 0.20 * 100) / 100;
    const actualAdminValue = Math.round(item.adminValue * 100) / 100;
    const adminValue = item.adminRows > 0 ? actualAdminValue : expectedAdminValue;
    const adminValueDelta = Math.round((adminValue - expectedAdminValue) * 100) / 100;

    return {
      key: item.key,
      month: item.month,
      document: item.document,
      forecast: item.forecast,
      realized: item.realized,
      value: totalValue,
      projectValue: Math.round(item.projectValue * 100) / 100,
      adminValue,
      adminValueExpected: expectedAdminValue,
      adminValueDelta,
      adminValueSource: item.adminRows > 0 ? 'CR_GERAL_1010107_COLUNA_K' : 'SISTEMA_20_PERCENT_FALLBACK',
      grossValue: Math.round(item.grossValue * 100) / 100,
      project: item.projectCandidates.size === 1 ? [...item.projectCandidates][0] : null,
      review: item.projectCandidates.size !== 1 || item.adminRows === 0 || Math.abs(adminValueDelta) > 0.02,
      dateSource: item.dateSource,
    };
  });
}
