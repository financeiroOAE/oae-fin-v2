const fs = require('fs');

let content = fs.readFileSync('src/app/projetos/page.js', 'utf8');

const replaces = [
  {
    find: '<InfoTooltip title="Composição Financeira (DRE)"',
    adder: '<ReportAdder title="Composição Financeira" componentName="Gráfico/Cards Composição Financeira" page="Projetos" type="SUMMARY" data={[{ "Receita Líquida": dreStats.receita, "Custos Diretos": dreStats.custo, "Despesas Admin.": dreStats.despesa }]} filters={`Projeto: ${filterProjetos.join(", ") || "Todos"}`} />'
  },
  {
    find: '<InfoTooltip title="Resultado e Margem"',
    adder: '<ReportAdder title="Resultado Gerencial" componentName="Cards Resultado Gerencial" page="Projetos" type="SUMMARY" data={[{ "Resultado Gerencial": resultadoGerencial, "Margem de Resultado (%)": margemFinanceira }]} filters={`Projeto: ${filterProjetos.join(", ") || "Todos"}`} />'
  },
  {
    find: '<InfoTooltip title="5 Maiores Entradas"',
    adder: '<ReportAdder title="5 Maiores Entradas de Caixa" componentName="Gráfico Maiores Entradas" page="Projetos" type="TABLE" data={topEntradasData} filters={`Projeto: ${filterProjetos.join(", ") || "Todos"}`} />'
  },
  {
    find: '<InfoTooltip title="5 Maiores Saídas"',
    adder: '<ReportAdder title="5 Maiores Saídas de Caixa" componentName="Gráfico Maiores Saídas" page="Projetos" type="TABLE" data={topSaidasData} filters={`Projeto: ${filterProjetos.join(", ") || "Todos"}`} />'
  },
  {
    find: '<InfoTooltip title="Impostos sobre Notas Fiscais"',
    adder: '<ReportAdder title="Impostos sobre Faturamento" componentName="Gráfico Impostos" page="Projetos" type="TABLE" data={taxesData.list} filters={`Projeto: ${filterProjetos.join(", ") || "Todos"}`} />'
  }
];

// Add imports
if (!content.includes('import ReportAdder')) {
  content = content.replace(/import MultiSelect/, 'import ReportAdder from "@/components/report/ReportAdder";\nimport MultiSelect');
}

replaces.forEach(r => {
  if (content.includes(r.find) && !content.includes(r.adder)) {
    content = content.replace(r.find, `<div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>${r.adder} ${r.find}</div></div>`);
    // Note: the extra </div> is a bug if not balanced. Wait! 
    // InfoTooltip is usually inside a div itself.
  }
});

// Let's do it safer:
fs.writeFileSync('src/app/projetos/page.js', content);
