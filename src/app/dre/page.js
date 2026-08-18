"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useReport } from "@/contexts/ReportContext";
import ReportAdder from "@/components/report/ReportAdder";
import {
  RefreshCw, AlertCircle, FilterX, ChevronDown, ChevronRight,
  X, FileText, ChevronsUpDown, ChevronsDown, ChevronsUp, Info, GripVertical
} from "lucide-react";
import MultiSelect from "@/components/MultiSelect";
import InfoTooltip from "@/components/InfoTooltip";
import { consolidateFinancialData } from "@/lib/consolidation";
import {
  DRE_ORDER, buildMeses, buildDreStructure, tagItemsWithMesKey
} from "@/lib/dreEngine";

const getDreDateRange = (mode = 'REALIZADO') => {
  const today = new Date();
  const year = today.getFullYear();
  const localDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return {
    start: `${year}-01-01`,
    end: mode === 'REALIZADO' ? localDate(today) : `${year}-12-31`,
  };
};

const DEFAULT_EXPANDED_GROUPS = Object.fromEntries(
  DRE_ORDER.filter(group => !group.computed || group.isCompound).map(group => [group.id, true])
);

// ─── Formatação ───────────────────────────────────────────────────────────────
const fmt = (val) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val || 0);

const fmtShort = (val) => {
  return fmt(val);
};

// ─── Helpers visuais ──────────────────────────────────────────────────────────
function resultColor(val) {
  if (!val || val === 0) return "var(--text-main)";
  return val >= 0 ? "var(--success)" : "var(--danger)";
}

