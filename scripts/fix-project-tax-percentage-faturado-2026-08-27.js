const fs = require('fs');

const pagePath = 'src/app/projetos/page.js';
let page = fs.readFileSync(pagePath, 'utf8');

const before = `  // A aliquota efetiva de tributos e calculada sobre o FATURAMENTO, nao sobre o caixa recebido.\n  const taxPercentage = totalFaturado > 0 ? (tributosProjetos / totalFaturado) * 100 : 0;`;
const after = `  // A aliquota efetiva de tributos usa como base o faturamento anual consolidado da coluna dedicada.\n  // Na interface, a descricao permanece apenas como \"sobre o Faturamento\".\n  const taxPercentage = totalFaturado2026 > 0 ? (tributosProjetos / totalFaturado2026) * 100 : 0;`;

if (!page.includes(before)) {
  throw new Error('Trecho do percentual de tributos nao encontrado.');
}

page = page.replace(before, after);
fs.writeFileSync(pagePath, page, 'utf8');
console.log('Percentual de tributos ajustado para usar o faturado anual consolidado.');
