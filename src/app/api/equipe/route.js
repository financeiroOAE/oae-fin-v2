import { NextResponse } from 'next/server';
import { requireMenuAccess } from '@/lib/authorization';
import { readCurrentSnapshot } from '@/lib/financialSync';
import { cpRows, monthOf } from '@/lib/managementSources';

const fail = (error, status = 400) => NextResponse.json({ error }, { status });
const START_YEAR = '2025';
const END_YEAR = '2026';
const START_MONTH = `${START_YEAR}-01`;
const END_MONTH = `${END_YEAR}-12`;

function isHistoricalTeamMonth(month) {
  return Boolean(month && month >= START_MONTH && month <= END_MONTH);
}

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

function isExecutiveTeamPerson(name) {
  const target = norm(name);
  return target.includes('FRANCIELLE PAIVA') || target.includes('PAULO HENRIQUE LEMES ARAUJO');
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

  try {
    const snapshot = await readCurrentSnapshot();
    if (!snapshot?.payload) {
      return fail('Base financeira indisponível. Aguarde a próxima sincronização ou use Atualizar dados.', 503);
    }
  const roster = snapshot?.payload?.equipe || [];

  // A aba Equipe é consultada com frequência. Em vez de percorrer o CP_GERAL
  // completo para cada cadastro, preparamos os lançamentos uma única vez e
  // indexamos por conta. Isso preserva a regra financeira sem sobrecarregar o servidor.
  const cp = cpRows(snapshot)
    .map((row) => {
      const rowMonth = monthOf(row.data);
      return {
        ...row,
        _accountCode: String(row.contaCodigo || '').replace(/\D/g, ''),
        _month: rowMonth,
      };
    })
    .filter((row) => {
      const isHistorical = isHistoricalTeamMonth(row._month);
      const isFutureOpen = Boolean(!row.paid && row._month && row._month > END_MONTH);
      return isHistorical || isFutureOpen;
    });

  // O cadastro EQUIPE informa função e vínculo, mas NÃO limita o plano financeiro.
  // Um profissional pode ter pagamentos em Coordenação, Arquitetura e outros
  // planos de equipe no mesmo exercício. Só CP_GERAL define a conta e o valor.
  const cpByPerson = new Map();
  const teamAccountRows = [];
  cp.forEach((row) => {
    if (!row.teamAccount) return;
    teamAccountRows.push(row);
    const party = norm(row.nome).replace(/^\d{2}[.\s]?\d{3}[.\s]?\d{3}\s+/, '').trim();
    if (!party) return;
    if (!cpByPerson.has(party)) cpByPerson.set(party, []);
    cpByPerson.get(party).push(row);
  });

  const entries = roster.map((item, index) => {
    const aliases = partyAliases(item.person);
    const exactMatches = new Map();
    aliases.forEach((alias) => {
      (cpByPerson.get(alias) || []).forEach((row) => exactMatches.set(row.sourceKey, row));
    });
    // Fallback para diferenças de razão social/nome entre o cadastro e o CP.
    // Só percorre as linhas da equipe quando não há correspondência exata.
    const candidates = exactMatches.size ? [...exactMatches.values()] : teamAccountRows.filter((row) => matchesParty(item.person, row.nome));
    const transactions = candidates.filter((row) => {
      if (!matchesParty(item.person, row.nome)) return false;
      if (item.thirdParty && !matchesProject(item.departmentProject, row.projeto)) return false;

      const isHistorical = isHistoricalTeamMonth(row._month);
      const isFutureOpenThirdParty = Boolean(
        item.thirdParty
        && !row.paid
        && row._month
        && row._month > END_MONTH
      );

      // Regra da relação de equipe:
      // - todos permanecem com movimentos de 2025 e 2026;
      // - somente terceiros mantêm A PAGAR após dez/2026.
      return isHistorical || isFutureOpenThirdParty;
    }).map(({ _accountCode, _month, ...row }) => row);

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

  const monthly = [];
  for (let year = Number(START_YEAR); year <= Number(END_YEAR); year += 1) {
    for (let monthNumber = 1; monthNumber <= 12; monthNumber += 1) {
      const month = `${year}-${String(monthNumber).padStart(2, '0')}`;
      const rows = financialRows.filter((row) => monthOf(row.data) === month);
      monthly.push({
        month,
        paid: Math.round(rows.filter((row) => row.paid).reduce((sum, row) => sum + Number(row.valor || 0), 0) * 100) / 100,
        open: Math.round(rows.filter((row) => !row.paid).reduce((sum, row) => sum + Number(row.valor || 0), 0) * 100) / 100,
      });
    }
  }

    return NextResponse.json({
      year: 2026,
      years: [2025, 2026],
      periodStart: `${START_YEAR}-01-01`,
      periodEnd: `${END_YEAR}-12-31`,
      entries,
      monthly,
      snapshotAt: snapshot?.updatedAt || null,
      rules: {
        zeroContractValue: 'MENSAL_FIXO',
        sourceRoster: 'EQUIPE (identificação, função e vínculo)',
        sourceFinancial: 'CP_GERAL (todos os planos de equipe por pessoa)',
        accountRule: 'Os planos e valores vêm de cada lançamento de CP_GERAL, nunca do plano ou valor-base do cadastro.',
        historicalScope: 'Movimentos de 2025 e 2026 disponíveis para consulta na aba Equipe.',
        futureOpenThirdParty: 'A PAGAR após dez/2026 incluído somente para cadastros TERCEIRO (EQUIP. TÉC. / TERCEIROS)',
      },
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('[api/equipe] falha ao montar dados', error);
    return NextResponse.json(
      { error: 'Não foi possível carregar os dados da Equipe. O último snapshot permanece preservado.' },
      { status: 500, headers: { 'Cache-Control': 'private, no-store' } }
    );
  }
}
