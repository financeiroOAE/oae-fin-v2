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

async function captureElement(element) {
  const html2canvas = (await import('html2canvas')).default;
  const previous = {
    overflow: element.style.overflow,
    maxHeight: element.style.maxHeight,
    height: element.style.height,
  };

  element.style.overflow = 'visible';
  element.style.maxHeight = 'none';
  element.style.height = 'auto';

  try {
    return await html2canvas(element, {
      scale: 1.35,
      useCORS: true,
      logging: false,
      backgroundColor: '#061b33',
      windowWidth: Math.max(element.scrollWidth, element.clientWidth),
      windowHeight: Math.max(element.scrollHeight, element.clientHeight),
      ignoreElements: (node) => node.hasAttribute?.('data-project-export-control'),
    });
  } finally {
    element.style.overflow = previous.overflow;
    element.style.maxHeight = previous.maxHeight;
    element.style.height = previous.height;
  }
}

function addCanvasToPdf(pdf, canvas, addNewPage = false) {
  if (addNewPage) pdf.addPage();

  const margin = 8;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const usableWidth = pageWidth - margin * 2;
  const usableHeight = pageHeight - margin * 2;
  const imageHeight = canvas.height * usableWidth / canvas.width;
  const image = canvas.toDataURL('image/png', 0.92);

  let remaining = imageHeight;
  let offsetY = margin;
  let firstSlice = true;

  while (remaining > 0) {
    if (!firstSlice) pdf.addPage();
    pdf.addImage(image, 'PNG', margin, offsetY, usableWidth, imageHeight, undefined, 'FAST');
    remaining -= usableHeight;
    offsetY -= usableHeight;
    firstSlice = false;
  }
}

function parseCurrentPage(dataTable) {
  const pageText = Array.from(dataTable.querySelectorAll('span'))
    .map((span) => (span.textContent || '').trim())
    .find((text) => /^Pág\.\s*\d+\s+de\s+\d+/i.test(text));
  const match = pageText?.match(/Pág\.\s*(\d+)\s+de\s+(\d+)/i);
  return match ? { current: Number(match[1]), total: Number(match[2]) } : { current: 1, total: 1 };
}

async function collectExtratoCanvases(dataTable) {
  const canvases = [];
  const footer = dataTable.lastElementChild;
  const pageSizeSelect = Array.from(footer?.querySelectorAll('select') || []).find((select) =>
    Array.from(select.options || []).some((option) => option.value === '100')
  );
  const originalSize = pageSizeSelect?.value;

  if (pageSizeSelect && pageSizeSelect.value !== '100') {
    pageSizeSelect.value = '100';
    pageSizeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(350);
  }

  const refreshedFooter = dataTable.lastElementChild;
  const buttons = Array.from(refreshedFooter?.querySelectorAll('button') || []);
  const firstButton = buttons[0];
  const nextButton = buttons[2];

  if (firstButton && !firstButton.disabled) {
    firstButton.click();
    await sleep(250);
  }

  let guard = 0;
  while (guard < 50) {
    guard += 1;
    const page = parseCurrentPage(dataTable);
    canvases.push(await captureElement(dataTable));
    if (page.current >= page.total) break;

    const currentButtons = Array.from(dataTable.lastElementChild?.querySelectorAll('button') || []);
    const currentNext = currentButtons[2] || nextButton;
    if (!currentNext || currentNext.disabled) break;
    currentNext.click();
    await sleep(300);
  }

  const finalButtons = Array.from(dataTable.lastElementChild?.querySelectorAll('button') || []);
  if (finalButtons[0] && !finalButtons[0].disabled) {
    finalButtons[0].click();
    await sleep(150);
  }

  if (pageSizeSelect && originalSize && originalSize !== '100') {
    pageSizeSelect.value = originalSize;
    pageSizeSelect.dispatchEvent(new Event('change', { bubbles: true }));
  }

  return canvases;
}

async function exportProjectDrawer(mode, panel, content, projectName) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  let hasPageContent = false;

  const cardsGrid = content.firstElementChild;
  const extratoHeading = Array.from(content.querySelectorAll('h3')).find((heading) =>
    (heading.textContent || '').includes('Extrato de Movimentações')
  );
  const extratoWrapper = extratoHeading?.nextElementSibling;
  const dataTable = extratoWrapper?.querySelector('.card');

  if (mode === 'full' && cardsGrid) {
    const header = panel.firstElementChild;
    const summaryHost = document.createElement('div');
    summaryHost.className = 'project-export-summary-host';
    summaryHost.style.position = 'fixed';
    summaryHost.style.left = '-10000px';
    summaryHost.style.top = '0';
    summaryHost.style.width = `${Math.max(content.clientWidth, 900)}px`;
    summaryHost.style.padding = '24px';
    summaryHost.style.background = '#061b33';
    summaryHost.style.color = '#fff';
    summaryHost.innerHTML = `${header ? header.innerHTML : ''}${cardsGrid.outerHTML}`;
    summaryHost.querySelectorAll('[data-project-export-control]').forEach((node) => node.remove());
    document.body.appendChild(summaryHost);
    try {
      addCanvasToPdf(pdf, await captureElement(summaryHost), false);
      hasPageContent = true;
    } finally {
      summaryHost.remove();
    }
  }

  if (dataTable) {
    const extratoCanvases = await collectExtratoCanvases(dataTable);
    extratoCanvases.forEach((canvas) => {
      addCanvasToPdf(pdf, canvas, hasPageContent);
      hasPageContent = true;
    });
  }

  if (!hasPageContent) return;

  const safeName = String(projectName || 'projeto')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  pdf.save(`${safeName || 'projeto'}-${mode === 'full' ? 'relatorio-completo' : 'extrato'}.pdf`);
}

function installProjectExportButtons() {
  const extratoHeading = Array.from(document.querySelectorAll('h3')).find((heading) =>
    (heading.textContent || '').includes('Extrato de Movimentações')
  );
  if (!extratoHeading) return;

  const content = extratoHeading.parentElement;
  const panel = content?.parentElement;
  const header = panel?.firstElementChild;
  if (!content || !panel || !header || header.querySelector('[data-project-export-control]')) return;

  const projectName = header.querySelector('h2')?.textContent?.trim() || 'projeto';
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
      button.textContent = 'Gerando PDF...';
      try {
        await exportProjectDrawer(mode, panel, content, projectName);
      } finally {
        button.disabled = false;
        button.textContent = original;
      }
    };
    return button;
  };

  controls.appendChild(makeButton('Exportar projeto', 'full'));
  controls.appendChild(makeButton('Somente extrato', 'extract'));

  const closeButton = header.querySelector('button');
  if (closeButton) header.insertBefore(controls, closeButton);
  else header.appendChild(controls);
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
      });
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [pathname]);

  return null;
}
