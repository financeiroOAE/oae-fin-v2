const fs = require('fs');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content, 'utf8');
}

function replaceRequired(content, before, after, label) {
  if (content.includes(after)) {
    console.log(`${label}: ja aplicado.`);
    return content;
  }
  if (!content.includes(before)) {
    throw new Error(`Trecho nao encontrado: ${label}`);
  }
  return content.replace(before, after);
}

function replaceSection(content, startMarker, endMarker, mutate, label) {
  const start = content.indexOf(startMarker);
  if (start < 0) throw new Error(`Inicio nao encontrado: ${label}`);
  const end = content.indexOf(endMarker, start);
  if (end < 0) throw new Error(`Fim nao encontrado: ${label}`);
  const section = content.slice(start, end);
  const nextSection = mutate(section);
  if (nextSection === section) throw new Error(`Nenhuma alteracao em: ${label}`);
  return content.slice(0, start) + nextSection + content.slice(end);
}

// PROJETOS
{
  const path = 'src/app/projetos/page.js';
  let content = read(path);

  content = replaceRequired(
    content,
    "  const totalRecebido = filteredProjetos.reduce((acc, p) => acc + p.recebido, 0);\n  const totalAReceber = filteredProjetos.reduce((acc, p) => acc + p.aReceber, 0);\n  const totalPago = filteredProjetos.reduce((acc, p) => acc + p.pago, 0);\n  const receitaLiquidaProjetos = totalRecebido;",
    "  const totalRecebido = filteredProjetos.reduce((acc, p) => acc + p.recebido, 0);\n  const totalAReceber = filteredProjetos.reduce((acc, p) => acc + p.aReceber, 0);\n  const totalPago = filteredProjetos.reduce((acc, p) => acc + p.pago, 0);\n  // Receita liquida dos projetos acompanha o botao de rateio administrativo.\n  // A base consolidada usa o valor efetivamente recebido da CR_GERAL (coluna K).\n  const receitaLiquidaProjetos = filteredProjetos.reduce((acc, p) => {\n    const direta = Number(p.receitaDireta) || 0;\n    const adm = incluirRateioAdm ? (Number(p.receitaAdm) || 0) : 0;\n    return acc + direta + adm;\n  }, 0);",
    'receita sensivel ao rateio'
  );

  content = replaceRequired(
    content,
    "  const margemFinanceira = receitaLiquidaProjetos > 0 ? ((receitaLiquidaProjetos - dreStats.custo - dreStats.despesa - dreStats.tributos) / receitaLiquidaProjetos) * 100 : null;\n  const resultadoGerencial = receitaLiquidaProjetos - dreStats.custo - dreStats.despesa - dreStats.tributos;\n  // Base unica para o peso tributario: Recebido Liquido do mesmo periodo e dos mesmos filtros.\n  // Isso evita comparar tributos do periodo com um faturamento contratual acumulado de outra base temporal.\n  const taxPercentage = receitaLiquidaProjetos > 0 ? (taxesData.total / receitaLiquidaProjetos) * 100 : 0;",
    "  // Uma unica fonte de tributos em Projetos: realizados, no periodo e alocados aos projetos filtrados.\n  const tributosProjetos = taxesData.total;\n  const margemFinanceira = receitaLiquidaProjetos > 0 ? ((receitaLiquidaProjetos - dreStats.custo - dreStats.despesa - tributosProjetos) / receitaLiquidaProjetos) * 100 : null;\n  const resultadoGerencial = receitaLiquidaProjetos - dreStats.custo - dreStats.despesa - tributosProjetos;\n  const taxPercentage = receitaLiquidaProjetos > 0 ? (tributosProjetos / receitaLiquidaProjetos) * 100 : 0;",
    'fonte unica de tributos'
  );

  content = replaceSection(
    content,
    '      {/* 5. Composição Financeira + Resultado */}',
    '      <div id="report-projetos-evolucao-anual"',
    (section) => {
      let next = section;
      next = next.replaceAll('totalFaturado2026', 'receitaLiquidaProjetos');
      next = next.replaceAll('dreStats.tributos', 'tributosProjetos');
      next = next.replace('Faturamento, custos, despesas e tributos em 2026', 'Receita, custos, despesas e tributos no período selecionado');
      next = next.replace('FATURADO 2026', 'RECEITA');
      next = next.replace('title="Faturado"', 'title="Receita Líquida Realizada"');
      next = next.replaceAll('% do Faturado', '% da Receita');
      next = next.replace('"Faturado": receitaLiquidaProjetos, "Receita Líquida Realizada": receitaLiquidaProjetos,', '"Receita Líquida Realizada": receitaLiquidaProjetos,');
      next = next.replace('Composição gerencial baseada no faturamento da carteira, mantendo a receita líquida realizada como informação complementar.', 'Composição gerencial baseada na receita líquida realizada dos projetos no período. O rateio administrativo acompanha o botão do painel.');
      next = next.replace('Faturado: ${formatCurrency(receitaLiquidaProjetos)}. Receita líquida realizada: ${formatCurrency(receitaLiquidaProjetos)}. Custos, despesas e tributos são comparados ao faturamento neste card.', 'Receita líquida realizada: ${formatCurrency(receitaLiquidaProjetos)}. O valor acompanha o período, os filtros e o botão de rateio administrativo.');
      next = next.replace('Faturado: ${formatCurrency(receitaLiquidaProjetos)}. Receita líquida realizada: ${formatCurrency(receitaLiquidaProjetos)}. A receita líquida é o valor efetivamente creditado após descontos e retenções.', 'Receita líquida realizada: ${formatCurrency(receitaLiquidaProjetos)}. Inclui a parcela administrativa somente quando o rateio estiver ligado.');
      next = next.replace('title={`Faturado em 2026: ${formatCurrency(receitaLiquidaProjetos)}`}', 'title={`Receita Líquida Realizada: ${formatCurrency(receitaLiquidaProjetos)}`}');
      return next;
    },
    'composicao financeira por receita'
  );

  if (content.includes('"Tributos": dreStats.tributos') && content.includes('projetos:composicao')) {
    throw new Error('Composicao ainda usa tributos divergentes.');
  }

  write(path, content);
}

