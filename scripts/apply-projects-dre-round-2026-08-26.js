const fs = require('fs');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content, 'utf8');
}

function replaceOnce(content, before, after, label) {
  if (!content.includes(before)) {
    if (content.includes(after)) {
      console.log(`${label}: ajuste ja aplicado.`);
      return content;
    }
    throw new Error(`Trecho nao encontrado: ${label}`);
  }
  return content.replace(before, after);
}

// Ajuste exclusivamente visual do DRE: nenhuma regra financeira e alterada.
{
  const path = 'src/app/dre/page.js';
  let content = read(path);

  content = replaceOnce(
    content,
    '        <div style={{ overflowX: "auto" }}>',
    '        <div className="dre-responsive-wrap">',
    'wrapper da tabela DRE'
  );

  content = replaceOnce(
    content,
    '          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: showMonths ? `${300 + meses.length * 130}px` : "600px" }}>',
    '          <table className="dre-responsive-table" style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>',
    'tabela DRE com layout fixo'
  );

  write(path, content);
}

{
  const path = 'src/app/globals.css';
  let content = read(path);
  const marker = '/* === DRE responsivo sem rolagem horizontal - 2026-08-26 === */';

  if (!content.includes(marker)) {
    content += `

${marker}
.dre-responsive-wrap {
  width: 100%;
  max-width: 100%;
  overflow-x: hidden;
}

.dre-responsive-table {
  width: 100% !important;
  min-width: 0 !important;
  max-width: 100% !important;
  table-layout: fixed !important;
}

.dre-responsive-table th,
.dre-responsive-table td {
  min-width: 0 !important;
  resize: none !important;
  overflow: visible !important;
  white-space: normal !important;
  overflow-wrap: anywhere;
  word-break: normal;
  line-height: 1.18 !important;
  padding-left: 0.22rem !important;
  padding-right: 0.22rem !important;
}

/* Descricao fica compacta, mas continua com espaco maior que as colunas numericas. */
.dre-responsive-table th:first-child,
.dre-responsive-table td:first-child {
  width: 23% !important;
  min-width: 0 !important;
  position: static !important;
  left: auto !important;
  padding-left: 0.55rem !important;
  padding-right: 0.35rem !important;
  font-size: clamp(9px, 0.76vw, 12px) !important;
}

/* Meses e Total dividem igualmente o restante da largura. */
.dre-responsive-table th:not(:first-child),
.dre-responsive-table td:not(:first-child) {
  width: auto !important;
  min-width: 0 !important;
  font-size: clamp(7px, 0.62vw, 10px) !important;
  letter-spacing: -0.025em;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.dre-responsive-table thead th {
  padding-top: 0.55rem !important;
  padding-bottom: 0.55rem !important;
}

.dre-responsive-table tbody td {
  padding-top: 0.48rem !important;
  padding-bottom: 0.48rem !important;
}

/* Mantem a hierarquia visual, reduzindo principalmente subcontas e valores. */
.dre-responsive-table tbody tr > td:first-child span {
  max-width: 100% !important;
}

@media (max-width: 1100px) {
  .dre-responsive-table th:first-child,
  .dre-responsive-table td:first-child {
    width: 21% !important;
    font-size: 9px !important;
  }

  .dre-responsive-table th:not(:first-child),
  .dre-responsive-table td:not(:first-child) {
    font-size: 7px !important;
    padding-left: 0.1rem !important;
    padding-right: 0.1rem !important;
  }
}

@media (max-width: 760px) {
  .dre-responsive-table th:first-child,
  .dre-responsive-table td:first-child {
    width: 24% !important;
    font-size: 8px !important;
    padding-left: 0.3rem !important;
    padding-right: 0.15rem !important;
  }

  .dre-responsive-table th:not(:first-child),
  .dre-responsive-table td:not(:first-child) {
    font-size: 6px !important;
    padding-left: 0.04rem !important;
    padding-right: 0.04rem !important;
  }
}
`;
  }

  write(path, content);
}

console.log('DRE compactado para caber na largura disponivel sem rolagem horizontal.');
