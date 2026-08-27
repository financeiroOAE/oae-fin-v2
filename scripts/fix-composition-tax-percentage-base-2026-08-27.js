const fs = require('fs');

const pagePath = 'src/app/projetos/page.js';
let page = fs.readFileSync(pagePath, 'utf8');

const before = `{receitaLiquidaProjetos > 0 && <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{((tributosProjetos / receitaLiquidaProjetos) * 100).toFixed(1)}% da Receita</span>}`;
const after = `{totalFaturado2026 > 0 && <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{taxPercentage.toFixed(1).replace('.', ',')}% do Faturamento</span>}`;

if (!page.includes(before)) {
  throw new Error('Percentual de tributos da Composicao Financeira nao encontrado.');
}

page = page.replace(before, after);
fs.writeFileSync(pagePath, page, 'utf8');
console.log('Composicao Financeira: percentual de tributos alinhado ao faturamento anual.');
