"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useReport } from "@/contexts/ReportContext";
import { CheckCircle, LoaderCircle, PlusCircle } from "lucide-react";

export default function ReportAdder({
  sectionKey,
  title,
  componentName,
  page,
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
  const { isReportMode, activeReportPage, addReportItem, reportItems, registerSection } = useReport();
  const [isPreparing, setIsPreparing] = useState(false);
  const normalizedKey = sectionKey || `${page}:${title}`;

  const section = useMemo(
    () => ({
      sectionKey: normalizedKey,
      title,
      componentName,
      page,
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

  if (!isReportMode || (activeReportPage && activeReportPage !== page)) return null;

  const isAdded = reportItems.some((item) => item.sectionKey === normalizedKey);

  const handleAdd = async (event) => {
    event.stopPropagation();
    if (isAdded || isPreparing) return;

    setIsPreparing(true);
    let capturedImage;

    try {
      const target = captureId
        ? document.getElementById(captureId)
        : event.currentTarget.closest("[data-report-section]");

      if (target && (type === "CHART" || captureId)) {
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
      // Dados estruturados continuam disponíveis se a captura visual falhar.
    }

    addReportItem({ ...section, capturedImage });
    setIsPreparing(false);
  };

  return (
    <button
      type="button"
      data-report-control
      className="report-add-button"
      onClick={handleAdd}
      disabled={isAdded || isPreparing}
      aria-label={isAdded ? `${title} já adicionado` : `Adicionar ${title} ao relatório`}
      title={isAdded ? "Já adicionado" : "Adicionar ao relatório"}
      style={{
        background: isAdded ? "var(--success)" : "var(--bg-elevated)",
        color: isAdded ? "#fff" : "var(--primary)",
        border: `1px solid ${isAdded ? "var(--success)" : "var(--primary)"}`,
        borderRadius: "4px",
        padding: "0.25rem 0.5rem",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.25rem",
        fontSize: "11px",
        fontWeight: "600",
        cursor: isAdded || isPreparing ? "default" : "pointer",
        transition: "all 0.2s",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {isPreparing ? (
        <LoaderCircle size={14} className="report-spin" />
      ) : isAdded ? (
        <CheckCircle size={14} />
      ) : (
        <PlusCircle size={14} />
      )}
      {isPreparing ? "Preparando..." : isAdded ? "Adicionado" : "Adicionar"}
    </button>
  );
}
