import { isPartnerWithdrawal } from './financialClassification.js';

// Identificação exclusivamente pelo favorecido: descrição, projeto e documento
// não comprovam que a retirada foi paga a um dos dois sócios.
const norm = (value) => String(value ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, ' ').trim().toUpperCase();

export const PARTNER_WITHDRAWAL_ACCOUNT = 'DESP ADM RETIRADAS SÓCIOS';

export function partnerIdForRow(row) {
  const name = norm(row?.nome);
  if (name === 'FPOA' || name.includes('FRANCIELLE PAIVA')) return 'francielle';
  if (name === 'PHLA' || name.includes('PAULO HENRIQUE')) return 'paulo';
  return null;
}

export function withdrawalAccountLabel(row) {
  return isPartnerWithdrawal(row)
    ? PARTNER_WITHDRAWAL_ACCOUNT
    : String(row?.contaNome || row?.contaDescricao || row?.contaCodigo || 'Sem conta');
}

// Centavos inteiros evitam diferenças por ponto flutuante entre cards,
// tabelas e relatórios que somam exatamente o mesmo conjunto de lançamentos.
export function summarizeFinancialRows(rows) {
  let paidCents = 0, openCents = 0;
  for (const row of rows || []) {
    const cents = Math.round((Number(row?.valor) || 0) * 100);
    if (row?.paid) paidCents += cents;
    else openCents += cents;
  }
  return { paid: paidCents / 100, open: openCents / 100,
    total: (paidCents + openCents) / 100 };
}

export function reconcilePartnerWithdrawals(rows) {
  const withdrawals = (rows || []).filter(isPartnerWithdrawal);
  const assigned = withdrawals.filter((row) => partnerIdForRow(row));
  const unassigned = withdrawals.filter((row) => !partnerIdForRow(row));
  const ledger = summarizeFinancialRows(withdrawals);
  const assignedTotals = summarizeFinancialRows(assigned);
  const unassignedTotals = summarizeFinancialRows(unassigned);
  return { ledger, assigned: assignedTotals, unassigned: unassignedTotals,
    unassignedRows: unassigned,
    reconciled: Math.round((assignedTotals.total + unassignedTotals.total - ledger.total) * 100) === 0 };
}
