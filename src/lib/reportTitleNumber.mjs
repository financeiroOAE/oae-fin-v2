// CP_GERAL: Título; CR_GERAL: Lançamento. Não confundir com Documento/NF.
export const REPORT_TITLE_NUMBER_KEY = '__reportTitleNumber';

const normalize = key => String(key || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[º°.]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
const titleAliases = new Set(['numero do titulo','n do titulo','n titulo','titulo','lancamento']);

export function getReportTitleNumber(row) {
  if (!row || typeof row !== 'object') return '';
  const preferred = [row[REPORT_TITLE_NUMBER_KEY], row['Número do Título'], row.titulo, row['Título'], row.lancamento, row['Lançamento']];
  const candidates = [...preferred, ...Object.entries(row).filter(([key])=>titleAliases.has(normalize(key))).map(([, value])=>value)];
  for (const value of candidates) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text && text !== '-' && text !== '—') return text;
  }
  return '';
}
