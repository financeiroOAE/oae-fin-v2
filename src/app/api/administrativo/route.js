import { NextResponse } from 'next/server';
import { requireMenuAccess } from '@/lib/authorization';
import { readCurrentSnapshot } from '@/lib/financialSync';
import { cpRows, monthOf, revenueTitles } from '@/lib/managementSources';

const YEAR = '2026';
const fail = (error, status = 400) => NextResponse.json({ error }, { status });

function norm(value) {
  return String(value ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\u00a0/g, ' ').replace(/\s+/g, ' ')
    .trim().toUpperCase();
}

function isPartner(row) {
  const name = norm(row.nome);
  return name.includes('FRANCIELLE PAIVA') || name.includes('PAULO HENRIQUE');
}
function rosterAliases(value) {
  const raw = norm(value).replace(/^\d{2}[.\s]?\d{3}[.\s]?\d{3}\s+/, '').trim();
  const aliases = new Set([raw]);
  raw.split(/\s+-\s+/).map((part) => part.trim()).filter((part) => part.length >= 5).forEach((part) => aliases.add(part));
  return [...aliases].filter(Boolean);
}

function matchesRosterEntity(roster, name) {
  const target = norm(name);
  if (!target) return false;
  return roster.some((item) => rosterAliases(item.person).some((alias) =>
    target === alias || target.includes(alias) || alias.includes(target)
  ));
}

const ADMIN_TEAM_EXCLUSIONS = [
  'MINISTERIO PUBLICO',
  'IFOOD',
  'MINISTERIO DA ECONOMIA',
  'OLIVEIRA ARAUJO ENGENHARIA LTDA',
];

function isExcludedAdminEntity(name) {
  const target = norm(name);
  return ADMIN_TEAM_EXCLUSIONS.some((value) => target.includes(value));
}


function adminType(row) {
  const code = String(row.contaCodigo || '').replace(/\D/g, '');
  const account = norm(row.contaNome);
  if (isPartner(row) && (code === '2010522' || account.includes('RETIRAD') && account.includes('SOCIO'))) return 'RETIRADA';
  if (isPartner(row) && (code === '2010302' || account.includes('EQUIP') && account.includes('ADM'))) return 'EQUIPE_ADM_SOCIO';
  if (code === '2010302' || account.includes('EQUIP') && account.includes('ADM')) return 'EQUIPE_ADM';
  return 'DESPESA_ADM';
}

export async function GET() {
  const access = await requireMenuAccess('administrativo');
  if (!access.ok) return fail(access.error, access.status);

  const snapshot = await readCurrentSnapshot();

  const roster = snapshot?.payload?.equipe || [];
  const expenses = cpRows(snapshot)
    .filter((row) => monthOf(row.data)?.startsWith(YEAR))
    .filter((row) => norm(row.projeto) === 'ADMINISTRACAO')
    .map((row) => {
      const type = adminType(row);
      const adminTeamEntity = ['EQUIPE_ADM', 'EQUIPE_ADM_SOCIO'].includes(type) &&
        !isExcludedAdminEntity(row.nome) &&
        (isPartner(row) || matchesRosterEntity(roster, row.nome));
      return { ...row, type, adminTeamEntity };
    });

  const revenue = revenueTitles(snapshot)
    .filter((row) => String(row.month || '').startsWith(YEAR))
    .map((row) => ({
      ...row,
      adminValue: Math.round(Number(row.value || 0) * 0.20 * 100) / 100,
      status: row.realized ? 'Recebido' : 'A receber',
    }));

  const monthly = Array.from({ length: 12 }, (_, i) => {
    const month = `${YEAR}-${String(i + 1).padStart(2, '0')}`;
    const monthRevenue = revenue.filter((row) => row.month === month).reduce((sum, row) => sum + row.adminValue, 0);
    const rows = expenses.filter((row) => monthOf(row.data) === month);
    const paid = rows.filter((row) => row.paid).reduce((sum, row) => sum + Number(row.valor || 0), 0);
    const open = rows.filter((row) => !row.paid).reduce((sum, row) => sum + Number(row.valor || 0), 0);
    return {
      month,
      revenue: Math.round(monthRevenue * 100) / 100,
      paid: Math.round(paid * 100) / 100,
      open: Math.round(open * 100) / 100,
      result: Math.round((monthRevenue - paid - open) * 100) / 100,
    };
  });

  return NextResponse.json({
    year: 2026,
    revenue,
    expenses,
    monthly,
    snapshotAt: snapshot?.updatedAt || null,
    rules: {
      revenueAdministrative: '20% da receita dos títulos',
      expenseScope: 'Centro de custo ADMINISTRAÇÃO',
      partnerScope: 'Francielle/Paulo somente Retirada dos Sócios ou Equipe ADM',
    },
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}
