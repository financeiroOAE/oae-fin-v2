"use client";

import React, { useMemo, useState } from "react";
import { useReport } from "@/contexts/ReportContext";
import ReportPreview from "./ReportPreview";
import { estimateReportPages, exportReportToExcel, exportReportToPdf, reportNeedsLandscape } from "@/lib/reportExport";
import {
  ArrowDown,
  ArrowUp,
  Download,
  Eye,
  FileDown,
  FileText,
  GripVertical,
  LoaderCircle,
  LogOut,
  PlusCircle,
  Table,
  Trash2,
  X,
} from "lucide-react";

const detailLabels = {
  summary: "Resumo",
  visible: "Itens visíveis",
  all: "Todos os itens filtrados",
  groups: "Somente grupos",
  current: "Visualização atual",
  expanded: "Grupos e contas expandidas",
};

export default function ReportDrawer() {
  const {
    isDrawerOpen,
    setIsDrawerOpen,
    isReportMode,
    activeReportPage,
    exitReportMode,
    reportItems,
    addReportItem,
    updateReportItem,
    reorderReportPageItems,
    removeReportItem,
    clearReportPage,
    reportConfig,
    setReportConfig,
    availableSections,
    statusMessage,
    setStatusMessage,
  } = useReport();
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isExporting, setIsExporting] = useState("");
  const [preparingSection, setPreparingSection] = useState("");
  const [draggedIndex, setDraggedIndex] = useState(null);

  const pageItems = useMemo(
    () => activeReportPage
      ? reportItems.filter((item) => item.page === activeReportPage)
      : reportItems,
    [activeReportPage, reportItems]
  );
  const pageSections = useMemo(
    () => Object.values(availableSections)
      .filter((section) => !activeReportPage || section.page === activeReportPage),
    [activeReportPage, availableSections]
  );

  const estimatedPages = useMemo(
    () => estimateReportPages(pageItems, reportConfig),
    [pageItems, reportConfig]
  );
  const recommendsLandscape = useMemo(() => reportNeedsLandscape(pageItems), [pageItems]);

  if (!isDrawerOpen && !isReportMode) return null;

  const updateDetailMode = (item, mode) => {
    updateReportItem(item.id, {
      detailMode: mode,
      data: item.dataSets?.[mode] ?? item.data,
      restoredWithoutImage: mode !== item.detailMode ? true : item.restoredWithoutImage,
    });
  };

  const runExport = async (kind) => {
    setIsExporting(kind);
    setStatusMessage(kind === "pdf" ? "Gerando PDF..." : "Gerando Excel...");
    try {
      if (kind === "pdf") await exportReportToPdf(pageItems, reportConfig);
      else await exportReportToExcel(pageItems, reportConfig);
      setStatusMessage(kind === "pdf" ? "PDF gerado com sucesso." : "Excel gerado com sucesso.");
    } catch {
      setStatusMessage(`Não foi possível gerar o arquivo ${kind.toUpperCase()}. Tente novamente.`);
    } finally {
      setIsExporting("");
    }
  };

  const addAvailableSection = async (section) => {
    if (pageItems.some((item) => item.sectionKey === section.sectionKey)) return;
    setPreparingSection(section.sectionKey);
    let capturedImage;
    try {
      const target = section.captureId ? document.getElementById(section.captureId) : null;
      if (target && section.type === "CHART") {
        const html2canvas = (await import("html2canvas")).default;
        const canvas = await html2canvas(target, {
          scale: Math.min(window.devicePixelRatio || 1, 1.75),
          useCORS: true,
          logging: false,
          backgroundColor: null,
          ignoreElements: (element) => element.hasAttribute?.("data-report-control"),
        });
        capturedImage = canvas.toDataURL("image/png", 0.94);
      }
    } catch {
      // A tabela de dados continua disponível caso a captura do gráfico falhe.
    }
    addReportItem({ ...section, capturedImage });
    setPreparingSection("");
  };

  return (
    <>
      {isDrawerOpen && <button type="button" className="report-drawer-backdrop" aria-label="Fechar construtor" onClick={() => setIsDrawerOpen(false)} />}

      <aside className={`report-drawer ${isDrawerOpen ? "is-open" : ""}`} aria-hidden={!isDrawerOpen}>
        <header className="report-drawer-header">
          <div className="report-drawer-title">
            <h2><FileText size={20} /> Relatório</h2>
            <span>Somente: {activeReportPage || "página atual"}</span>
          </div>
          <div className="report-drawer-header-actions">
            <button type="button" className="report-exit-button" onClick={exitReportMode}><LogOut size={15} /> Sair</button>
            <button type="button" className="report-icon-button" onClick={() => setIsDrawerOpen(false)} aria-label="Fechar"><X size={20} /></button>
          </div>
        </header>

        <div className="report-drawer-body">
          <section className="report-builder-section">
            <label className="report-field-label" htmlFor="report-title">Título do relatório</label>
            <input id="report-title" className="report-input" value={reportConfig.title} onChange={(event) => setReportConfig({ ...reportConfig, title: event.target.value })} />

            <div className="report-inline-fields">
              <label className="report-field-label" htmlFor="report-orientation">Orientação</label>
              <select id="report-orientation" className="report-select" value={reportConfig.orientation} onChange={(event) => setReportConfig({ ...reportConfig, orientation: event.target.value })}>
                <option value="auto">Automática</option>
                <option value="portrait">Retrato</option>
                <option value="landscape">Paisagem</option>
              </select>
            </div>
            {recommendsLandscape && reportConfig.orientation === "portrait" && (
              <p className="report-warning">Há uma tabela larga. A orientação paisagem pode ficar mais legível.</p>
            )}
            <label className="report-checkbox">
              <input type="checkbox" checked={reportConfig.includeExplanations} onChange={(event) => setReportConfig({ ...reportConfig, includeExplanations: event.target.checked })} />
              Incluir explicações dos indicadores
            </label>
          </section>

          <section className="report-builder-section">
            <div className="report-section-heading"><div><span className="report-step">1</span><h3>Escolha os blocos</h3></div></div>
            <p className="report-help">A lista abaixo mostra somente o conteúdo de {activeReportPage || "esta página"}.</p>
            {pageSections.length === 0 ? (
              <div className="report-empty-state">Os blocos desta página ainda estão sendo preparados.</div>
            ) : (
              <div className="report-available-list">
                {pageSections.map((section) => {
                  const isAdded = pageItems.some((item) => item.sectionKey === section.sectionKey);
                  const isPreparing = preparingSection === section.sectionKey;
                  return (
                    <button key={section.sectionKey} type="button" disabled={isAdded || isPreparing} onClick={() => addAvailableSection(section)}>
                      {isPreparing ? <LoaderCircle size={15} className="report-spin" /> : <PlusCircle size={15} />}
                      <span>{section.title}</span>
                      <small>{isAdded ? "Adicionado" : "Adicionar"}</small>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="report-builder-section">
            <div className="report-section-heading">
              <div><span className="report-step">2</span><h3>Ordem do relatório ({pageItems.length})</h3></div>
              {pageItems.length > 0 && <button type="button" className="report-text-danger" onClick={() => clearReportPage(activeReportPage)}>Limpar página</button>}
            </div>

            {pageItems.length === 0 ? (
              <div className="report-empty-state">Escolha acima os blocos de {activeReportPage || "esta página"} que devem entrar no relatório.</div>
            ) : (
              <div className="report-item-list">
                {pageItems.map((item, index) => {
                  const modes = item.detailOptions || Object.keys(item.dataSets || {});
                  return (
                    <article
                      key={item.id}
                      className="report-builder-item"
                      draggable
                      onDragStart={() => setDraggedIndex(index)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => {
                        if (draggedIndex !== null) reorderReportPageItems(activeReportPage, draggedIndex, index);
                        setDraggedIndex(null);
                      }}
                      onDragEnd={() => setDraggedIndex(null)}
                    >
                      <div className="report-builder-item-main">
                        <GripVertical size={16} aria-hidden="true" />
                        <div>
                          <strong>{item.title}</strong>
                          <span>Origem: {item.page}</span>
                        </div>
                      </div>
                      {modes.length > 0 && (
                        <label className="report-detail-field">
                          Detalhamento
                          <select value={item.detailMode || modes[0]} onChange={(event) => updateDetailMode(item, event.target.value)}>
                            {modes.map((mode) => <option key={mode} value={mode}>{detailLabels[mode] || mode}</option>)}
                          </select>
                        </label>
                      )}
                      {Array.isArray(item.pendingData) && item.pendingData.length > 0 && (
                        <label className="report-checkbox report-checkbox-compact">
                          <input type="checkbox" checked={Boolean(item.includePending)} onChange={(event) => updateReportItem(item.id, { includePending: event.target.checked })} />
                          Incluir pendências ({item.pendingData.length})
                        </label>
                      )}
                      <div className="report-item-actions">
                        <button type="button" onClick={() => reorderReportPageItems(activeReportPage, index, index - 1)} disabled={index === 0} aria-label="Mover para cima"><ArrowUp size={15} /></button>
                        <button type="button" onClick={() => reorderReportPageItems(activeReportPage, index, index + 1)} disabled={index === pageItems.length - 1} aria-label="Mover para baixo"><ArrowDown size={15} /></button>
                        <button type="button" className="is-danger" onClick={() => removeReportItem(item.id)} aria-label="Remover"><Trash2 size={15} /></button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

        </div>

        <footer className="report-drawer-footer">
          <div className="report-status-row">
            <span>{pageItems.length} bloco(s) • cerca de {estimatedPages} página(s)</span>
            <button type="button" onClick={exitReportMode}>Sair do relatório</button>
          </div>
          {statusMessage && <p className="report-status" role="status">{statusMessage}</p>}
          <button type="button" className="report-preview-button" disabled={pageItems.length === 0} onClick={() => setIsPreviewOpen(true)}><Eye size={17} /> Visualizar prévia A4</button>
          <div className="report-export-actions">
            <button type="button" disabled={pageItems.length === 0 || Boolean(isExporting)} onClick={() => runExport("pdf")}>
              {isExporting === "pdf" ? <LoaderCircle size={17} className="report-spin" /> : <FileDown size={17} />} PDF
            </button>
            <button type="button" disabled={pageItems.length === 0 || Boolean(isExporting)} onClick={() => runExport("excel")}>
              {isExporting === "excel" ? <LoaderCircle size={17} className="report-spin" /> : <Table size={17} />} Excel
            </button>
          </div>
        </footer>
      </aside>

      {isReportMode && !isDrawerOpen && (
        <button type="button" className="report-floating-button" onClick={() => setIsDrawerOpen(true)}>
          <FileText size={19} /> Relatório: {activeReportPage || "página"} ({pageItems.length})
        </button>
      )}

      {isPreviewOpen && (
        <div className="report-preview-modal" role="dialog" aria-modal="true" aria-label="Prévia do relatório">
          <header>
            <h2>Prévia do relatório</h2>
            <div>
              <button type="button" onClick={() => runExport("pdf")} disabled={Boolean(isExporting)}><Download size={16} /> Baixar PDF</button>
              <button type="button" onClick={() => setIsPreviewOpen(false)}><X size={18} /> Fechar</button>
            </div>
          </header>
          <main><ReportPreview items={pageItems} config={reportConfig} /></main>
        </div>
      )}
    </>
  );
}
