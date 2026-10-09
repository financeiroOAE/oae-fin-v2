/**
 * Exportador vetorial exclusivo da análise de viabilidade de projetos (ADMIN).
 * Usa os números já conciliados para a prévia e não modifica regras financeiras.
 * Não passa pelo template genérico de relatórios do painel.
 */
const number = (value) => Number(value) || 0;
const fmtBRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPercent = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const money = (value) => fmtBRL.format(number(value));
const percent = (value) => Number.isFinite(value) ? fmtPercent.format(value * 100) + "%" : "—";
const share = (part, total) => number(total) > 0 ? percent(number(part) / number(total)) : "—";

const INK = "#142b45";
const MUTED = "#52647a";
const BLUE = "#245a89";
const LIGHT_BLUE = "#eaf1f9";
const LINE = "#d9e2ec";
const PALE = "#f4f7fa";
const GOLD = "#b28b4f";
const PALE_GOLD = "#faf4e9";
const RED = "#a34639";
const WHITE = "#ffffff";

const cleanName = (name) => String(name || "projeto")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 75).toLowerCase() || "projeto";

/** Renderiza numa instância jsPDF injetada, permitindo verificação sem navegador. */
export function renderProjectViabilityPdf(pdf, { project, analysis, periodLabel, includeAdminAllocation }) {
  if (!project || !analysis) throw new Error("Dados da análise do projeto indisponíveis.");

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const M = 12;
  const W = pageWidth - 2 * M;
  const bottom = pageHeight - 16;
  const projectName = String(project.nome || "Projeto não identificado");
  const reportTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date());
  const color = (hex, target = "text") => {
    if (target === "fill") pdf.setFillColor(hex);
    else if (target === "line") pdf.setDrawColor(hex);
    else pdf.setTextColor(hex);
  };
  const font = (size, weight = "normal", hex = INK) => {
    pdf.setFont("helvetica", weight);
    pdf.setFontSize(size);
    color(hex);
  };
  const fit = (value, maxWidth, start = 11, min = 6.8) => {
    let size = start;
    pdf.setFontSize(size);
    while (pdf.getTextWidth(String(value)) > maxWidth && size > min) {
      size = Math.max(min, size - 0.3);
      pdf.setFontSize(size);
    }
    return size;
  };
  const write = (value, x, y, width, options = {}) => {
    const size = options.size || 10;
    const lineHeight = options.lineHeight || size * 0.36 + 0.65;
    font(size, options.bold ? "bold" : "normal", options.color || INK);
    const lines = pdf.splitTextToSize(String(value ?? "—"), Math.max(width, 5));
    const align = options.align || "left";
    lines.forEach((line, i) => {
      const tx = align === "right" ? x + width : align === "center" ? x + width / 2 : x;
      pdf.text(line, tx, y + i * lineHeight, { align });
    });
    return y + (lines.length - 1) * lineHeight;
  };
  const oneLine = (value, x, y, width, options = {}) => {
    font(options.size || 10, options.bold ? "bold" : "normal", options.color || INK);
    fit(value, width, options.size || 10, options.minSize || 6.8);
    pdf.text(String(value), options.align === "right" ? x + width : x, y, { align: options.align || "left" });
  };
  const rect = (x, y, width, height, fill = WHITE, stroke = LINE) => {
    color(fill, "fill");
    color(stroke, "line");
    pdf.setLineWidth(0.24);
    pdf.rect(x, y, width, height, "FD");
  };
  const line = (x1, y1, x2, y2, stroke = LINE) => {
    color(stroke, "line");
    pdf.setLineWidth(0.24);
    pdf.line(x1, y1, x2, y2);
  };
  const newPage = (title, context = "") => {
    pdf.addPage();
    rect(0, 0, pageWidth, 5, BLUE, BLUE);
    write("OAE_FIN / PROJETOS", M, 18, W, { size: 9, bold: true, color: BLUE });
    write(title, M, 29, W, { size: 18, bold: true });
    write(projectName + (context ? "  |  " + context : ""), M, 37, W, { size: 9, color: MUTED });
    line(M, 41, pageWidth - M, 41);
    return 47;
  };
  const heading = (num, title, x, y, annotation = "") => {
    rect(x, y - 4.5, 9, 8, LIGHT_BLUE, LIGHT_BLUE);
    oneLine(num, x, y + 1.1, 9, { size: 9, bold: true, color: BLUE });
    write(title, x + 12, y + 1.2, 155, { size: 12, bold: true });
    if (annotation) oneLine(annotation, pageWidth - M - 94, y + 0.5, 94, { size: 8, color: MUTED, align: "right" });
  };

  // Página 1: síntese editorial fiel à prévia do ADMIN.
  rect(0, 0, pageWidth, 5, BLUE, BLUE);
  write("OAE_FIN / RESULTADO FINANCEIRO E VIABILIDADE", M, 17, 182, { size: 9, bold: true, color: BLUE });
  const nameLines = pdf.splitTextToSize(projectName, 171);
  const projectSize = nameLines.length > 1 ? 15 : 19;
  write(projectName, M, 28, 173, { size: projectSize, bold: true, lineHeight: 6 });
  const labelY = nameLines.length > 1 ? 39 : 36;
  oneLine(String(project.empresa || "Empresa não informada") + "  ·  " + String(project.tipo || "Tipo não informado"), M, labelY, 182, { size: 9, color: MUTED });
  write("Histórico: " + (periodLabel || "Posição acumulada da base") + "  |  Rateio administrativo: " + (includeAdminAllocation ? "incluído" : "não incluído"), M, 43, 184, { size: 8, color: MUTED });
  const viable = Boolean(analysis.viable);
  const inconclusive = Boolean(analysis.inconclusive);
  const verdict = inconclusive ? "Viabilidade ainda inconclusiva" : viable ? "Projeto viável nos registros atuais" : "Projeto exige revisão financeira";
  rect(204, 12, 81, 34, viable && !inconclusive ? LIGHT_BLUE : PALE_GOLD, viable && !inconclusive ? "#c9d9e9" : "#e5d7bd");
  rect(204, 12, 1.5, 34, viable && !inconclusive ? BLUE : GOLD, viable && !inconclusive ? BLUE : GOLD);
  write("PARECER FINANCEIRO PRELIMINAR", 209, 19, 71, { size: 7.8, bold: true, color: MUTED });
  write(verdict, 209, 27, 69, { size: 12, bold: true, lineHeight: 4.9 });
  line(M, 48, pageWidth - M, 48);

  heading("01", "Leitura executiva", M, 55, "Valores completos da base financeira");
  const kpiItems = [
    ["Valor contratado", analysis.contract, "Base contratual"],
    ["Faturado", analysis.billed, share(analysis.billed, analysis.contract) + " do contrato"],
    ["Recebido", analysis.received, share(analysis.received, analysis.billed) + " do faturamento"],
    ["Custos pagos", analysis.paid, share(analysis.paid, analysis.received) + " da receita recebida"],
    ["Resultado realizado", analysis.realizedResult, "Margem de " + percent(number(analysis.realizedMargin))],
    ["Resultado projetado", analysis.projectedResult, "Margem de " + percent(number(analysis.projectedMargin))],
  ];
  const gap = 3;
  const kW = (W - gap * 2) / 3;
  kpiItems.forEach(([label, amount, note], index) => {
    const x = M + (index % 3) * (kW + gap);
    const y = 62 + Math.floor(index / 3) * 25;
    rect(x, y, kW, 22, index >= 4 ? LIGHT_BLUE : WHITE);
    write(String(label).toUpperCase(), x + 3, y + 5.2, kW - 6, { size: 7.5, bold: true, color: MUTED });
    oneLine(money(amount), x + 3, y + 13.2, kW - 6, { size: 15, minSize: 9, bold: true, color: index >= 4 ? (number(amount) < 0 ? RED : BLUE) : INK });
    write(note, x + 3, y + 18.7, kW - 6, { size: 7.6, color: MUTED });
  });

  // Composição contratual e resultado realizado.
  const leftX = M;
  const leftW = 158;
  const rightX = 174;
  const rightW = pageWidth - M - rightX;
  rect(leftX, 114, leftW, 32);
  rect(rightX, 114, rightW, 32);
  write("Composição do contrato", leftX + 4, 120, leftW - 8, { size: 11, bold: true });
  write("Recebido, programado e saldo sem previsão", leftX + 4, 125, leftW - 8, { size: 7.8, color: MUTED });
  const base = Math.max(number(analysis.contract), number(analysis.knownRevenue), 1);
  const receivedFraction = Math.min(Math.max(number(analysis.received) / base, 0), 1);
  const scheduleFraction = Math.min(Math.max(number(analysis.receivable) / base, 0), 1 - receivedFraction);
  const barX = leftX + 4, barY = 128.5, barW = leftW - 8;
  rect(barX, barY, barW, 4.2, "#ecf0f5", "#ecf0f5");
  if (receivedFraction) rect(barX, barY, barW * receivedFraction, 4.2, BLUE, BLUE);
  if (scheduleFraction) rect(barX + barW * receivedFraction, barY, barW * scheduleFraction, 4.2, "#829fb8", "#829fb8");
  const legends = [
    ["Recebido", analysis.received, BLUE, 0],
    ["A receber", analysis.receivable, "#829fb8", 1],
    ["Sem previsão", analysis.unscheduledContract, GOLD, 2],
  ];
  legends.forEach(([label, amount, shade, ix]) => {
    const x = leftX + 4 + ix * 50;
    rect(x, 136, 2.1, 2.1, shade, shade);
    write(label, x + 4, 138, 43, { size: 7.1, color: MUTED });
    oneLine(money(amount), x, 143, 46, { size: 9.2, bold: true, minSize: 7.5 });
  });
  write("Resultado realizado", rightX + 4, 120, rightW - 8, { size: 11, bold: true });
  write("Recebido", rightX + 4, 126, 58, { size: 8, color: MUTED });
  oneLine(money(analysis.received), rightX + 61, 126, rightW - 65, { size: 9, align: "right", bold: true });
  write("(-) Custos pagos", rightX + 4, 133, 58, { size: 8, color: MUTED });
  oneLine(money(analysis.paid), rightX + 61, 133, rightW - 65, { size: 9, align: "right", bold: true });
  line(rightX + 4, 136, rightX + rightW - 4, 136);
  write("Resultado", rightX + 4, 142, 58, { size: 9.4, bold: true });
  oneLine(money(analysis.realizedResult), rightX + 61, 142, rightW - 65, { size: 11, align: "right", color: number(analysis.realizedResult) < 0 ? RED : BLUE, bold: true });

  // Parecer e tabela de cenários em áreas dedicadas: sem sobreposição.
  rect(M, 150, 111, 39, viable && !inconclusive ? LIGHT_BLUE : PALE_GOLD);
  write("PARECER PRELIMINAR", M + 4, 157, 103, { size: 8, bold: true, color: BLUE });
  const verdictBottom = write(verdict, M + 4, 164, 103, { size: 12.5, lineHeight: 5.1, bold: true });
  const conclusion = inconclusive
    ? "A receita registrada é insuficiente para concluir sobre a viabilidade."
    : "Realizado: " + money(analysis.realizedResult) + ". Com registros programados: " + money(analysis.projectedResult) + ".";
  write(conclusion, M + 4, Math.min(verdictBottom + 5, 174), 103, { size: 8.2, lineHeight: 3.7, color: MUTED });
  write("Conclusão sujeita ao custo para concluir o escopo.", M + 4, 186, 103, { size: 7.5, color: MUTED });
  const tx = 127, tw = pageWidth - M - tx;
  rect(tx, 150, tw, 39);
  write("Cenários financeiros", tx + 4, 156, tw - 8, { size: 10.8, bold: true });
  const scW = [45, 30, 30, 32, 13];
  const sx = [tx + 4]; for (let i = 0; i < scW.length - 1; i++) sx.push(sx[i] + scW[i]);
  const heads = ["Cenário", "Receita", "Custo", "Resultado", "Margem"];
  heads.forEach((title, i) => oneLine(title, sx[i], 162, scW[i] - 2, { size: 7.6, bold: true, color: MUTED, align: i ? "right" : "left" }));
  line(tx + 4, 164, tx + tw - 4, 164);
  const cases = [
    ["Realizado", analysis.received, analysis.paid, analysis.realizedResult, analysis.realizedMargin],
    ["Realizado + programado", analysis.knownRevenue, analysis.knownCost, analysis.projectedResult, analysis.projectedMargin],
    ["Teto contratual*", analysis.contract, analysis.knownCost, analysis.ceilingResult, analysis.ceilingMargin],
  ];
  cases.forEach((row, ix) => {
    const y = 170 + ix * 6;
    oneLine(row[0], sx[0], y, scW[0] - 2, { size: 8.1, minSize: 7.1 });
    [1, 2, 3].forEach((i) => oneLine(money(row[i]), sx[i], y, scW[i] - 2, { size: 8.4, minSize: 6.4, align: "right", bold: i === 3, color: i === 3 ? (number(row[i]) < 0 ? RED : BLUE) : INK }));
    oneLine(percent(number(row[4])), sx[4], y, scW[4] - 2, { size: 8, minSize: 6.5, align: "right" });
  });
  write("*Teto contratual não significa lucro garantido.", tx + 4, 186.1, tw - 8, { size: 7.4, color: MUTED });

  // Página 2: custos + alertas. Repetição dos cabeçalhos em eventuais quebras.
  let y = newPage("Composição dos custos e pontos de atenção", "Visão acumulada");
  heading("02", "Composição dos custos", M, y + 2, "Pagos e compromissos conhecidos");
  y += 13;
  const cols = [78, 46, 46, 52, 51];
  const start = [M];
  for (let i = 0; i < cols.length - 1; i++) start.push(start[i] + cols[i]);
  const costHeader = () => {
    rect(M, y, W, 9, LIGHT_BLUE, LIGHT_BLUE);
    ["Categoria", "Pago", "A pagar", "Total", "% custos"].forEach((h, i) =>
      oneLine(h, start[i] + 2, y + 5.9, cols[i] - 5, { size: 8.2, bold: true, color: BLUE, align: i ? "right" : "left" })
    );
    y += 9;
  };
  costHeader();
  const costRows = Array.isArray(analysis.costRows) ? analysis.costRows : [];
  const drawCost = (row, totalRow = false) => {
    const titleLines = pdf.splitTextToSize(String(row.name), cols[0] - 5);
    const height = Math.max(9, titleLines.length * 3.7 + 4);
    if (y + height > bottom) {
      y = newPage("Composição dos custos (continuação)");
      costHeader();
    }
    rect(M, y, W, height, totalRow ? LIGHT_BLUE : WHITE, LINE);
    write(row.name, start[0] + 2, y + 5.7, cols[0] - 5, { size: 8.7, bold: totalRow, lineHeight: 3.7 });
    [row.paid, row.scheduled, row.total].forEach((v, ix) =>
      oneLine(money(v), start[ix + 1] + 2, y + 5.9, cols[ix + 1] - 5, { size: 9.2, minSize: 7.3, align: "right", bold: totalRow || ix === 2 })
    );
    oneLine(share(row.total, analysis.knownCost), start[4] + 2, y + 5.9, cols[4] - 5, { size: 9, align: "right", bold: totalRow });
    y += height;
  };
  costRows.forEach(row => drawCost({ name: row.name || "Sem categoria", paid: row.paid, scheduled: row.scheduled, total: row.total }));
  drawCost({ name: "TOTAL CONHECIDO", paid: analysis.paid, scheduled: analysis.payable, total: analysis.knownCost }, true);
  y += 7;
  const costNote = "A conciliação reflete os valores do painel. Custos administrativos são despesas classificadas, não o rateio de receita do faturamento.";
  const linesCost = pdf.splitTextToSize(costNote, W - 6);
  const noteH = 6 + linesCost.length * 3.7;
  if (y + noteH > bottom) y = newPage("Notas de conciliação");
  rect(M, y, W, noteH, PALE);
  write(costNote, M + 3, y + 5.8, W - 6, { size: 8.5, lineHeight: 3.7, color: MUTED });
  y += noteH + 12;
  if (y + 41 > bottom) y = newPage("Pontos de atenção");
  heading("03", "Pontos de atenção", M, y, "Parecer sujeito às informações faltantes");
  y += 9;
  const warningItems = [
    ["Saldo sem previsão", money(analysis.unscheduledContract), share(analysis.unscheduledContract, analysis.contract) + " do contrato. Não recebido nem programado."],
    ["Compromissos a pagar", money(analysis.payable), share(analysis.payable, analysis.knownCost) + " dos custos já conhecidos."],
    ["Custo para concluir", "Não informado", "Sem avanço físico e orçamento remanescente, a viabilidade é preliminar."],
  ];
  const warningWidth = (W - 8) / 3;
  warningItems.forEach((item, i) => {
    const x = M + i * (warningWidth + 4);
    rect(x, y, warningWidth, 34, i === 2 ? PALE_GOLD : PALE);
    write(String(item[0]).toUpperCase(), x + 4, y + 6, warningWidth - 8, { size: 8.2, bold: true, color: MUTED });
    oneLine(item[1], x + 4, y + 15, warningWidth - 8, { size: 12, minSize: 8, bold: true, color: i === 2 ? RED : BLUE });
    write(item[2], x + 4, y + 21, warningWidth - 8, { size: 8.2, lineHeight: 3.9, color: MUTED });
  });
  y += 42;
  if (y + 18 < bottom) {
    write("Critério de análise", M, y, W, { size: 10, bold: true });
    write("Resultado realizado = recebido - pago. Cenário programado = (recebido + a receber) - (pago + a pagar). O teto contratual pressupõe o contrato integral e não inclui custos ainda não cadastrados.", M, y + 6, W - 6, { size: 8.7, lineHeight: 4.1, color: MUTED });
  }

  // Página 3+: evolução mensal sem truncar valores e sem cortar linhas.
  y = newPage("Evolução do caixa realizado", "Ordem cronológica");
  heading("04", "Recebimentos e pagamentos mensais", M, y + 1, "Somente movimentos efetivamente realizados");
  y += 13;
  const months = Array.isArray(analysis.monthRows) ? [...analysis.monthRows].sort((a, b) => String(a.key).localeCompare(String(b.key))) : [];
  const totalReceived = months.reduce((sum, row) => sum + number(row.received), 0);
  const totalPaid = months.reduce((sum, row) => sum + number(row.paid), 0);
  const sumValues = [
    ["Recebimentos no histórico", totalReceived, BLUE],
    ["Pagamentos no histórico", totalPaid, INK],
    ["Resultado acumulado", totalReceived - totalPaid, totalReceived - totalPaid < 0 ? RED : BLUE],
    ["Margem acumulada", share(totalReceived - totalPaid, totalReceived), INK],
  ];
  const sW = (W - 9) / 4;
  sumValues.forEach(([label, amount, shade], index) => {
    const x = M + index * (sW + 3);
    rect(x, y, sW, 23, PALE);
    write(String(label).toUpperCase(), x + 3, y + 6, sW - 6, { size: 7.8, bold: true, color: MUTED });
    oneLine(typeof amount === "number" ? money(amount) : amount, x + 3, y + 16, sW - 6, { size: 13, minSize: 8.3, bold: true, color: shade });
  });
  y += 30;
  const mw = [33, 51, 50, 50, 50, 39];
  const mx = [M]; for (let i = 0; i < mw.length - 1; i++) mx.push(mx[i] + mw[i]);
  const monthlyHeader = () => {
    rect(M, y, W, 9, LIGHT_BLUE, LIGHT_BLUE);
    ["Mês", "Comparativo", "Recebido", "Pago", "Resultado", "Margem"].forEach((label, i) =>
      oneLine(label, mx[i] + 2, y + 6, mw[i] - 4, { size: 8.1, bold: true, color: BLUE, align: i > 1 ? "right" : "left" })
    );
    y += 9;
  };
  monthlyHeader();
  if (!months.length) {
    rect(M, y, W, 18, WHITE);
    write("Não há movimentações realizadas com data válida no histórico do projeto.", M + 3, y + 10, W - 6, { size: 10, color: MUTED });
    y += 18;
  } else {
    const maxMonthly = Math.max(1, ...months.flatMap(row => [number(row.received), number(row.paid)]));
    months.forEach((row) => {
      if (y + 10 > bottom) {
        y = newPage("Evolução do caixa (continuação)", "Ordem cronológica");
        monthlyHeader();
      }
      rect(M, y, W, 10, WHITE);
      const month = /^\d{4}-\d{2}$/.test(String(row.key))
        ? String(row.key).slice(5, 7) + "/" + String(row.key).slice(0, 4)
        : String(row.key || "Sem data");
      const received = number(row.received);
      const paid = number(row.paid);
      const result = received - paid;
      oneLine(month, mx[0] + 2, y + 6.6, mw[0] - 4, { size: 9.1, bold: true });
      rect(mx[1] + 2, y + 2.1, mw[1] - 5, 2, "#ecf0f5", "#ecf0f5");
      if (received > 0) rect(mx[1] + 2, y + 2.1, Math.min(received / maxMonthly, 1) * (mw[1] - 5), 2, BLUE, BLUE);
      rect(mx[1] + 2, y + 5.9, mw[1] - 5, 2, "#ecf0f5", "#ecf0f5");
      if (paid > 0) rect(mx[1] + 2, y + 5.9, Math.min(paid / maxMonthly, 1) * (mw[1] - 5), 2, "#9aa9b8", "#9aa9b8");
      [received, paid, result].forEach((v, i) =>
        oneLine(money(v), mx[i + 2] + 2, y + 6.6, mw[i + 2] - 4, { size: 9.3, minSize: 7.3, bold: i === 2, color: i === 2 ? (v < 0 ? RED : BLUE) : INK, align: "right" })
      );
      oneLine(share(result, received), mx[5] + 2, y + 6.6, mw[5] - 4, { size: 9.1, align: "right" });
      y += 10;
    });
    if (y + 10 > bottom) {
      y = newPage("Evolução do caixa (continuação)", "Totais do período com data");
      monthlyHeader();
    }
    rect(M, y, W, 10, LIGHT_BLUE);
    oneLine("TOTAL COM DATA", mx[0] + 2, y + 6.6, mw[0] + mw[1] - 5, { size: 9.1, bold: true });
    [totalReceived, totalPaid, totalReceived - totalPaid].forEach((v, i) =>
      oneLine(money(v), mx[i + 2] + 2, y + 6.6, mw[i + 2] - 4, { size: 9.5, minSize: 7.2, bold: true, color: i === 2 ? (v < 0 ? RED : BLUE) : INK, align: "right" })
    );
    oneLine(share(totalReceived - totalPaid, totalReceived), mx[5] + 2, y + 6.6, mw[5] - 4, { size: 9.1, bold: true, align: "right" });
    y += 10;
  }
  if (y + 18 < bottom) {
    write("Legenda: azul = receita recebida | cinza = custo pago. Barras proporcionais à mesma escala em todos os meses.", M, y + 9, W, { size: 8.2, color: MUTED });
    write("A somatória mensal compreende apenas movimentos com data válida. Resultados acumulados do painel podem incluir lançamentos sem data.", M, y + 15, W, { size: 8.2, color: MUTED });
  }

  // Identificação e paginação somente após finalizar a composição.
  const count = pdf.internal.getNumberOfPages();
  for (let p = 1; p <= count; p++) {
    pdf.setPage(p);
    line(M, pageHeight - 11, pageWidth - M, pageHeight - 11);
    oneLine("OAE_FIN  ·  Documento interno e confidencial  ·  Emitido em " + reportTime, M, pageHeight - 6.5, W - 47, { size: 7.7, color: MUTED });
    oneLine("Página " + p + " de " + count, pageWidth - M - 34, pageHeight - 6.5, 34, { size: 7.7, color: MUTED, align: "right" });
  }
  return pdf;
}

export async function downloadProjectViabilityPdf(data) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  renderProjectViabilityPdf(pdf, data);
  pdf.setProperties({
    title: "Resultado Financeiro e Viabilidade - " + String(data.project?.nome || "Projeto"),
    subject: "Análise financeira interna de projeto",
    creator: "OAE_FIN",
  });
  pdf.save("resultado-financeiro-e-viabilidade-" + cleanName(data.project?.nome) + ".pdf");
}
