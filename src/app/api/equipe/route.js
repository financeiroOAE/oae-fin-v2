import { NextResponse } from 'next/server';
import { requireMenuAccess } from '@/lib/authorization';
import { readCurrentSnapshot } from '@/lib/financialSync';
import { cpRows, monthOf } from '@/lib/managementSources';

const fail = (error, status = 400) => NextResponse.json({ error }, { status });

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
    .filter((row) => Boolean(row._month));

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
      return true;
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

  const years = [...new Set(financialRows
    .map((row) => monthOf(row.data)?.slice(0, 4))
    .filter(Boolean))]
    .sort();

  const monthly = financialRows.reduce((map, row) => {
    const month = monthOf(row.data);
    if (!month) return map;
    if (!map.has(month)) map.set(month, { month, paid: 0, open: 0 });
    const item = map.get(month);
    item[row.paid ? 'paid' : 'open'] += Number(row.valor || 0);
    return map;
  }, new Map());

  const monthlyRows = [...monthly.values()]
    .map((item) => ({
      ...item,
      paid: Math.round(item.paid * 100) / 100,
      open: Math.round(item.open * 100) / 100,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

    return NextResponse.json({
      defaultYear: 2026,
      availableYears: years,
      entries,
      monthly: monthlyRows,
      snapshotAt: snapshot?.updatedAt || null,
      rules: {
        zeroContractValue: 'MENSAL_FIXO',
        sourceRoster: 'EQUIPE (identificação, função e vínculo)',
        sourceFinancial: 'CP_GERAL (todos os planos de equipe por pessoa)',
        accountRule: 'Os planos e valores vêm de cada lançamento de CP_GERAL, nunca do plano ou valor-base do cadastro.',
        periodFiltering: 'A API entrega o histórico financeiro disponível; o período é aplicado na tela da Equipe.',
        futureOpenThirdParty: 'No período padrão de 2026, terceiros mantêm pendências futuras. Ao alterar as datas, o filtro selecionado passa a ser respeitado integralmente.',
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
