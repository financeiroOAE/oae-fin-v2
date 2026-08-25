"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function markNegativeDreValues() {
  const dreSection = document.querySelector('[data-report-section]');
  if (!dreSection) return;

  dreSection.querySelectorAll('td, strong').forEach((element) => {
    if (element.children.length > 0) return;
    const text = (element.textContent || '').trim();
    const isNegative = /^-\s*R\$/.test(text) || /^R\$\s*-/.test(text) || /^-\s*\d/.test(text);
    element.classList.toggle('dre-negative-value', isNegative);
  });
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function parseCurrentPage(dataTable) {
  const pageText = Array.from(dataTable.querySelectorAll('span'))
    .map((span) => cleanText(span.textContent))
    .find((text) => /^Pág\.\s*\d+\s+de\s+\d+/i.test(text));
  const match = pageText?.match(/Pág\.\s*(\d+)\s+de\s+(\d+)/i);
  return match ? { current: Number(match[1]), total: Number(match[2]) } : { current: 1, total: 1 };
}

function tableHeaders(table) {
  return Array.from(table?.querySelectorAll('thead tr:first-child th') || []).map((th) => {
    const clone = th.cloneNode(true);
    clone.querySelectorAll('svg').forEach((node) => node.remove());
    return cleanText(clone.textContent);
  });
}

function visibleTableRows(table) {
  const headers = tableHeaders(table);
  return Array.from(table?.querySelectorAll('tbody tr') || [])
    .map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => cleanText(td.textContent)))
    .filter((cells) => cells.length === headers.length && !cells.some((cell) => /Nenhum registro encontrado/i.test(cell)))
    .map((cells) => Object.fromEntries(headers.map((header, index) => [header || `Coluna ${index + 1}`, cells[index]])));
}

async function collectAllTableRows(dataTable) {
  const table = dataTable.querySelector('table');
  if (!table) return [];

  const footer = dataTable.lastElementChild;
  const pageSizeSelect = Array.from(footer?.querySelectorAll('select') || []).find((select) =>
    Array.from(select.options || []).some((option) => option.value === '100')
  );
  const originalSize = pageSizeSelect?.value;

  if (pageSizeSelect && pageSizeSelect.value !== '100') {
    pageSizeSelect.value = '100';
    pageSizeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(250);
  }

  const firstButtons = Array.from(dataTable.lastElementChild?.querySelectorAll('button') || []);
  if (firstButtons[0] && !firstButtons[0].disabled) {
    firstButtons[0].click();
    await sleep(180);
  }

  const rows = [];
  let guard = 0;
  while (guard < 100) {
    guard += 1;
    rows.push(...visibleTableRows(dataTable.querySelector('table')));
    const page = parseCurrentPage(dataTable);
    if (page.current >= page.total) break;

    const buttons = Array.from(dataTable.lastElementChild?.querySelectorAll('button') || []);
    const next = buttons[2];
    if (!next || next.disabled) break;
    next.click();
    await sleep(180);
  }

  const finalButtons = Array.from(dataTable.lastElementChild?.querySelectorAll('button') || []);
  if (finalButtons[0] && !finalButtons[0].disabled) {
    finalButtons[0].click();
    await sleep(120);
  }

  if (pageSizeSelect && originalSize && originalSize !== '100') {
    pageSizeSelect.value = originalSize;
    pageSizeSelect.dispatchEvent(new Event('change', { bubbles: true }));
  }

  return rows;
}

function summaryRows(content, projectName) {
  const rows = [
    { Seção: 'Projeto', Indicador: 'Projeto', Valor: projectName },
    { Seção: 'Projeto', Indicador: 'Gerado em', Valor: new Date().toLocaleString('pt-BR') },
  ];

  const cardsGrid = content.firstElementChild;
  Array.from(cardsGrid?.children || []).forEach((card) => {
    const section = cleanText(card.querySelector('h3')?.textContent) || 'Resumo';
    const strongs = Array.from(card.querySelectorAll('strong'));
    strongs.forEach((strong) => {
      const row = strong.closest('div');
      const label = cleanText(row?.querySelector('span')?.textContent);
      const value = cleanText(strong.textContent);
      if (label && value) rows.push({ Seção: section, Indicador: label, Valor: value });
    });
  });

  return rows;
}

