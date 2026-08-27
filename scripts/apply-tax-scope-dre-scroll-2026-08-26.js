const fs = require('fs');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content, 'utf8');
}

function replaceOnce(content, before, after, label) {
  if (content.includes(after)) {
    console.log(`${label}: ja aplicado.`);
    return content;
  }
  if (!content.includes(before)) {
    throw new Error(`Trecho nao encontrado: ${label}`);
  }
  return content.replace(before, after);
}

function replaceAllChecked(content, before, after, minCount, label) {
  if (!content.includes(before)) {
    if (content.includes(after)) {
      console.log(`${label}: ja aplicado.`);
      return content;
    }
    throw new Error(`Trecho nao encontrado: ${label}`);
  }
  const count = content.split(before).length - 1;
  if (count < minCount) throw new Error(`Ocorrencias insuficientes em ${label}: ${count}`);
  return content.split(before).join(after);
}

// 1) Visao Financeira Geral: todos os tributos realizados/previstos, incluindo INSS.
//    A visao especifica de projetos continua restrita a lancamentos efetivamente alocados a projeto.
{
  const path = 'src/app/visao-financeira/page.js';
  let content = read(path);

  content = replaceOnce(
    content,
    `export default function VisaoFinanceira() {`,
    `const normalizeTaxScopeText = (value) => String(value || '')\n  .normalize('NFD')\n  .replace(/[\\u0300-\\u036f]/g, '')\n  .trim()\n  .toUpperCase();\n\nconst isInssTaxEntry = (item) => {\n  const text = normalizeTaxScopeText([\n    item?.contaNome,\n    item?.contaDescricao,\n    item?.planoFinanceiro,\n    item?.dreClasse,\n    item?.drePacote,\n    item?.dreLinha,\n    item?.dreDescricao,\n  ].filter(Boolean).join(' '));\n  return /\\bINSS\\b/.test(text);\n};\n\n// Visao Geral: tributos da empresa inteira. Mantem as regras tributarias existentes\n// e inclui INSS quando a propria conta/classificacao identifica o tributo.\nconst isGeneralTax = (item) => isRevenueTax(item) || isInssTaxEntry(item);\n\nconst hasAllocatedProject = (item) => {\n  const project = normalizeTaxScopeText(item?.projeto);\n  if (!project || project.includes('ADMINISTRA')) return false;\n  return ![\n    'GRUPO OAE',\n    'SEM PROJETO',\n    'PROJETOS',\n    'PROJETO',\n    'PROJETOS GERAL',\n    'PROJETOS GERAIS'\n  ].includes(project);\n};\n\nexport default function VisaoFinanceira() {`,
    'helpers de escopo tributario da Visao Financeira'
  );

  content = replaceOnce(
    content,
    `      if (isRevenueTax(item)) add('tributos', item, value);`,
    `      if (isGeneralTax(item)) add('tributos', item, value);`,
    'composicao geral com todos os tributos'
  );

  content = replaceOnce(
    content,
    `    realizado: realizedFilteredData\n      .filter((item) => item.natureza === 'Saída' && isRevenueTax(item))\n      .reduce((sum, item) => sum + Math.abs(Number(item.valor) || 0), 0),\n    pendente: forecastFilteredData\n      .filter((item) => item.natureza === 'Saída' && isRevenueTax(item))\n      .reduce((sum, item) => sum + Math.abs(Number(item.valor) || 0), 0),`,
    `    realizado: realizedFilteredData\n      .filter((item) => item.natureza === 'Saída' && isGeneralTax(item))\n      .reduce((sum, item) => sum + Math.abs(Number(item.valor) || 0), 0),\n    pendente: forecastFilteredData\n      .filter((item) => item.natureza === 'Saída' && isGeneralTax(item))\n      .reduce((sum, item) => sum + Math.abs(Number(item.valor) || 0), 0),`,
    'status tributario geral'
  );

  content = replaceOnce(
    content,
    `    const saidasProjeto = realizedFilteredData\n      .filter((item) => item.natureza === 'Saída')\n      .filter((item) => filterProjetos.length > 0 || !String(item.projeto || '').toUpperCase().includes('ADMINISTRA'));\n    const tributos = saidasProjeto\n      .filter((item) => isRevenueTax(item))\n      .reduce((sum, item) => sum + Math.abs(Number(item.valor) || 0), 0);\n    const saidas = saidasProjeto\n      .filter((item) => !isRevenueTax(item))\n      .reduce((sum, item) => sum + Math.abs(Number(item.valor) || 0), 0);`,
    `    const saidasProjeto = realizedFilteredData\n      .filter((item) => item.natureza === 'Saída')\n      .filter((item) => hasAllocatedProject(item));\n    const tributos = saidasProjeto\n      .filter((item) => isGeneralTax(item))\n      .reduce((sum, item) => sum + Math.abs(Number(item.valor) || 0), 0);\n    const saidas = saidasProjeto\n      .filter((item) => !isGeneralTax(item))\n      .reduce((sum, item) => sum + Math.abs(Number(item.valor) || 0), 0);`,
    'visao de projetos somente com tributos alocados'
  );

  write(path, content);
}

