import { sortMovementRowsByDate } from '@/lib/reportMovementOrder.mjs';
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
  if (Array.isArray(rows)) return isMovementReport(item) ? sortMovementRowsByDate(rows) : rows;
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
    return item.type === "DRE" || columns.length > 6;
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

  // Hierarquia padrão para todas as seções exportadas:
  // título 10,5 pt em negrito; explicação 7,5 pt regular.
  // Calcular as quebras com a fonte correta evita subtítulos enormes
  // e mantém título + subtítulo juntos na mesma página.
  const drawSectionTitle = (item) => {
    const title = String(item.title || "Seção");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10.5);
    const titleLines = pdf.splitTextToSize(title, contentWidth);
    const explanation = config.includeExplanations ? String(item.explanation || "").trim() : "";
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    const explanationLines = explanation ? pdf.splitTextToSize(explanation, contentWidth) : [];
    const titleLineHeight = 4.2;
    const explanationLineHeight = 3.4;
    const sectionHeight = titleLines.length * titleLineHeight
      + (explanationLines.length ? 2 + explanationLines.length * explanationLineHeight : 0)
      + 4;
    ensureSpace(sectionHeight);

    pdf.setTextColor(30, 58, 138);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10.5);
    pdf.text(titleLines, margin, y);
    y += titleLines.length * titleLineHeight;
    if (explanationLines.length) {
      y += 1.5;
      pdf.setTextColor(71, 85, 105);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.5);
      pdf.text(explanationLines, margin, y);
      y += explanationLines.length * explanationLineHeight + 1.5;
    } else {
      y += 2;
    }
  };

  const drawTable = (item, sourceRows, title) => {
    const rows = isMovementReport(item) ? sortMovementRowsByDate(sourceRows) : sourceRows;
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

    const columnWeights = columns.map((column) => {
      const label = normalizedColumnName(column.label || column.key);
      if (/^data$|vencimento/.test(label)) return 0.80;
      if (/pessoa|fornecedor|^nome$|cliente/.test(label)) return 1.70;
      if (/documento|projeto|obra|plano|conta|descri/.test(label)) return 1.45;
      if (/situa|status/.test(label)) return 0.95;
      if (/valor|pago|pagar|total|saldo/.test(label)) return 1.00;
      return 1.15;
    });
    const totalWeight = columnWeights.reduce((sum, value) => sum + value, 0);
    const widths = columnWeights.map((weight) => contentWidth * weight / totalWeight);
    const minHeight = 6.5;
    const paddingY = 1.6;

    const fontSize = columns.length > 8 ? 5.0 : columns.length > 6 ? 5.7 : 6.5;
    const lineHeight = Math.max(2.25, fontSize * 0.43);
    const wrapCell = (value, width) => pdf.splitTextToSize(String(value ?? '—'), Math.max(width - 3, 3));

    const drawTableHeader = () => {
      const headerLines = columns.map((col, index) => wrapCell(col.label || col.key, widths[index]));
      const height = Math.max(minHeight, ...headerLines.map((lines) => lines.length * lineHeight + paddingY * 2));
      ensureSpace(height + minHeight);
      let x = margin;
      pdf.setFillColor(226, 232, 240);
      pdf.rect(margin, y, contentWidth, height, "F");
      pdf.setTextColor(51, 65, 85);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(fontSize);
      headerLines.forEach((lines, index) => {
        pdf.text(lines, x + 1.5, y + paddingY + lineHeight * 0.85);
        x += widths[index];
      });
      pdf.setDrawColor(203, 213, 225);
      pdf.setLineWidth(0.14);
      let dividerX = margin;
      widths.slice(0, -1).forEach((width) => {
        dividerX += width;
        pdf.line(dividerX, y, dividerX, y + height);
      });
      y += height;
    };

    drawTableHeader();
    rows.forEach((row, rowIndex) => {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(fontSize);
      const cells = columns.map((column, index) => {
        const format = inferReportFormat(column.key, column.format || item.columnFormats?.[column.key]);
        const raw = getReportCellValue(row, column);
        const value = formatReportValue(raw, format);
        return {
          lines: wrapCell(value, widths[index]),
          align: format === "currency" || format === "percent" || typeof raw === "number" ? "right" : "left",
        };
      });
      const rowHeight = Math.max(minHeight, ...cells.map(({lines}) => lines.length * lineHeight + paddingY * 2));
      if (rowHeight > maxY - (margin + 28)) {
        // Extremely long free-form fields are clipped only when one record would
        // exceed an entire printed page; ordinary names wrap without clipping.
        const maxLines = Math.floor((maxY - margin - 32 - paddingY * 2) / lineHeight);
        cells.forEach((cell) => { cell.lines = cell.lines.slice(0, maxLines); });
      }
      const finalHeight = Math.max(minHeight, ...cells.map(({lines}) => lines.length * lineHeight + paddingY * 2));
      if (y + finalHeight > maxY) {
        addPage();
        drawTableHeader();
      }
      if (isPriorityExportRow(row)) {
        pdf.setFillColor(225, 242, 251);
        pdf.rect(margin, y, contentWidth, finalHeight, 'F');
        pdf.setFillColor(14, 165, 233);
        pdf.rect(margin, y, 0.85, finalHeight, 'F');
      } else if (rowIndex % 2 === 1) {
        pdf.setFillColor(248, 250, 252);
        pdf.rect(margin, y, contentWidth, finalHeight, "F");
      }
      pdf.setTextColor(51, 65, 85);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(fontSize);
      let x = margin;
      cells.forEach(({lines, align}, index) => {
        const textX = align === "right" ? x + widths[index] - 1.5 : x + 1.5;
        pdf.text(lines, textX, y + paddingY + lineHeight * 0.85, { align });
        x += widths[index];
      });
      pdf.setDrawColor(203, 213, 225);
      pdf.setLineWidth(0.14);
      let dividerX = margin;
      widths.slice(0, -1).forEach((width) => {
        dividerX += width;
        pdf.line(dividerX, y, dividerX, y + finalHeight);
      });
      pdf.line(margin, y + finalHeight, pageWidth - margin, y + finalHeight);
      y += finalHeight;
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


export const isPriorityExportRow = (row) => isDocumentedPayableNext30Days(row);

// SheetJS Community não grava a cor de fundo das células. Aplicamos o estilo
// ao pacote XLSX já gerado, sem modificar valores ou fórmulas da planilha.
function stylePriorityExcelRows(xlsxBytes, prioritySheets) {
  const zip = unzipSync(xlsxBytes);
  const stylesPath = 'xl/styles.xml';
  if (!zip[stylesPath]) return xlsxBytes;
  let styles = strFromU8(zip[stylesPath]);

  const fillsMatch = styles.match(/<fills\b[^>]*>[\s\S]*?<\/fills>/);
  const fontsMatch = styles.match(/<fonts\b[^>]*>[\s\S]*?<\/fonts>/);
  const bordersMatch = styles.match(/<borders\b[^>]*>[\s\S]*?<\/borders>/);
  const xfsMatch = styles.match(/<cellXfs\b[^>]*>[\s\S]*?<\/cellXfs>/);
  if (!fillsMatch || !fontsMatch || !bordersMatch || !xfsMatch) return xlsxBytes;

  const appendStyles = (match, name, additions) => {
    const count = Number(match[0].match(/\bcount="(\d+)"/)?.[1] || 0);
    const revised = match[0].replace(new RegExp('<' + name + '\\b[^>]*>'), tag =>
      tag.replace(/count="\d+"/, 'count="' + (count + additions.length) + '"'))
      .replace('</' + name + '>', additions.join('') + '</' + name + '>');
    styles = styles.replace(match[0], revised);
    return count;
  };

  const fillBase = appendStyles(fillsMatch, 'fills', [
    '<fill><patternFill patternType="solid"><fgColor rgb="FF143456"/><bgColor indexed="64"/></patternFill></fill>',
    '<fill><patternFill patternType="solid"><fgColor rgb="FFF0F5FA"/><bgColor indexed="64"/></patternFill></fill>',
    '<fill><patternFill patternType="solid"><fgColor rgb="FFE0F2FE"/><bgColor indexed="64"/></patternFill></fill>',
    '<fill><patternFill patternType="solid"><fgColor rgb="FFE8F1F9"/><bgColor indexed="64"/></patternFill></fill>'
  ]);
  const fontBase = appendStyles(fontsMatch, 'fonts', [
    '<font><sz val="10"/><name val="Aptos"/><b/><color rgb="FFFFFFFF"/></font>',
    '<font><sz val="10"/><name val="Aptos"/><color rgb="FF233952"/></font>',
    '<font><sz val="11"/><name val="Aptos Display"/><b/><color rgb="FFFFFFFF"/></font>'
  ]);
  const borderBase = appendStyles(bordersMatch, 'borders', [
    '<border><left style="thin"><color rgb="FFD6E0EA"/></left><right style="thin"><color rgb="FFD6E0EA"/></right><top style="thin"><color rgb="FFD6E0EA"/></top><bottom style="thin"><color rgb="FFD6E0EA"/></bottom><diagonal/></border>'
  ]);

  const xfs = [...xfsMatch[0].matchAll(/<xf\b[^>]*\/>/g)].map(match => match[0]);
  if (!xfs.length) return xlsxBytes;
  const newXfs = [];
  const styleCache = new Map();
  const getStyledId = (originalId, role) => {
    const original = Number(originalId) || 0;
    const key = original + ':' + role;
    if (styleCache.has(key)) return styleCache.get(key);
    const base = xfs[original] || xfs[0];
    const roleFill = role === 'header' || role === 'summaryTitle' ? fillBase :
      role === 'priority' ? fillBase + 2 : role === 'stripe' ? fillBase + 1 : fillBase + 3;
    const roleFont = role === 'header' ? fontBase : role === 'summaryTitle' ? fontBase + 2 : fontBase + 1;
    let next = base;
    for (const [attribute, value] of Object.entries({fillId:roleFill,fontId:roleFont,borderId:borderBase})) {
      if (new RegExp('\\b' + attribute + '="\\d+"').test(next))
        next = next.replace(new RegExp('\\b' + attribute + '="\\d+"'), attribute + '="' + value + '"');
      else next = next.replace(/\/>$/, ' ' + attribute + '="' + value + '"/>');
    }
    for (const attribute of ['applyFill','applyFont','applyBorder']) {
      if (new RegExp('\\b' + attribute + '="\\d+"').test(next))
        next = next.replace(new RegExp('\\b' + attribute + '="\\d+"'), attribute + '="1"');
      else next = next.replace(/\/>$/, ' ' + attribute + '="1"/>');
    }
    const id = xfs.length + newXfs.length;
    newXfs.push(next);
    styleCache.set(key,id);
    return id;
  };

  // "Resumo" e a primeira planilha; as demais seguem a ordem de criação.
  const sheetFiles = Object.keys(zip).filter(path => /^xl\/worksheets\/sheet\d+\.xml$/.test(path))
    .sort((a,b) => Number(a.match(/sheet(\d+)/)[1]) - Number(b.match(/sheet(\d+)/)[1]));
  for (let sheetIndex = 0; sheetIndex < sheetFiles.length; sheetIndex++) {
    const path = sheetFiles[sheetIndex];
    const highlighted = new Set((prioritySheets[sheetIndex - 1] || []).map(idx => idx + 2));
    let xml = strFromU8(zip[path]);
    xml = xml.replace(/<row\b[^>]*>[\s\S]*?<\/row>/g, rowXml => {
      const rowNumber = Number(rowXml.match(/<row\b[^>]*\br="(\d+)"/)?.[1] || 0);
      if (!rowNumber) return rowXml;
      const role = sheetIndex === 0
        ? ([1,5].includes(rowNumber) ? 'summaryTitle' : 'plain')
        : rowNumber === 1 ? 'header' : highlighted.has(rowNumber) ? 'priority'
        : rowNumber % 2 === 0 ? 'plain' : 'stripe';
      return rowXml.replace(/<c\b[^>]*>/g, cell => {
        const oldStyle = Number(cell.match(/\bs="(\d+)"/)?.[1] || 0);
        const id = getStyledId(oldStyle,role);
        return /\bs="\d+"/.test(cell)
          ? cell.replace(/\bs="\d+"/,'s="' + id + '"')
          : cell.replace(/>$/,' s="' + id + '">');
      });
    });
    if (sheetIndex !== 0) {
      const sheetViews = '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>';
      xml = xml.replace(/<sheetViews\b[^>]*>[\s\S]*?<\/sheetViews>/,sheetViews);
      xml = xml.replace(/<row\b[^>]*\br="1"[^>]*>/, tag => tag.replace(/>$/, ' ht="26" customHeight="1">'));
    }
    zip[path] = strToU8(xml);
  }

  const xfsRevised = xfsMatch[0].replace(/<cellXfs\b[^>]*>/, tag =>
    tag.replace(/count="\d+"/,'count="' + (xfs.length + newXfs.length) + '"'))
    .replace('</cellXfs>',newXfs.join('') + '</cellXfs>');
  styles = styles.replace(xfsMatch[0],xfsRevised);
  zip[stylesPath] = strToU8(styles);
  return zipSync(zip,{level:6});
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
    const sourceRows = Array.isArray(item?.dataSets?.all)
      ? item.dataSets.all
      : getReportRows(item);
    const rows = isMovementReport(item) ? sortMovementRowsByDate(sourceRows) : sourceRows;
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
