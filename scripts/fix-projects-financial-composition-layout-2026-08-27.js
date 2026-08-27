const fs = require('fs');

const pagePath = 'src/app/projetos/page.js';
const cssPath = 'src/app/globals.css';

let page = fs.readFileSync(pagePath, 'utf8');

const changes = [
  [
    `<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: '1rem', marginBottom: '2rem', alignItems: 'stretch' }}>`,
    `<div className="projects-financial-summary-grid" style={{ display: 'grid', gap: '1rem', marginBottom: '2rem', alignItems: 'stretch' }}>`
  ],
  [
    `<div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>`,
    `<div className="projects-financial-metrics-grid">`
  ],
  [
    `<div className="card" style={{ padding: '1.5rem', borderTop: '2px solid var(--primary)', display: 'flex', flexDirection: 'column', height: '100%' }}>`,
    `<div className="card projects-managerial-result-card" style={{ padding: '1.5rem', borderTop: '2px solid var(--primary)', display: 'flex', flexDirection: 'column', height: '100%' }}>`
  ],
  [
    `<div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>\n            <p style={{ fontSize: 'clamp(20px, 2vw, 26px)', fontWeight: '700', color: resultadoGerencial >= 0 ? 'var(--success)' : 'var(--danger)', letterSpacing: '-0.03em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'clip', minWidth: 0, fontVariantNumeric: 'tabular-nums' }}>`,
    `<div className="projects-managerial-result-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>\n            <p className="projects-managerial-result-value" style={{ color: resultadoGerencial >= 0 ? 'var(--success)' : 'var(--danger)' }}>`
  ]
];

let applied = 0;
for (const [before, after] of changes) {
  if (page.includes(after)) continue;
  if (page.includes(before)) {
    page = page.replace(before, after);
    applied += 1;
  }
}

if (!page.includes('projects-financial-summary-grid') || !page.includes('projects-financial-metrics-grid')) {
  throw new Error('Nao foi possivel localizar a secao Composicao Financeira na versao atual.');
}

fs.writeFileSync(pagePath, page, 'utf8');

let css = fs.readFileSync(cssPath, 'utf8');
const marker = '/* Projects financial composition layout - 2026-08-27 */';
if (!css.includes(marker)) {
  css += `\n\n${marker}\n.projects-financial-summary-grid {\n  grid-template-columns: minmax(0, 1.7fr) minmax(300px, 0.8fr);\n}\n\n.projects-financial-metrics-grid {\n  display: grid !important;\n  grid-template-columns: repeat(4, minmax(0, 1fr));\n  gap: 0.9rem !important;\n  align-items: start;\n  margin-bottom: 1.5rem !important;\n}\n\n.projects-financial-metrics-grid > div {\n  min-width: 0 !important;\n  flex: initial !important;\n  overflow: visible !important;\n}\n\n.projects-financial-metrics-grid > div > p:first-child {\n  min-height: 26px;\n  margin-bottom: 0.2rem !important;\n  font-size: 10px !important;\n  font-weight: 600;\n  line-height: 1.15;\n  white-space: nowrap;\n}\n\n.projects-financial-metrics-grid > div > p:nth-child(2) {\n  font-size: clamp(13px, 1.15vw, 17px) !important;\n  line-height: 1.15;\n  white-space: nowrap !important;\n  font-variant-numeric: tabular-nums;\n}\n\n.projects-financial-metrics-grid > div > span {\n  display: block;\n  margin-top: 0.3rem;\n  font-size: 10px !important;\n  line-height: 1.15;\n  white-space: nowrap;\n}\n\n.projects-managerial-result-card {\n  min-height: 0;\n}\n\n.projects-managerial-result-content {\n  min-height: 138px;\n  justify-content: space-between !important;\n  padding-top: 0.25rem;\n}\n\n.projects-managerial-result-value {\n  margin: 0;\n  min-width: 0;\n  font-size: clamp(24px, 2.2vw, 34px) !important;\n  font-weight: 800 !important;\n  line-height: 1.05;\n  letter-spacing: -0.04em !important;\n  white-space: nowrap !important;\n  overflow: visible !important;\n  font-variant-numeric: tabular-nums;\n}\n\n@media (max-width: 1120px) {\n  .projects-financial-summary-grid {\n    grid-template-columns: 1fr;\n  }\n  .projects-managerial-result-content {\n    min-height: 115px;\n  }\n}\n\n@media (max-width: 760px) {\n  .projects-financial-metrics-grid {\n    grid-template-columns: repeat(2, minmax(0, 1fr));\n  }\n  .projects-financial-metrics-grid > div > p:first-child,\n  .projects-financial-metrics-grid > div > p:nth-child(2),\n  .projects-financial-metrics-grid > div > span {\n    white-space: normal !important;\n  }\n}\n\n@media (max-width: 420px) {\n  .projects-financial-metrics-grid {\n    grid-template-columns: 1fr;\n  }\n}\n`;
}
fs.writeFileSync(cssPath, css, 'utf8');

console.log(`Layout financeiro ajustado. Alteracoes estruturais aplicadas: ${applied}.`);
