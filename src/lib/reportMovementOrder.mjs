// Ordenação cronológica usada apenas na exportação de movimentações.
// É estável para lançamentos na mesma data e preserva a lista original.
const dateFields = ['data', 'data pagamento', 'data vencimento', 'data de vencimento', 'vencimento', 'due date'];

function dateKey(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    return dayKey(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (/^\d{5}(?:\.\d+)?$/.test(raw)) {
    const serial = Number(raw);
    if (serial >= 20000 && serial <= 80000) {
      const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000);
      return dayKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
    }
  }
  let match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|[T\s])/);
  if (match) return dayKey(Number(match[1]), Number(match[2]), Number(match[3]));
  match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:$|\s)/);
  return match ? dayKey(Number(match[3]), Number(match[2]), Number(match[1])) : '';
}

function dayKey(year, month, day) {
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1) return '';
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day
    ? year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0') : '';
}

function normalizeColumn(key) {
  return String(key).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

function rowDate(row) {
  if (!row || typeof row !== 'object') return '';
  const keys = Object.keys(row);
  for (const alias of dateFields) {
    const key = keys.find((candidate) => normalizeColumn(candidate) === alias);
    if (key) return dateKey(row[key]);
  }
  return '';
}

export function sortMovementRowsByDate(rows) {
  if (!Array.isArray(rows)) return [];
  if (rows.length < 2) return rows;
  return rows.map((row, index) => ({row, index, date: rowDate(row)}))
    .sort((a, b) => {
      if (!a.date && b.date) return 1;
      if (a.date && !b.date) return -1;
      return a.date.localeCompare(b.date) || a.index - b.index;
    }).map((entry) => entry.row);
}
