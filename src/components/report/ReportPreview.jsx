"use client";

import React from "react";
import { describeFilters, formatReportValue, getReportColumns, getReportRows, inferReportFormat } from "@/lib/reportExport";

function ReportTable({ item, rows, title }) {
  const columns = getReportColumns(item, rows);
  if (!rows.length || !columns.length) {
    return <p className="report-preview-empty">Nenhum dado encontrado para os filtros selecionados.</p>;
  }

  return (
    <div className="report-preview-table-wrap">
      {title && <h4 className="report-preview-subtitle">{title}</h4>}
      <table className="report-preview-table">
        <thead>
          <tr>
            {columns.map((column) => <th key={column.key}>{column.label || column.key}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`${item.id}-row-${rowIndex}`}>
              {columns.map((column) => {
                const format = inferReportFormat(column.key, column.format || item.columnFormats?.[column.key]);
                return <td key={column.key} className={format === "currency" || format === "percent" ? "is-number" : ""}>{formatReportValue(row?.[column.key], format)}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReportSummary({ item, rows }) {
  const row = rows[0];
  const columns = getReportColumns(item, rows);
  if (!row || !columns.length) return <p className="report-preview-empty">Nenhum indicador encontrado para os filtros selecionados.</p>;

  return (
    <div className="report-preview-summary-grid">
      {columns.map((column) => {
        const format = inferReportFormat(column.key, column.format || item.columnFormats?.[column.key]);
        return (
          <div key={column.key} className="report-preview-summary-card">
            <span>{column.label || column.key}</span>
            <strong>{formatReportValue(row?.[column.key], format)}</strong>
          </div>
        );
      })}
    </div>
  );
}

export default function ReportPreview({ items, config }) {
  return (
    <article id="report-preview-content" className={`report-paper report-paper-${config.orientation}`}>
      <header className="report-preview-header">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="OAE" className="report-preview-logo" onError={(event) => { event.currentTarget.style.display = "none"; }} />
          <strong className="report-preview-brand">OAE_FIN</strong>
          <span>Oliveira Araújo Engenharia</span>
        </div>
        <div>
          <h1>{config.title || "Relatório Financeiro"}</h1>
          <span>Gerado em {new Date().toLocaleString("pt-BR")}</span>
        </div>
      </header>

      <div className="report-preview-sections">
        {items.map((item, index) => {
          const rows = getReportRows(item);
          return (
            <section key={item.id} className="report-preview-section">
              <div className="report-preview-section-title"><span>{String(index + 1).padStart(2, '0')}</span><h2>{item.title}</h2></div>
              <p className="report-preview-filter"><strong>Filtros:</strong> {describeFilters(item.filters)}</p>
              {config.includeExplanations && item.explanation && <p className="report-preview-explanation">{item.explanation}</p>}
              {item.capturedImage && !item.restoredWithoutImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.capturedImage} alt={item.title} className="report-preview-chart" />
              ) : item.type === "SUMMARY" && rows.length === 1 ? (
                <ReportSummary item={item} rows={rows} />
              ) : (
                <ReportTable item={item} rows={rows} />
              )}
              {item.includePending && item.pendingData?.length > 0 && (
                <ReportTable item={{ ...item, columns: undefined }} rows={item.pendingData} title="Pendências incluídas" />
              )}
            </section>
          );
        })}
      </div>

      <footer className="report-preview-footer">OAE_FIN • Documento interno e confidencial</footer>
    </article>
  );
}
