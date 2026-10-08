import { isDocumentedPayableNext30Days } from '@/lib/paymentCommitment';
import { unzipSync, zipSync, strFromU8, strToU8 } from "fflate";
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

const MOVEMENT_NAME_KEY = "__movementName";
const MOVEMENT_NAME_ALIASES = [
  "nome / pessoa / fornecedor",
  "nome / fornecedor",
  "fornecedor / nome",
  "cliente / nome",
  "pessoa / empresa",
  "pessoa",
  "fornecedor",
  "cliente",
  "nome",
];

function normalizedColumnName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function isMovementReport(item) {
  const haystack = normalizedColumnName(
    [item?.title, item?.componentName, item?.sectionKey].filter(Boolean).join(" ")
  );
  return haystack.includes("moviment");
}

function movementNameValue(row) {
  if (!row || typeof row !== "object") return undefined;

  for (const alias of MOVEMENT_NAME_ALIASES) {
    const key = Object.keys(row).find((candidate) => normalizedColumnName(candidate) === alias);
    if (key && row[key] !== undefined && row[key] !== null && row[key] !== "") return row[key];
  }

  const fallback = Object.keys(row).find((candidate) => {
    const normalized = normalizedColumnName(candidate);
    return normalized === "nome" || normalized.includes("fornecedor") || normalized.includes("pessoa");
  });
  return fallback ? row[fallback] : undefined;
}

export function getReportCellValue(row, column) {
  if (column?.key === MOVEMENT_NAME_KEY) return movementNameValue(row);
  return row?.[column?.key];
}

