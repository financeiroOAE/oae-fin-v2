const fs = require('fs');

const path = 'src/app/projetos/page.js';
let content = fs.readFileSync(path, 'utf8');

function replaceOnce(before, after, label) {
  if (content.includes(after)) {
    console.log(`${label}: já aplicado.`);
    return;
  }
  if (!content.includes(before)) {
    throw new Error(`Trecho não encontrado: ${label}`);
  }
  content = content.replace(before, after);
  console.log(`${label}: aplicado.`);
}

replaceOnce(
  "  const listaProjetos = Array.from(new Set([...projetosCruzados.map(p => p.nome), 'ADMINISTRAÇÃO'])).sort((a, b) => a.localeCompare(b, 'pt-BR'));",
  "  // Regra oficial dos filtros de Projetos: exibir os nomes da relação PROJETOS_2026 / centro de custo, sem códigos financeiros P.xxx e sem duplicidade.\n  const listaProjetos = getActiveProjectNames(projetosBrutos, true);",
  'lista oficial de projetos no filtro'
);

replaceOnce(
  "Faturamento, custos, despesas e tributos em 2026",
  "Faturamento, custos, despesas e tributos",
  'subtítulo da composição financeira'
);

replaceOnce(
  'data={[{ "Faturado em 2026": totalFaturado2026, "Receita Líquida Realizada": receitaLiquidaProjetos, "Custos Diretos": dreStats.custo, "Despesas": dreStats.despesa, "Tributos": dreStats.tributos, "Não Classificado": dreStats.naoClassificado }]}',
  'data={[{ "Faturado": totalFaturado2026, "Receita Líquida Realizada": receitaLiquidaProjetos, "Custos Diretos": dreStats.custo, "Despesas": dreStats.despesa, "Tributos": dreStats.tributos, "Não Classificado": dreStats.naoClassificado }]}',
  'rótulo do faturado no relatório da composição'
);

replaceOnce(
  'explanation="Composição gerencial baseada no faturamento de 2026, mantendo a receita líquida realizada como informação complementar."',
  'explanation="Composição gerencial baseada no faturamento da carteira, mantendo a receita líquida realizada como informação complementar."',
  'explicação da composição'
);

replaceOnce(
  '<InfoTooltip title="Composição Financeira" content={`Faturado em 2026: ${formatCurrency(totalFaturado2026)}. Receita líquida realizada: ${formatCurrency(receitaLiquidaProjetos)}. Custos, despesas e tributos são comparados ao faturamento neste card.`} />',
  '<InfoTooltip title="Composição Financeira" content={`Faturado: ${formatCurrency(totalFaturado2026)}. Receita líquida realizada: ${formatCurrency(receitaLiquidaProjetos)}. Custos, despesas e tributos são comparados ao faturamento neste card.`} />',
  'tooltip geral da composição'
);

replaceOnce(
  '                FATURADO 2026',
  '                FATURADO',
  'rótulo visível Faturado'
);

replaceOnce(
  '                  title="Faturado em 2026"',
  '                  title="Faturado"',
  'título do tooltip Faturado'
);

replaceOnce(
  '                  content={`Faturado em 2026: ${formatCurrency(totalFaturado2026)}. Receita líquida realizada: ${formatCurrency(receitaLiquidaProjetos)}. A receita líquida é o valor efetivamente creditado após descontos e retenções.`}',
  '                  content={`Faturado: ${formatCurrency(totalFaturado2026)}. Receita líquida realizada: ${formatCurrency(receitaLiquidaProjetos)}. A receita líquida é o valor efetivamente creditado após descontos e retenções.`}',
  'conteúdo do tooltip Faturado'
);

fs.writeFileSync(path, content, 'utf8');
console.log('Correções de Projetos concluídas sem alterar cálculos financeiros.');