// ─── Drawer de Auditoria ──────────────────────────────────────────────────────
function AuditDrawer({ items, title, onClose }) {
  if (!items || items.length === 0) return null;
  const total = items.reduce((a, b) => a + (b.valor || 0), 0);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(4px)", zIndex: 9999, display: "flex",
        alignItems: "flex-end", justifyContent: "flex-end",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "min(760px, 100vw)", height: "100vh",
          background: "var(--bg-card)", borderLeft: "1px solid var(--border-color)",
          display: "flex", flexDirection: "column", overflow: "hidden",
          animation: "slideInRight 0.25s ease-out",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border-color)",
          background: "var(--bg-elevated)", display: "flex", alignItems: "center",
          justifyContent: "space-between", gap: "1rem",
        }}>
          <div>
            <h2 style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-main)", marginBottom: "0.25rem" }}>
              Lançamentos — {title}
            </h2>
            <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
              {items.length} registro{items.length !== 1 ? "s" : ""} · Total:{" "}
              <strong style={{ color: total >= 0 ? "var(--success)" : "var(--danger)" }}>{fmt(total)}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent", border: "none", cursor: "pointer",
              color: "var(--text-secondary)", padding: "0.375rem", borderRadius: "6px",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "var(--text-main)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-secondary)"; }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabela */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0.5rem 0" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr style={{ background: "var(--bg-elevated)", position: "sticky", top: 0, zIndex: 1 }}>
                {["Data", "Documento", "Lançamento", "Nome", "Centro de Custo", "Conta", "Valor", "Status"].map(h => (
                  <th key={h} style={{
                    padding: "0.625rem 0.875rem", textAlign: h === "Valor" ? "right" : "left",
                    color: "var(--text-secondary)", fontWeight: "600", whiteSpace: "nowrap",
                    borderBottom: "1px solid var(--border-color)",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr
                  key={idx}
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <td style={{ padding: "0.625rem 0.875rem", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{item.data || "—"}</td>
                  <td style={{ padding: "0.625rem 0.875rem", color: "var(--text-secondary)" }}>{item.documento || "—"}</td>
                  <td style={{ padding: "0.625rem 0.875rem", color: "var(--text-main)" }}>{item.lancamento || "—"}</td>
                  <td style={{ padding: "0.625rem 0.875rem", color: "var(--text-main)", maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={item.nome}>{item.nome || "—"}</td>
                  <td style={{ padding: "0.625rem 0.875rem", color: "var(--text-secondary)", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={item.projeto}>{item.projeto || "—"}</td>
                  <td style={{ padding: "0.625rem 0.875rem", color: "var(--text-secondary)", maxWidth: "140px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={item.contaDescricao}>{item.contaDescricao || item.contaCodigo || "—"}</td>
                  <td style={{ padding: "0.625rem 0.875rem", textAlign: "right", fontWeight: "700", color: (item.valor || 0) >= 0 ? "var(--success)" : "var(--danger)", whiteSpace: "nowrap" }}>{fmt(item.valor)}</td>
                  <td style={{ padding: "0.625rem 0.875rem" }}>
                    <span style={{
                      fontSize: "11px", padding: "2px 8px", borderRadius: "20px",
                      background: item.status === "Realizado" ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)",
                      color: item.status === "Realizado" ? "var(--success)" : "var(--warning)",
                      fontWeight: "600",
                    }}>{item.status || "—"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <style>{`@keyframes slideInRight { from { transform: translateX(100%); opacity:0; } to { transform: translateX(0); opacity:1; } }`}</style>
    </div>
  );
}

// ─── Linha de Resultado Calculado ─────────────────────────────────────────────
function DreResultRow({ groupDef, value, byMonth, meses, showMonths }) {
  const isFinal = groupDef.id === "RES_LIQUIDO";
  const isPositive = value >= 0;
  const color = isPositive ? "var(--success)" : "var(--danger)";
  
  return (
    <tr style={{ 
      background: isFinal ? "rgba(15, 23, 42, 0.95)" : "var(--bg-main)", 
      borderTop: isFinal ? "2px solid rgba(255,255,255,0.1)" : "1px solid rgba(255,255,255,0.05)",
      borderBottom: isFinal ? "2px solid rgba(255,255,255,0.1)" : "none"
    }}>
      <td style={{
        padding: isFinal ? "1.25rem 1rem" : "0.875rem 1rem", 
        fontWeight: isFinal ? "900" : "800", 
        fontSize: isFinal ? "14px" : "13px",
        color: "var(--text-main)", position: "sticky", left: 0, zIndex: 1,
        background: isFinal ? "rgba(15, 23, 42, 0.95)" : "var(--bg-main)", whiteSpace: "nowrap",
      }}>
        {groupDef.label}
      </td>
      {showMonths && meses.map(m => (
        <td key={m.key} style={{ 
          padding: "0.875rem 1rem", textAlign: "right", 
          fontWeight: isFinal ? "800" : "700", 
          color: resultColor(byMonth[m.key] || 0), 
          whiteSpace: "nowrap" 
        }} title={fmt(byMonth[m.key] || 0)}>
          {fmt(byMonth[m.key] || 0)}
        </td>
      ))}
      <td style={{ 
        padding: "0.875rem 1rem", textAlign: "right", 
        fontWeight: "900", fontSize: isFinal ? "16px" : "14px", 
        color, whiteSpace: "nowrap" 
      }}>
        {fmt(value)}
      </td>
    </tr>
  );
}

// ─── Linha de Grupo (Nível 1) ────────────────────────────────────────────────
const sortAccounts = (accounts) => Object.values(accounts || {}).sort((a, b) =>
  a.label.localeCompare(b.label, 'pt-BR', { sensitivity: 'base', numeric: true })
);

function DreGroupRow({ groupDef, groupData, meses, showMonths, expanded, onToggle, onAccountClick, dreData, isEditMode, onDragStart, onDragOver, onDrop }) {
  const accounts = sortAccounts(groupData.accounts);
  let total = groupData.total || 0;
  
  // Tratamento especial para RESULTADO FINANCEIRO que é isCompound
  if (groupDef.isCompound) {
    total = dreData.computedValues[groupDef.id] || 0;
  }

  const isDraggable = isEditMode && !groupDef.computed;

  return (
    <>
      {/* Linha de Grupo */}
      <tr
        onClick={onToggle}
        draggable={isDraggable}
        onDragStart={isDraggable ? (e) => onDragStart(e, groupDef.id) : undefined}
        onDragOver={isDraggable ? onDragOver : undefined}
        onDrop={isDraggable ? (e) => onDrop(e, groupDef.id) : undefined}
        style={{
          background: expanded ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.015)",
          cursor: isDraggable ? "grab" : "pointer", borderTop: "1px solid var(--border-color)",
          transition: "background 0.15s",
        }}
        onMouseEnter={e => { if (!expanded) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
        onMouseLeave={e => { if (!expanded) e.currentTarget.style.background = "rgba(255,255,255,0.015)"; }}
      >
        <td style={{
          padding: "0.875rem 1rem", fontWeight: "700", fontSize: "13px",
          color: "var(--text-main)", position: "sticky", left: 0, zIndex: 1,
          background: expanded ? "rgba(6,27,60,0.98)" : "rgba(6,27,51,0.98)",
          whiteSpace: "nowrap",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            {isEditMode && !groupDef.computed && (
              <GripVertical size={14} color="var(--text-secondary)" style={{ cursor: "grab" }} />
            )}
            <div style={{
              width: "20px", height: "20px", borderRadius: "4px",
              background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center",
              justifyContent: "center", flexShrink: 0, transition: "transform 0.2s",
            }}>
              {expanded
                ? <ChevronDown size={12} color="var(--text-secondary)" />
                : <ChevronRight size={12} color="var(--text-secondary)" />
              }
            </div>
            <span style={{ color: "var(--text-main)" }}>{groupDef.label}</span>
            {!groupDef.isCompound && accounts.length > 0 && (
              <span style={{ fontSize: "11px", color: "var(--text-secondary)", fontWeight: "400" }}>
                ({accounts.length} conta{accounts.length !== 1 ? "s" : ""})
              </span>
            )}
          </div>
        </td>
        {showMonths && meses.map(m => {
          let mVal = groupData?.byMonth?.[m.key] || 0;
          if (groupDef.isCompound) mVal = dreData.computedByMonth[groupDef.id]?.[m.key] || 0;
          return (
            <td key={m.key} style={{
              padding: "0.875rem 1rem", textAlign: "right",
              color: "var(--text-main)", fontWeight: "600", whiteSpace: "nowrap", fontSize: "12px",
            }} title={fmt(mVal)}>
              {mVal !== 0 ? fmt(mVal) : "—"}
            </td>
          );
        })}
        <td style={{ 
          padding: "0.875rem 1rem", textAlign: "right", fontWeight: "800", color: "var(--text-main)", whiteSpace: "nowrap", fontSize: "14px",
          background: "rgba(15, 23, 42, 0.6)", borderLeft: "1px solid rgba(255,255,255,0.05)"
        }}>
          {fmt(total)}
        </td>
      </tr>

      {/* Linhas de Conta (Nível 2) ou Subgrupos para isCompound */}
      {expanded && (
        groupDef.isCompound ? (
          groupDef.subGroups.flatMap(subId => {
            const subData = dreData.groups[subId];
            if (!subData || subData.itemCount === 0) return [];
            const subAccounts = sortAccounts(subData.accounts);
            const subDef = DRE_ORDER.find(g => g.id === subId);

            // Linha de cabeçalho do sub-grupo (mesmo grid que os demais)
            const headerRow = (
              <tr key={`${subId}-header`} style={{ background: "rgba(255,255,255,0.02)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <td style={{
                  padding: "0.625rem 1rem 0.625rem 3rem", fontSize: "12px",
                  color: "var(--text-secondary)", fontWeight: "700", position: "sticky", left: 0, zIndex: 1,
                  background: "rgba(6,24,48,0.98)", whiteSpace: "nowrap",
                }}>
                  {subData.label}
                </td>
                {showMonths && meses.map(m => (
                  <td key={m.key} style={{
                    padding: "0.625rem 1rem", textAlign: "right",
                    color: "var(--text-main)", fontSize: "12px", whiteSpace: "nowrap",
                  }}>
                    {(subData.byMonth[m.key] || 0) !== 0 ? fmt(subData.byMonth[m.key]) : "—"}
                  </td>
                ))}
                <td style={{ 
                  padding: "0.625rem 1rem", textAlign: "right", color: "var(--text-main)", fontWeight: "700", fontSize: "13px", whiteSpace: "nowrap",
                  background: "rgba(15, 23, 42, 0.6)", borderLeft: "1px solid rgba(255,255,255,0.05)"
                }}>
                  {fmt(subData.total)}
                </td>
              </tr>
            );

            // Linhas de contas do sub-grupo (reutiliza DreAccountRow = mesma estrutura tr)
            const accountRows = subAccounts.map((account, idx) => (
              <DreAccountRow
                key={`${subId}-acc-${idx}`}
                account={account}
                meses={meses}
                showMonths={showMonths}
                onAccountClick={onAccountClick}
                paddingLeft="4.5rem"
              />
            ));

            return [headerRow, ...accountRows];
          })
        ) : (
          accounts.map((account, idx) => (
            <DreAccountRow
              key={idx}
              account={account}
              meses={meses}
              showMonths={showMonths}
              onAccountClick={onAccountClick}
            />
          ))
        )
      )}
    </>
  );
}

// ─── Linha de Conta (Nível 2) ─────────────────────────────────────────────────
function DreAccountRow({ account, meses, showMonths, onAccountClick, paddingLeft = "3rem" }) {
  return (
    <tr
      onClick={() => onAccountClick(account)}
      style={{ background: "rgba(255,255,255,0.01)", cursor: "pointer", transition: "background 0.1s" }}
      onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
      onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.01)"}
    >
      <td style={{
        padding: `0.625rem 1rem 0.625rem ${paddingLeft}`, fontSize: "12px",
        color: "var(--text-secondary)", position: "sticky", left: 0, zIndex: 1,
        background: "rgba(6,24,48,0.98)", whiteSpace: "nowrap",
        display: "flex", alignItems: "center", gap: "0.5rem",
      }}>
        <span style={{ color: "var(--text-secondary)", fontSize: "11px", fontWeight: "700", flexShrink: 0 }}>→</span>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", maxWidth: "280px" }} title={account.label}>
          {account.label}
        </span>
        <FileText size={10} color="rgba(168,181,198,0.4)" style={{ flexShrink: 0 }} />
      </td>
      {showMonths && meses.map(m => (
        <td key={m.key} style={{
          padding: "0.625rem 1rem", textAlign: "right",
          color: (account.byMonth[m.key] || 0) !== 0 ? "var(--text-main)" : "rgba(255,255,255,0.2)",
          fontSize: "12px", whiteSpace: "nowrap",
        }} title={fmt(account.byMonth[m.key] || 0)}>
          {(account.byMonth[m.key] || 0) !== 0 ? fmt(account.byMonth[m.key]) : "—"}
        </td>
      ))}
      <td style={{ 
        padding: "0.625rem 1rem", textAlign: "right", color: "var(--text-main)", fontWeight: "600", whiteSpace: "nowrap", fontSize: "13px",
        background: "rgba(15, 23, 42, 0.6)", borderLeft: "1px solid rgba(255,255,255,0.05)"
      }}>
        {fmt(account.total)}
      </td>
    </tr>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function Dre() {
  const { isReportMode, openReportBuilder, exitReportMode } = useReport();
  const [isSyncing, setIsSyncing] = useState(false);
  const [data, setData] = useState([]);
  const [error, setError] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const [visao, setVisao] = useState('REALIZADO'); // 'REALIZADO', 'SOMENTE_PREVISAO', 'REALIZADO_PREVISAO'

  // Filtros
  const [filterDataInicial, setFilterDataInicial] = useState(() => getDreDateRange().start);
  const [filterDataFinal, setFilterDataFinal] = useState(() => getDreDateRange().end);
  const [filterProjetos, setFilterProjetos] = useState([]);
  const [filterCCs, setFilterCCs] = useState([]);

  // UI
  const [expandedGroups, setExpandedGroups] = useState(DEFAULT_EXPANDED_GROUPS);
  const [auditDrawer, setAuditDrawer] = useState(null); // { items, title }
  // A ordem contábil é fixa para preservar a sequência correta dos resultados.
  const customOrder = DRE_ORDER;

  const fetchDados = async () => {
    setIsSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/sync");
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Erro desconhecido");
      setData(result.data || []);
      setLastSync(new Date().toLocaleString("pt-BR"));
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchDados();
  }, []);

  const handleVisaoChange = (nextVisao) => {
    const range = getDreDateRange(nextVisao);
    setVisao(nextVisao);
    setFilterDataInicial(range.start);
    setFilterDataFinal(range.end);
  };

  // ── Dados base com timestamp e labels ──────────────────────────────────────
  const baseData = useMemo(() => {
    return data.map(item => {
      let ts = 0;
      if (item.data) {
        const parts = String(item.data).trim().split("/");
        if (parts.length === 3) ts = new Date(parts[2], parts[1] - 1, parts[0]).getTime();
      }
      const dreClasseLabel = (!item.dreClasse || item.dreClasse.includes("PENDENTE")) ? "Não classificado" : item.dreClasse;
      const dreLinhaLabel = (!item.dreLinha || item.dreLinha.includes("PENDENTE")) ? "Não classificado" : item.dreLinha;
      const drePacoteLabel = (!item.drePacote || item.drePacote.includes("PENDENTE")) ? "Não classificado" : item.drePacote;
      return { ...item, dataTimestamp: ts, dreClasseLabel, dreLinhaLabel, drePacoteLabel };
    });
  }, [data]);

  const projetosDisponiveis = useMemo(() =>
    Array.from(new Set(baseData.map(d => d.projeto).filter(Boolean))).sort(), [baseData]);

  const annualView = visao !== 'REALIZADO';
  const annualRange = getDreDateRange(visao);
  const effectiveDataInicial = annualView ? annualRange.start : filterDataInicial;
  const effectiveDataFinal = annualView ? annualRange.end : filterDataFinal;

  // ── Filtros com exclusão "Fora da DRE" e regra 80/20 ADM ────────────────────
  const filteredItems = useMemo(() => {
    const { filterDreItems } = require("@/lib/dreEngine");
    
    let items = filterDreItems(baseData, {
      filterDataInicial: effectiveDataInicial, filterDataFinal: effectiveDataFinal,
      filterProjetos, filterEmpresas: [],
      filterCCs,
      visao
    });

    const hasFiltroCC = filterCCs.length > 0;
    const hasFiltroProj = filterProjetos.length > 0;
    const isAdmCC = hasFiltroCC && filterCCs.every(cc => cc.toUpperCase().includes("ADMINISTRA"));

    if (hasFiltroProj || hasFiltroCC) {
      // Entradas: regra administrativa
      const entradas = items.filter(i => i.natureza === "Entrada");
      const saidas = items.filter(i => i.natureza === "Saída");

      const projetosAlvo = hasFiltroProj ? filterProjetos : filterCCs;
      const consolidated = consolidateFinancialData(entradas, {
        filterProjetos: projetosAlvo,
        isProjetosPage: false,
        incluirRateioAdm: true,
      });

      const entradasFiltradas = consolidated.filter(item => {
        const proj = item.projeto || "";
        if (isAdmCC) return projetosAlvo.some(cc => proj.toUpperCase().includes("ADMINISTRA"));
        return projetosAlvo.some(p => proj === p || proj.toUpperCase().includes(p.toUpperCase()));
      });

      // Saídas: apenas pelo projeto direto
      const saidasFiltradas = saidas.filter(item => {
        const proj = item.projeto || "";
        const alvo = hasFiltroCC ? filterCCs : filterProjetos;
        return alvo.some(p => proj === p || proj.toUpperCase().includes(p.toUpperCase()));
      });

      items = [...entradasFiltradas, ...saidasFiltradas];
    }

    return items;
  }, [baseData, effectiveDataInicial, effectiveDataFinal, filterProjetos, filterCCs, visao]);

  const meses = useMemo(() => buildMeses(effectiveDataInicial, effectiveDataFinal), [effectiveDataInicial, effectiveDataFinal]);
  const showMonths = meses.length > 1;

  const taggedItems = useMemo(() => tagItemsWithMesKey(filteredItems), [filteredItems]);
  const dreData = useMemo(() => buildDreStructure(taggedItems, meses), [taggedItems, meses]);

  // Toggle groups
  const toggleGroup = useCallback((id) => {
    setExpandedGroups(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const expandAll = () => {
    const all = {};
    customOrder.filter(g => !g.computed || g.isCompound).forEach(g => { all[g.id] = true; });
    setExpandedGroups(all);
  };

  const collapseAll = () => setExpandedGroups({});

  const clearFilters = () => {
    const range = getDreDateRange(visao);
    setFilterDataInicial(range.start);
    setFilterDataFinal(range.end);
    setFilterProjetos([]);
    setFilterCCs([]);
  };

  const hasActiveFilters = filterProjetos.length > 0 || filterCCs.length > 0;

  // KPIs
  const receitaBruta = dreData.groups["RECEITA_BRUTA"]?.total || 0;
  const resLiquido = dreData.computedValues["RES_LIQUIDO"] || 0;
  const resOperacional = dreData.computedValues["RES_OPERACIONAL"] || 0;
  const totalCustos = (dreData.groups["CUSTOS_SERVICOS"]?.total || 0);
  const margem = receitaBruta > 0 ? (resLiquido / receitaBruta) * 100 : 0;

  const reportFilters = {
    Visão: visao === "REALIZADO" ? "Realizado" : visao === "SOMENTE_PREVISAO" ? "Somente previsão" : "Realizado + Previsão 2026",
    "Data inicial": effectiveDataInicial || "Todas",
    "Data final": effectiveDataFinal || "Todas",
    Projetos: filterProjetos.length ? filterProjetos : "Todos",
    "Centros de custo": filterCCs.length ? filterCCs : "Todos",
  };

  const dreReportDataSets = useMemo(() => {
    const valueRow = (description, total, byMonth = {}, level = "Grupo") => {
      const row = { Descrição: description, Nível: level };
      meses.forEach((month) => { row[month.label] = byMonth[month.key] || 0; });
      row.Total = total || 0;
      return row;
    };

    const buildRows = (accountMode) => {
      const rows = [];
      customOrder.forEach((groupDef) => {
        if (groupDef.hidden) return;
        const computedTotal = dreData.computedValues[groupDef.id] || 0;
        const computedMonths = dreData.computedByMonth[groupDef.id] || {};

        if (groupDef.computed && !groupDef.isCompound) {
          rows.push(valueRow(groupDef.label, computedTotal, computedMonths, "Resultado"));
          return;
        }

        const groupData = dreData.groups[groupDef.id];
        const total = groupDef.isCompound ? computedTotal : groupData?.total || 0;
        const byMonth = groupDef.isCompound ? computedMonths : groupData?.byMonth || {};
        rows.push(valueRow(groupDef.label, total, byMonth, "Grupo"));

        const shouldAddAccounts = accountMode === "all" || (accountMode === "current" && expandedGroups[groupDef.id]);
        if (!shouldAddAccounts) return;

        if (groupDef.isCompound) {
          groupDef.subGroups.forEach((subId) => {
            const subGroup = dreData.groups[subId];
            if (!subGroup || subGroup.itemCount === 0) return;
            rows.push(valueRow(subGroup.label, subGroup.total, subGroup.byMonth, "Subgrupo"));
            sortAccounts(subGroup.accounts).forEach((account) => rows.push(valueRow(account.label, account.total, account.byMonth, "Conta")));
          });
        } else {
          sortAccounts(groupData?.accounts).forEach((account) => rows.push(valueRow(account.label, account.total, account.byMonth, "Conta")));
        }
      });
      return rows;
    };

    return {
      groups: buildRows("groups"),
      current: buildRows("current"),
      expanded: buildRows("all"),
    };
  }, [customOrder, dreData, expandedGroups, meses]);

  const dreReportColumns = useMemo(() => [
    { key: "Descrição", label: "Descrição" },
    { key: "Nível", label: "Nível" },
    ...meses.map((month) => ({ key: month.label, label: month.label, format: "currency" })),
    { key: "Total", label: showMonths ? "TOTAL" : "VALOR", format: "currency" },
  ], [meses, showMonths]);

  const drePendingRows = useMemo(() => dreData.naoClassificados.items.map((item) => ({
    Data: item.data,
    Projeto: item.projeto,
    Conta: item.contaNome || item.contaDescricao,
    Nome: item.nome,
    Situação: item.status,
    Valor: Math.abs(item.valor || 0),
  })), [dreData.naoClassificados.items]);

  return (
    <div style={{ padding: "1.5rem", maxWidth: "100%", minHeight: "100vh", background: "var(--bg-main)" }}>
      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <h1 style={{ fontSize: "22px", fontWeight: "800", color: "var(--text-main)" }}>DRE Gerencial</h1>
              <InfoTooltip
                title="Demonstrativo de Resultado"
                content="Demonstrativo gerencial estruturado conforme o DEPARA financeiro da OAE. Os grupos podem ser expandidos para visualizar as contas que formam cada total. Ao analisar uma obra, receitas administrativas vinculadas ao mesmo título financeiro são incorporadas à receita da obra, enquanto despesas administrativas gerais permanecem fora da análise do projeto. Registros sem classificação ou deliberadamente marcados como fora da DRE não participam dos resultados."
              />
            </div>
            {lastSync && <p style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "0.25rem" }}>Última sync: {lastSync}</p>}
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button
            onClick={() => isReportMode ? exitReportMode() : openReportBuilder('DRE')}
            style={{ display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.5rem 1rem", background: isReportMode ? "var(--primary)" : "var(--bg-elevated)", border: "1px solid var(--border-color)", borderRadius: "8px", color: isReportMode ? "#fff" : "var(--text-main)", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}
          >
            <FileText size={14} /> {isReportMode ? "Sair do Modo Relatório" : "Gerar Relatório"}
          </button>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              style={{ display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.5rem 1rem", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "8px", color: "var(--danger)", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}
            >
              <FilterX size={14} /> Limpar filtros
            </button>
          )}
          <button
            onClick={fetchDados}
            disabled={isSyncing}
            style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 1.25rem", background: "var(--primary)", borderRadius: "8px", border: "none", color: "#fff", fontSize: "13px", fontWeight: "600", cursor: isSyncing ? "not-allowed" : "pointer", opacity: isSyncing ? 0.7 : 1 }}
          >
            <RefreshCw size={14} style={{ animation: isSyncing ? "spin 1s linear infinite" : "none" }} />
            {isSyncing ? "Sincronizando..." : "Sincronizar"}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: "1rem", padding: "1rem", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "8px", display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--danger)", fontSize: "13px" }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* 🔹 Filtros 🔹 */}
      <div className="card" style={{ padding: "1.25rem", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", minWidth: "220px" }}>
            <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-secondary)", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "4px" }}>
              Visão
              <InfoTooltip
                title="Modo de Visualização"
                content="Realizado: Somente lançamentos realizados até a data atual. Realizado + Previsão 2026: Realizado até hoje e A Realizar/A Pagar/A Receber até 31/12/2026. Somente Previsão: Apenas futuros a realizar até 31/12/2026."
              />
            </label>
            <select
              value={visao}
              onChange={(e) => handleVisaoChange(e.target.value)}
              style={{
                height: "38px", padding: "0 0.75rem", background: "var(--bg-elevated)", border: "1px solid var(--border-color)",
                borderRadius: "6px", color: "var(--text-main)", fontSize: "13px", outline: "none", cursor: "pointer"
              }}
            >
              <option value="REALIZADO">Realizado</option>
              <option value="REALIZADO_PREVISAO">Realizado + Previsão 2026</option>
              <option value="SOMENTE_PREVISAO">Somente Previsão</option>
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", minWidth: "140px" }}>
            <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-secondary)", textTransform: "uppercase" }}>Data Inicial</label>
            <input type="date" value={effectiveDataInicial} disabled={annualView} onChange={e => setFilterDataInicial(e.target.value)} title={annualView ? "A visão anual usa o ano completo" : undefined} style={{ height: "38px", padding: "0 0.75rem", background: "var(--bg-elevated)", border: "1px solid var(--border-color)", borderRadius: "6px", color: "var(--text-main)", fontSize: "13px", opacity: annualView ? 0.7 : 1 }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", minWidth: "140px" }}>
            <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-secondary)", textTransform: "uppercase" }}>Data Final</label>
            <input type="date" value={effectiveDataFinal} disabled={annualView} onChange={e => setFilterDataFinal(e.target.value)} title={annualView ? "A visão anual usa o ano completo" : undefined} style={{ height: "38px", padding: "0 0.75rem", background: "var(--bg-elevated)", border: "1px solid var(--border-color)", borderRadius: "6px", color: "var(--text-main)", fontSize: "13px", opacity: annualView ? 0.7 : 1 }} />
          </div>
          <div style={{ flex: "1 1 200px", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-secondary)", textTransform: "uppercase" }}>Projeto / Obra</label>
            <MultiSelect options={projetosDisponiveis} selected={filterProjetos} onChange={setFilterProjetos} placeholder="Todos os projetos" />
          </div>
          <div style={{ flex: "1 1 200px", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-secondary)", textTransform: "uppercase" }}>Centro de Custo</label>
            <MultiSelect options={projetosDisponiveis} selected={filterCCs} onChange={setFilterCCs} placeholder="Todos os CCs" />
          </div>
        </div>
      </div>

      {/* ── Tabela DRE ── */}
      <div className="card" data-report-section style={{ padding: 0, overflow: "hidden", marginBottom: "2rem" }}>
        <div style={{
          padding: "1rem 1.25rem", borderBottom: "1px solid var(--border-color)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          background: "var(--bg-elevated)", flexWrap: "wrap", gap: "0.75rem",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <h2 style={{ fontSize: "14px", fontWeight: "700", color: "var(--text-main)" }}>DRE Gerencial</h2>
            {showMonths && <span style={{ fontSize: "12px", color: "var(--text-secondary)", background: "var(--bg-main)", padding: "2px 10px", borderRadius: "20px" }}>{meses.length} {meses.length === 1 ? "mês" : "meses"}</span>}
            {hasActiveFilters && <span style={{ fontSize: "11px", color: "var(--warning)", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", padding: "2px 10px", borderRadius: "20px", fontWeight: "600" }}>Filtrado</span>}
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <ReportAdder
              sectionKey="dre:demonstrativo"
              title="DRE Gerencial"
              componentName="Demonstrativo de Resultado"
              page="DRE"
              type="DRE"
              data={dreReportDataSets.current}
              dataSets={dreReportDataSets}
              detailMode="current"
              detailOptions={["groups", "current", "expanded"]}
              columns={dreReportColumns}
              filters={reportFilters}
              pendingData={drePendingRows}
              presetTags={["executive-financial", "project-executive"]}
              explanation="Demonstrativo gerencial com receitas, deduções, custos, despesas e resultados. Pendências só são incluídas quando selecionadas no construtor."
            />
            <button onClick={expandAll} style={{ display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.375rem 0.875rem", background: "transparent", border: "1px solid var(--border-color)", borderRadius: "6px", color: "var(--text-secondary)", fontSize: "12px", cursor: "pointer" }}><ChevronsDown size={13} /> Expandir tudo</button>
            <button onClick={collapseAll} style={{ display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.375rem 0.875rem", background: "transparent", border: "1px solid var(--border-color)", borderRadius: "6px", color: "var(--text-secondary)", fontSize: "12px", cursor: "pointer" }}><ChevronsUp size={13} /> Recolher tudo</button>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: showMonths ? `${300 + meses.length * 130}px` : "600px" }}>
            <thead>
              <tr style={{ background: "var(--bg-elevated)", borderBottom: "2px solid var(--border-color)" }}>
                <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "12px", fontWeight: "700", color: "var(--text-secondary)", textTransform: "uppercase", position: "sticky", left: 0, zIndex: 2, background: "var(--bg-elevated)", minWidth: "280px", whiteSpace: "nowrap" }}>Descrição</th>
                {showMonths && meses.map(m => <th key={m.key} style={{ padding: "0.75rem 1rem", textAlign: "right", fontSize: "11px", fontWeight: "600", color: "var(--text-secondary)", whiteSpace: "nowrap", minWidth: "120px" }}>{m.label}</th>)}
                <th style={{ 
                  padding: "0.75rem 1rem", textAlign: "right", fontSize: "13px", fontWeight: "800", color: "var(--primary)", whiteSpace: "nowrap", minWidth: "140px",
                  background: "rgba(15, 23, 42, 0.8)", borderLeft: "1px solid rgba(255,255,255,0.05)"
                }}>
                  {showMonths ? "TOTAL" : "VALOR"}
                </th>
              </tr>
            </thead>
            <tbody>
              {customOrder.map(groupDef => {
                if (groupDef.hidden) return null; // Subgroups handled manually or inside isCompound

                if (groupDef.computed && !groupDef.isCompound) {
                  return <DreResultRow key={groupDef.id} groupDef={groupDef} value={dreData.computedValues[groupDef.id] || 0} byMonth={dreData.computedByMonth[groupDef.id] || {}} meses={meses} showMonths={showMonths} />;
                }

                const groupData = groupDef.isCompound ? {} : dreData.groups[groupDef.id];
                if (!groupDef.isCompound && !groupData) return null;

                return (
                  <DreGroupRow
                    key={groupDef.id}
                    groupDef={groupDef}
                    groupData={groupData}
                    dreData={dreData}
                    meses={meses}
                    showMonths={showMonths}
                    expanded={!!expandedGroups[groupDef.id]}
                    onToggle={() => toggleGroup(groupDef.id)}
                    onAccountClick={(account) => setAuditDrawer({ items: account.items, title: account.label })}
                    isEditMode={false}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Pendências de Classificação ── */}
      {dreData.naoClassificados.items.length > 0 && (
        <div className="card" style={{ padding: "1.25rem", borderLeft: "3px solid var(--warning)", background: "rgba(245,158,11,0.03)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <AlertCircle size={20} color="var(--warning)" />
              <div>
                <h3 style={{ fontSize: "14px", fontWeight: "700", color: "var(--text-main)", marginBottom: "0.25rem" }}>Pendências de Classificação</h3>
                <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                  Existem {dreData.naoClassificados.items.length} lançamentos que não foram classificados na DRE (sem DEPARA). Eles <strong>NÃO</strong> estão somando no resultado acima.
                </p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <span style={{ fontSize: "16px", fontWeight: "800", color: "var(--warning)" }}>{fmt(dreData.naoClassificados.total)}</span>
              <button
                onClick={() => setAuditDrawer({ items: dreData.naoClassificados.items, title: "Lançamentos Não Classificados" })}
                style={{ background: "rgba(245,158,11,0.15)", color: "var(--warning)", border: "none", padding: "0.5rem 1rem", borderRadius: "6px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}
              >
                Revisar contas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Audit Drawer ── */}
      {auditDrawer && <AuditDrawer items={auditDrawer.items} title={auditDrawer.title} onClose={() => setAuditDrawer(null)} />}
    </div>
  );
}
