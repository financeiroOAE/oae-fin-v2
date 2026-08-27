const fs = require('fs');

function replaceOnce(path, before, after, label) {
  const source = fs.readFileSync(path, 'utf8');
  if (!source.includes(before)) {
    throw new Error(`Trecho nao encontrado: ${label}`);
  }
  fs.writeFileSync(path, source.replace(before, after), 'utf8');
}

replaceOnce(
  'src/app/visao-financeira/page.js',
  `<p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Recebido líquido de projetos versus custos/despesas e tributos realizados, com INSS sobre faturamento separado na leitura.</p>`,
  `<p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Margem = Resultado ÷ Recebido Líquido × 100. O Resultado corresponde ao Recebido Líquido menos Custos + Despesas e Tributos realizados.</p>`,
  'explicacao da margem na Visao Financeira'
);

replaceOnce(
  'src/app/fluxo-caixa/page.js',
  `      const status = String(item.status || '').trim().toUpperCase();\n      const forecastOnly = item.natureza === 'Entrada' && isForecastOnlyReceivableDocument(item);\n      const isForecast = status === 'A REALIZAR' || forecastOnly;\n      if(isForecast && map[item.dataTimestamp]) {`,
  `      const status = String(item.status || '').trim().toUpperCase();\n      const forecastOnly = item.natureza === 'Entrada' && isForecastOnlyReceivableDocument(item);\n\n      // PCT/PRV sao documentos auxiliares de previsao e nao devem compor\n      // a receita prevista do Fluxo de Caixa de 7 dias, mesmo quando a origem\n      // vier com status A REALIZAR.\n      if (forecastOnly) return;\n\n      const isForecast = status === 'A REALIZAR';\n      if(isForecast && map[item.dataTimestamp]) {`,
  'exclusao PCT PRV da previsao semanal'
);

console.log('Ajustes de margem e previsao semanal PCT/PRV aplicados.');