// 2) Projetos: os valores da Composicao Financeira ficam menores e sem corte.
{
  const path = 'src/app/projetos/page.js';
  let content = read(path);

  content = replaceAllChecked(
    content,
    `flex: '1 1 120px', minWidth: 0, overflow: 'hidden'`,
    `flex: '1 1 135px', minWidth: 0, overflow: 'visible'`,
    4,
    'largura dos indicadores da Composicao Financeira'
  );

  content = replaceAllChecked(
    content,
    `fontSize: 'clamp(14px, 1.25vw, 18px)'`,
    `fontSize: 'clamp(11px, 1vw, 15px)'`,
    4,
    'fonte dos valores da Composicao Financeira'
  );

  content = replaceAllChecked(
    content,
    `whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'clip', minWidth: 0, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em'`,
    `whiteSpace: 'nowrap', overflow: 'visible', minWidth: 0, maxWidth: '100%', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.035em'`,
    4,
    'exibicao integral dos valores da Composicao Financeira'
  );

  content = replaceOnce(
    content,
    `title={\`Receita Líquida: \${formatCurrency(receitaLiquidaProjetos)}\`}`,
    `title={\`Faturado em 2026: \${formatCurrency(totalFaturado2026)}\`}`,
    'tooltip do faturado 2026'
  );

  write(path, content);
}

// 3) Componente de composicao da Visao Geral: valores compactos para nao cortar.
{
  const path = 'src/components/FinancialCompositionBar.js';
  let content = read(path);

  content = replaceOnce(
    content,
    `        <strong style={{ fontSize: '14px', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>{formatCurrency(total)}</strong>`,
    `        <strong style={{ fontSize: 'clamp(11px, 0.9vw, 13px)', color: 'var(--text-main)', whiteSpace: 'nowrap', letterSpacing: '-0.025em', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(total)}</strong>`,
    'total compacto da composicao'
  );

  content = replaceOnce(
    content,
    `      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))', gap: '0.55rem' }}>`,
    `      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 175px), 1fr))', gap: '0.55rem' }}>`,
    'grade compacta da composicao'
  );

  content = replaceOnce(
    content,
    `            <strong style={{ fontSize: '10.5px', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>{formatCurrency(item.value)}</strong>`,
    `            <strong style={{ fontSize: 'clamp(8.5px, 0.72vw, 10px)', color: 'var(--text-main)', whiteSpace: 'nowrap', letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(item.value)}</strong>`,
    'valores compactos da composicao'
  );

  write(path, content);
}

// 4) DRE: restaura a rolagem horizontal e deixa a barra grande e visivel.
{
  const path = 'src/app/globals.css';
  let content = read(path);
  const marker = '/* === DRE SCROLLBAR VISIVEL 2026-08-26 === */';

  if (!content.includes(marker)) {
    content += `\n\n${marker}\n/* Override final: a DRE precisa preservar colunas legiveis e oferecer rolagem horizontal clara. */\n.dre-responsive-wrap {\n  width: 100% !important;\n  max-width: 100% !important;\n  overflow-x: scroll !important;\n  overflow-y: hidden !important;\n  -webkit-overflow-scrolling: touch;\n  scrollbar-gutter: stable both-edges;\n  scrollbar-width: auto;\n  scrollbar-color: var(--primary) var(--bg-main);\n  padding-bottom: 5px;\n}\n\n.dre-responsive-table {\n  width: max-content !important;\n  min-width: 100% !important;\n  max-width: none !important;\n  table-layout: auto !important;\n}\n\n.dre-responsive-table th:first-child,\n.dre-responsive-table td:first-child {\n  width: 340px !important;\n  min-width: 340px !important;\n  max-width: 340px !important;\n  position: sticky !important;\n  left: 0 !important;\n  z-index: 3;\n  white-space: nowrap !important;\n  overflow: hidden !important;\n  text-overflow: ellipsis;\n}\n\n.dre-responsive-table th:not(:first-child),\n.dre-responsive-table td:not(:first-child) {\n  width: 110px !important;\n  min-width: 110px !important;\n  max-width: none !important;\n  white-space: nowrap !important;\n  overflow-wrap: normal !important;\n  word-break: normal !important;\n  font-size: 10px !important;\n  text-align: right;\n}\n\n.dre-responsive-table th:last-child,\n.dre-responsive-table td:last-child {\n  width: 135px !important;\n  min-width: 135px !important;\n}\n\n.dre-responsive-wrap::-webkit-scrollbar {\n  height: 18px !important;\n}\n\n.dre-responsive-wrap::-webkit-scrollbar-track {\n  background: var(--bg-main);\n  border-top: 1px solid var(--border-color);\n  border-bottom: 1px solid var(--border-color);\n  border-radius: 10px;\n}\n\n.dre-responsive-wrap::-webkit-scrollbar-thumb {\n  background: var(--primary);\n  border: 3px solid var(--bg-main);\n  border-radius: 10px;\n  min-width: 72px;\n}\n\n.dre-responsive-wrap::-webkit-scrollbar-thumb:hover {\n  background: var(--primary-hover);\n}\n\n@media (max-width: 820px) {\n  .dre-responsive-table th:first-child,\n  .dre-responsive-table td:first-child {\n    width: 280px !important;\n    min-width: 280px !important;\n    max-width: 280px !important;\n    font-size: 10px !important;\n  }\n\n  .dre-responsive-table th:not(:first-child),\n  .dre-responsive-table td:not(:first-child) {\n    width: 100px !important;\n    min-width: 100px !important;\n    font-size: 9px !important;\n  }\n}\n`;
  } else {
    console.log('Barra da DRE ja aplicada.');
  }

  write(path, content);
}

console.log('Escopo de tributos, composicoes e barra de rolagem da DRE aplicados.');