function findExtratoTable(content) {
  const heading = Array.from(content.querySelectorAll('h3')).find((node) =>
    cleanText(node.textContent).includes('Extrato de Movimentações')
  );
  return heading?.nextElementSibling?.querySelector('.card') || null;
}

function findAdministrativeTable(content) {
  const details = Array.from(content.querySelectorAll('details')).find((node) =>
    cleanText(node.querySelector('summary')?.textContent).includes('Títulos Administrativos Associados')
  );
  return details?.querySelector('table') || null;
}

function applyWorksheetWidths(XLSX, worksheet, rows) {
  const headers = rows.length ? Object.keys(rows[0]) : [];
  worksheet['!cols'] = headers.map((key) => ({
    wch: Math.min(46, Math.max(12, key.length + 2, ...rows.slice(0, 100).map((row) => cleanText(row[key]).length + 2))),
  }));
  if (rows.length && headers.length) {
    worksheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: headers.length - 1 } }) };
  }
}

async function exportProjectWorkbook(mode, content, projectName) {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();
  const extratoTable = findExtratoTable(content);
  const extratoRows = extratoTable ? await collectAllTableRows(extratoTable) : [];

  if (mode === 'full') {
    const resumo = summaryRows(content, projectName);
    const resumoSheet = XLSX.utils.json_to_sheet(resumo);
    applyWorksheetWidths(XLSX, resumoSheet, resumo);
    XLSX.utils.book_append_sheet(workbook, resumoSheet, 'Resumo Executivo');

    const admTable = findAdministrativeTable(content);
    if (admTable) {
      const admRows = visibleTableRows(admTable);
      if (admRows.length) {
        const admSheet = XLSX.utils.json_to_sheet(admRows);
        applyWorksheetWidths(XLSX, admSheet, admRows);
        XLSX.utils.book_append_sheet(workbook, admSheet, 'Titulos Administrativos');
      }
    }
  }

  if (extratoRows.length) {
    const extratoSheet = XLSX.utils.json_to_sheet(extratoRows);
    applyWorksheetWidths(XLSX, extratoSheet, extratoRows);
    XLSX.utils.book_append_sheet(workbook, extratoSheet, 'Extrato');
  }

  if (!workbook.SheetNames.length) return;

  const safeName = String(projectName || 'projeto')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

  XLSX.writeFile(workbook, `${safeName || 'projeto'}-${mode === 'full' ? 'relatorio-completo' : 'somente-extrato'}.xlsx`);
}

function installProjectExportButtons() {
  const extratoHeading = Array.from(document.querySelectorAll('h3')).find((heading) =>
    cleanText(heading.textContent).includes('Extrato de Movimentações')
  );
  if (!extratoHeading) return;

  const content = extratoHeading.parentElement;
  const panel = content?.parentElement;
  const header = panel?.firstElementChild;
  if (!content || !panel || !header || header.querySelector('[data-project-export-control]')) return;

  const projectName = cleanText(header.querySelector('h2')?.textContent) || 'projeto';
  const controls = document.createElement('div');
  controls.setAttribute('data-project-export-control', 'true');
  controls.className = 'project-export-controls';

  const makeButton = (label, mode) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'project-export-button';
    button.textContent = label;
    button.onclick = async () => {
      const original = button.textContent;
      button.disabled = true;
      button.textContent = 'Gerando Excel...';
      try {
        await exportProjectWorkbook(mode, content, projectName);
      } finally {
        button.disabled = false;
        button.textContent = original;
      }
    };
    return button;
  };

  controls.appendChild(makeButton('Relatório completo (Excel)', 'full'));
  controls.appendChild(makeButton('Somente extrato (Excel)', 'extract'));

  const closeButton = header.querySelector('button');
  if (closeButton) header.insertBefore(controls, closeButton);
  else header.appendChild(controls);
}

