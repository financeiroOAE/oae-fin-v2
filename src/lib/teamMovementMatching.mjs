const normalize = (value) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toUpperCase();

export function normalizeTeamParty(value) {
  return normalize(value)
    .replace(/^\d{2}[.\s]?\d{3}[.\s]?\d{3}\s+/, '')
    .trim();
}

export function teamPartyAliases(value) {
  const raw = normalizeTeamParty(value);
  const aliases = new Set([raw]);
  raw.split(/\s+-\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 5)
    .forEach((part) => aliases.add(part));
  return [...aliases].filter(Boolean);
}

export function matchesTeamParty(rosterName, cpName) {
  const target = normalizeTeamParty(cpName);
  if (!target) return false;
  return teamPartyAliases(rosterName)
    .some((alias) => target === alias || target.includes(alias) || alias.includes(target));
}

/**
 * A associação financeira da Equipe é feita pelo nome do beneficiário.
 * Projeto/Departamento/Obra é informação de classificação e não pode excluir
 * lançamentos da mesma pessoa em outras obras.
 */
export function filterTeamMovementsByPerson(rosterPerson, movements = [], includeMovement = () => true) {
  return (movements || []).filter((row) => (
    matchesTeamParty(rosterPerson, row?.nome) && includeMovement(row)
  ));
}
