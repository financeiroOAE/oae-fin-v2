import {
  financialAccountCode, financialAccountKey, financialAccountName,
  groupFinancialAccounts, moneyCents, fromMoneyCents, financialPaymentKind
} from './financialAccounts.js';
import { isPartnerWithdrawal, isProjectRevenue } from './financialClassification.js';
import { financialDateKey } from './paymentCommitment.js';

const normalize = (value) => String(value ?? '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
const yearOf = (value) => financialDateKey(value)?.slice(0, 4) || '';

function totalBySituation(rows) {
  const values = { paid: 0, open: 0, unknown: 0, total: 0, count: 0 };
  for (const row of rows) {
    const cents = moneyCents(row.valor);
    values[financialPaymentKind(row)] += cents;
    values.total += cents;
    values.count += 1;
  }
  return Object.fromEntries(Object.entries(values).map(([key, val]) => [
    key, key === 'count' ? val : fromMoneyCents(val)
  ]));
}

function mismatchedAccounts(source, normalized, label) {
  const rawByKey = new Map(groupFinancialAccounts(source, { includeRows: false }).map(row => [row.key, row]));
  const normalizedByKey = new Map(groupFinancialAccounts(normalized, { includeRows: false }).map(row => [row.key, row]));
  const mismatches = [];
  for (const key of new Set([...rawByKey.keys(), ...normalizedByKey.keys()])) {
    const from = rawByKey.get(key), to = normalizedByKey.get(key);
    if (moneyCents(from?.total) !== moneyCents(to?.total) || (from?.count ?? 0) !== (to?.count ?? 0)) {
      mismatches.push({
        label, code: from?.code || to?.code || '', account: from?.name || to?.name,
        original: from?.total || 0, normalized: to?.total || 0,
        originalRows: from?.count || 0, normalizedRows: to?.count || 0
      });
    }
  }
  return mismatches;
}

// Compara a fonte com sua projeção CP sem igualar propositalmente
// indicadores de escopos diferentes (Visão Financeira = realizado;
// Fluxo de Caixa = realizado + previsto).
export function auditFinancialNomenclatures({ sourceRows = [], cpRows = [], titles = [], year = '2026' } = {}) {
  const yearText = year === null ? null : String(year);
  const inYear = row => yearText === null || yearOf(row?.data) === yearText;
  const source = sourceRows.filter(inYear);
  const accounts = groupFinancialAccounts(source, { includeRows: false });
  const rawCp = source.filter(row => row.natureza === 'Saída');
  const normalizedCp = cpRows.filter(inYear);
  const rawCr = source.filter(row => row.natureza === 'Entrada');
  const sourcePaid = source.filter(row => financialPaymentKind(row) === 'paid');
  const sourceOpen = source.filter(row => financialPaymentKind(row) === 'open');
  const unknown = source.filter(row => financialPaymentKind(row) === 'unknown');

  const aliases = new Map();
  const namesToCodes = new Map();
  const dreGroups = new Map();
  for (const row of source) {
    const key = financialAccountKey(row);
    if (!aliases.has(key)) aliases.set(key, new Map());
    // Auditar todas as grafias, sem usar o nome como chave financeira.
    for (const [origin, label] of [
      ['Conta CP/CR', row.contaNome], ['Plano Financeiro', row.planoFinanceiro],
      ['Descrição DRE', row.contaDescricao]
    ]) {
      const name = String(label || '').trim();
      if (!name) continue;
      const alias = aliases.get(key);
      const aliasKey = `${origin}|${normalize(name)}`;
      if (!alias.has(aliasKey)) alias.set(aliasKey, { origin, name, count: 0, totalCents: 0 });
      const item = alias.get(aliasKey);
      item.count += 1;
      item.totalCents += moneyCents(row.valor);
    }
    const name = normalize(financialAccountName(row));
    const code = financialAccountCode(row);
    if (code && name) {
      if (!namesToCodes.has(name)) namesToCodes.set(name, new Set());
      namesToCodes.get(name).add(code);
    }
    const dre = normalize([row.dreClasse, row.dreLinha].filter(Boolean).join(' / '));
    if (dre) {
      if (!dreGroups.has(key)) dreGroups.set(key, new Set());
      dreGroups.get(key).add(dre);
    }
  }
  const nomenclatureVariations = accounts.map(account => {
    const perOrigin = [...(aliases.get(account.key)?.values() || [])];
    const byOrigin = Object.groupBy(perOrigin, item => item.origin);
    const variations = Object.entries(byOrigin).filter(([,labels]) => labels.length > 1)
      .map(([origin, labels]) => ({ origin, labels: labels.map(item => ({
        name:item.name, count:item.count, total:fromMoneyCents(item.totalCents)
      })) }));
    return variations.length ? { code:account.code, account:account.name, total:account.total, variations } : null;
  }).filter(Boolean);

  const titlesForYear = titles.filter(item => yearText === null || String(item.month || '').startsWith(yearText));
  const splits = titlesForYear.map(item => ({
    month:item.month, document:item.document,
    total: item.value, project: item.projectValue, administrative: item.adminValue,
    difference:fromMoneyCents(moneyCents(item.value)-moneyCents(item.projectValue)-moneyCents(item.adminValue))
  })).filter(item => moneyCents(item.difference) !== 0);

  const sourceAdministrative = rawCp.filter(row => normalize(row.projeto) === 'ADMINISTRACAO');
  const normalizedAdministrative = normalizedCp.filter(row => normalize(row.projeto) === 'ADMINISTRACAO');

  return {
    year: yearText || 'todos',
    scopeRules: {
      visaoFinanceira: 'Somente realizado: entradas recebidas e saidas pagas',
      fluxoCaixa: 'Realizado e previsto, apresentados em indicadores separados',
      conciliacao: 'Comparar apenas natureza, status, periodo, conta e projeto equivalentes',
    },
    scopes: {
      visaoFinanceiraRealizado: totalBySituation(sourcePaid),
      fluxoCaixaRealizado: totalBySituation(sourcePaid),
      fluxoCaixaPrevisto: totalBySituation(sourceOpen),
      fluxoCaixaNaoClassificado: totalBySituation(unknown),
      contasPagar: totalBySituation(rawCp),
      contasReceber: totalBySituation(rawCr),
      administrativo: totalBySituation(sourceAdministrative),
      retiradas: totalBySituation(rawCp.filter(isPartnerWithdrawal)),
      receitasProjeto: totalBySituation(rawCr.filter(isProjectRevenue))
    },
    nomenclatures: accounts.map(account => ({
      code:account.code, label:account.name,
      paid:account.paid, open:account.open, unknown:account.unknown,
      total:account.total, count:account.count
    })),
    findings: {
      sourceVersusNormalized: [
        ...mismatchedAccounts(rawCp, normalizedCp, 'CP_GERAL x leitura CP'),
        ...mismatchedAccounts(sourceAdministrative, normalizedAdministrative, 'Centro de custo ADMINISTRACAO')
      ],
      nomenclatureVariations,
      descriptionsSharedByDifferentCodes: [...namesToCodes.entries()]
        .filter(([, codes]) => codes.size > 1)
        .map(([name, codes]) => ({ name, codes: [...codes].sort() })),
      dreDifferentForSameAccount: [...dreGroups.entries()]
        .filter(([, groups]) => groups.size > 1)
        .map(([account, groups]) => ({ account, dreClasses: [...groups].sort() })),
      revenueRateioInconsistencies: splits,
      unknownStatuses: unknown.length,
      unknownValue: fromMoneyCents(unknown.reduce((sum, row) => sum + moneyCents(row.valor), 0)),
      invalidDates: sourceRows.filter(row => row?.data && !financialDateKey(row.data)).length
    }
  };
}
