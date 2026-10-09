import { NextResponse } from 'next/server';
import { hasMenuAccess, requireAnyMenuAccess } from '@/lib/authorization';
import { readCurrentSnapshot } from '@/lib/financialSync';
import { cpRows, monthOf, revenueTitles } from '@/lib/managementSources';
import { isPartnerWithdrawal } from '@/lib/financialClassification';
import { reconcilePartnerWithdrawals, partnerIdForRow } from '@/lib/partnerWithdrawals';

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
  return Boolean(partnerIdForRow(row));
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
  if (isPartner(row) && isPartnerWithdrawal(row)) return 'RETIRADA';
  if (isPartner(row) && (code === '2010302' || account.includes('EQUIP') && account.includes('ADM'))) return 'EQUIPE_ADM_SOCIO';
  if (isPartner(row)) return 'OUTRO_PAGAMENTO_SOCIO';
  if (code === '2010302' || account.includes('EQUIP') && account.includes('ADM')) return 'EQUIPE_ADM';
  return 'DESPESA_ADM';
}

export async function GET() {
  const access = await requireAnyMenuAccess(['administrativo_geral', 'administrativo_diretoria']);
  if (!access.ok) return fail(access.error, access.status);

  const canViewGeneral = hasMenuAccess(access.user, 'administrativo_geral');
  const canViewDiretoria = hasMenuAccess(access.user, 'administrativo_diretoria');
  const snapshot = await readCurrentSnapshot();

  const roster = snapshot?.payload?.equipe || [];
  const allCp2026 = cpRows(snapshot).filter((row) => monthOf(row.data)?.startsWith(YEAR));
  const partnerWithdrawalReconciliation = reconcilePartnerWithdrawals(allCp2026);

  const expenses = allCp2026
    .filter((row) => norm(row.projeto) === 'ADMINISTRACAO')
    .map((row) => {
      const type = adminType(row);
      const adminTeamEntity = ['EQUIPE_ADM', 'EQUIPE_ADM_SOCIO'].includes(type) &&
        !isExcludedAdminEntity(row.nome) &&
        (isPartner(row) || matchesRosterEntity(roster, row.nome));
      return { ...row, type, adminTeamEntity };
    });

  const adminTeamRows = allCp2026
    .filter((row) => String(row.contaCodigo || '').replace(/\D/g, '') === '2010302')
    .filter((row) => !isExcludedAdminEntity(row.nome))
    .filter((row) => matchesRosterEntity(roster, row.nome))
    .map((row) => ({ ...row, type: isPartner(row) ? 'EQUIPE_ADM_SOCIO' : 'EQUIPE_ADM', adminTeamEntity: true }));

  const partnerRows = allCp2026
    .filter((row) => isPartner(row))
    .filter((row) => {
      const code = String(row.contaCodigo || '').replace(/\D/g, '');
      return code === '2010302' || isPartnerWithdrawal(row);
    })
    .map((row) => ({ ...row, type: adminType(row), adminTeamEntity: true }));

  const revenue = revenueTitles(snapshot)
    .filter((row) => String(row.month || '').startsWith(YEAR))
    .map((row) => ({
      ...row,
      adminValue: Math.round(Number(row.adminValue || 0) * 100) / 100,
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
    revenue: canViewGeneral ? revenue : [],
    expenses: canViewGeneral ? expenses : [],
    adminTeamRows: canViewGeneral ? adminTeamRows : [],
    partnerRows: canViewDiretoria ? partnerRows : [],
    partnerWithdrawalReconciliation: canViewDiretoria ? partnerWithdrawalReconciliation : null,
    monthly: canViewGeneral ? monthly : [],
    snapshotAt: snapshot?.updatedAt || null,
    rules: {
      revenueAdministrative: '20% da coluna K para receitas de projeto; receitas avulsas sem projeto e com centro de custo ADMINISTRAÇÃO entram 100% no Administrativo',
      expenseScope: 'Centro de custo ADMINISTRAÇÃO',
      partnerScope: 'Retiradas: todos os lançamentos da conta 2010522 no CP_GERAL em 2026, discriminando favorecidos identificados e não atribuídos; Equipe ADM separada',
    },
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}
