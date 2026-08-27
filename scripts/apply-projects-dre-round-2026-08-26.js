const fs = require('fs');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content, 'utf8');
}

function replaceOnce(content, before, after, label) {
  if (!content.includes(before)) {
    throw new Error(`Trecho nao encontrado: ${label}`);
  }
  return content.replace(before, after);
}

function replaceAllChecked(content, before, after, minCount, label) {
  const count = content.split(before).length - 1;
  if (count < minCount) {
    throw new Error(`Ocorrencias insuficientes em ${label}: ${count} < ${minCount}`);
  }
  return content.split(before).join(after);
}

// 1) Fonte de dados: PROJETOS_2026 passa a ler ate a coluna L e cria um alias estavel para L.
{
  const path = 'src/lib/googleSheets.js';
  let content = read(path);
  content = replaceOnce(content, "    'PROJETOS_2026!A:I',", "    'PROJETOS_2026!A:L',", 'range PROJETOS_2026 A:L');
  content = replaceOnce(
    content,
    `          headers.forEach((header, index) => {\n            if (!header) return;\n            rowData[header] = row[index] ?? '';\n          });\n          return rowData;`,
    `          headers.forEach((header, index) => {\n            if (!header) return;\n            rowData[header] = row[index] ?? '';\n          });\n\n          // Coluna L da PROJETOS_2026: faturamento acumulado do ano de 2026.\n          // O alias por posicao evita depender de variacoes no texto do cabecalho da planilha.\n          if (sheetName === 'PROJETOS_2026') {\n            rowData.FATURADO_2026_COL_L = row[11] ?? '';\n          }\n\n          return rowData;`,
    'alias da coluna L'
  );
  write(path, content);
}

// 2) Snapshot: normaliza o valor anual de faturamento e obriga reparo de snapshots antigos.
{
  const path = 'src/lib/financialSync.js';
  let content = read(path);
  content = replaceOnce(
    content,
    `      'NF FATURADAS': parseBRL(proj['NF FATURADAS']),\n      'SALDO CONTRATUAL': parseBRL(proj['SALDO CONTRATUAL']),`,
    `      'NF FATURADAS': parseBRL(proj['NF FATURADAS']),\n      FATURADO_2026: parseBRL(proj.FATURADO_2026_COL_L),\n      'SALDO CONTRATUAL': parseBRL(proj['SALDO CONTRATUAL']),`,
    'parse FATURADO_2026'
  );
  write(path, content);
}

{
  const path = 'src/app/api/sync/route.js';
  let content = read(path);
  content = replaceOnce(
    content,
    `function snapshotNeedsProjectRepair(payload) {\n  if (!Array.isArray(payload?.data)) return false;`,
    `function snapshotNeedsProjectRepair(payload) {\n  // Snapshots anteriores a leitura da coluna L nao possuem FATURADO_2026.\n  // Nesse caso a primeira abertura apos o deploy refaz a sincronizacao automaticamente.\n  if (!Array.isArray(payload?.projetos)) return true;\n  if (payload.projetos.some((project) => project?.FATURADO_2026 === undefined || project?.FATURADO_2026 === null)) return true;\n  if (!Array.isArray(payload?.data)) return false;`,
    'reparo automatico do snapshot de projetos'
  );
  write(path, content);
}

