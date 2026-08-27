const fs = require('fs');

const path = 'src/app/projetos/page.js';
let content = fs.readFileSync(path, 'utf8');

function replaceOnce(before, after, label) {
  if (!content.includes(before)) {
    throw new Error(`Trecho nao encontrado: ${label}`);
  }
  content = content.replace(before, after);
}

const compactValueBase = "fontSize: 'clamp(14px, 1.25vw, 18px)', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'clip', minWidth: 0, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em'";

replaceOnce(
  "<p style={{ fontSize: '19px', fontWeight: '700', color: 'var(--success)' }}>{formatCurrency(receitaLiquidaProjetos)}</p>",
  `<p style={{ ${compactValueBase}, color: 'var(--success)' }}>{formatCurrency(receitaLiquidaProjetos)}</p>`,
  'Receita Liquida'
);

replaceOnce(
  "<p style={{ fontSize: '19px', fontWeight: '700', color: 'var(--warning)' }}>{formatCurrency(dreStats.custo)}</p>",
  `<p style={{ ${compactValueBase}, color: 'var(--warning)' }}>{formatCurrency(dreStats.custo)}</p>`,
  'Custos Diretos'
);

replaceOnce(
  "<p style={{ fontSize: '19px', fontWeight: '700', color: 'var(--danger)' }}>{formatCurrency(dreStats.despesa)}</p>",
  `<p style={{ ${compactValueBase}, color: 'var(--danger)' }}>{formatCurrency(dreStats.despesa)}</p>`,
  'Outras Despesas'
);

replaceOnce(
  "<p style={{ fontSize: '19px', fontWeight: '700', color: 'var(--primary)' }}>{formatCurrency(dreStats.tributos)}</p>",
  `<p style={{ ${compactValueBase}, color: 'var(--primary)' }}>{formatCurrency(dreStats.tributos)}</p>`,
  'Tributos'
);

replaceOnce(
  "<p style={{ fontSize: '28px', fontWeight: '700', color: resultadoGerencial >= 0 ? 'var(--success)' : 'var(--danger)', letterSpacing: '-1px' }}>",
  "<p style={{ fontSize: 'clamp(20px, 2vw, 26px)', fontWeight: '700', color: resultadoGerencial >= 0 ? 'var(--success)' : 'var(--danger)', letterSpacing: '-0.03em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'clip', minWidth: 0, fontVariantNumeric: 'tabular-nums' }}>",
  'Resultado Gerencial'
);

// Os quatro blocos da composicao precisam poder encolher sem forcar quebra do valor.
content = content.replaceAll(
  "<div style={{ flex: 1, minWidth: '120px' }}>",
  "<div style={{ flex: '1 1 120px', minWidth: 0, overflow: 'hidden' }}>"
);

fs.writeFileSync(path, content, 'utf8');
console.log('Valores da Composicao Financeira e Resultado Gerencial ajustados para uma linha.');
