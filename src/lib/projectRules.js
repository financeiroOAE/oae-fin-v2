export function normalizeProjectText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

export function cleanOfficialProjectName(value) {
  return String(value || '').trim().replace(/[.\s]+$/g, '');
}

export function getProjectKey(value) {
  const normalized = normalizeProjectText(value);

  // Uma mesma obra pode aparecer no sistema como:
  //   448-TS-VIR-JF-ENG
  //   P.448
  //   P 448
  //   448
  // Todos esses formatos precisam apontar para a mesma chave de centro de custo.
  // Projetos do tipo 392A03 tambem possuem alias historico P.39203 no Sienge,
  // por isso removemos o "A" apenas na chave de agrupamento.
  const rawCode = normalized.match(/^(?:P\s*\.?\s*)?(\d+(?:A\d+)?)/)?.[1];
  if (rawCode) {
    return /^\d+A\d+$/.test(rawCode) ? rawCode.replace('A', '') : rawCode;
  }

  return normalized.replace(/[^A-Z0-9]/g, '');
}

export function isAdministrativeProject(value) {
  const normalized = normalizeProjectText(value);
  return normalized.includes('ADMINISTRA');
}

export function isGeneralProjectsBucket(value) {
  const normalized = normalizeProjectText(value);
  return normalized === 'PROJETOS' || normalized === 'PROJETO' || normalized === 'PROJETOS GERAL' || normalized === 'PROJETOS GERAIS';
}

export function isGenericProject(value) {
  const normalized = normalizeProjectText(value);
  return !normalized || normalized === 'GRUPO OAE' || normalized === 'SEM PROJETO';
}

export function isProjectOngoing(project) {
  if (!project) return false;

  const name = cleanOfficialProjectName(project.OBRA);
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
  return true;
}

export function getActiveProjects(projects = []) {
  return (projects || []).filter(isProjectOngoing);
}

export function getActiveProjectNames(projects = [], includeAdministration = true) {
  const names = getActiveProjects(projects)
    .map((project) => cleanOfficialProjectName(project.OBRA))
    .filter(Boolean);

  if (includeAdministration) names.push('ADMINISTRAÇÃO');
  return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export function buildOfficialProjectNameMap(projects = []) {
  const map = new Map();
  for (const project of projects || []) {
    const name = cleanOfficialProjectName(project?.OBRA);
    if (!name) continue;
    const key = getProjectKey(name);
    if (!key) continue;

    const current = map.get(key);
    if (!current || name.length < current.length) map.set(key, name);
  }
  return map;
}

export function getOfficialProjectName(value, projects = []) {
  if (isAdministrativeProject(value)) return 'ADMINISTRAÇÃO';
  if (isGeneralProjectsBucket(value)) return 'PROJETOS';
  const key = getProjectKey(value);
  return buildOfficialProjectNameMap(projects).get(key) || cleanOfficialProjectName(value);
}

export function isProjectRevenueType(classificationType) {
  return classificationType === 'receita_projeto' || classificationType === 'receita_administrativa';
}
