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
import { classifyFinancialEntry, normalizeAccountCode } from "@/lib/financialClassification";
import { getActiveProjectNames } from "@/lib/projectRules";
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


function getPendingReason(item) {
  const classe = String(item.dreClasse || '').toUpperCase();
  const linha = String(item.dreLinha || '').toUpperCase();
  if (!item.contaCodigo) return 'Conta financeira não identificada no lançamento.';
  if (!item.planoFinanceiro) return 'Conta não encontrada na relação PLANOS_FINANCEIROS.';
  if (classe.includes('PENDENTE') || linha.includes('PENDENTE')) return 'O plano financeiro existe, mas não possui DEPARA válido para a DRE.';
  return 'O DEPARA existe, mas a classe/linha informada não corresponde a uma linha reconhecida da DRE.';
}

function classifyOutsideDre(item) {
  const code = normalizeAccountCode(item);
  const financialType = classifyFinancialEntry(item).type;
  const text = [item.contaNome, item.contaDescricao, item.dreClasse, item.drePacote, item.dreLinha, item.planoFinanceiro]
    .filter(Boolean).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

  if (financialType === 'emprestimo' || ['2020402', '2020104'].includes(code) || text.includes('EMPREST') || text.includes('FINANCIAMENTO')) {
    return { category: 'Empréstimos / Financiamentos', reason: code === '2020104' ? 'Principal de empréstimo é patrimonial; somente os juros segregados pertencem ao resultado financeiro.' : 'Captação ou amortização de principal altera caixa e passivo, mas não representa receita/despesa operacional da DRE.', intentional: true };
  }
  if (financialType === 'aporte' || code === '1020101' || text.includes('APORTE DE SOCIO')) {
    return { category: 'Aportes de Sócios', reason: 'Aporte é movimentação de patrimônio líquido, não receita operacional.', intentional: true };
  }
  if (code === '2020304' || text.includes('ADIANTAMENTO CREDOR')) {
    return { category: 'Adiantamentos', reason: 'Adiantamento é movimentação patrimonial/financeira até sua apropriação definitiva.', intentional: true };
  }
  if (code === '2090105' || text.includes('IRRF')) {
    return { category: 'Retenções Tributárias', reason: 'Retenção compensável é tratada como ativo/crédito tributário e não como despesa da DRE neste momento.', intentional: true };
  }
  if (code === '2020202' || code.startsWith('20107') || code === '2010802' || text.includes('CAPEX') || text.includes('IMOBILIZADO') || text.includes('INVESTIMENTO EM')) {
    return { category: 'Investimentos / CAPEX', reason: 'Aquisição de ativo ou intangível é investimento patrimonial; o efeito na DRE ocorre por depreciação/amortização quando aplicável.', intentional: true };
  }
  if (financialType === 'movimentacao_financeira' || text.includes('TRANSFERENCIA ENTRE CONTAS') || text.includes('RESGATE DE APLIC')) {
    return { category: 'Movimentações Financeiras', reason: 'Transferência ou movimentação entre contas não gera receita nem despesa econômica.', intentional: true };
  }

  const classe = String(item.dreClasse || '').toUpperCase();
  const linha = String(item.dreLinha || '').toUpperCase();
  const intentionalByDepara = classe.includes('FORA DA DRE') || linha.includes('FORA DA DRE') || classe.includes('PATRIMONIAL') || linha.includes('PATRIMONIAL');
  if (intentionalByDepara) {
    return { category: 'Fora da DRE — regra contábil', reason: 'O DEPARA marcou esta conta deliberadamente como patrimonial/fora da DRE.', intentional: true };
  }

  return { category: 'Pendente de Classificação', reason: getPendingReason(item), intentional: false };
}

function isIntentionalOutsideDre(item) {
  return classifyOutsideDre(item).intentional;
}

