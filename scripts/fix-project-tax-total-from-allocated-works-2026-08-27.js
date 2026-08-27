const fs = require('fs');

const projectsPath = 'src/app/projetos/page.js';
const overviewPath = 'src/app/visao-financeira/page.js';

function replaceOnce(content, before, after, label) {
  if (!content.includes(before)) throw new Error(`Trecho nao encontrado: ${label}`);
  return content.replace(before, after);
}

let projects = fs.readFileSync(projectsPath, 'utf8');

projects = replaceOnce(
  projects,
  `  // Tributos de projetos devem considerar somente centros de custo que existem\n  // como obras/projetos ativos na carteira. Administrativo, buckets genericos e\n  // rotulos financeiros sem obra cadastrada ficam fora do total de tributos.\n  const activeProjectTaxKeys = useMemo(() => new Set(\n    projetosBrutos\n      .filter((p) => {\n        const obra = String(p.OBRA || '').trim();\n        return obra && !obra.toUpperCase().includes('ADMINISTRATIVO') && isProjectOngoing(p);\n      })\n      .map((p) => getProjectKey(p.ID || p.OBRA))\n      .filter(Boolean)\n  ), [projetosBrutos]);`,
  `  // Escopo de impostos dos projetos: qualquer lancamento tributario efetivamente\n  // alocado a uma obra/centro de custo real. Administracao e buckets genericos ficam fora.\n  // Quando ha filtro global de projeto/empresa/tipo, o imposto acompanha esse recorte.\n  const hasGlobalProjectScopeFilter = filterProjetos.length > 0 || filterEmpresas.length > 0 || filterTipos.length > 0;\n  const globalProjectTaxKeys = useMemo(() => new Set(\n    projetosCruzados\n      .filter((p) => {\n        if (filterProjetos.length > 0 && !filterProjetos.includes(p.nome)) return false;\n        if (filterEmpresas.length > 0 && !p.empresas.some((empresa) => filterEmpresas.includes(empresa))) return false;\n        if (filterTipos.length > 0 && !p.tipos.some((tipo) => filterTipos.includes(tipo))) return false;\n        return true;\n      })\n      .map((p) => p.projectKey)\n      .filter(Boolean)\n  ), [projetosCruzados, filterProjetos, filterEmpresas, filterTipos]);`,
  'substituir escopo ativo por escopo alocado'
);

projects = replaceOnce(
  projects,
  `    data.forEach((item) => {\n      if (item.natureza !== 'Saída' || !allowedProjects.has(getProjectKey(item.projeto))) return;\n      const projetoNome = String(item.projeto || '').toUpperCase();\n      if (projetoNome.includes('ADMINISTRA')) return;`,
  `    data.forEach((item) => {\n      if (item.natureza !== 'Saída') return;\n      const itemProjectKey = getProjectKey(item.projeto);\n      const projetoNome = String(item.projeto || '').toUpperCase();\n      if (projetoNome.includes('ADMINISTRA')) return;`,
  'permitir tributo de toda obra alocada no dreStats'
);

projects = replaceOnce(
  projects,
  `      if (isProjectTax(item)) {\n        // Imposto administrativo ou associado a centro que nao e uma obra ativa\n        // nao pertence a visao financeira dos projetos.\n        if (!activeProjectTaxKeys.has(getProjectKey(item.projeto))) return;\n        if (isRealizado) tributos += valor;\n        else tributosAPagar += valor;\n      } else if (isPendingDre) {`,
  `      if (isProjectTax(item)) {\n        const isAllocatedWork = !isGenericFinancialProject(item.projeto);\n        const taxInScope = isAllocatedWork && (!hasGlobalProjectScopeFilter || globalProjectTaxKeys.has(itemProjectKey));\n        if (!taxInScope) return;\n        if (isRealizado) tributos += valor;\n        else tributosAPagar += valor;\n        return;\n      }\n\n      // Custos e despesas continuam seguindo o conjunto de projetos exibidos.\n      if (!allowedProjects.has(itemProjectKey)) return;\n\n      if (isPendingDre) {`,
  'regra tributaria somente obras alocadas'
);

projects = replaceOnce(
  projects,
  `  }, [data, filteredProjetos, realizadoIni, realizadoFim, incluirRateioAdm, usarCarteiraCompleta, receitaLiquidaProjetos, totalAReceber, activeProjectTaxKeys]);`,
  `  }, [data, filteredProjetos, realizadoIni, realizadoFim, incluirRateioAdm, usarCarteiraCompleta, receitaLiquidaProjetos, totalAReceber, hasGlobalProjectScopeFilter, globalProjectTaxKeys]);`,
  'dependencias dreStats'
);

projects = replaceOnce(
  projects,
  `    data.forEach(item => {\n      if (item.natureza !== 'Saída') return;\n      if (!allowedProjects.has(getProjectKey(item.projeto))) return;\n      if (!activeProjectTaxKeys.has(getProjectKey(item.projeto))) return;`,
  `    data.forEach(item => {\n      if (item.natureza !== 'Saída') return;\n      const itemProjectKey = getProjectKey(item.projeto);\n      if (isGenericFinancialProject(item.projeto)) return;\n      if (hasGlobalProjectScopeFilter && !globalProjectTaxKeys.has(itemProjectKey)) return;`,
  'taxesData usa obras alocadas'
);

projects = replaceOnce(
  projects,
  `  }, [data, filteredProjetos, realizadoIni, realizadoFim, activeProjectTaxKeys]);`,
  `  }, [data, realizadoIni, realizadoFim, hasGlobalProjectScopeFilter, globalProjectTaxKeys]);`,
  'dependencias taxesData'
);

fs.writeFileSync(projectsPath, projects, 'utf8');

let overview = fs.readFileSync(overviewPath, 'utf8');

overview = replaceOnce(
  overview,
  `    // Esta visao e exclusivamente de OBRAS: usa somente receita direta alocada\n    // a projetos ativos. A parcela administrativa (1010107) nao entra neste grafico.\n    // Para realizados, valorDireto ja carrega a regra de caixa da CR_GERAL coluna K.\n    const receitaObra = realizedFilteredData\n      .filter((item) => item.natureza === 'Entrada' && activeProjectKeys.has(getProjectKey(item.projeto)))`,
  `    // Esta visao e exclusivamente de OBRAS: usa somente valores alocados a\n    // centro de custo real. Administracao e buckets genericos ficam fora.\n    // Para realizados, valorDireto ja carrega a regra de caixa da CR_GERAL coluna K.\n    const receitaObra = realizedFilteredData\n      .filter((item) => item.natureza === 'Entrada' && hasAllocatedProject(item))`,
  'receita das obras sem restricao a ativo'
);

overview = replaceOnce(
  overview,
  `    const saidasProjeto = realizedFilteredData\n      .filter((item) => item.natureza === 'Saída')\n      .filter((item) => activeProjectKeys.has(getProjectKey(item.projeto)));`,
  `    const saidasProjeto = realizedFilteredData\n      .filter((item) => item.natureza === 'Saída')\n      .filter((item) => hasAllocatedProject(item));`,
  'saidas e impostos de obras alocadas'
);

overview = replaceOnce(
  overview,
  `  }, [realizedFilteredData, activeProjectKeys]);`,
  `  }, [realizedFilteredData]);`,
  'dependencias visao financeira projetos'
);

fs.writeFileSync(overviewPath, overview, 'utf8');

console.log('Total de impostos dos projetos alinhado pelas obras efetivamente alocadas, sem ADM.');
