export function normalizeProjectText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

export function getProjectKey(value) {
  const normalized = normalizeProjectText(value);
  const code = normalized.match(/^(\d+(?:A\d+)?)/)?.[1];
  return code || normalized.replace(/[^A-Z0-9]/g, '');
}

export function isAdministrativeProject(value) {
  const normalized = normalizeProjectText(value);
  return normalized.includes('ADMINISTRA');
}

export function isGenericProject(value) {
  const normalized = normalizeProjectText(value);
  return !normalized || normalized === 'GRUPO OAE' || normalized === 'SEM PROJETO';
}

export function isProjectOngoing(project) {
  if (!project) return false;

  const name = String(project.OBRA || '').trim();
  if (!name || isAdministrativeProject(name)) return false;

  const explicitStatus = normalizeProjectText(
    project.STATUS || project.Status || project.status || project.SITUACAO || project.Situação || project.Situacao
  );

  if (explicitStatus) {
    if (/(ENCERR|CONCLUID|FINALIZ|CANCEL|INATIV)/.test(explicitStatus)) return false;
    if (/(ATIV|ANDAMENTO|EM EXECUCAO|EXECUCAO|ABERTO)/.test(explicitStatus)) return true;
  }

  // A PROJETOS_2026 atualmente não possui uma coluna de status.
  // Portanto, a própria presença na relação oficial é o critério de projeto corrente.
  // Não usamos 100% faturado ou saldo contratual zero como sinônimo de encerramento,
  // pois isso poderia ocultar obras ainda administrativamente em andamento.
  return true;
}

export function getActiveProjects(projects = []) {
  return (projects || []).filter(isProjectOngoing);
}

export function getActiveProjectNames(projects = [], includeAdministration = true) {
  const names = getActiveProjects(projects)
    .map((project) => String(project.OBRA || '').trim())
    .filter(Boolean);

  if (includeAdministration) names.push('ADMINISTRAÇÃO');
  return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export function isProjectRevenueType(classificationType) {
  return classificationType === 'receita_projeto' || classificationType === 'receita_administrativa';
}