// 3) Projetos: faturado 2026, nomenclaturas liquidas, INSS alocado, base tributaria consistente e relatorio executivo.
{
  const path = 'src/app/projetos/page.js';
  let content = read(path);

  // Troca a classificacao usada SOMENTE nesta pagina antes de inserir o helper local.
  content = replaceAllChecked(content, 'isRevenueTax(item)', 'isProjectTax(item)', 3, 'tributos de projetos');
  content = replaceAllChecked(content, 'getRevenueTaxLabel(item)', 'getProjectTaxLabel(item)', 1, 'rotulo de tributos de projetos');

  content = replaceOnce(
    content,
    `export default function Projetos() {`,
    `const normalizeProjectTaxText = (value) => String(value || '')\n  .normalize('NFD')\n  .replace(/[\\u0300-\\u036f]/g, '')\n  .trim()\n  .toUpperCase();\n\nconst isAllocatedProjectInss = (item) => {\n  const text = normalizeProjectTaxText([\n    item?.contaNome,\n    item?.contaDescricao,\n    item?.planoFinanceiro,\n    item?.dreClasse,\n    item?.dreLinha,\n    item?.dreDescricao,\n  ].filter(Boolean).join(' '));\n  return /\\bINSS\\b/.test(text);\n};\n\n// Na pagina de Projetos, INSS diretamente alocado a obra/centro de custo e tributo do projeto.\n// A verificacao de projeto permitido acontece antes desta classificacao, evitando INSS administrativo generico.\nconst isProjectTax = (item) => isRevenueTax(item) || isAllocatedProjectInss(item);\nconst getProjectTaxLabel = (item) => isAllocatedProjectInss(item) ? 'INSS' : getRevenueTaxLabel(item);\n\nexport default function Projetos() {`,
    'helpers de tributos de projeto'
  );

  content = replaceAllChecked(
    content,
    `          faturado: 0,\n          saldoContratual: 0,`,
    `          faturado: 0,\n          faturado2026: 0,\n          saldoContratual: 0,`,
    2,
    'inicializacao faturado2026'
  );

  content = replaceOnce(
    content,
    `      projeto.faturado += Number(p['NF FATURADAS']) || 0;\n      projeto.saldoContratual += Number(p['SALDO CONTRATUAL']) || 0;`,
    `      projeto.faturado += Number(p['NF FATURADAS']) || 0;\n      projeto.faturado2026 += Number(p.FATURADO_2026) || 0;\n      projeto.saldoContratual += Number(p['SALDO CONTRATUAL']) || 0;`,
    'soma faturado2026 por projeto'
  );

  content = replaceOnce(
    content,
    `  const totalFaturado = filteredProjetos.reduce((acc, p) => acc + p.faturado, 0);\n  const totalSaldo = filteredProjetos.reduce((acc, p) => acc + p.saldoContratual, 0);`,
    `  const totalFaturado = filteredProjetos.reduce((acc, p) => acc + p.faturado, 0);\n  const totalFaturado2026 = filteredProjetos.reduce((acc, p) => acc + p.faturado2026, 0);\n  const totalSaldo = filteredProjetos.reduce((acc, p) => acc + p.saldoContratual, 0);`,
    'total faturado2026'
  );

  content = replaceOnce(
    content,
    `  const taxPercentage = totalFaturado > 0 ? (taxesData.total / totalFaturado) * 100 : 0;`,
    `  // Base unica para o peso tributario: Recebido Liquido do mesmo periodo e dos mesmos filtros.\n  // Isso evita comparar tributos do periodo com um faturamento contratual acumulado de outra base temporal.\n  const taxPercentage = receitaLiquidaProjetos > 0 ? (taxesData.total / receitaLiquidaProjetos) * 100 : 0;`,
    'base percentual de tributos'
  );

  content = replaceOnce(
    content,
    `    Faturado: project.faturado,\n    Saldo: project.saldoContratual,\n    Recebido: project.recebido,`,
    `    Faturado: project.faturado,\n    "Faturado em 2026": project.faturado2026,\n    Saldo: project.saldoContratual,\n    "Recebido Líquido": project.recebido,`,
    'linhas do relatorio executivo'
  );

  content = replaceAllChecked(content, 'Recebido no período', 'Recebido Líquido no período', 1, 'rotulo recebido liquido');
  content = replaceAllChecked(content, 'Receita Realizada de Projetos', 'Receita Líquida Realizada de Projetos', 1, 'rotulo receita liquida realizada');
  content = replaceAllChecked(content, '% sobre o Faturamento', '% sobre Recebido Líquido', 1, 'rotulo percentual tributario');
  content = replaceAllChecked(content, '% sobre o faturamento', '% sobre o Recebido Líquido', 1, 'texto percentual tributario');
  content = replaceAllChecked(content, 'da receita de projetos</p>', 'do Recebido Líquido</p>', 1, 'subtitulo percentual tributario');

  const faturadoCardAnchor = `        <div className="card" onClick={() => setKpiModal('saldo')} style={{ padding: '1.5rem', borderLeft: '4px solid var(--warning)', cursor: 'pointer', transition: 'all 0.2s ease' }} title="Clique para ver por empresa" onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseOut={e => e.currentTarget.style.transform = 'none'}>`;
  content = replaceOnce(
    content,
    faturadoCardAnchor,
    `        <div className="card" style={{ padding: '1.5rem', borderLeft: '4px solid var(--info)' }}>\n          <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem', fontWeight: '600' }}>\n            <Target size={16} color="var(--info)" /> Faturado em 2026\n            <InfoTooltip title="Faturado em 2026" content="Faturamento anual de 2026 registrado para os projetos exibidos. O valor acompanha os filtros de projeto, empresa e tipo." />\n          </p>\n          <p style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-main)' }}>{formatCurrency(totalFaturado2026)}</p>\n        </div>\n` + faturadoCardAnchor,
    'card faturado em 2026'
  );

  content = replaceOnce(
    content,
    `dataSets={{ summary: [{ Projetos: projectReportRows.length, "Total Contratado": totalContratado, "Total Faturado": totalFaturado, "Saldo Contratual": totalSaldo, "Resultado de Caixa": totalResultado }], visible: projectReportRows.slice((tablePage - 1) * TABLE_PAGE_SIZE, tablePage * TABLE_PAGE_SIZE), all: projectReportRows }}`,
    `dataSets={{ summary: [{ Projetos: projectReportRows.length, "Total Contratado": totalContratado, "Total Faturado": totalFaturado, "Faturado em 2026": totalFaturado2026, "Saldo Contratual": totalSaldo, "Recebido Líquido": totalRecebido, "A Receber": totalAReceber, "Pago": totalPago, "A Pagar": totalAPagar, "Resultado de Caixa": totalResultado }], visible: projectReportRows.slice((tablePage - 1) * TABLE_PAGE_SIZE, tablePage * TABLE_PAGE_SIZE), all: projectReportRows }}`,
    'resumo do relatorio executivo'
  );

  content = replaceOnce(content, `<div style={{ overflowX: 'auto' }}>\n          <table style={{ width: '100%', minWidth: '900px', borderCollapse: 'collapse' }}>`, `<div className="projects-executive-table-wrap">\n          <table className="projects-executive-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>`, 'layout tabela executiva');

  content = replaceOnce(
    content,
    `<th style={{ padding: '1rem 1rem 0.5rem 1rem', textAlign: 'right', cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => handleSort('recebido')}>Recebido <SortIcon columnKey="recebido" /></th>`,
    `<th style={{ padding: '1rem 1rem 0.5rem 1rem', textAlign: 'right', cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => handleSort('recebido')}>Recebido Líquido <SortIcon columnKey="recebido" /></th>`,
    'cabecalho recebido liquido'
  );

  content = replaceOnce(
    content,
    `<th style={{ padding: '1rem 1rem 0.5rem 1rem', textAlign: 'right', cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => handleSort('pago')}>Pago <SortIcon columnKey="pago" /></th>\n                <th style={{ padding: '1rem 1rem 0.5rem 1rem', textAlign: 'right', cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => handleSort('resultadoCaixa')}>Resultado <SortIcon columnKey="resultadoCaixa" /></th>`,
    `<th style={{ padding: '1rem 1rem 0.5rem 1rem', textAlign: 'right', cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => handleSort('pago')}>Pago <SortIcon columnKey="pago" /></th>\n                <th style={{ padding: '1rem 1rem 0.5rem 1rem', textAlign: 'right', cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => handleSort('aReceber')}>A Receber <SortIcon columnKey="aReceber" /></th>\n                <th style={{ padding: '1rem 1rem 0.5rem 1rem', textAlign: 'right', cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => handleSort('aPagar')}>A Pagar <SortIcon columnKey="aPagar" /></th>\n                <th style={{ padding: '1rem 1rem 0.5rem 1rem', textAlign: 'right', cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => handleSort('resultadoCaixa')}>Resultado <SortIcon columnKey="resultadoCaixa" /></th>`,
    'colunas a receber e a pagar'
  );

  content = replaceOnce(content, `<th colSpan={4} style={{ padding: '0 1rem 0.75rem 1rem' }}></th>`, `<th colSpan={6} style={{ padding: '0 1rem 0.75rem 1rem' }}></th>`, 'colspan filtros tabela executiva');

  content = replaceOnce(
    content,
    `<td style={{ padding: '0.85rem 1rem', textAlign: 'right', color: 'var(--success)' }}>{formatCurrency(p.recebido)}</td>\n                  <td style={{ padding: '0.85rem 1rem', textAlign: 'right', color: 'var(--danger)' }}>{formatCurrency(p.pago)}</td>\n                  <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: '600', color: p.resultadoCaixa >= 0 ? 'var(--success)' : 'var(--danger)' }}>{formatCurrency(p.resultadoCaixa)}</td>`,
    `<td style={{ padding: '0.85rem 1rem', textAlign: 'right', color: 'var(--success)' }}>{formatCurrency(p.recebido)}</td>\n                  <td style={{ padding: '0.85rem 1rem', textAlign: 'right', color: 'var(--danger)' }}>{formatCurrency(p.pago)}</td>\n                  <td style={{ padding: '0.85rem 1rem', textAlign: 'right', color: 'var(--text-main)' }}>{formatCurrency(p.aReceber)}</td>\n                  <td style={{ padding: '0.85rem 1rem', textAlign: 'right', color: 'var(--text-main)' }}>{formatCurrency(p.aPagar)}</td>\n                  <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: '600', color: p.resultadoCaixa >= 0 ? 'var(--success)' : 'var(--danger)' }}>{formatCurrency(p.resultadoCaixa)}</td>`,
    'valores a receber e a pagar'
  );

  content = replaceOnce(content, `<tr><td colSpan={9}`, `<tr><td colSpan={11}`, 'colspan vazio tabela executiva');

  content = replaceOnce(
    content,
    `Total de Impostos: <strong style={{color:'var(--text-main)'}}>{formatCurrency(taxesData.total)}</strong> ({taxPercentage.toFixed(2).replace('.', ',')}% sobre o Recebido Líquido)`,
    `Total de Tributos: <strong style={{color:'var(--text-main)'}}>{formatCurrency(taxesData.total)}</strong> ({taxPercentage.toFixed(2).replace('.', ',')}% sobre o Recebido Líquido)`,
    'texto total tributos'
  );

  write(path, content);
}

