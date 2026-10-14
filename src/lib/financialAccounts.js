import { normalizeAccountCode, isRealizedFinancialStatus, isForecastFinancialStatus } from './financialClassification.js';

const clean = (value) => String(value ?? '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ').trim().toUpperCase();

const title = (value) => String(value ?? '').replace(/\u00a0/g, ' ')
  .replace(/^\s*[\d.]{6,}\s*[-–—:]?\s*/, '')
  .replace(/\s+/g, ' ').trim();

export const moneyCents = (value) => Math.round((Number(value) || 0) * 100);
export const fromMoneyCents = (cents) => cents / 100;

export function financialAccountCode(row) {
  return normalizeAccountCode(row);
}

export function financialAccountName(row) {
  return title(row?.planoFinanceiro || row?.contaNome || row?.contaDescricao || row?.conta || '')
    || 'Conta não identificada';
}

// O código define a identidade da conta; a descrição é apenas a apresentação.
// Contas distintas jamais são somadas porque suas descrições coincidem.
export function financialAccountKey(row) {
  const code = financialAccountCode(row);
  return code ? `CODIGO:${code}` : `SEM_CODIGO:${clean(financialAccountName(row))}`;
}

export function financialAccountLabel(row) {
  const code = financialAccountCode(row);
  const name = financialAccountName(row);
  return code ? `${code} · ${name}` : name;
}

export function financialPaymentKind(row) {
  if (isRealizedFinancialStatus(row)) return 'paid';
  if (isForecastFinancialStatus(row)) return 'open';
  return 'unknown';
}

// Todos os totais utilizam centavos inteiros, preservando valores negativos
// (estornos) e evitando discrepâncias de representação binária.
export function groupFinancialAccounts(rows, { includeRows = true } = {}) {
  const groups = new Map();
  for (const row of rows || []) {
    const key = financialAccountKey(row);
    const code = financialAccountCode(row);
    if (!groups.has(key)) {
      groups.set(key, {
        key, code, name: '', paidCents: 0, openCents: 0,
        unknownCents: 0, totalCents: 0, count: 0,
        rows: [], aliases: new Map(), officialAliases: new Map()
      });
    }
    const current = groups.get(key);
    const name = financialAccountName(row);
    const cents = moneyCents(row?.valor);
    const kind = row?.paid === true ? 'paid' : row?.paid === false ? 'open' : financialPaymentKind(row);
    if (kind === 'paid') current.paidCents += cents;
    else if (kind === 'open') current.openCents += cents;
    else current.unknownCents += cents;
    current.totalCents += cents;
    current.count += 1;
    current.aliases.set(name, (current.aliases.get(name) || 0) + 1);
    if (row?.planoFinanceiro) current.officialAliases.set(name, (current.officialAliases.get(name) || 0) + 1);
    if (includeRows) current.rows.push(row);
  }

  return [...groups.values()].map((group) => {
    const preferred = group.officialAliases.size ? group.officialAliases : group.aliases;
    const names = [...preferred.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'));
    const name = names[0]?.[0] || 'Conta não identificada';
    const label = group.code ? `${group.code} · ${name}` : name;
    return {
      key: group.key, code: group.code, name: label,
      paid: fromMoneyCents(group.paidCents),
      open: fromMoneyCents(group.openCents),
      unknown: fromMoneyCents(group.unknownCents),
      total: fromMoneyCents(group.totalCents),
      count: group.count, rows: group.rows,
      aliases: [...group.aliases.keys()].sort((a,b) => a.localeCompare(b, 'pt-BR')),
    };
  }).sort((a, b) => Math.abs(b.total) - Math.abs(a.total) || a.name.localeCompare(b.name, 'pt-BR'));
}
