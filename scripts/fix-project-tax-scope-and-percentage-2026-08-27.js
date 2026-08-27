const fs = require('fs');

const projectsPath = 'src/app/projetos/page.js';
const overviewPath = 'src/app/visao-financeira/page.js';

function replaceOnce(content, before, after, label) {
  if (!content.includes(before)) throw new Error(`Trecho nao encontrado: ${label}`);
  return content.replace(before, after);
}

function replaceAfter(content, anchor, before, after, label) {
  const anchorIndex = content.indexOf(anchor);
  if (anchorIndex < 0) throw new Error(`Ancora nao encontrada: ${label}`);
  const targetIndex = content.indexOf(before, anchorIndex);
  if (targetIndex < 0) throw new Error(`Trecho apos ancora nao encontrado: ${label}`);
  return content.slice(0, targetIndex) + after + content.slice(targetIndex + before.length);
}

let projects = fs.readFileSync(projectsPath, 'utf8');

projects = replaceOnce(
  projects,
  `  const totalRecebidoAdmGlobal = filteredProjetos.reduce((acc, p) => acc + (p.receitaAdm || 0), 0);\n\n  function isCDP(planoFinanceiro) {`,
  `  const totalRecebidoAdmGlobal = filteredProjetos.reduce((acc, p) => acc + (p.receitaAdm || 0), 0);\n\n  // Tributos de projetos devem considerar somente centros de custo que existem\n  // como obras/projetos ativos na carteira. Administrativo, buckets genericos e\n  // rotulos financeiros sem obra cadastrada ficam fora do total de tributos.\n  const activeProjectTaxKeys = useMemo(() => new Set(\n    projetosBrutos\n      .filter((p) => {\n        const obra = String(p.OBRA || '').trim();\n        return obra && !obra.toUpperCase().includes('ADMINISTRATIVO') && isProjectOngoing(p);\n      })\n      .map((p) => getProjectKey(p.ID || p.OBRA))\n      .filter(Boolean)\n  ), [projetosBrutos]);\n\n  function isCDP(planoFinanceiro) {`,
  'chaves de obras validas para tributos'
);

projects = replaceOnce(
  projects,
  `      if (isProjectTax(item)) {\n        if (isRealizado) tributos += valor;\n        else tributosAPagar += valor;\n      } else if (isPendingDre) {`,
  `      if (isProjectTax(item)) {\n        // Imposto administrativo ou associado a centro que nao e uma obra ativa\n        // nao pertence a visao financeira dos projetos.\n        if (!activeProjectTaxKeys.has(getProjectKey(item.projeto))) return;\n        if (isRealizado) tributos += valor;\n        else tributosAPagar += valor;\n      } else if (isPendingDre) {`,
  'escopo de tributos no DRE de projetos'
);

projects = replaceOnce(
  projects,
  `  }, [data, filteredProjetos, realizadoIni, realizadoFim, incluirRateioAdm, usarCarteiraCompleta, receitaLiquidaProjetos, totalAReceber]);`,
  `  }, [data, filteredProjetos, realizadoIni, realizadoFim, incluirRateioAdm, usarCarteiraCompleta, receitaLiquidaProjetos, totalAReceber, activeProjectTaxKeys]);`,
  'dependencias DRE projetos'
);

projects = replaceAfter(
  projects,
  `  const taxesData = useMemo(() => {`,
  `      if (!allowedProjects.has(getProjectKey(item.projeto))) return;\n\n      let ts = 0;`,
  `      if (!allowedProjects.has(getProjectKey(item.projeto))) return;\n      if (!activeProjectTaxKeys.has(getProjectKey(item.projeto))) return;\n\n      let ts = 0;`,
  'escopo de taxesData'
);

projects = replaceAfter(
  projects,
  `  const taxesData = useMemo(() => {`,
  `  }, [data, filteredProjetos, realizadoIni, realizadoFim]);`,
  `  }, [data, filteredProjetos, realizadoIni, realizadoFim, activeProjectTaxKeys]);`,
  'dependencias taxesData'
);

projects = replaceOnce(
  projects,
  `  const taxPercentage = receitaLiquidaProjetos > 0 ? (tributosProjetos / receitaLiquidaProjetos) * 100 : 0;`,
  `  // A aliquota efetiva de tributos e calculada sobre o FATURAMENTO, nao sobre o caixa recebido.\n  const taxPercentage = totalFaturado > 0 ? (tributosProjetos / totalFaturado) * 100 : 0;`,
  'percentual de tributos sobre faturamento'
);

projects = projects
  .replaceAll(`% sobre Recebido Líquido`, `% sobre Faturamento`)
  .replaceAll(`do Recebido Líquido</p>`, `do Faturamento</p>`)
  .replaceAll(`% sobre o Recebido Líquido)`, `% sobre o Faturamento)`);

fs.writeFileSync(projectsPath, projects, 'utf8');

let overview = fs.readFileSync(overviewPath, 'utf8');