function PendingClassificationDrawer({ items, onClose }) {
  const summary = Object.values((items || []).reduce((map, item) => {
    const code = String(item.contaCodigo || '').trim() || 'SEM-CODIGO';
    const plan = String(item.planoFinanceiro || '').trim() || `${code} - ${item.contaNome || item.contaDescricao || 'Plano não identificado'}`;
    const nomenclature = item.contaNome || item.contaDescricao || 'Sem nomenclatura';
    const classification = classifyOutsideDre(item);
    const key = `${classification.category}|${code}|${plan}|${classification.reason}`;
    if (!map[key]) map[key] = { code, plan, nomenclature, category: classification.category, reason: classification.reason, intentional: classification.intentional, total: 0, count: 0 };
    map[key].total += Math.abs(Number(item.valor) || 0);
    map[key].count += 1;
    return map;
  }, {})).sort((a, b) => a.total - b.total || a.category.localeCompare(b.category, 'pt-BR') || a.plan.localeCompare(b.plan, 'pt-BR'));

  const detailRows = [...(items || [])].sort((a, b) => Math.abs(Number(a.valor) || 0) - Math.abs(Number(b.valor) || 0));
  const total = summary.reduce((sum, row) => sum + row.total, 0);

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 2147483400, background: 'rgba(0,0,0,0.68)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(1100px, 100vw)', height: '100vh', background: 'var(--bg-main)', borderLeft: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', boxShadow: '-18px 0 44px rgba(0,0,0,0.45)' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-elevated)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '16px', color: 'var(--text-main)', marginBottom: '0.25rem' }}>Itens fora da DRE</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Classificação dos itens que não entram no resultado — incluindo investimentos, empréstimos, aportes e pendências reais. Total fora da DRE: <strong style={{ color: 'var(--warning)' }}>{fmt(total)}</strong>.</p>
          </div>
          <button type="button" className="btn" onClick={onClose} style={{ padding: '0.4rem', background: 'transparent', border: 0 }}><X size={18} /></button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '1.25rem' }}>
          <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '1.5rem' }}>
            <div style={{ padding: '0.9rem 1rem', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-color)' }}>
              <strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>Resumo por plano financeiro</strong>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ minWidth: '900px', fontSize: '12px' }}>
                <thead><tr><th>Classificação</th><th>Plano Financeiro</th><th>Nomenclatura</th><th>Por que não entra na DRE</th><th style={{ textAlign: 'center' }}>Lanç.</th><th style={{ textAlign: 'right' }}>Valor</th></tr></thead>
                <tbody>
                  {summary.map((row) => (
                    <tr key={`${row.category}-${row.code}-${row.plan}`}>
                      <td style={{ fontWeight: 700, color: row.intentional ? 'var(--primary)' : 'var(--warning)', minWidth: '180px' }}>{row.category}</td>
                      <td style={{ fontWeight: 600, color: 'var(--text-main)', maxWidth: '300px' }}>{row.plan}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{row.nomenclature}</td>
                      <td style={{ color: 'var(--warning)', maxWidth: '360px' }}>{row.reason}</td>
                      <td style={{ textAlign: 'center' }}>{row.count}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '0.9rem 1rem', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-color)' }}>
              <strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>Lançamentos fora da DRE</strong>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>Detalhamento para auditoria. Somente itens classificados como Pendente de Classificação exigem ajuste do DEPARA.</p>
            </div>
            <div style={{ overflowX: 'auto', maxHeight: '48vh', overflowY: 'auto' }}>
              <table style={{ minWidth: '1050px', fontSize: '12px' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}><tr><th>Classificação</th><th>Data</th><th>Projeto</th><th>Plano Financeiro</th><th>Nomenclatura</th><th>Nome</th><th>Status</th><th style={{ textAlign: 'right' }}>Valor</th></tr></thead>
                <tbody>
                  {detailRows.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 700, color: classifyOutsideDre(item).intentional ? 'var(--primary)' : 'var(--warning)' }}>{classifyOutsideDre(item).category}</td>
                      <td>{item.data || '—'}</td>
                      <td>{item.projeto || '—'}</td>
                      <td>{item.planoFinanceiro || item.contaCodigo || '—'}</td>
                      <td>{item.contaNome || item.contaDescricao || '—'}</td>
                      <td>{item.nome || '—'}</td>
                      <td>{item.status || '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(Math.abs(Number(item.valor) || 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
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
const normalizeAccountLabel = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toUpperCase();

const accountSubgroup = (groupId, label) => {
  const text = normalizeAccountLabel(label);
  if (groupId === 'CUSTOS_SERVICOS') {
    if (text.includes('EQUIP.') || text.includes('EQUIPE')) return { key: 'EQUIPE', label: 'CUSTOS / EQUIPE TÉCNICA', order: 0 };
    if (text.includes('C.D.P') || text.includes('CDP')) return { key: 'CDP', label: 'CUSTOS / PROJETOS', order: 1 };
    return { key: 'OUTROS_CUSTOS', label: 'OUTROS CUSTOS DOS SERVIÇOS', order: 2 };
  }
  if (groupId === 'DESP_ADM') {
    if (text.includes('ASSESSORIA') || text.includes('CONSULTORIA EM TI') || text.includes('SERVICOS ESPECIALIZADOS')) {
      return { key: 'ASSESSORIAS', label: 'DESPESAS COM ASSESSORIAS E SERVIÇOS', order: 1 };
    }
    return { key: 'ADM', label: 'DESPESAS ADMINISTRATIVAS', order: 0 };
  }
  return { key: 'CONTAS', label: null, order: 0 };
};

const accountSection = (label) => {
  const text = normalizeAccountLabel(label);
  if (text.includes('EQUIP.') || text.includes('EQUIPE')) return 'EQUIPE';
  if (text.includes('C.D.P') || text.includes('CDP')) return 'CDP';
  return 'OUTRO';
};

const sortAccounts = (accounts, groupId = '') => Object.values(accounts || {}).sort((a, b) => {
  const sectionA = accountSubgroup(groupId, a.label);
  const sectionB = accountSubgroup(groupId, b.label);
  if (sectionA.order !== sectionB.order) return sectionA.order - sectionB.order;
  return a.label.localeCompare(b.label, 'pt-BR', { sensitivity: 'base', numeric: true });
});

function DreSubgroupRow({ label, accounts, meses, showMonths }) {
  const total = accounts.reduce((sum, account) => sum + (account.total || 0), 0);
  const byMonth = Object.fromEntries(meses.map((month) => [month.key, accounts.reduce((sum, account) => sum + (account.byMonth?.[month.key] || 0), 0)]));
  return (
    <tr style={{ background: 'rgba(57,198,198,0.055)', borderTop: '3px solid var(--bg-main)', borderBottom: '1px solid var(--border-color)' }}>
      <td style={{ padding: '0.7rem 1rem 0.7rem 2.6rem', position: 'sticky', left: 0, zIndex: 1, background: 'rgba(10,38,65,0.99)', color: 'var(--primary)', fontSize: '11px', fontWeight: 800, letterSpacing: '0.045em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{label}</td>
      {showMonths && meses.map((month) => <td key={month.key} style={{ padding: '0.7rem 1rem', textAlign: 'right', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap' }}>{byMonth[month.key] ? fmt(byMonth[month.key]) : '—'}</td>)}
      <td style={{ padding: '0.7rem 1rem', textAlign: 'right', color: 'var(--text-main)', fontSize: '12px', fontWeight: 800, whiteSpace: 'nowrap', background: 'rgba(15,23,42,0.6)' }}>{fmt(total)}</td>
    </tr>
  );
}

function renderSubgroupedAccounts(accounts, groupId, meses, showMonths, onAccountClick, paddingLeft = '3rem') {
  const sorted = sortAccounts(accounts, groupId);
  const rows = [];
  let previousKey = null;

  sorted.forEach((account, idx) => {
    const subgroup = accountSubgroup(groupId, account.label);
    if (subgroup.label && subgroup.key !== previousKey) {
      const subgroupAccounts = sorted.filter((candidate) => accountSubgroup(groupId, candidate.label).key === subgroup.key);
      rows.push(<DreSubgroupRow key={`${groupId}-${subgroup.key}-header`} label={subgroup.label} accounts={subgroupAccounts} meses={meses} showMonths={showMonths} />);
    }
    rows.push(<DreAccountRow key={`${groupId}-acc-${idx}`} account={account} meses={meses} showMonths={showMonths} onAccountClick={onAccountClick} paddingLeft={paddingLeft} />);
    previousKey = subgroup.key;
  });
  return rows;
}

function DreGroupRow({ groupDef, groupData, meses, showMonths, expanded, onToggle, onAccountClick, dreData, isEditMode, onDragStart, onDragOver, onDrop }) {
  const accounts = sortAccounts(groupData.accounts, groupDef.id);
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
            const subAccounts = sortAccounts(subData.accounts, subId);
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
            const accountRows = renderSubgroupedAccounts(subAccounts, subId, meses, showMonths, onAccountClick, '4.5rem');

            return [headerRow, ...accountRows];
          })
        ) : (
          renderSubgroupedAccounts(accounts, groupDef.id, meses, showMonths, onAccountClick)
        )
      )}
    </>
  );
}

// ─── Linha de Conta (Nível 2) ─────────────────────────────────────────────────
function DreAccountRow({ account, meses, showMonths, onAccountClick, paddingLeft = "3rem", showSeparator = false }) {
  return (
    <tr
      onClick={() => onAccountClick(account)}
      style={{ background: "rgba(255,255,255,0.01)", cursor: "pointer", transition: "background 0.1s", borderTop: showSeparator ? "2px solid var(--border-color)" : "none" }}
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
  const [projetosBrutos, setProjetosBrutos] = useState([]);
  const [error, setError] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const [visao, setVisao] = useState('REALIZADO'); // 'REALIZADO', 'SOMENTE_PREVISAO', 'REALIZADO_PREVISAO'

  // Filtros
  const [filterDataInicial, setFilterDataInicial] = useState(() => getDreDateRange().start);
  const [filterDataFinal, setFilterDataFinal] = useState(() => getDreDateRange().end);
  const [filterProjetos, setFilterProjetos] = useState([]);

  // UI
  const [expandedGroups, setExpandedGroups] = useState(DEFAULT_EXPANDED_GROUPS);
  const [auditDrawer, setAuditDrawer] = useState(null); // { items, title }
  const [pendingDrawerOpen, setPendingDrawerOpen] = useState(false);
  const [includeRetroactive, setIncludeRetroactive] = useState(false);
  // A ordem contábil é fixa para preservar a sequência correta dos resultados.
  const customOrder = DRE_ORDER;

  const fetchDados = async (force = false) => {
    setIsSyncing(true);
    setError(null);
    try {
      const res = await fetch(force ? "/api/sync?force=1" : "/api/sync", { method: 'GET', cache: 'no-store' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || result.details?.message || "Erro desconhecido");
      setData(result.data || []);
      setProjetosBrutos(result.projetos || []);
      const syncDate = result.syncedAt || result.snapshotAt;
      setLastSync(syncDate ? new Date(syncDate).toLocaleString("pt-BR") : null);
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

  const projetosDisponiveis = useMemo(() => getActiveProjectNames(projetosBrutos, true), [projetosBrutos]);

  const annualView = visao !== 'REALIZADO';
  const annualRange = getDreDateRange(visao);
  const effectiveDataInicial = annualView ? annualRange.start : filterDataInicial;
  const effectiveDataFinal = annualView ? annualRange.end : filterDataFinal;

  // ── Filtros com exclusão "Fora da DRE" e regra 80/20 ADM ────────────────────
  const filteredItems = useMemo(() => {
    const { filterDreItems } = require("@/lib/dreEngine");
    
    let items = filterDreItems(baseData, {
      filterDataInicial: effectiveDataInicial, filterDataFinal: effectiveDataFinal,
      filterProjetos: [], filterEmpresas: [],
      filterCCs: [],
      visao
    });

    if (filterProjetos.length > 0) {
      const entradas = items.filter(i => i.natureza === "Entrada");
      const saidas = items.filter(i => i.natureza === "Saída");
      const consolidated = consolidateFinancialData(entradas, {
        filterProjetos,
        isProjetosPage: false,
        incluirRateioAdm: true,
      });

      const somenteAdm = filterProjetos.length === 1 && filterProjetos[0].toUpperCase().includes('ADMINISTRA');
      const entradasFiltradas = consolidated.filter(item => {
        const proj = String(item.projeto || '');
        if (somenteAdm) return proj.toUpperCase().includes('ADMINISTRA') && Math.abs(Number(item.valor) || 0) > 0;
        return filterProjetos.some(p => proj === p || proj.toUpperCase().includes(p.toUpperCase()));
      });

      const saidasFiltradas = saidas.filter(item => {
        const proj = String(item.projeto || '');
        return filterProjetos.some(p => proj === p || proj.toUpperCase().includes(p.toUpperCase()));
      });

      items = [...entradasFiltradas, ...saidasFiltradas];
    }

    return items;
  }, [baseData, effectiveDataInicial, effectiveDataFinal, filterProjetos, visao]);

  // Projetos com movimentacao realizada em 2025 podem trazer esse historico em
  // uma unica coluna chamada Retroativo 2026. O retroativo so aparece quando ha
  // projeto selecionado e nunca entra automaticamente no resultado.
  const retroactiveItems = useMemo(() => {
    if (filterProjetos.length === 0) return [];
    const { filterDreItems } = require("@/lib/dreEngine");
    let items = filterDreItems(baseData, {
      filterDataInicial: '2025-01-01', filterDataFinal: '2025-12-31',
      filterProjetos: [], filterEmpresas: [], filterCCs: [], visao: 'REALIZADO'
    });

    const entradas = items.filter((item) => item.natureza === 'Entrada');
    const saidas = items.filter((item) => item.natureza === 'Saída');
    const consolidated = consolidateFinancialData(entradas, {
      filterProjetos,
      isProjetosPage: false,
      incluirRateioAdm: true,
    });
    const somenteAdm = filterProjetos.length === 1 && filterProjetos[0].toUpperCase().includes('ADMINISTRA');
    const entradasFiltradas = consolidated.filter((item) => {
      const proj = String(item.projeto || '');
      if (somenteAdm) return proj.toUpperCase().includes('ADMINISTRA') && Math.abs(Number(item.valor) || 0) > 0;
      return filterProjetos.some((project) => proj === project || proj.toUpperCase().includes(project.toUpperCase()));
    });
    const saidasFiltradas = saidas.filter((item) => {
      const proj = String(item.projeto || '');
      return filterProjetos.some((project) => proj === project || proj.toUpperCase().includes(project.toUpperCase()));
    });
    return [...entradasFiltradas, ...saidasFiltradas];
  }, [baseData, filterProjetos]);

  useEffect(() => {
    if (includeRetroactive && retroactiveItems.length === 0) setIncludeRetroactive(false);
  }, [includeRetroactive, retroactiveItems.length]);

  // A DRE permanece anual na leitura: Jan-Dez ficam visiveis mesmo quando o filtro
  // de realizado termina no mes corrente. Meses fora do periodo filtrado aparecem zerados.
  const baseMeses = useMemo(() => buildMeses('2026-01-01', '2026-12-31'), []);
  const meses = useMemo(() => includeRetroactive && retroactiveItems.length > 0
    ? [{ key: 'RETRO-2026', label: 'Retroativo 2026', retroactive: true }, ...baseMeses]
    : baseMeses, [baseMeses, includeRetroactive, retroactiveItems.length]);
  const showMonths = meses.length > 1;

  const taggedItems = useMemo(() => {
    const current = tagItemsWithMesKey(filteredItems);
    if (!includeRetroactive || retroactiveItems.length === 0) return current;
    const retroactive = retroactiveItems.map((item) => ({ ...item, mesKey: 'RETRO-2026', isRetroactive2026: true }));
    return [...retroactive, ...current];
  }, [filteredItems, retroactiveItems, includeRetroactive]);
  const dreData = useMemo(() => buildDreStructure(taggedItems, meses), [taggedItems, meses]);

  const intentionalOutsideItems = useMemo(() => {
    const start = effectiveDataInicial ? new Date(effectiveDataInicial + 'T00:00:00').getTime() : 0;
    const end = effectiveDataFinal ? new Date(effectiveDataFinal + 'T23:59:59').getTime() : Infinity;
    return baseData.filter((item) => {
      if (!isIntentionalOutsideDre(item)) return false;
      const status = String(item.status || '').toUpperCase();
      const isRealizado = status.includes('REALIZADO') || status.includes('PAGO') || status.includes('RECEBIDO') || status === 'EFETIVADO';
      const isPrevisto = !isRealizado && (status.includes('A REALIZAR') || status.includes('A RECEBER') || status.includes('A PAGAR') || status.includes('PREVISTO'));
      if (visao === 'REALIZADO' && !isRealizado) return false;
      if (visao === 'SOMENTE_PREVISAO' && !isPrevisto) return false;
      if (visao === 'REALIZADO_PREVISAO' && !isRealizado && !isPrevisto) return false;
      if ((item.dataTimestamp || 0) < start || (item.dataTimestamp || 0) > end) return false;
      if (filterProjetos.length > 0) {
        const proj = String(item.projeto || '');
        if (!filterProjetos.some((project) => proj === project || proj.toUpperCase().includes(project.toUpperCase()))) return false;
      }
      return true;
    });
  }, [baseData, effectiveDataInicial, effectiveDataFinal, filterProjetos, visao]);

  const outsideDreItems = useMemo(() => {
    const map = new Map();
    [...dreData.naoClassificados.items, ...intentionalOutsideItems].forEach((item) => {
      // A mesma movimentacao pode ter sido capturada como nao classificada pelo
      // motor e tambem reconhecida pela regra patrimonial. A chave nao inclui a
      // origem da captura para impedir duplicidade no resumo.
      const key = [item.data, item.documento, item.lancamento, item.contaCodigo, item.projeto, item.valor].join('|');
      if (!map.has(key)) map.set(key, item);
    });
    return [...map.values()];
  }, [dreData.naoClassificados.items, intentionalOutsideItems]);

  const outsideDreTotal = useMemo(() => outsideDreItems.reduce((sum, item) => sum + Math.abs(Number(item.valor) || 0), 0), [outsideDreItems]);
  const pendingCount = useMemo(() => outsideDreItems.filter((item) => !classifyOutsideDre(item).intentional).length, [outsideDreItems]);
  const intentionalCount = outsideDreItems.length - pendingCount;

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
    setIncludeRetroactive(false);
  };

  const hasActiveFilters = filterProjetos.length > 0 || includeRetroactive;

  // KPIs
  const receitaBruta = dreData.groups["RECEITA_BRUTA"]?.total || 0;
  const resLiquido = dreData.computedValues["RES_LIQUIDO"] || 0;
  const resOperacional = dreData.computedValues["RES_OPERACIONAL"] || 0;
  const totalCustos = (dreData.groups["CUSTOS_SERVICOS"]?.total || 0);
  const totalDespesas = (dreData.groups["DESP_ADM"]?.total || 0) + (dreData.groups["DESP_COMERCIAL"]?.total || 0) + (dreData.groups["DESP_FINANCEIRA"]?.total || 0);
  const margem = receitaBruta > 0 ? (resLiquido / receitaBruta) * 100 : 0;

  const reportFilters = {
    Visão: visao === "REALIZADO" ? "Realizado" : visao === "SOMENTE_PREVISAO" ? "Somente previsão" : "Realizado + Previsão 2026",
    "Data inicial": effectiveDataInicial || "Todas",
    "Data final": effectiveDataFinal || "Todas",
    Projetos: filterProjetos.length ? filterProjetos : "Todos",
    "Retroativo 2026": includeRetroactive ? "Incluído" : "Não incluído",
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
            sortAccounts(subGroup.accounts, subId).forEach((account) => rows.push(valueRow(account.label, account.total, account.byMonth, "Conta")));
          });
        } else {
          sortAccounts(groupData?.accounts, groupDef.id).forEach((account) => rows.push(valueRow(account.label, account.total, account.byMonth, "Conta")));
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

  const drePendingRows = useMemo(() => outsideDreItems.map((item) => {
    const classification = classifyOutsideDre(item);
    return {
      Classificação: classification.category,
      Data: item.data,
      Projeto: item.projeto,
      "Plano Financeiro": item.planoFinanceiro || item.contaCodigo || 'Não identificado',
      Nomenclatura: item.contaNome || item.contaDescricao,
      Motivo: classification.reason,
      Nome: item.nome,
      Situação: item.status,
      Valor: Math.abs(item.valor || 0),
    };
  }).sort((a, b) => a.Valor - b.Valor), [outsideDreItems]);

  return (
    <div style={{ padding: "1.5rem", maxWidth: "100%", minHeight: "100vh", background: "var(--bg-main)" }}>
      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <h1 style={{ fontSize: "22px", fontWeight: "800", color: "var(--text-main)" }}>DRE Gerencial</h1>
              <InfoTooltip title="Demonstrativo de Resultado" content="Receitas, deduções, custos, despesas e resultados classificados na DRE." />
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
            onClick={() => fetchDados(true)}
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
              <InfoTooltip title="Modo de Visualização" content="Define se a DRE mostra realizado, previsão ou realizado + previsão." />
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', minWidth: '205px' }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              Retroativo 2026
              <InfoTooltip title="Retroativo 2026" content="Movimentações realizadas em 2025 dos projetos selecionados, exibidas como Retroativo 2026." />
            </label>
            <button
              type="button"
              disabled={filterProjetos.length === 0 || retroactiveItems.length === 0}
              onClick={() => setIncludeRetroactive((value) => !value)}
              title={filterProjetos.length === 0 ? 'Selecione uma obra para verificar o retroativo.' : retroactiveItems.length === 0 ? 'A obra selecionada não possui movimentação realizada em 2025.' : undefined}
              style={{
                height: '38px', padding: '0 0.8rem', borderRadius: '6px',
                border: `1px solid ${includeRetroactive ? 'var(--primary)' : 'var(--border-color)'}`,
                background: includeRetroactive ? 'rgba(57,198,198,0.15)' : 'var(--bg-elevated)',
                color: includeRetroactive ? 'var(--primary)' : 'var(--text-main)',
                fontSize: '12px', fontWeight: 700,
                cursor: filterProjetos.length === 0 || retroactiveItems.length === 0 ? 'not-allowed' : 'pointer',
                opacity: filterProjetos.length === 0 || retroactiveItems.length === 0 ? 0.58 : 1,
              }}
            >
              {filterProjetos.length === 0
                ? 'Selecione uma obra'
                : retroactiveItems.length === 0
                  ? 'Sem movimento em 2025'
                  : includeRetroactive
                    ? '✓ Incluído no resultado'
                    : '+ Incluir retroativo'}
            </button>
            {filterProjetos.length > 0 && retroactiveItems.length > 0 && (
              <span style={{ fontSize: '9.5px', color: 'var(--text-secondary)', lineHeight: 1.25 }}>
                {retroactiveItems.length} movimentação{retroactiveItems.length !== 1 ? 'ões' : ''} de 2025 disponível{retroactiveItems.length !== 1 ? 'is' : ''}.
              </span>
            )}
          </div>
        </div>
      </div>


      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          ['Receita Bruta', receitaBruta, 'var(--success)'],
          ['Custos dos Serviços', totalCustos, 'var(--warning)'],
          ['Despesas', totalDespesas, 'var(--danger)'],
          ['Resultado Operacional', resOperacional, resOperacional >= 0 ? 'var(--success)' : 'var(--danger)'],
          ['Resultado Líquido', resLiquido, resLiquido >= 0 ? 'var(--success)' : 'var(--danger)'],
        ].map(([label, value, color]) => (
          <div key={label} className="card" style={{ padding: '1rem', borderTop: `3px solid ${color}` }}>
            <p style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.35rem', fontWeight: '700' }}>{label}</p>
            <p style={{ fontSize: '17px', fontWeight: '700', color }}>{fmt(value)}</p>
          </div>
        ))}
        <div className="card" style={{ padding: '1rem', borderTop: '3px solid var(--primary)' }}>
          <p style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.35rem', fontWeight: '700' }}>Margem Líquida</p>
          <p style={{ fontSize: '17px', fontWeight: '700', color: margem >= 0 ? 'var(--success)' : 'var(--danger)' }}>{margem.toFixed(2).replace('.', ',')}%</p>
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

        <div className="dre-responsive-wrap">
          <table className="dre-responsive-table" style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
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

      {/* ── Itens fora da DRE ── */}
      {outsideDreItems.length > 0 && (
        <div className="card" style={{ padding: "1.25rem", borderLeft: "3px solid var(--warning)", background: "rgba(245,158,11,0.03)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <AlertCircle size={20} color="var(--warning)" />
              <div>
                <h3 style={{ fontSize: "14px", fontWeight: "700", color: "var(--text-main)", marginBottom: "0.25rem" }}>Itens fora da DRE</h3>
                <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                  {intentionalCount} exclusão(ões) intencional(is) (investimentos, empréstimos, aportes, retenções etc.) e {pendingCount} pendência(s) real(is) de classificação. Nenhum desses itens soma no resultado acima.
                </p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <span style={{ fontSize: "16px", fontWeight: "800", color: "var(--warning)" }}>{fmt(outsideDreTotal)}</span>
              <button
                onClick={() => setPendingDrawerOpen(true)}
                style={{ background: "rgba(245,158,11,0.15)", color: "var(--warning)", border: "none", padding: "0.5rem 1rem", borderRadius: "6px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}
              >
                Ver classificação e motivo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Drawers de Auditoria ── */}
      {pendingDrawerOpen && <PendingClassificationDrawer items={outsideDreItems} onClose={() => setPendingDrawerOpen(false)} />}
      {auditDrawer && <AuditDrawer items={auditDrawer.items} title={auditDrawer.title} onClose={() => setAuditDrawer(null)} />}
    </div>
  );
}
