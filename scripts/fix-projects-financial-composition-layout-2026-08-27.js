const fs = require('fs');

const pagePath = 'src/app/projetos/page.js';
const cssPath = 'src/app/globals.css';

function replaceOnce(content, before, after, label) {
  if (!content.includes(before)) {
    throw new Error(`Trecho nao encontrado: ${label}`);
  }
  return content.replace(before, after);
}

let page = fs.readFileSync(pagePath, 'utf8');

page = replaceOnce(
  page,
  `<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: '1rem', marginBottom: '2rem', alignItems: 'stretch' }}>`,
  `<div className="projects-financial-summary-grid" style={{ display: 'grid', gap: '1rem', marginBottom: '2rem', alignItems: 'stretch' }}>`,
  'grid externo composicao + resultado'
);

page = replaceOnce(
  page,
  `<div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>`,
  `<div className="projects-financial-metrics-grid">`,
  'grid dos quatro indicadores'
);

page = replaceOnce(
  page,
  `<div style={{ flex: '1 1 135px', minWidth: 0, overflow: 'visible' }}>\n              <p style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>\n                RECEITA`,
  `<div className="projects-financial-metric">\n              <p className="projects-financial-metric-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>\n                RECEITA`,
  'metrica receita'
);

page = replaceOnce(
  page,
  `<p title={\`Receita Líquida Realizada: \${formatCurrency(receitaLiquidaProjetos)}\`} style={{ fontSize: 'clamp(11px, 1vw, 15px)', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'visible', minWidth: 0, maxWidth: '100%', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.035em', color: 'var(--success)', cursor: 'help' }}>{formatCurrency(receitaLiquidaProjetos)}</p>`,
  `<p title={\`Receita Líquida Realizada: \${formatCurrency(receitaLiquidaProjetos)}\`} className="projects-financial-metric-value" style={{ color: 'var(--success)', cursor: 'help' }}>{formatCurrency(receitaLiquidaProjetos)}</p>`,
  'valor receita'
);

page = replaceOnce(
  page,
  `<div style={{ flex: '1 1 135px', minWidth: 0, overflow: 'visible' }}>\n              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Custos Diretos</p>\n              <p style={{ fontSize: 'clamp(11px, 1vw, 15px)', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'visible', minWidth: 0, maxWidth: '100%', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.035em', color: 'var(--warning)' }}>{formatCurrency(dreStats.custo)}</p>\n              {receitaLiquidaProjetos > 0 && <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{((dreStats.custo / receitaLiquidaProjetos) * 100).toFixed(1)}% da Receita</span>}\n            </div>`,
  `<div className="projects-financial-metric">\n              <p className="projects-financial-metric-label">Custos Diretos</p>\n              <p className="projects-financial-metric-value" style={{ color: 'var(--warning)' }}>{formatCurrency(dreStats.custo)}</p>\n              <span className="projects-financial-metric-sub">{receitaLiquidaProjetos > 0 ? \`${((dreStats.custo / receitaLiquidaProjetos) * 100).toFixed(1)}% da Receita\` : '0,0% da Receita'}</span>\n            </div>`,
  'metrica custos'
);

page = replaceOnce(
  page,
  `<div style={{ flex: '1 1 135px', minWidth: 0, overflow: 'visible' }}>\n              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Outras Despesas</p>\n              <p style={{ fontSize: 'clamp(11px, 1vw, 15px)', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'visible', minWidth: 0, maxWidth: '100%', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.035em', color: 'var(--danger)' }}>{formatCurrency(dreStats.despesa)}</p>\n              {receitaLiquidaProjetos > 0 && <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{((dreStats.despesa / receitaLiquidaProjetos) * 100).toFixed(1)}% da Receita</span>}\n            </div>`,
  `<div className="projects-financial-metric">\n              <p className="projects-financial-metric-label">Outras Despesas</p>\n              <p className="projects-financial-metric-value" style={{ color: 'var(--danger)' }}>{formatCurrency(dreStats.despesa)}</p>\n              <span className="projects-financial-metric-sub">{receitaLiquidaProjetos > 0 ? \`${((dreStats.despesa / receitaLiquidaProjetos) * 100).toFixed(1)}% da Receita\` : '0,0% da Receita'}</span>\n            </div>`,
  'metrica despesas'
);

page = replaceOnce(
  page,
  `<div style={{ flex: '1 1 135px', minWidth: 0, overflow: 'visible' }}>\n              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Tributos</p>\n              <p style={{ fontSize: 'clamp(11px, 1vw, 15px)', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'visible', minWidth: 0, maxWidth: '100%', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.035em', color: 'var(--primary)' }}>{formatCurrency(tributosProjetos)}</p>\n              {receitaLiquidaProjetos > 0 && <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{((tributosProjetos / receitaLiquidaProjetos) * 100).toFixed(1)}% da Receita</span>}\n            </div>`,
  `<div className="projects-financial-metric">\n              <p className="projects-financial-metric-label">Tributos</p>\n              <p className="projects-financial-metric-value" style={{ color: 'var(--primary)' }}>{formatCurrency(tributosProjetos)}</p>\n              <span className="projects-financial-metric-sub">{receitaLiquidaProjetos > 0 ? \`${((tributosProjetos / receitaLiquidaProjetos) * 100).toFixed(1)}% da Receita\` : '0,0% da Receita'}</span>\n            </div>`,
  'metrica tributos'
);

