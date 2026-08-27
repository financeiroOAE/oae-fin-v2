const fs = require('fs');

const file = 'src/app/projetos/page.js';
let src = fs.readFileSync(file, 'utf8');

function replaceOrFail(from, to, label) {
  if (!src.includes(from)) {
    throw new Error(`Trecho nao encontrado: ${label}`);
  }
  src = src.replace(from, to);
}

replaceOrFail(
  `<p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Classificação dos valores realizados em 2026</p>`,
  `<p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Faturamento, custos, despesas e tributos em 2026</p>`,
  'subtitulo da composicao'
);

replaceOrFail(
  `<ReportAdder sectionKey="projetos:composicao" title="Composição Financeira" componentName="Composição Financeira - Projetos" page="Projetos" type="SUMMARY" data={[{ "Receita Líquida de Projetos": receitaLiquidaProjetos, "Custos Diretos": dreStats.custo, "Despesas": dreStats.despesa, "Tributos": dreStats.tributos, "Não Classificado": dreStats.naoClassificado }]} filters={reportFilters} presetTags={["project-executive"]} explanation="Composição gerencial da receita líquida, custos e despesas dos projetos selecionados." />`,
  `<ReportAdder sectionKey="projetos:composicao" title="Composição Financeira" componentName="Composição Financeira - Projetos" page="Projetos" type="SUMMARY" data={[{ "Faturado em 2026": totalFaturado2026, "Receita Líquida Realizada": receitaLiquidaProjetos, "Custos Diretos": dreStats.custo, "Despesas": dreStats.despesa, "Tributos": dreStats.tributos, "Não Classificado": dreStats.naoClassificado }]} filters={reportFilters} presetTags={["project-executive"]} explanation="Composição gerencial baseada no faturamento de 2026, mantendo a receita líquida realizada como informação complementar." />`,
  'report adder da composicao'
);

replaceOrFail(
  `<InfoTooltip title="Composição Financeira (DRE)" content="Receita, custos, despesas, tributos e valores não classificados dos projetos selecionados." />`,
  `<InfoTooltip title="Composição Financeira" content={\`Faturado em 2026: \${formatCurrency(totalFaturado2026)}. Receita líquida realizada: \${formatCurrency(receitaLiquidaProjetos)}. Custos, despesas e tributos são comparados ao faturamento neste card.\`} />`,
  'tooltip geral da composicao'
);

replaceOrFail(
  `                RECEITA LÍQUIDA\n                <InfoTooltip\n                  title="Receita Líquida Realizada"\n                  content={\`Receita líquida realizada: \${formatCurrency(receitaLiquidaProjetos)}. É o valor efetivamente creditado, após descontos e retenções identificados na relação de recebimentos.\`}\n                />`,
  `                FATURADO 2026\n                <InfoTooltip\n                  title="Faturado em 2026"\n                  content={\`Faturado em 2026: \${formatCurrency(totalFaturado2026)}. Receita líquida realizada: \${formatCurrency(receitaLiquidaProjetos)}. A receita líquida é o valor efetivamente creditado após descontos e retenções.\`}\n                />`,
  'rotulo e tooltip da receita'
);

replaceOrFail(
  `<p style={{ fontSize: 'clamp(14px, 1.25vw, 18px)', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'clip', minWidth: 0, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', color: 'var(--success)' }}>{formatCurrency(receitaLiquidaProjetos)}</p>`,
  `<p title={\`Receita Líquida: \${formatCurrency(receitaLiquidaProjetos)}\`} style={{ fontSize: 'clamp(14px, 1.25vw, 18px)', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'clip', minWidth: 0, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', color: 'var(--success)', cursor: 'help' }}>{formatCurrency(totalFaturado2026)}</p>`,
  'valor principal faturado'
);

replaceOrFail(
  `{receitaLiquidaProjetos > 0 && <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{((dreStats.custo / receitaLiquidaProjetos) * 100).toFixed(1)}% da Receita</span>}`,
  `{totalFaturado2026 > 0 && <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{((dreStats.custo / totalFaturado2026) * 100).toFixed(1)}% do Faturado</span>}`,
  'percentual custos'
);

replaceOrFail(
  `{receitaLiquidaProjetos > 0 && <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{((dreStats.despesa / receitaLiquidaProjetos) * 100).toFixed(1)}% da Receita</span>}`,
  `{totalFaturado2026 > 0 && <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{((dreStats.despesa / totalFaturado2026) * 100).toFixed(1)}% do Faturado</span>}`,
  'percentual despesas'
);

replaceOrFail(
  `{receitaLiquidaProjetos > 0 && <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{((dreStats.tributos / receitaLiquidaProjetos) * 100).toFixed(1)}% da Receita</span>}`,
  `{totalFaturado2026 > 0 && <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{((dreStats.tributos / totalFaturado2026) * 100).toFixed(1)}% do Faturado</span>}`,
  'percentual tributos'
);

replaceOrFail(
  `          {receitaLiquidaProjetos > 0 && (\n            <div style={{ width: '100%', height: '12px', background: 'var(--bg-main)', borderRadius: '6px', display: 'flex', overflow: 'hidden' }}>\n              <div style={{ width: \`${'${'}Math.max(0, 100 - ((dreStats.custo + dreStats.despesa + dreStats.tributos) / receitaLiquidaProjetos) * 100)}%\`, background: 'var(--success)', transition: 'width 0.3s ease' }} />\n              <div style={{ width: \`${'${'}(dreStats.custo / receitaLiquidaProjetos) * 100}%\`, background: 'var(--warning)', transition: 'width 0.3s ease' }} />\n              <div style={{ width: \`${'${'}(dreStats.despesa / receitaLiquidaProjetos) * 100}%\`, background: 'var(--danger)', transition: 'width 0.3s ease' }} />\n              <div style={{ width: \`${'${'}(dreStats.tributos / receitaLiquidaProjetos) * 100}%\`, background: 'var(--primary)', transition: 'width 0.3s ease' }} />\n            </div>\n          )}`,
  `          {totalFaturado2026 > 0 && (\n            <div style={{ width: '100%', height: '12px', background: 'var(--bg-main)', borderRadius: '6px', display: 'flex', overflow: 'hidden' }}>\n              <div style={{ width: \`${'${'}Math.max(0, 100 - ((dreStats.custo + dreStats.despesa + dreStats.tributos) / totalFaturado2026) * 100)}%\`, background: 'var(--success)', transition: 'width 0.3s ease' }} />\n              <div style={{ width: \`${'${'}(dreStats.custo / totalFaturado2026) * 100}%\`, background: 'var(--warning)', transition: 'width 0.3s ease' }} />\n              <div style={{ width: \`${'${'}(dreStats.despesa / totalFaturado2026) * 100}%\`, background: 'var(--danger)', transition: 'width 0.3s ease' }} />\n              <div style={{ width: \`${'${'}(dreStats.tributos / totalFaturado2026) * 100}%\`, background: 'var(--primary)', transition: 'width 0.3s ease' }} />\n            </div>\n          )}`,
  'barra de composicao'
);

fs.writeFileSync(file, src, 'utf8');
console.log('Composicao Financeira atualizada: Faturado 2026 como valor principal e Receita Liquida no hover.');
