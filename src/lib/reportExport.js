const CURRENCY_FORMAT = '[$R$-pt-BR] #,##0.00;[Red]-[$R$-pt-BR] #,##0.00';

function fileName(value, extension) {
  const clean = String(value || "relatorio-financeiro")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return `${clean || "relatorio-financeiro"}.${extension}`;
}

export function getReportRows(item) {
  const rows = item?.dataSets?.[item.detailMode] ?? item?.data;
  if (Array.isArray(rows)) return rows;
  if (rows && typeof rows === "object") return [rows];
  return [];
}

export function getReportColumns(item, rows = getReportRows(item)) {
  if (Array.isArray(item?.columns) && item.columns.length > 0) {
    return item.columns.map((column) =>
      typeof column === "string" ? { key: column, label: column } : column
    );
  }
  const first = rows.find((row) => row && typeof row === "object");
  return first
    ? Object.keys(first).map((key) => ({ key, label: key }))
    : [];
}

function normalizeFormat(format) {
  return typeof format === "string" ? format.toLowerCase() : "";
}

export function inferReportFormat(key, explicitFormat) {
  const explicit = normalizeFormat(explicitFormat);
  if (explicit) return explicit;
  const normalized = String(key || "").toLowerCase();
  if (normalized.includes("data") || normalized.includes("vencimento")) return "date";
  if (normalized.includes("%") || normalized.includes("percent") || normalized.includes("margem")) return "percent";
  if (/valor|saldo|contrat|fatur|receb|pago|pagar|entrada|sa[ií]da|receita|despesa|custo|resultado|imposto|total/.test(normalized)) return "currency";
  return "text";
}

function parseDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value !== "string") return null;
  const br = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  return null;
}