// DRE: datas ficam editaveis em todas as visoes, inclusive previsao.
{
  const path = 'src/app/dre/page.js';
  let content = read(path);

  content = replaceRequired(
    content,
    "  const annualView = visao !== 'REALIZADO';\n  const annualRange = getDreDateRange(visao);\n  const effectiveDataInicial = annualView ? annualRange.start : filterDataInicial;\n  const effectiveDataFinal = annualView ? annualRange.end : filterDataFinal;",
    "  // Todas as visoes respeitam o periodo escolhido, inclusive previsoes.\n  const effectiveDataInicial = filterDataInicial;\n  const effectiveDataFinal = filterDataFinal;",
    'periodo editavel da DRE'
  );

  content = content.replaceAll(' disabled={annualView}', '');
  content = content.replaceAll(' title={annualView ? "A visão anual usa o ano completo" : undefined}', '');
  content = content.replaceAll('opacity: annualView ? 0.7 : 1', 'opacity: 1');

  if (content.includes('annualView')) throw new Error('Referencia annualView ainda presente na DRE.');
  write(path, content);
}

// MOTOR DRE: o status define realizado/previsto e o filtro de datas define o intervalo.
{
  const path = 'src/lib/dreEngine.js';
  let content = read(path);

  const todayBlock = "  // Data de corte = Início do dia de hoje\n  const hoje = new Date();\n  hoje.setHours(0, 0, 0, 0);\n  const hojeTs = hoje.getTime();\n  const endOf2026 = new Date('2026-12-31T23:59:59').getTime();\n\n";
  if (content.includes(todayBlock)) content = content.replace(todayBlock, '');
  content = content.replace('    const ts = item.dataTimestamp || 0;\n\n', '');

  const startMarker = '    // Lógica da visão';
  const endMarker = '    // Filtro para "Fora da DRE"';
  const start = content.indexOf(startMarker);
  const end = content.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw new Error('Bloco de visao da DRE nao encontrado.');

  const statusBlock = [
    '    // Lógica da visão: o período selecionado é a regra temporal.',
    "    if (visao === 'REALIZADO') {",
    '      if (!isRealizado) return false;',
    "    } else if (visao === 'SOMENTE_PREVISAO') {",
    '      if (!isPrevisto) return false;',
    "    } else if (visao === 'REALIZADO_PREVISAO') {",
    '      if (!isRealizado && !isPrevisto) return false;',
    '    }',
    '',
  ].join('\n');

  content = content.slice(0, start) + statusBlock + content.slice(end);

  if (content.includes('hojeTs') || content.includes('endOf2026')) {
    throw new Error('Corte por data atual ainda presente no motor DRE.');
  }

  write(path, content);
}

console.log('Receita por rateio, tributos unificados e previsoes no periodo da DRE aplicados.');
