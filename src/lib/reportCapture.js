// Captura um bloco do painel para manter no PDF a mesma composicao visivel.
// A imagem nao e persistida no navegador; deve ser renovada ao exportar.
export async function captureReportSection(section, fallbackElement = null) {
  if (typeof document === "undefined") return null;

  let target = section?.captureId ? document.getElementById(section.captureId) : null;
  if (!target && fallbackElement) target = fallbackElement.closest("[data-report-section]");
  if (!target && section?.sectionKey) {
    const marker = Array.from(document.querySelectorAll("[data-report-section-key]"))
      .find((element) => element.getAttribute("data-report-section-key") === section.sectionKey);
    target = marker?.closest("[data-report-section]") || null;
  }
  if (!target || !target.isConnected || target.getBoundingClientRect().width < 30 || target.getBoundingClientRect().height < 30) return null;

  // Aguarda fontes e layout responsivo do Recharts antes da captura.
  if (document.fonts?.ready) await document.fonts.ready;
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  const html2canvas = (await import("html2canvas")).default;
  const canvas = await html2canvas(target, {
    scale: Math.min(Math.max(window.devicePixelRatio || 1, 2), 2.5),
    useCORS: true,
    logging: false,
    backgroundColor: null,
    ignoreElements: (element) => element.hasAttribute?.("data-report-control"),
  });
  if (canvas.width < 30 || canvas.height < 30) return null;
  return canvas.toDataURL("image/png");
}
