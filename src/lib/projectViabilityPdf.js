/**
 * Exportação isolada do relatório de viabilidade.
 *
 * O PDF é gerado a partir do artigo renderizado, sem usar window.print().
 * As regras globais de impressão do painel não interferem na exportação.
 */
export async function exportProjectViabilityPdf(reportElement, projectName) {
  if (!reportElement) throw new Error("O relatório ainda não está disponível para exportação.");

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  if (document.fonts?.ready) await document.fonts.ready;

  const canvas = await html2canvas(reportElement, {
    backgroundColor: "#ffffff",
    scale: 1.8,
    useCORS: true,
    logging: false,
    scrollX: 0,
    scrollY: -window.scrollY,
    windowWidth: Math.max(document.documentElement.clientWidth, reportElement.scrollWidth + 60),
    windowHeight: Math.max(document.documentElement.clientHeight, reportElement.scrollHeight + 60),
  });

  if (!canvas.width || !canvas.height) {
    throw new Error("Não foi possível capturar o conteúdo do relatório.");
  }

  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 9;
  const printableWidth = pageWidth - margin * 2;
  const printableHeight = pageHeight - margin * 2 - 4;
  const pageHeightPx = Math.floor((printableHeight / printableWidth) * canvas.width);
  const scale = canvas.width / reportElement.getBoundingClientRect().width;

  // Evita começar uma nova página no meio de título, card, tabela ou seção.
  const candidates = [...reportElement.querySelectorAll(
    "header, section, footer, .project-viability-cost-row, .project-viability-scenario-row"
  )]
    .map((node) => {
      const parentTop = reportElement.getBoundingClientRect().top;
      const top = (node.getBoundingClientRect().top - parentTop) * scale;
      const bottom = (node.getBoundingClientRect().bottom - parentTop) * scale;
      return [Math.round(top), Math.round(bottom)];
    })
    .flat()
    .filter((point) => point > 0 && point < canvas.height)
    .sort((a, b) => a - b);

  let top = 0;
  let pageIndex = 0;
  while (top < canvas.height) {
    const endLimit = Math.min(canvas.height, top + pageHeightPx);
    const safeBreak = candidates.filter(
      (point) => point > top + pageHeightPx * 0.68 && point <= endLimit
    ).at(-1);
    const end = safeBreak ?? endLimit;
    const height = Math.max(1, Math.min(canvas.height - top, end - top));

    const tile = document.createElement("canvas");
    tile.width = canvas.width;
    tile.height = height;
    const context = tile.getContext("2d");
    if (!context) throw new Error("Não foi possível preparar a página do PDF.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, tile.width, tile.height);
    context.drawImage(canvas, 0, top, canvas.width, height, 0, 0, tile.width, height);

    if (pageIndex > 0) pdf.addPage();
    const imageHeight = height * printableWidth / canvas.width;
    pdf.addImage(tile.toDataURL("image/jpeg", 0.95), "JPEG", margin, margin, printableWidth, imageHeight);

    top += height;
    pageIndex += 1;
  }

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(79, 99, 119);
  for (let page = 1; page <= pdf.getNumberOfPages(); page += 1) {
    pdf.setPage(page);
    pdf.text("OAE FIN  |  Pagina " + page + " / " + pdf.getNumberOfPages(), pageWidth - margin, pageHeight - 4, {
      align: "right",
    });
  }

  const safeName = String(projectName || "projeto")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 70) || "projeto";
  pdf.save("Analise_Viabilidade_" + safeName + ".pdf");
}