// 4) DRE: sempre apresenta Jan-Dez e remove a necessidade de rolagem horizontal, inclusive com retroativo.
{
  const path = 'src/app/dre/page.js';
  let content = read(path);
  content = replaceOnce(
    content,
    `  const baseMeses = useMemo(() => buildMeses(effectiveDataInicial, effectiveDataFinal), [effectiveDataInicial, effectiveDataFinal]);`,
    `  // A DRE permanece anual na leitura: Jan-Dez ficam visiveis mesmo quando o filtro\n  // de realizado termina no mes corrente. Meses fora do periodo filtrado aparecem zerados.\n  const baseMeses = useMemo(() => buildMeses('2026-01-01', '2026-12-31'), []);`,
    'meses anuais completos da DRE'
  );
  content = replaceOnce(content, `        <div style={{ overflowX: "auto" }}>`, `        <div className="dre-responsive-wrap">`, 'wrapper responsivo DRE');
  content = replaceOnce(
    content,
    `          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: showMonths ? \`${300 + meses.length * 130}px\` : "600px" }}>`,
    `          <table className="dre-responsive-table" style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>`,
    'tabela DRE sem minWidth'
  );
  write(path, content);
}

// 5) CSS: tabela executiva responsiva, DRE sem scroll e preview de relatorios sem rolagem horizontal.
{
  const path = 'src/app/globals.css';
  let content = read(path);
  const marker = '/* === OAE_FIN Projects + DRE responsive pass 2026-08-26 === */';
  if (!content.includes(marker)) {
    content += `\n\n${marker}\n.projects-executive-table-wrap { width: 100%; overflow-x: hidden; }\n.projects-executive-table { width: 100%; min-width: 0 !important; table-layout: fixed; }\n.projects-executive-table th,\n.projects-executive-table td {\n  min-width: 0 !important;\n  resize: none !important;\n  overflow: visible !important;\n  white-space: normal !important;\n  overflow-wrap: anywhere;\n  line-height: 1.25;\n  padding-left: 0.45rem !important;\n  padding-right: 0.45rem !important;\n}\n.projects-executive-table th { font-size: clamp(8px, 0.72vw, 11px) !important; }\n.projects-executive-table td { font-size: clamp(9px, 0.78vw, 12px) !important; font-variant-numeric: tabular-nums; }\n.projects-executive-table th:nth-child(1), .projects-executive-table td:nth-child(1) { width: 15%; }\n.projects-executive-table th:nth-child(2), .projects-executive-table td:nth-child(2) { width: 8%; }\n\n.dre-responsive-wrap { width: 100%; max-width: 100%; overflow-x: hidden !important; }\n.dre-responsive-table { width: 100% !important; min-width: 0 !important; table-layout: fixed !important; }\n.dre-responsive-table th,\n.dre-responsive-table td {\n  min-width: 0 !important;\n  resize: none !important;\n  overflow: visible !important;\n  white-space: normal !important;\n  line-height: 1.2 !important;\n}\n.dre-responsive-table th:first-child,\n.dre-responsive-table td:first-child {\n  width: 22%;\n  position: static !important;\n  overflow-wrap: anywhere;\n  padding-left: 0.55rem !important;\n  padding-right: 0.35rem !important;\n}\n.dre-responsive-table th:not(:first-child),\n.dre-responsive-table td:not(:first-child) {\n  padding-left: 0.2rem !important;\n  padding-right: 0.2rem !important;\n  font-size: clamp(7px, 0.58vw, 10px) !important;\n  font-variant-numeric: tabular-nums;\n  letter-spacing: -0.02em;\n  overflow-wrap: anywhere;\n}\n\n.report-preview-table-wrap { overflow-x: hidden !important; max-width: 100%; }\n.report-preview-table { width: 100% !important; min-width: 0 !important; table-layout: fixed; font-size: 7.5px; }\n.report-preview-table th,\n.report-preview-table td {\n  min-width: 0 !important;\n  resize: none !important;\n  overflow: visible !important;\n  white-space: normal !important;\n  overflow-wrap: anywhere;\n  line-height: 1.25;\n  padding: 0.24rem !important;\n}\n.report-preview-table .is-number { font-variant-numeric: tabular-nums; font-size: 7px; }\n\n@media (max-width: 820px) {\n  .projects-executive-table thead { display: none; }\n  .projects-executive-table,\n  .projects-executive-table tbody,\n  .projects-executive-table tr,\n  .projects-executive-table td { display: block; width: 100% !important; }\n  .projects-executive-table tbody tr { margin: 0.75rem; width: calc(100% - 1.5rem) !important; border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; }\n  .projects-executive-table tbody td {\n    display: grid;\n    grid-template-columns: minmax(125px, 42%) minmax(0, 1fr);\n    gap: 0.75rem;\n    align-items: center;\n    text-align: right !important;\n    padding: 0.6rem 0.75rem !important;\n    font-size: 11px !important;\n  }\n  .projects-executive-table tbody td::before { color: var(--text-secondary); font-size: 9px; font-weight: 700; text-transform: uppercase; text-align: left; }\n  .projects-executive-table tbody td:nth-child(1)::before { content: 'Projeto / Obra'; }\n  .projects-executive-table tbody td:nth-child(2)::before { content: 'Empresa'; }\n  .projects-executive-table tbody td:nth-child(3)::before { content: 'Contratado'; }\n  .projects-executive-table tbody td:nth-child(4)::before { content: 'Faturado'; }\n  .projects-executive-table tbody td:nth-child(5)::before { content: '% Faturado'; }\n  .projects-executive-table tbody td:nth-child(6)::before { content: 'Saldo'; }\n  .projects-executive-table tbody td:nth-child(7)::before { content: 'Recebido Líquido'; }\n  .projects-executive-table tbody td:nth-child(8)::before { content: 'Pago'; }\n  .projects-executive-table tbody td:nth-child(9)::before { content: 'A Receber'; }\n  .projects-executive-table tbody td:nth-child(10)::before { content: 'A Pagar'; }\n  .projects-executive-table tbody td:nth-child(11)::before { content: 'Resultado'; }\n  .projects-executive-table tbody td[colspan] { display: block; text-align: center !important; }\n  .projects-executive-table tbody td[colspan]::before { display: none; }\n\n  .dre-responsive-table th:first-child,\n  .dre-responsive-table td:first-child { width: 26%; font-size: 8px !important; }\n  .dre-responsive-table th:not(:first-child),\n  .dre-responsive-table td:not(:first-child) { font-size: 6.5px !important; padding-left: 0.08rem !important; padding-right: 0.08rem !important; }\n}\n`;
  }
  write(path, content);
}

console.log('Ajustes de Projetos, DRE, relatorios e fonte PROJETOS_2026 aplicados.');
