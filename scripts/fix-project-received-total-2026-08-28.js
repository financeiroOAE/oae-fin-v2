const fs = require('fs');

const pagePath = 'src/app/projetos/page.js';
let page = fs.readFileSync(pagePath, 'utf8');

const before = `  // Receita liquida dos projetos acompanha o botao de rateio administrativo.\n  // A base consolidada usa o valor efetivamente recebido da CR_GERAL (coluna K).\n  const receitaLiquidaProjetos = filteredProjetos.reduce((acc, p) => {\n    const direta = Number(p.receitaDireta) || 0;\n    const adm = incluirRateioAdm ? (Number(p.receitaAdm) || 0) : 0;\n    return acc + direta + adm;\n  }, 0);`;

const after = `  // Receita liquida dos projetos acompanha o botao de rateio administrativo.\n  // No consolidado geral, a fonte de verdade e a CR_GERAL (coluna K), somando\n  // diretamente as receitas 1010101 + 1010107 realizadas dentro do periodo.\n  // O vinculo por obra so passa a limitar o total quando ha filtro de projeto/empresa/tipo\n  // ou filtro inline da tabela. Isso evita perder receitas validas por falha de associacao\n  // com a carteira PROJETOS_2026.\n  const hasProjectScopeFilter = filterProjetos.length > 0\n    || filterEmpresas.length > 0\n    || filterTipos.length > 0\n    || Boolean(colFilterProjeto)\n    || Boolean(colFilterEmpresa)\n    || parsePercentFilter(colFilterMinFaturadoPerc) !== null;\n\n  const receitaLiquidaProjetos = useMemo(() => {\n    if (hasProjectScopeFilter) {\n      return filteredProjetos.reduce((acc, p) => {\n        const direta = Number(p.receitaDireta) || 0;\n        const adm = incluirRateioAdm ? (Number(p.receitaAdm) || 0) : 0;\n        return acc + direta + adm;\n      }, 0);\n    }\n\n    return baseData.reduce((acc, item) => {\n      if (String(item?.natureza || '').toUpperCase() !== 'ENTRADA') return acc;\n\n      const status = String(item?.status || '').toUpperCase();\n      const isRealizado = status.includes('REALIZADO')\n        || status.includes('RECEBIDO')\n        || status.includes('EFETIVADO');\n      if (!isRealizado) return acc;\n\n      let ts = 0;\n      if (item.data) {\n        const parts = String(item.data).split('/');\n        if (parts.length === 3) ts = new Date(parts[2], parts[1] - 1, parts[0]).getTime();\n      }\n      if (ts < realizadoIni || ts > realizadoFim) return acc;\n\n      return acc + (Number(item.valor) || 0);\n    }, 0);\n  }, [hasProjectScopeFilter, filteredProjetos, incluirRateioAdm, baseData, realizadoIni, realizadoFim]);`;

if (!page.includes(before)) {
  throw new Error('Trecho da receita liquida de projetos nao encontrado.');
}

page = page.replace(before, after);
fs.writeFileSync(pagePath, page, 'utf8');
console.log('Recebido liquido geral de projetos alinhado diretamente a CR_GERAL no periodo.');
