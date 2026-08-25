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

const demonstrativeCardPattern = /(saldo|contrat|fatur|receb|entrada|receita|pagamento|pago|pagar|resultado|margem|curva|progresso|imposto|custo|despesa|status|ranking|top\s|evolução|evolucao|composição|composicao|distribuição|distribuicao|financeiro)/i;

function cardExplanation(title) {
  const text = cleanText(title).toLowerCase();

  if (text.includes('saldo banc')) return {
    what: 'Soma dos saldos das contas bancárias cadastradas.',
    read: 'Valor positivo é disponibilidade em conta. Valor negativo indica saldo bancário devedor.'
  };
  if (text.includes('saldo contrat')) return {
    what: 'Valor do contrato que ainda não foi faturado.',
    read: 'Quanto maior o saldo, maior o valor que ainda resta faturar no contrato.'
  };
  if (text.includes('valor contratado') || text === 'contratado') return {
    what: 'Valor total dos contratos dos projetos exibidos.',
    read: 'É a base contratual da carteira, antes de comparar quanto já foi faturado.'
  };
  if (text.includes('% fatur') || text.includes('percentual fatur')) return {
    what: 'Percentual do contrato que já foi faturado.',
    read: '100% significa que todo o valor contratado já foi faturado.'
  };
  if (text.includes('faturado') && !text.includes('imposto')) return {
    what: 'Valor já faturado dos contratos.',
    read: 'Compare com o valor contratado para entender quanto do contrato já avançou.'
  };
  if (text.includes('a receber')) return {
    what: 'Valores registrados que ainda devem entrar no caixa.',
    read: 'É compromisso de entrada futura registrado no sistema; não significa que o dinheiro já entrou.'
  };
  if (text.includes('recebido') || text.includes('entradas realizadas')) return {
    what: 'Valores que já entraram no caixa no período considerado.',
    read: 'Entrada de caixa não é sempre receita: empréstimos e aportes devem ser lidos separadamente quando aparecerem na composição.'
  };
  if (text.includes('a pagar')) return {
    what: 'Valores registrados que ainda precisam ser pagos.',
    read: 'Mostra compromissos futuros de saída do caixa no período considerado.'
  };
  if (text === 'pago' || text.includes('pagamentos realizados')) return {
    what: 'Valores que já saíram do caixa no período considerado.',
    read: 'Quanto maior o valor, maior foi o desembolso realizado.'
  };
  if (text.includes('curva abc')) return {
    what: 'Agrupa os projetos pelo valor total de seus contratos.',
    read: 'A: acima de R$ 500 mil. B: de R$ 100 mil a R$ 500 mil. C: abaixo de R$ 100 mil.'
  };
  if (text.includes('progresso') && text.includes('contrat')) return {
    what: 'Compara o valor contratado, o faturado e o saldo a faturar de cada projeto.',
    read: 'Quanto maior o percentual faturado, mais avançado está o contrato.'
  };
  if (text.includes('imposto')) return {
    what: 'Mostra os impostos ligados ao faturamento dos projetos.',
    read: 'Retenções de fornecedores não entram aqui. Valores maiores indicam maior peso dos impostos sobre o faturamento.'
  };
  if (text.includes('composição') || text.includes('composicao')) return {
    what: 'Separa as entradas conforme sua origem financeira.',
    read: 'Receitas, empréstimos, financiamentos e aportes aparecem separados para não tratar toda entrada de caixa como receita.'
  };
  if (text.includes('receita') || text.includes('fonte')) return {
    what: 'Mostra de onde vêm as receitas exibidas no período.',
    read: 'Quanto maior a barra ou participação, maior a contribuição daquela fonte ou projeto.'
  };
  if (text.includes('despesa') || text.includes('custo') || text.includes('saída') || text.includes('saida')) return {
    what: 'Mostra onde os gastos estão concentrados.',
    read: 'Quanto maior a barra ou valor, maior o gasto daquele projeto, conta ou grupo.'
  };
  if (text.includes('anual')) return {
    what: 'Mostra, mês a mês, o que entrou, o que ainda está programado para entrar e o que saiu do caixa em 2026.',
    read: 'Entradas realizadas já aconteceram. Entradas programadas são títulos registrados a receber — não são meta, orçamento nem faturamento esperado. Saídas são os pagamentos do período.'
  };
  if (text.includes('resultado')) return {
    what: 'Mostra a diferença entre entradas e saídas consideradas no cálculo.',
    read: 'Positivo significa mais entradas que saídas; negativo significa mais saídas que entradas.'
  };
  if (text.includes('margem')) return {
    what: 'Mostra quanto do resultado representa em relação à receita.',
    read: 'Percentuais maiores indicam maior resultado proporcional sobre a receita considerada.'
  };
  if (text.includes('status')) return {
    what: 'Divide os valores conforme a situação financeira atual.',
    read: 'Compare realizado e pendente para entender o que já aconteceu e o que ainda está em aberto.'
  };
  if (text.includes('evolução') || text.includes('evolucao') || text.includes('financeiro')) return {
    what: 'Resume visualmente a movimentação financeira apresentada neste card.',
    read: 'Compare os períodos e valores. Elementos maiores representam maior participação ou volume.'
  };

  return {
    what: 'Resume este indicador de forma visual.',
    read: 'Use o valor principal e sua comparação com os demais indicadores para entender a posição apresentada.'
  };
}