export function getReportColumns(item, rows = getReportRows(item)) {
  let columns;
  if (Array.isArray(item?.columns) && item.columns.length > 0) {
    columns = item.columns.map((column) =>
      typeof column === "string" ? { key: column, label: column } : column
    );
  } else {
    const first = rows.find((row) => row && typeof row === "object");
    columns = first
      ? Object.keys(first).map((key) => ({ key, label: key }))
      : [];
  }

  if (!isMovementReport(item) || rows.length === 0) return columns;

  const hasMovementName = rows.some((row) => movementNameValue(row) !== undefined);
  if (!hasMovementName) return columns;

  const withoutNameAliases = columns.filter((column) => {
    const normalized = normalizedColumnName(column?.key || column?.label);
    return !MOVEMENT_NAME_ALIASES.includes(normalized);
  });

  const dataIndex = withoutNameAliases.findIndex((column) =>
    normalizedColumnName(column?.key || column?.label).includes("data")
  );
  const insertAt = dataIndex >= 0 ? dataIndex + 1 : 0;

  return [
    ...withoutNameAliases.slice(0, insertAt),
    { key: MOVEMENT_NAME_KEY, label: "Nome / Pessoa / Fornecedor", format: "text" },
    ...withoutNameAliases.slice(insertAt),
  ];
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

    const drawColumnDividers = (topY) => {
      if (normalizedColumnName(item?.page) !== "equipe" || columns.length < 2) return;
      let dividerX = margin;
      pdf.setDrawColor(203, 213, 225);
      pdf.setLineWidth(0.15);
      for (let index = 0; index < columns.length - 1; index += 1) {
        dividerX += widths[index];
        pdf.line(dividerX, topY, dividerX, topY + rowHeight);
      }
    };

    const drawTableHeader = () => {
      ensureSpace(rowHeight * 2);
      const headerY = y;
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
      drawColumnDividers(headerY);
      y += rowHeight;
    };

    drawTableHeader();
    rows.forEach((row, rowIndex) => {
      if (y + rowHeight > maxY) {
        addPage();
        drawTableHeader();
      }
      const priority = isDocumentedPayableNext30Days(row) || /VENCE EM AT[EÉ] 30 DIAS/i.test(String(row?.['Situação'] ?? ''));
      if (priority) {
        pdf.setFillColor(225, 242, 251);
        pdf.rect(margin, y, contentWidth, rowHeight, 'F');
        pdf.setFillColor(14, 165, 233);
        pdf.rect(margin, y, 0.85, rowHeight, 'F');
      } else if (rowIndex % 2 === 1) {
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
        const value = formatReportValue(getReportCellValue(row, column), format);
        const align = format === "currency" || format === "percent" || typeof getReportCellValue(row, column) === "number" ? "right" : "left";
        const textX = align === "right" ? x + widths[index] - 1 : x + 1;
        pdf.text(truncateText(pdf, value, widths[index] - 2), textX, y + 4.3, { align });
        x += widths[index];
      });
      drawColumnDividers(y);
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
    } else if (item.type === "CHART") {
      throw new Error(`Gráfico “${item.title}” sem imagem. Atualize a captura antes de exportar.`);
    } else {
      drawTable(item, getReportRows(item));
    }
    if (item.includePending && Array.isArray(item.pendingData) && item.pendingData.length > 0) {
      drawTable({ ...item, columns: undefined }, item.pendingData, "Pendências incluídas");
    }

    // Respiro visual entre um topico e o seguinte no PDF.
    if (y < maxY) y += 8;
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
      return excelCellValue(getReportCellValue(row, column), format);
    }));
  });
  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  worksheet["!cols"] = columns.map((column, columnIndex) => {
    const values = [column.label || column.key, ...rows.slice(0, 100).map((row) => String(getReportCellValue(row, column) ?? ""))];
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


export const isPriorityExportRow = (row) => isDocumentedPayableNext30Days(row)
  || /VENCE EM AT[EÉ] 30 DIAS/i.test(String(row?.['Situação'] ?? row?.Situacao ?? ''));

// SheetJS Community não grava a cor de fundo das células. Aplicamos o estilo
// ao pacote XLSX já gerado, sem modificar valores ou fórmulas da planilha.
function stylePriorityExcelRows(xlsxBytes, prioritySheets) {
  if (!prioritySheets.some((rows) => rows.length)) return xlsxBytes;
  const zip = unzipSync(xlsxBytes);
  const stylesPath = 'xl/styles.xml';
  if (!zip[stylesPath]) return xlsxBytes;
  let styles = strFromU8(zip[stylesPath]);
  const fills = styles.match(/<fills\b[^>]*>[\s\S]*?<\/fills>/);
  const cellXfs = styles.match(/<cellXfs\b[^>]*>[\s\S]*?<\/cellXfs>/);
  if (!fills || !cellXfs) return xlsxBytes;

  const currentFillCount = Number(fills[0].match(/\bcount="(\d+)"/)?.[1] || 0);
  const fillXml = '<fill><patternFill patternType="solid"><fgColor rgb="FFE0F2FE"/><bgColor indexed="64"/></patternFill></fill>';
  styles = styles.replace(fills[0], fills[0].replace(/<fills\b[^>]*>/, (tag) =>
    tag.replace(/count="\d+"/, 'count="' + (currentFillCount + 1) + '"'))
    .replace('</fills>', fillXml + '</fills>'));

  let xfsBlock = cellXfs[0];
  const xfs = [...xfsBlock.matchAll(/<xf\b[^>]*\/>/g)].map((match) => match[0]);
  if (!xfs.length) return xlsxBytes;
  const priorityStyles = new Map();
  const additions = [];
  const priorityStyleId = (original) => {
    const base = Number(original) || 0;
    if (priorityStyles.has(base)) return priorityStyles.get(base);
    const template = xfs[base] || xfs[0];
    let next = template.replace(/\bfillId="\d+"/, 'fillId="' + currentFillCount + '"');
    if (!/\bfillId=/.test(next)) next = next.replace(/\/>$/, ' fillId="' + currentFillCount + '"/>');
    if (/\bapplyFill=/.test(next)) next = next.replace(/\bapplyFill="\d+"/, 'applyFill="1"');
    else next = next.replace(/\/>$/, ' applyFill="1"/>');
    const id = xfs.length + additions.length;
    additions.push(next);
    priorityStyles.set(base, id);
    return id;
  };

  prioritySheets.forEach((rows, index) => {
    if (!rows.length) return;
    const sheetPath = 'xl/worksheets/sheet' + (index + 2) + '.xml';
    if (!zip[sheetPath]) return;
    let sheet = strFromU8(zip[sheetPath]);
    const rowNumbers = new Set(rows.map((index) => index + 2));
    sheet = sheet.replace(/<row\b[^>]*>[\s\S]*?<\/row>/g, (rowXml) => {
      const index = Number(rowXml.match(/<row\b[^>]*\br="(\d+)"/)?.[1] || 0);
      if (!rowNumbers.has(index)) return rowXml;
      return rowXml.replace(/<c\b[^>]*>/g, (cell) => {
        const oldStyle = Number(cell.match(/\bs="(\d+)"/)?.[1] || 0);
        const newStyle = priorityStyleId(oldStyle);
        return /\bs="\d+"/.test(cell)
          ? cell.replace(/\bs="\d+"/, 's="' + newStyle + '"')
          : cell.replace(/>$/, ' s="' + newStyle + '">');
      });
    });
    zip[sheetPath] = strToU8(sheet);
  });

  if (!additions.length) return xlsxBytes;
  xfsBlock = xfsBlock.replace(/<cellXfs\b[^>]*>/, (tag) =>
    tag.replace(/count="\d+"/, 'count="' + (xfs.length + additions.length) + '"'))
    .replace('</cellXfs>', additions.join('') + '</cellXfs>');
  styles = styles.replace(cellXfs[0], xfsBlock);
  zip[stylesPath] = strToU8(styles);
  return zipSync(zip, { level: 6 });
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
    ["Ordem", "Bloco", "Origem"],
    ...items.map((item, index) => [index + 1, item.title, item.page]),
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summary);
  summarySheet["!cols"] = [{ wch: 12 }, { wch: 38 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumo");
  usedNames.add("resumo");

  const prioritySheets = [];
  items.forEach((item, index) => {
    // Excel é uma exportação de dados, não uma captura visual. Quando o bloco
    // oferece a relação completa filtrada, ela tem prioridade sobre resumo/visível.
    const rows = Array.isArray(item?.dataSets?.all)
      ? item.dataSets.all
      : getReportRows(item);
    const worksheet = createWorksheet(XLSX, item, rows);
    prioritySheets.push(rows.flatMap((row, rowIndex) => isPriorityExportRow(row) ? [rowIndex] : []));
    XLSX.utils.book_append_sheet(workbook, worksheet, uniqueSheetName(item.title || `Bloco ${index + 1}`, usedNames));
    if (item.includePending && Array.isArray(item.pendingData) && item.pendingData.length > 0) {
      const pendingSheet = createWorksheet(XLSX, { ...item, columns: undefined }, item.pendingData);
      prioritySheets.push(item.pendingData.flatMap((row, rowIndex) => isPriorityExportRow(row) ? [rowIndex] : []));
      XLSX.utils.book_append_sheet(workbook, pendingSheet, uniqueSheetName(`Pendências ${item.title}`, usedNames));
    }
  });

  const original = XLSX.write(workbook, { bookType: "xlsx", type: "array", cellDates: true });
  const styled = stylePriorityExcelRows(new Uint8Array(original), prioritySheets);
  const url = URL.createObjectURL(new Blob([styled], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName(config.title, "xlsx");
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
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
