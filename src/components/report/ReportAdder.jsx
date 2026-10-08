"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useReport } from "@/contexts/ReportContext";
import { LoaderCircle, PlusCircle } from "lucide-react";
import { captureReportSection } from "@/lib/reportCapture";

export default function ReportAdder({
  sectionKey,
  title,
  componentName,
  page,
  scope,
  data,
  dataSets,
  detailMode,
  detailOptions,
  pendingData,
  columns,
  columnFormats,
  filters,
  type = "GENERAL",
  captureId,
  explanation,
  presetTags = [],
  style = {},
}) {
  const { isReportMode, activeReportPage, activeReportScope, addReportItem, reportItems, registerSection, unregisterSection, setStatusMessage } = useReport();
  const [isPreparing, setIsPreparing] = useState(false);
  const normalizedKey = sectionKey || `${page}:${title}`;

  const section = useMemo(
    () => ({
      sectionKey: normalizedKey,
      title,
      componentName,
      page,
      scope,
      data,
      dataSets,
      detailMode,
      detailOptions,
      pendingData,
      columns,
      columnFormats,
      filters,
      type,
      captureId,
      explanation,
      presetTags,
    }),
    [
      normalizedKey,
      title,
      componentName,
      page,
      scope,
      data,
      dataSets,
      detailMode,
      detailOptions,
      pendingData,
      columns,
      columnFormats,
      filters,
      type,
      captureId,
      explanation,
      presetTags,
    ]
  );

  useEffect(() => {
    registerSection(section);
  }, [registerSection, section]);

  // O registro de uma secao deve existir somente enquanto o bloco correspondente
  // estiver montado. O cleanup usa apenas a chave, para nao apagar/recriar a secao
  // a cada atualizacao de dados do mesmo bloco.
  useEffect(() => {
    return () => unregisterSection?.(normalizedKey);
  }, [normalizedKey, unregisterSection]);

  const matchesScope = activeReportScope ? scope === activeReportScope : !scope;
  if (!isReportMode || (activeReportPage && activeReportPage !== page) || !matchesScope) {
    return <span data-report-section-key={normalizedKey} hidden aria-hidden="true" />;
  }

  const isAdded = reportItems.some((item) => item.sectionKey === normalizedKey);

  // Depois que a seção entra no relatório, o controle some completamente.
  // Isso evita o selo verde "Adicionado" sobre os cards e mantém a tela limpa.
  if (isAdded) {
    return <span data-report-section-key={normalizedKey} hidden aria-hidden="true" />;
  }

  const handleAdd = async (event) => {
    event.stopPropagation();
    if (isPreparing) return;

    setIsPreparing(true);
    try {
      const capturedImage = type === "CHART" || captureId
        ? await captureReportSection(section, event.currentTarget)
        : undefined;
      if (type === "CHART" && !capturedImage) {
        setStatusMessage(`Não foi possível capturar “${title}”. Aguarde o gráfico carregar e tente novamente.`);
        return;
      }
      addReportItem({ ...section, capturedImage, restoredWithoutImage: false });
    } catch {
      setStatusMessage(`Falha ao capturar “${title}”. Tente novamente quando o gráfico estiver visível.`);
    } finally {
      setIsPreparing(false);
    }
  };

  return (
    <button
      type="button"
      data-report-control
      data-report-section-key={normalizedKey}
      className="report-add-button"
      onClick={handleAdd}
      disabled={isPreparing}
      aria-label={`Adicionar ${title} ao relatório`}
      title="Adicionar ao relatório"
      style={{
        background: "var(--bg-elevated)",
        color: "var(--primary)",
        border: "1px solid var(--primary)",
        borderRadius: "4px",
        padding: "0.25rem 0.5rem",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.25rem",
        fontSize: "11px",
        fontWeight: "600",
        cursor: isPreparing ? "default" : "pointer",
        transition: "all 0.2s",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {isPreparing ? (
        <LoaderCircle size={14} className="report-spin" />
      ) : (
        <PlusCircle size={14} />
      )}
      {isPreparing ? "Preparando..." : "Adicionar"}
    </button>
  );
}