const chartTitlePattern = /(curva|progresso|fluxo|entrada|saída|saida|receita|pagamento|recebimento|resultado|imposto|custo|ranking|top\s|evolução|evolucao|comparativo|distribuição|distribuicao|status)/i;

function chartExplanation(title) {
  const text = cleanText(title).toLowerCase();

  if (text.includes('curva abc')) {
    return {
      what: 'Organiza os projetos pelo valor dos contratos.',
      read: 'A = acima de R$ 500 mil; B = de R$ 100 mil a R$ 500 mil; C = abaixo de R$ 100 mil.'
    };
  }
  if (text.includes('progresso') && text.includes('contrat')) {
    return {
      what: 'Mostra quanto de cada contrato já foi faturado.',
      read: 'Compare o valor faturado e o percentual com o valor total contratado. Quanto maior o percentual, mais avançado está o contrato.'
    };
  }
  if (text.includes('imposto')) {
    return {
      what: 'Mostra os impostos ligados ao faturamento dos projetos.',
      read: 'Valores maiores indicam maior peso do imposto no período. Retenções de fornecedores não entram aqui.'
    };
  }
  if (text.includes('anual')) {
    return {
      what: 'Mostra as movimentações financeiras mês a mês no ano.',
      read: 'Entradas realizadas são valores que já entraram. Entradas programadas são títulos ainda a receber — não são meta nem previsão de faturamento.'
    };
  }
  if (text.includes('fluxo') || text.includes('evolução') || text.includes('evolucao')) {
    return {
      what: 'Mostra como entradas e saídas se movimentam ao longo do período.',
      read: 'Compare as barras por data. Entradas aumentam o caixa; saídas reduzem o caixa; o resultado mostra a diferença entre elas.'
    };
  }
  if (text.includes('receita') || text.includes('entrada') || text.includes('receb')) {
    return {
      what: 'Mostra de onde vêm as entradas financeiras.',
      read: 'Quanto maior a barra ou fatia, maior a participação daquela fonte. Empréstimos e aportes são entradas de caixa, mas não são receita.'
    };
  }
  if (text.includes('saída') || text.includes('saida') || text.includes('pagamento') || text.includes('custo')) {
    return {
      what: 'Mostra onde estão concentradas as saídas financeiras.',
      read: 'Quanto maior a barra ou fatia, maior o valor gasto naquele projeto, conta ou grupo.'
    };
  }
  if (text.includes('resultado')) {
    return {
      what: 'Mostra a diferença entre entradas e saídas.',
      read: 'Resultado positivo significa que entrou mais dinheiro do que saiu. Resultado negativo significa que saiu mais do que entrou.'
    };
  }

  return {
    what: 'Resume visualmente os valores deste indicador.',
    read: 'Compare os tamanhos das barras, linhas ou fatias. Quanto maior o elemento, maior o valor representado.'
  };
}

function isChartCard(card) {
  if (!card || card.querySelector('[data-chart-tools]')) return false;
  if (card.querySelector('.recharts-wrapper, canvas')) return true;
  const title = cleanText(card.querySelector('h2, h3')?.textContent);
  return Boolean(title && chartTitlePattern.test(title) && !card.querySelector('table'));
}

