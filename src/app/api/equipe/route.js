import { NextResponse } from 'next/server';
import { requireMenuAccess } from '@/lib/authorization';
import { readCurrentSnapshot } from '@/lib/financialSync';
import { cpRows, monthOf } from '@/lib/managementSources';

const fail = (error, status = 400) => NextResponse.json({ error }, { status });
const YEAR = '2026';

function norm(value) {
  return String(value ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\u00a0/g, ' ').replace(/\s+/g, ' ')
    .trim().toUpperCase();
}

function partyAliases(value) {
  const raw = norm(value).replace(/^\d{2}[.\s]?\d{3}[.\s]?\d{3}\s+/, '').trim();
  const aliases = new Set([raw]);
  raw.split(/\s+-\s+/).map((part) => part.trim()).filter((part) => part.length >= 5).forEach((part) => aliases.add(part));
  return [...aliases].filter(Boolean);
}

function matchesParty(rosterName, cpName) {
  const target = norm(cpName);
  if (!target) return false;
  return partyAliases(rosterName).some((alias) => target === alias || target.includes(alias) || alias.includes(target));
}

function projectCode(value) {
  return norm(value).match(/(?:^|\b)P?\.?\s*(\d{3,4}[A-Z0-9]*)/)?.[1] || '';
}

function matchesProject(rosterProject, cpProject) {
  const a = projectCode(rosterProject);
  const b = projectCode(cpProject);
  if (a && b) return a === b;
  const left = norm(rosterProject);
  const right = norm(cpProject);
  return Boolean(left && right && (left.includes(right) || right.includes(left)));
}

export async function GET() {
  const access = await requireMenuAccess('equipe_gestao');
  if (!access.ok) return fail(access.error, access.status);

  const snapshot = await readCurrentSnapshot();
  const roster = snapshot?.payload?.equipe || [];
  const cp = cpRows(snapshot).filter((row) => monthOf(row.data)?.startsWith(YEAR));

  const entries = roster.map((item, index) => {
    const accountCode = String(item.accountCode || '').replace(/\D/g, '');
    const transactions = cp.filter((row) => {
      if (accountCode && String(row.contaCodigo || '').replace(/\D/g, '') !== accountCode) return false;
      if (!matchesParty(item.person, row.nome)) return false;
      if (item.thirdParty && !matchesProject(item.departmentProject, row.projeto)) return false;
      return true;
    });

    const paid = transactions.filter((row) => row.paid).reduce((sum, row) => sum + Number(row.valor || 0), 0);
    const open = transactions.filter((row) => !row.paid).reduce((sum, row) => sum + Number(row.valor || 0), 0);
    const projects = [...new Set(transactions.map((row) => String(row.projeto || '').trim()).filter((value) => value && norm(value) !== 'ADMINISTRACAO'))];

    return {
      id: `roster-${index + 1}`,
      ...item,
      department: item.thirdParty ? 'TERCEIROS' : item.departmentProject,
      project: item.thirdParty ? item.departmentProject : null,
      paid: Math.round(paid * 100) / 100,
      open: Math.round(open * 100) / 100,
      total: Math.round((paid + open) * 100) / 100,
      projects,
      transactions,
    };
  });

  const allTransactions = entries.flatMap((entry) => entry.transactions.map((row) => ({ ...row, rosterId: entry.id, rosterPerson: entry.person })));
  const uniqueTx = new Map(allTransactions.map((row) => [row.sourceKey, row]));
  const financialRows = [...uniqueTx.values()];

  const monthly = Array.from({ length: 12 }, (_, i) => {
    const month = `${YEAR}-${String(i + 1).padStart(2, '0')}`;
    const rows = financialRows.filter((row) => monthOf(row.data) === month);
    return {
      month,
      paid: Math.round(rows.filter((row) => row.paid).reduce((sum, row) => sum + Number(row.valor || 0), 0) * 100) / 100,
      open: Math.round(rows.filter((row) => !row.paid).reduce((sum, row) => sum + Number(row.valor || 0), 0) * 100) / 100,
    };
  });

  return NextResponse.json({
    year: 2026,
    entries,
    monthly,
    snapshotAt: snapshot?.updatedAt || null,
    rules: {
      zeroContractValue: 'MENSAL_FIXO',
      sourceRoster: 'EQUIPE',
      sourceFinancial: 'CP_GERAL',
    },
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}