function getDemonstrativeCardTitleNode(card) {
  const heading = card.querySelector('h2, h3');
  if (heading) return heading;

  const labels = Array.from(card.querySelectorAll(':scope > p, :scope > div > p'));
  return labels.find((node) => {
    const text = cleanText(node.textContent);
    return text && /[A-Za-zÀ-ÿ]/.test(text) && !/^R\$/.test(text) && text.length <= 90;
  }) || null;
}

function isDemonstrativeCard(card) {
  if (!card || card.querySelector('[data-card-help]')) return false;
  if (card.querySelector('input, select, textarea, table')) return false;
  if (card.querySelector(':scope .card')) return false;

  const titleNode = getDemonstrativeCardTitleNode(card);
  if (!titleNode) return false;

  const title = cleanText(titleNode.textContent);
  const fullText = cleanText(card.textContent);
  const hasVisual = Boolean(card.querySelector('.recharts-wrapper, canvas'));
  const hasMetric = /R\$|%/.test(fullText);
  const isKnownCard = demonstrativeCardPattern.test(title);

  return hasVisual || (hasMetric && isKnownCard);
}

function closeOtherCardPopovers(current) {
  document.querySelectorAll('[data-card-popover]').forEach((popover) => {
    if (popover !== current) popover.hidden = true;
  });
}

function removeDemonstrativeCardHelp() {
  document.querySelectorAll('[data-chart-tools], [data-card-help]').forEach((node) => node.remove());
  document.querySelectorAll('.has-demonstrative-help').forEach((card) => card.classList.remove('has-demonstrative-help'));
}

function installDemonstrativeCardHelp() {
  // Remove qualquer controle antigo de gráfico, inclusive download/menus.
  document.querySelectorAll('[data-chart-tools]').forEach((node) => node.remove());

  document.querySelectorAll('.card').forEach((card) => {
    if (!isDemonstrativeCard(card)) return;

    const titleNode = getDemonstrativeCardTitleNode(card);
    if (!titleNode) return;
    const title = cleanText(titleNode.textContent) || 'Indicador';
    const explanation = cardExplanation(title);

    card.classList.add('has-demonstrative-help');

    const wrap = document.createElement('span');
    wrap.setAttribute('data-card-help', 'true');
    wrap.className = 'card-help-wrap';

    const help = document.createElement('button');
    help.type = 'button';
    help.className = 'card-help-icon';
    help.setAttribute('aria-label', `Entenda o card ${title}`);
    help.setAttribute('title', 'Entenda este card');
    help.textContent = 'i';

    const popover = document.createElement('div');
    popover.setAttribute('data-card-popover', 'true');
    popover.className = 'card-help-popover';
    popover.hidden = true;
    popover.innerHTML = `
      <strong>O que é</strong>
      <p>${explanation.what}</p>
      <strong>Leitura</strong>
      <p>${explanation.read}</p>
    `;

    const openHelp = () => {
      closeOtherCardPopovers(popover);
      popover.hidden = false;
    };
    const closeHelp = () => {
      popover.hidden = true;
    };

    wrap.addEventListener('mouseenter', openHelp);
    wrap.addEventListener('mouseleave', closeHelp);
    help.onfocus = openHelp;
    help.onblur = closeHelp;
    help.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const willOpen = popover.hidden;
      closeOtherCardPopovers(popover);
      popover.hidden = !willOpen;
    };

    wrap.appendChild(help);
    wrap.appendChild(popover);
    card.appendChild(wrap);
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
        if (pathname.startsWith('/fluxo-caixa')) {
          removeDemonstrativeCardHelp();
        } else {
          installDemonstrativeCardHelp();
        }
      });
    };

    const closePopovers = () => closeOtherCardPopovers(null);
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