overview = replaceOnce(
  overview,
  `  const projectFinancialOverview = useMemo(() => {\n    const receitaObra = projectRevenueStatus.realizado.obra;\n    const receitaAdm = projectRevenueStatus.realizado.adm;\n    const receita = projectRevenueStatus.realizado.total;\n    const saidasProjeto = realizedFilteredData\n      .filter((item) => item.natureza === 'Saída')\n      .filter((item) => hasAllocatedProject(item));\n    const tributos = saidasProjeto\n      .filter((item) => isGeneralTax(item))\n      .reduce((sum, item) => sum + Math.abs(Number(item.valor) || 0), 0);\n    const saidas = saidasProjeto\n      .filter((item) => !isGeneralTax(item))\n      .reduce((sum, item) => sum + Math.abs(Number(item.valor) || 0), 0);\n    const resultado = receita - saidas - tributos;\n    const margem = receita > 0 ? (resultado / receita) * 100 : 0;\n    return { receita, receitaObra, receitaAdm, saidas, tributos, resultado, margem };\n  }, [projectRevenueStatus, realizedFilteredData, filterProjetos]);`,
  `  const projectFinancialOverview = useMemo(() => {\n    // Esta visao e exclusivamente de OBRAS: usa somente receita direta alocada\n    // a projetos ativos. A parcela administrativa (1010107) nao entra neste grafico.\n    // Para realizados, valorDireto ja carrega a regra de caixa da CR_GERAL coluna K.\n    const receitaObra = realizedFilteredData\n      .filter((item) => item.natureza === 'Entrada' && activeProjectKeys.has(getProjectKey(item.projeto)))\n      .reduce((sum, item) => {\n        if (item?.valorDireto !== undefined && item?.valorDireto !== null) {\n          return sum + (Number(item.valorDireto) || 0);\n        }\n        const classification = classifyFinancialEntry(item);\n        return classification.type === 'receita_projeto'\n          ? sum + (Number(item.valor) || 0)\n          : sum;\n      }, 0);\n\n    const receitaAdm = 0;\n    const receita = receitaObra;\n    const saidasProjeto = realizedFilteredData\n      .filter((item) => item.natureza === 'Saída')\n      .filter((item) => activeProjectKeys.has(getProjectKey(item.projeto)));\n    const tributos = saidasProjeto\n      .filter((item) => isGeneralTax(item))\n      .reduce((sum, item) => sum + Math.abs(Number(item.valor) || 0), 0);\n    const saidas = saidasProjeto\n      .filter((item) => !isGeneralTax(item))\n      .reduce((sum, item) => sum + Math.abs(Number(item.valor) || 0), 0);\n    const resultado = receita - saidas - tributos;\n    const margem = receita > 0 ? (resultado / receita) * 100 : 0;\n    return { receita, receitaObra, receitaAdm, saidas, tributos, resultado, margem };\n  }, [realizedFilteredData, activeProjectKeys]);`,
  'visao financeira somente obras'
);

overview = replaceOnce(
  overview,
  `            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Margem = Resultado ÷ Recebido Líquido × 100. O Resultado corresponde ao Recebido Líquido menos Custos + Despesas e Tributos realizados.</p>`,
  `            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Margem = Resultado ÷ Recebido Líquido × 100. Somente valores alocados às obras entram neste gráfico; Administração não é considerada. O Resultado corresponde ao Recebido Líquido menos Custos + Despesas e Tributos realizados.</p>`,
  'explicacao do grafico de obras'
);

overview = replaceOnce(
  overview,
  `<div><span style={{fontSize:'10px',color:'var(--text-secondary)',textTransform:'uppercase'}}>Recebido</span><strong style={{display:'block',fontSize:'14px',color:'var(--success)',overflowWrap:'anywhere'}}>{formatCurrency(projectFinancialOverview.receita)}</strong></div>`,
  `<div><span style={{fontSize:'10px',color:'var(--text-secondary)',textTransform:'uppercase'}}>Recebido Líquido</span><strong style={{display:'block',fontSize:'14px',color:'var(--success)',overflowWrap:'anywhere'}}>{formatCurrency(projectFinancialOverview.receita)}</strong></div>`,
  'rotulo recebido liquido obras'
);

overview = replaceOnce(
  overview,
  `data={[{ Recebido: projectFinancialOverview.receita, "Custos + Despesas": projectFinancialOverview.saidas, Tributos: projectFinancialOverview.tributos, Resultado: projectFinancialOverview.resultado, Margem: projectFinancialOverview.margem }]}`,
  `data={[{ "Recebido Líquido": projectFinancialOverview.receita, "Custos + Despesas": projectFinancialOverview.saidas, Tributos: projectFinancialOverview.tributos, Resultado: projectFinancialOverview.resultado, Margem: projectFinancialOverview.margem }]}`,
  'relatorio recebido liquido obras'
);

fs.writeFileSync(overviewPath, overview, 'utf8');

console.log('Tributos de projetos alinhados: somente obras ativas; percentual sobre faturamento; grafico sem ADM.');