export function formatReportValue(value, format) {
  if (value === null || value === undefined || value === "") return "—";
  if (format === "currency" && typeof value === "number") {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  if (format === "percent" && typeof value === "number") {
    const normalized = Math.abs(value) <= 1 ? value * 100 : value;
    return `${normalized.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
  }
  if (format === "date") {
    const date = parseDate(value);
    return date ? date.toLocaleDateString("pt-BR") : String(value);
  }
  if (typeof value === "number") return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  return String(value);
}

export function describeFilters(filters) {
  if (!filters) return "Sem filtros específicos";
  if (typeof filters === "string") return filters;
  if (Array.isArray(filters)) return filters.filter(Boolean).join(" • ") || "Sem filtros específicos";
  return Object.entries(filters)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : value}`)
    .join(" • ") || "Sem filtros específicos";
}

function resolveOrientation(items, requested) {
  if (requested === "portrait" || requested === "landscape") return requested;
  const needsLandscape = items.some((item) => {
    const columns = getReportColumns(item);
    return item.type === "DRE" || columns.length > 7;
  });
  return needsLandscape ? "landscape" : "portrait";
}

function imageFromUrl(url) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

function truncateText(pdf, value, width) {
  const lines = pdf.splitTextToSize(String(value ?? "—"), Math.max(width, 4));
  const first = lines[0] || "";
  return lines.length > 1 && first.length > 2 ? `${first.slice(0, -2)}…` : first;
}

export async function exportReportToPdf(items, config) {
  const { jsPDF } = await import("jspdf");
  const orientation = resolveOrientation(items, config.orientation);
  const pdf = new jsPDF({ orientation, unit: "mm", format: "a4" });
  const margin = 12;
  const footerHeight = 10;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin * 2;
  const maxY = pageHeight - margin - footerHeight;
  const logo = await imageFromUrl("/logo.png");
  let y = margin;

  const drawHeader = () => {
    if (logo) {
      const ratio = logo.naturalWidth / Math.max(logo.naturalHeight, 1);
      pdf.addImage(logo, "PNG", margin, y, Math.min(28, 10 * ratio), 10);
    } else {
      pdf.setTextColor(30, 58, 138);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(15);
      pdf.text("OAE_FIN", margin, y + 7);
    }
    pdf.setTextColor(30, 41, 59);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text(config.title || "Relatório Financeiro", pageWidth - margin, y + 4, { align: "right" });
    pdf.setTextColor(100, 116, 139);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, pageWidth - margin, y + 9, { align: "right" });
    y += 15;
    pdf.setDrawColor(30, 58, 138);
    pdf.setLineWidth(0.6);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 7;
  };

  const addPage = () => {
    pdf.addPage();
    y = margin;
    drawHeader();
  };

  const ensureSpace = (height) => {
    if (y + height > maxY) addPage();
  };

  const drawSectionTitle = (item) => {
    ensureSpace(18);
    pdf.setTextColor(30, 58, 138);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.text(item.title, margin, y);
    y += 4;
    pdf.setTextColor(100, 116, 139);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6.8);
    const filterLines = pdf.splitTextToSize(`Filtros: ${describeFilters(item.filters)}`, contentWidth);
    pdf.text(filterLines, margin, y);
    y += filterLines.length * 3.2 + 2;
    if (config.includeExplanations && item.explanation) {
      const explanationLines = pdf.splitTextToSize(item.explanation, contentWidth);
      pdf.setTextColor(71, 85, 105);
      pdf.text(explanationLines, margin, y);
      y += explanationLines.length * 3.2 + 2;
    }
  };

  const drawTable = (item, rows, title) => {
    if (title) {
      ensureSpace(9);
      pdf.setTextColor(51, 65, 85);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.text(title, margin, y);
      y += 4;
    }
    const columns = getReportColumns(item, rows);
    if (columns.length === 0 || rows.length === 0) {
      ensureSpace(8);
      pdf.setTextColor(100, 116, 139);
      pdf.setFont("helvetica", "italic");
      pdf.setFontSize(8);
      pdf.text("Nenhum dado encontrado para os filtros selecionados.", margin, y);
      y += 8;
      return;
    }

    const firstWidth = columns.length > 2 ? Math.min(46, contentWidth * 0.28) : contentWidth / columns.length;
    const otherWidth = columns.length > 1 ? (contentWidth - firstWidth) / (columns.length - 1) : contentWidth;
    const widths = columns.map((_, index) => (index === 0 ? firstWidth : otherWidth));
    const rowHeight = 6.5;

    const drawTableHeader = () => {
      ensureSpace(rowHeight * 2);
      let x = margin;
      pdf.setFillColor(226, 232, 240);
      pdf.rect(margin, y, contentWidth, rowHeight, "F");
      pdf.setTextColor(51, 65, 85);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(columns.length > 8 ? 5.3 : 6.3);
      columns.forEach((column, index) => {
        pdf.text(truncateText(pdf, column.label || column.key, widths[index] - 2), x + 1, y + 4.3);
        x += widths[index];
      });
      y += rowHeight;
    };

    drawTableHeader();
    rows.forEach((row, rowIndex) => {
      if (y + rowHeight > maxY) {
        addPage();
        drawTableHeader();
      }
      if (rowIndex % 2 === 1) {
        pdf.setFillColor(248, 250, 252);
        pdf.rect(margin, y, contentWidth, rowHeight, "F");
      }
      let x = margin;
      pdf.setTextColor(51, 65, 85);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(columns.length > 8 ? 5.2 : 6.2);
      columns.forEach((column, index) => {
        const explicit = column.format || item.columnFormats?.[column.key];
        const format = inferReportFormat(column.key, explicit);
        const value = formatReportValue(row?.[column.key], format);
        const align = format === "currency" || format === "percent" || typeof row?.[column.key] === "number" ? "right" : "left";
        const textX = align === "right" ? x + widths[index] - 1 : x + 1;
        pdf.text(truncateText(pdf, value, widths[index] - 2), textX, y + 4.3, { align });
        x += widths[index];
      });
      pdf.setDrawColor(226, 232, 240);
      pdf.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight);
      y += rowHeight;
    });
    y += 4;
  };

  drawHeader();
  for (const item of items) {
    drawSectionTitle(item);
    if (item.capturedImage && !item.restoredWithoutImage) {
      try {
        const props = pdf.getImageProperties(item.capturedImage);
        const imageHeight = Math.min(86, contentWidth * props.height / props.width);
        ensureSpace(imageHeight + 5);
        pdf.addImage(item.capturedImage, "PNG", margin, y, contentWidth, imageHeight, undefined, "FAST");
        y += imageHeight + 6;
      } catch {
        drawTable(item, getReportRows(item));
      }
    } else {
      drawTable(item, getReportRows(item));
    }
    if (item.includePending && Array.isArray(item.pendingData) && item.pendingData.length > 0) {
      drawTable({ ...item, columns: undefined }, item.pendingData, "Pendências incluídas");
    }
  }

  const totalPages = pdf.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    pdf.setPage(page);
    pdf.setDrawColor(226, 232, 240);
    pdf.line(margin, pageHeight - 11, pageWidth - margin, pageHeight - 11);
    pdf.setTextColor(100, 116, 139);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.text("OAE_FIN • Documento interno e confidencial", margin, pageHeight - 6);
    pdf.text(`Página ${page} de ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: "right" });
  }

  pdf.save(fileName(config.title, "pdf"));
}

function excelCellValue(value, format) {
  if (format === "date") return parseDate(value) || value;
  if (format === "percent" && typeof value === "number") return Math.abs(value) <= 1 ? value : value / 100;
  return value;
}

function uniqueSheetName(rawName, usedNames) {
  const base = String(rawName || "Relatório").replace(/[\\/?*\[\]:]/g, " ").trim().slice(0, 31) || "Relatório";
  let name = base;
  let suffix = 2;
  while (usedNames.has(name.toLowerCase())) {
    const tail = ` ${suffix}`;
    name = `${base.slice(0, 31 - tail.length)}${tail}`;
    suffix += 1;
  }
  usedNames.add(name.toLowerCase());
  return name;
}

function createWorksheet(XLSX, item, rows) {
  const columns = getReportColumns(item, rows);
  const aoa = [columns.map((column) => column.label || column.key)];
  rows.forEach((row) => {
    aoa.push(columns.map((column) => {
      const format = inferReportFormat(column.key, column.format || item.columnFormats?.[column.key]);
      return excelCellValue(row?.[column.key], format);
    }));
  });
  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  worksheet["!cols"] = columns.map((column, columnIndex) => {
    const values = [column.label || column.key, ...rows.slice(0, 100).map((row) => String(row?.[column.key] ?? ""))];
    return { wch: Math.min(42, Math.max(12, ...values.map((value) => value.length + 2))) };
  });
  if (rows.length > 0 && columns.length > 0) {
    worksheet["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: columns.length - 1 } }) };
  }
  columns.forEach((column, columnIndex) => {
    const format = inferReportFormat(column.key, column.format || item.columnFormats?.[column.key]);
    for (let rowIndex = 1; rowIndex <= rows.length; rowIndex += 1) {
      const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
      if (!worksheet[address]) continue;
      if (format === "currency") worksheet[address].z = CURRENCY_FORMAT;
      if (format === "percent") worksheet[address].z = "0.00%";
      if (format === "date" && worksheet[address].v instanceof Date) worksheet[address].z = "dd/mm/yyyy";
    }
  });
  return worksheet;
}

export async function exportReportToExcel(items, config) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  const usedNames = new Set();
  const summary = [
    ["OAE_FIN", config.title || "Relatório Financeiro"],
    ["Gerado em", new Date()],
    ["Blocos", items.length],
    [],
    ["Ordem", "Bloco", "Origem", "Filtros"],
    ...items.map((item, index) => [index + 1, item.title, item.page, describeFilters(item.filters)]),
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summary);
  summarySheet["!cols"] = [{ wch: 12 }, { wch: 38 }, { wch: 24 }, { wch: 70 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumo");
  usedNames.add("resumo");

  items.forEach((item, index) => {
    const rows = getReportRows(item);
    const worksheet = createWorksheet(XLSX, item, rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, uniqueSheetName(item.title || `Bloco ${index + 1}`, usedNames));
    if (item.includePending && Array.isArray(item.pendingData) && item.pendingData.length > 0) {
      const pendingSheet = createWorksheet(XLSX, { ...item, columns: undefined }, item.pendingData);
      XLSX.utils.book_append_sheet(workbook, pendingSheet, uniqueSheetName(`Pendências ${item.title}`, usedNames));
    }
  });

  XLSX.writeFile(workbook, fileName(config.title, "xlsx"), { cellDates: true });
}

export function estimateReportPages(items, config) {
  const capacity = resolveOrientation(items, config.orientation) === "landscape" ? 42 : 34;
  const units = items.reduce((total, item) => {
    const rows = getReportRows(item).length;
    const main = item.capturedImage ? 16 : Math.max(7, Math.min(rows + 5, 70));
    const pending = item.includePending ? Math.min(item.pendingData?.length || 0, 50) : 0;
    return total + main + pending;
  }, 0);
  return Math.max(1, Math.ceil(units / capacity));
}

export function reportNeedsLandscape(items) {
  return resolveOrientation(items, "auto") === "landscape";
}