page = replaceOnce(
  page,
  `<div className="card" style={{ padding: '1.5rem', borderTop: '2px solid var(--primary)', display: 'flex', flexDirection: 'column', height: '100%' }}>`,
  `<div className="card projects-managerial-result-card" style={{ padding: '1.5rem', borderTop: '2px solid var(--primary)', display: 'flex', flexDirection: 'column', height: '100%' }}>`,
  'classe do resultado gerencial'
);

page = replaceOnce(
  page,
  `<div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>\n            <p style={{ fontSize: 'clamp(20px, 2vw, 26px)', fontWeight: '700', color: resultadoGerencial >= 0 ? 'var(--success)' : 'var(--danger)', letterSpacing: '-0.03em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'clip', minWidth: 0, fontVariantNumeric: 'tabular-nums' }}>`,
  `<div className="projects-managerial-result-content">\n            <p className="projects-managerial-result-value" style={{ color: resultadoGerencial >= 0 ? 'var(--success)' : 'var(--danger)' }}>`,
  'conteudo resultado gerencial'
);

page = replaceOnce(
  page,
  `<div style={{ width: '100%', height: '6px', background: 'var(--bg-main)', borderRadius: '3px', overflow: 'hidden' }}>`,
  `<div style={{ width: '100%', height: '10px', background: 'var(--bg-main)', borderRadius: '999px', overflow: 'hidden' }}>`,
  'barra margem resultado'
);

fs.writeFileSync(pagePath, page, 'utf8');

let css = fs.readFileSync(cssPath, 'utf8');
const marker = '/* Projects financial composition layout - 2026-08-27 */';
if (!css.includes(marker)) {
  css += `\n\n${marker}\n.projects-financial-summary-grid {\n  grid-template-columns: minmax(0, 1.65fr) minmax(285px, 0.85fr);\n}\n\n.projects-financial-metrics-grid {\n  display: grid;\n  grid-template-columns: repeat(4, minmax(0, 1fr));\n  gap: 1rem;\n  align-items: start;\n  margin-bottom: 1.5rem;\n}\n\n.projects-financial-metric {\n  min-width: 0;\n  display: flex;\n  flex-direction: column;\n  gap: 0.35rem;\n}\n\n.projects-financial-metric-label {\n  margin: 0;\n  color: var(--text-secondary);\n  font-size: 10.5px;\n  font-weight: 600;\n  line-height: 1.2;\n  text-transform: uppercase;\n  white-space: nowrap;\n}\n\n.projects-financial-metric-value {\n  margin: 0;\n  min-width: 0;\n  max-width: 100%;\n  color: var(--text-main);\n  font-size: clamp(13px, 1.18vw, 18px);\n  font-weight: 700;\n  line-height: 1.15;\n  white-space: nowrap;\n  font-variant-numeric: tabular-nums;\n  letter-spacing: -0.035em;\n}\n\n.projects-financial-metric-sub {\n  color: var(--text-secondary);\n  font-size: 10px;\n  line-height: 1.2;\n  white-space: nowrap;\n}\n\n.projects-managerial-result-card {\n  min-height: 0;\n}\n\n.projects-managerial-result-content {\n  flex: 1;\n  min-height: 145px;\n  display: flex;\n  flex-direction: column;\n  justify-content: space-between;\n  padding-top: 0.25rem;\n}\n\n.projects-managerial-result-value {\n  margin: 0;\n  min-width: 0;\n  font-size: clamp(24px, 2.25vw, 34px);\n  font-weight: 800;\n  line-height: 1.05;\n  letter-spacing: -0.04em;\n  white-space: nowrap;\n  font-variant-numeric: tabular-nums;\n}\n\n@media (max-width: 1120px) {\n  .projects-financial-summary-grid {\n    grid-template-columns: 1fr;\n  }\n  .projects-managerial-result-content {\n    min-height: 125px;\n  }\n}\n\n@media (max-width: 760px) {\n  .projects-financial-metrics-grid {\n    grid-template-columns: repeat(2, minmax(0, 1fr));\n  }\n  .projects-financial-metric-label,\n  .projects-financial-metric-value,\n  .projects-financial-metric-sub {\n    white-space: normal;\n  }\n}\n\n@media (max-width: 420px) {\n  .projects-financial-metrics-grid {\n    grid-template-columns: 1fr;\n  }\n}\n`;
}
fs.writeFileSync(cssPath, css, 'utf8');

console.log('Layout da Composicao Financeira e Resultado Gerencial ajustado.');
