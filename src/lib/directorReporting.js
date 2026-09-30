export const DIRECTORS = [
  { id: 'francielle-paiva', name: 'Francielle Paiva', phrases: ['FRANCIELLE PAIVA'] },
  { id: 'paulo-henrique-araujo', name: 'Paulo Henrique Araújo', phrases: ['PAULO HENRIQUE ARAUJO', 'PAULO HENRIQUE LEMES ARAUJO'] },
];

const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();

export function directorForRow(row) {
  const fields = [row.nome, row.titulo, row.documento].map(normalize);
  const matches = DIRECTORS.filter((director) => director.phrases.some((phrase) => fields.some((field) => (` ${field} `).includes(` ${phrase} `)))
    || (director.id === 'paulo-henrique-araujo' && fields[0] === 'PHLA')
    || (director.id === 'francielle-paiva' && fields[0] === 'FPOA'));
  return matches.length === 1 ? matches[0] : null;
}

export function directorCategory(row) {
  const account = normalize(row.contaNome);
  const description = normalize(`${row.titulo} ${row.documento}`);
  if (isFixedDirectorAccount(row)) return 'FIXO';
  if (/REEMBOLSO|RESSARCIMENTO/.test(account) || /REEMBOLSO|RESSARCIMENTO/.test(description)) return 'REEMBOLSO';
  if (/RETIRADA|DISTRIBUICAO DE LUCROS|ANTECIPACAO DE LUCROS/.test(account)) return 'RETIRADA';
  return 'OUTRO';
}

export function isFixedDirectorAccount(row) {
  return /\bEQUIP(?:E)?\s+TEC(?:NICA)?\s+ADM\b/.test(normalize(row.contaNome));
}

export function buildDirectorReports(rows, overrides = []) {
  const byKey = new Map(overrides.map((link) => [link.sourceKey, link]));
  const groups = new Map(DIRECTORS.map((director) => [director.id, []]));
  rows.forEach((source) => {
    const director = directorForRow(source);
    if (!director) return;
    const override = byKey.get(source.sourceKey);
    const fixedAccount = isFixedDirectorAccount(source);
    groups.get(director.id).push({ id: override?.id || source.sourceKey, sourceKey: source.sourceKey, source, fixedAccount,
      category: fixedAccount ? 'FIXO' : override?.category || directorCategory(source), allocations: override?.allocations || [] });
  });
  return DIRECTORS.map(({ id, name }) => ({ id, name, cpLinks: groups.get(id) }));
}
