/**
 * Identidade editorial dos relatórios OAE_FIN.
 * Design compartilhado com a análise de viabilidade, mantendo a seleção,
 * as fórmulas, filtros, dados e regras de acesso do exportador original.
 */
const COLORS = {
  ink: "#142b45",
  muted: "#52647a",
  blue: "#245a89",
  pale: "#eaf1f9",
  light: "#f4f7fa",
  line: "#d9e2ec",
  white: "#ffffff",
  warning: "#e0f2fe",
  warningAccent: "#0284c7",
  negative: "#a34639",
};

export async function renderFinancialReportPdf(items, config = {}, helpers) {
  const { jsPDF } = await import("jspdf");
  const {
    resolveOrientation, getReportRows, getReportColumns, getReportCellValue,
    inferReportFormat, formatReportValue, isMovementReport,
    sortMovementRowsByDate, isPriorityExportRow, fileName,
  } = helpers;
  const orientation = resolveOrientation(items, config.orientation);
  const pdf = new jsPDF({ orientation, unit: "mm", format: "a4", compress: true });
  const margin = 12;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin * 2;
  const bottom = pageHeight - 16;
  const generatedAt = new Date().toLocaleString("pt-BR");
  let y = margin;
  let sectionNumber = 0;
  const fill = (hex) => pdf.setFillColor(hex);
  const ink = (hex) => pdf.setTextColor(hex);
  const rule = (x1, yy, x2, color = COLORS.line, thickness = 0.2) => {
    pdf.setDrawColor(color);
    pdf.setLineWidth(thickness);
    pdf.line(x1, yy, x2, yy);
  };
  const font = (size = 9, weight = "normal", color = COLORS.ink) => {
    pdf.setFont("helvetica", weight);
    pdf.setFontSize(size);
    ink(color);
  };
  const wrapped = (text, width, size = 9, weight = "normal") => {
    font(size, weight);
    return pdf.splitTextToSize(String(text ?? "—"), Math.max(width, 4));
  };
  const fontThatFits = (text, width, original = 11, min = 7.4) => {
    let size = original;
    font(size, "bold");
    while (pdf.getTextWidth(String(text)) > width && size > min) {
      size = Math.max(min, size - 0.3);
      font(size, "bold");
    }
    return size;
  };
  const drawHeader = () => {
    fill(COLORS.blue);
    pdf.rect(0, 0, pageWidth, 5, "F");
    font(8.4, "bold", COLORS.blue);
    pdf.text("OAE_FIN / RELATÓRIO GERENCIAL", margin, 16.5);
    font(7.2, "normal", COLORS.muted);
    pdf.text("OLIVEIRA ARAÚJO ENGENHARIA", pageWidth - margin, 16.5, { align: "right" });
    const title = String(config.title || "Relatório Financeiro");
    const titleSize = title.length > 95 ? 12.2 : title.length > 64 ? 14.2 : 17;
    const titleLines = wrapped(title, contentWidth, titleSize, "bold");
    font(titleSize, "bold", COLORS.ink);
    pdf.text(titleLines, margin, 27, { lineHeightFactor: 1.12 });
    const lineHeight = titleSize * 0.3528 * 1.12;
    const titleEnd = 27 + (titleLines.length - 1) * lineHeight;
    font(8, "normal", COLORS.muted);
    pdf.text("Emitido em " + generatedAt + "  ·  Dados conforme seleção e filtros do painel", margin, titleEnd + 7.3);
    y = titleEnd + 13.3;
    rule(margin, y, pageWidth - margin);
    y += 8;
  };
  const addPage = () => {
    pdf.addPage();
    drawHeader();
  };
  const ensureSpace = (height) => {
    if (y + height > bottom) addPage();
  };
  const sectionHeader = (item) => {
    sectionNumber += 1;
    const title = String(item.title || "Seção");
    const titleX = margin + 13;
    const titleLines = wrapped(title, contentWidth - 13, 11.2, "bold");
    const explanation = config.includeExplanations ? String(item.explanation || "").trim() : "";
    const noteLines = explanation ? wrapped(explanation, contentWidth - 13, 7.5) : [];
    const titleHeight = titleLines.length * 4.5;
    const noteHeight = noteLines.length ? 2 + noteLines.length * 3.4 : 0;
    const height = Math.max(11, titleHeight + noteHeight + 4);
    ensureSpace(height + 8);
    fill(COLORS.pale);
    pdf.rect(margin, y - 3.8, 9, 8, "F");
    font(8.8, "bold", COLORS.blue);
    pdf.text(String(sectionNumber).padStart(2, "0"), margin + 4.5, y + 1.6, { align: "center" });
    font(11.2, "bold", COLORS.ink);
    pdf.text(titleLines, titleX, y + 1.1, { lineHeightFactor: 1.14 });
    let noteY = y + titleHeight + 1.1;
    if (noteLines.length) {
      font(7.5, "normal", COLORS.muted);
      pdf.text(noteLines, titleX, noteY + 1.3, { lineHeightFactor: 1.2 });
      noteY += noteHeight;
    }
    y = Math.max(y + 8, noteY + 4);
  };
  const drawSubheading = (text) => {
    ensureSpace(11);
    fill(COLORS.light);
    pdf.rect(margin, y, contentWidth, 8, "F");
    font(8.7, "bold", COLORS.blue);
    pdf.text(String(text), margin + 3, y + 5.5);
    y += 11;
  };
  const showEmpty = () => {
    ensureSpace(13);
    fill(COLORS.light);
    pdf.rect(margin, y, contentWidth, 12, "F");
    font(8.5, "italic", COLORS.muted);
    pdf.text("Nenhum dado encontrado para os filtros selecionados.", margin + 4, y + 7.5);
    y += 15;
  };

  // Indicadores de resumo: cards editoriais apenas para linhas curtas.
  const drawSummary = (item, rows) => {
    const columns = getReportColumns(item, rows);
    if (rows.length !== 1 || columns.length === 0) return false;
    const row = rows[0];
    const summaries = columns.map((col) => {
      const format = inferReportFormat(col.key, col.format || item.columnFormats?.[col.key]);
      return { label: String(col.label || col.key), value: formatReportValue(getReportCellValue(row, col), format) };
    });
    // Textos longos, como justificativas e listagens, continuam em tabela sem cortes.
    if (summaries.some((v) => v.value.length > 100 || v.label.length > 85)) return false;
    const perRow = orientation === "landscape" ? 3 : 2;
    const gap = 3;
    const width = (contentWidth - (perRow - 1) * gap) / perRow;
    for (let i = 0; i < summaries.length; i += perRow) {
      const group = summaries.slice(i, i + perRow).map((v) => ({
        ...v,
        labelLines: wrapped(v.label.toUpperCase(), width - 7, 7.5, "bold"),
        valueLines: wrapped(v.value, width - 7, v.value.length > 30 ? 9 : 11.5, "bold"),
      }));
      const rowHeight = Math.max(25, ...group.map((v) =>
        9 + v.labelLines.length * 3 + v.valueLines.length * 4.2 + 4
      ));
      ensureSpace(rowHeight);
      group.forEach((v, j) => {
        const x = margin + j * (width + gap);
        fill((i + j) % 5 === 4 ? COLORS.pale : COLORS.white);
        pdf.setDrawColor(COLORS.line);
        pdf.setLineWidth(0.23);
        pdf.rect(x, y, width, rowHeight, "FD");
        font(7.5, "bold", COLORS.muted);
        pdf.text(v.labelLines, x + 3.5, y + 6.4, { lineHeightFactor: 1.1 });
        const top = y + 9.2 + v.labelLines.length * 3;
        const size = v.value.length > 30 ? 9 : fontThatFits(v.value, width - 7, 11.5, 8.2);
        font(size, "bold", COLORS.ink);
        pdf.text(v.valueLines, x + 3.5, top, { lineHeightFactor: 1.15 });
      });
      y += rowHeight + gap;
    }
    y += 1;
    return true;
  };

  const drawTable = (item, sourceRows, subheading) => {
    const rows = isMovementReport(item) ? sortMovementRowsByDate(sourceRows) : sourceRows;
    if (subheading) drawSubheading(subheading);
    const columns = getReportColumns(item, rows);
    if (!rows.length || !columns.length) return showEmpty();

    const normalize = (value) => String(value || "").normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const weights = columns.map((col) => {
      const label = normalize(col.label || col.key);
      if (/^data$|vencimento/.test(label)) return 0.8;
      if (/pessoa|fornecedor|^nome$|cliente/.test(label)) return 1.7;
      if (/documento|projeto|obra|plano|conta|descri/.test(label)) return 1.45;
      if (/situa|status/.test(label)) return 0.95;
      if (/valor|pago|pagar|total|saldo/.test(label)) return 1;
      return 1.15;
    });
    const total = weights.reduce((a, b) => a + b, 0);
    const widths = weights.map((weight) => contentWidth * weight / total);
    const xs = [margin];
    widths.slice(0, -1).forEach((width, ix) => xs.push(xs[ix] + width));
    const cellFont = columns.length > 9 ? 5.0 : columns.length > 7 ? 5.8 : 7.1;
    const cellLineHeight = cellFont * 0.405;
    const rowPadding = 1.7;
    const wrapCell = (text, width) => wrapped(text, Math.max(4, width - 3.4), cellFont);
    const drawTableHeader = () => {
      const lines = columns.map((col, ix) => wrapCell(col.label || col.key, widths[ix]));
      const headHeight = Math.max(8.5, ...lines.map(group => group.length * cellLineHeight + rowPadding * 2 + 0.5));
      ensureSpace(headHeight + 7);
      fill(COLORS.pale);
      pdf.rect(margin, y, contentWidth, headHeight, "F");
      font(cellFont, "bold", COLORS.blue);
      lines.forEach((group, ix) => {
        pdf.text(group, xs[ix] + 1.7, y + rowPadding + cellLineHeight * 0.8, { lineHeightFactor: 1.15 });
      });
      pdf.setDrawColor(COLORS.line);
      pdf.setLineWidth(0.15);
      xs.slice(1).forEach(x => pdf.line(x, y, x, y + headHeight));
      rule(margin, y + headHeight, pageWidth - margin);
      y += headHeight;
    };
    drawTableHeader();
    rows.forEach((row, rowIndex) => {
      const cells = columns.map((column, index) => {
        const format = inferReportFormat(column.key, column.format || item.columnFormats?.[column.key]);
        const raw = getReportCellValue(row, column);
        return {
          lines: wrapCell(formatReportValue(raw, format), widths[index]),
          align: format === "currency" || format === "percent" || typeof raw === "number" ? "right" : "left",
        };
      });
      // Registros curtos jamais são divididos; registros maiores que a página
      // continuam na página seguinte, sem suprimir conteúdo.
      let offset = 0;
      const rowLines = Math.max(1, ...cells.map(cell => cell.lines.length));
      const emphasized = isPriorityExportRow(row);
      while (offset < rowLines) {
        const remainingHeight = bottom - y;
        if (remainingHeight < 8.5) {
          addPage();
          drawTableHeader();
        }
        const availableLines = Math.max(1, Math.floor((bottom - y - rowPadding * 2) / cellLineHeight));
        const linesThisPage = Math.min(rowLines - offset, availableLines);
        const chunkHeight = Math.max(7.5, linesThisPage * cellLineHeight + rowPadding * 2);
        // Evita dividir uma linha normal quando ela cabe integralmente na próxima página.
        if (offset === 0 && rowLines <= Math.floor((bottom - (margin + 50)) / cellLineHeight)
            && y + chunkHeight > bottom) {
          addPage();
          drawTableHeader();
          continue;
        }
        if (y + chunkHeight > bottom) {
          addPage();
          drawTableHeader();
          continue;
        }
        if (emphasized) {
          fill(COLORS.warning);
          pdf.rect(margin, y, contentWidth, chunkHeight, "F");
          fill(COLORS.warningAccent);
          pdf.rect(margin, y, 0.85, chunkHeight, "F");
        } else if (rowIndex % 2 === 1) {
          fill(COLORS.light);
          pdf.rect(margin, y, contentWidth, chunkHeight, "F");
        }
        cells.forEach((cell, index) => {
          const lines = cell.lines.slice(offset, offset + linesThisPage);
          if (!lines.length) return;
          font(cellFont, "normal", COLORS.ink);
          const textX = cell.align === "right" ? xs[index] + widths[index] - 1.7 : xs[index] + 1.7;
          pdf.text(lines, textX, y + rowPadding + cellLineHeight * 0.8, {
            align: cell.align,
            lineHeightFactor: 1.15,
          });
        });
        pdf.setDrawColor(COLORS.line);
        pdf.setLineWidth(0.15);
        xs.slice(1).forEach(x => pdf.line(x, y, x, y + chunkHeight));
        rule(margin, y + chunkHeight, pageWidth - margin);
        y += chunkHeight;
        offset += linesThisPage;
        if (offset < rowLines) {
          addPage();
          drawTableHeader();
        }
      }
    });
    y += 4;
  };

  drawHeader();
  for (const item of items) {
    sectionHeader(item);
    const rows = getReportRows(item);
    if (item.capturedImage && !item.restoredWithoutImage) {
      try {
        const props = pdf.getImageProperties(item.capturedImage);
        const height = Math.min(86, contentWidth * props.height / Math.max(props.width, 1));
        ensureSpace(height + 8);
        pdf.setDrawColor(COLORS.line);
        pdf.setLineWidth(0.22);
        pdf.rect(margin, y, contentWidth, height + 4, "S");
        pdf.addImage(item.capturedImage, "PNG", margin + 2, y + 2, contentWidth - 4, height, undefined, "FAST");
        y += height + 9;
      } catch {
        drawTable(item, rows);
      }
    } else if (item.type === "CHART") {
      throw new Error('Gráfico “' + item.title + '” sem imagem. Atualize a captura antes de exportar.');
    } else if (!(item.type === "SUMMARY" && drawSummary(item, rows))) {
      drawTable(item, rows);
    }
    if (item.includePending && Array.isArray(item.pendingData) && item.pendingData.length) {
      drawTable({ ...item, columns: undefined }, item.pendingData, "Pendências incluídas");
    }
    if (y < bottom) y += 8;
  }

  const totalPages = pdf.internal.getNumberOfPages();
  for (let page = 1; page <= totalPages; page++) {
    pdf.setPage(page);
    rule(margin, pageHeight - 11, pageWidth - margin);
    font(7.2, "normal", COLORS.muted);
    pdf.text("OAE_FIN  ·  Documento interno e confidencial  ·  Emitido em " + generatedAt, margin, pageHeight - 6.5);
    pdf.text("Página " + page + " de " + totalPages, pageWidth - margin, pageHeight - 6.5, { align: "right" });
  }
  pdf.setProperties({ title: String(config.title || "Relatório Financeiro"), creator: "OAE_FIN" });
  pdf.save(fileName(config.title, "pdf"));
}