async function downloadChartPng(card, title, button) {
  const html2canvas = (await import('html2canvas')).default;
  button.disabled = true;
  try {
    const canvas = await html2canvas(card, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: null,
      ignoreElements: (node) => node.hasAttribute?.('data-chart-tools') || node.hasAttribute?.('data-chart-popover'),
    });
    const safe = String(title || 'grafico')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();
    const link = document.createElement('a');
    link.download = `${safe || 'grafico'}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } finally {
    button.disabled = false;
  }
}

function closeOtherChartPopovers(current) {
  document.querySelectorAll('[data-chart-popover]').forEach((popover) => {
    if (popover !== current) popover.hidden = true;
  });
}

function installChartTools() {
  document.querySelectorAll('.card').forEach((card) => {
    if (!isChartCard(card)) return;

    const heading = card.querySelector('h2, h3');
    if (!heading) return;
    const title = cleanText(heading.textContent) || 'Gráfico';
    const explanation = chartExplanation(title);

    const tools = document.createElement('div');
    tools.setAttribute('data-chart-tools', 'true');
    tools.className = 'chart-utility-tools';

    const helpWrap = document.createElement('div');
    helpWrap.className = 'chart-tool-wrap';

    const help = document.createElement('button');
    help.type = 'button';
    help.className = 'chart-icon-button chart-help-button';
    help.setAttribute('aria-label', `Entenda o gráfico ${title}`);
    help.setAttribute('title', 'Entenda este gráfico');
    help.textContent = '?';

    const helpPopover = document.createElement('div');
    helpPopover.setAttribute('data-chart-popover', 'true');
    helpPopover.className = 'chart-popover chart-help-popover';
    helpPopover.hidden = true;
    helpPopover.innerHTML = `
      <strong>O que mostra</strong>
      <p>${explanation.what}</p>
      <strong>Como ler</strong>
      <p>${explanation.read}</p>
    `;

    help.onclick = (event) => {
      event.stopPropagation();
      const willOpen = helpPopover.hidden;
      closeOtherChartPopovers(helpPopover);
      helpPopover.hidden = !willOpen;
    };

    helpWrap.appendChild(help);
    helpWrap.appendChild(helpPopover);

    const menuWrap = document.createElement('div');
    menuWrap.className = 'chart-tool-wrap';

    const menu = document.createElement('button');
    menu.type = 'button';
    menu.className = 'chart-icon-button chart-menu-button';
    menu.setAttribute('aria-label', `Ações do gráfico ${title}`);
    menu.setAttribute('title', 'Mais opções');
    menu.textContent = '⋮';

    const menuPopover = document.createElement('div');
    menuPopover.setAttribute('data-chart-popover', 'true');
    menuPopover.className = 'chart-popover chart-actions-popover';
    menuPopover.hidden = true;

    const download = document.createElement('button');
    download.type = 'button';
    download.className = 'chart-action-item';
    download.textContent = 'Baixar imagem';
    download.onclick = async (event) => {
      event.stopPropagation();
      menuPopover.hidden = true;
      await downloadChartPng(card, title, download);
    };

    menuPopover.appendChild(download);
    menu.onclick = (event) => {
      event.stopPropagation();
      const willOpen = menuPopover.hidden;
      closeOtherChartPopovers(menuPopover);
      menuPopover.hidden = !willOpen;
    };

    menuWrap.appendChild(menu);
    menuWrap.appendChild(menuPopover);

    tools.appendChild(helpWrap);
    tools.appendChild(menuWrap);

    const firstHeader = heading.closest('div');
    if (firstHeader && firstHeader.parentElement === card) {
      firstHeader.appendChild(tools);
    } else {
      card.insertBefore(tools, card.firstChild);
    }
  });
}

export default function UiEnhancements() {
  const pathname = usePathname();

  useEffect(() => {
    let frame;
    const apply = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (pathname.startsWith('/dre')) markNegativeDreValues();
        if (pathname.startsWith('/projetos')) installProjectExportButtons();
        installChartTools();
      });
    };

    const closePopovers = () => closeOtherChartPopovers(null);
    document.addEventListener('click', closePopovers);

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('click', closePopovers);
    };
  }, [pathname]);

  return null;
}