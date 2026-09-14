"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CircleDollarSign,
  Clock3,
  FileText,
  RefreshCw,
  Target,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { consolidateFinancialData, splitProjectReceipt } from "@/lib/consolidation";
import { getOfficialProjectName, getProjectKey } from "@/lib/projectRules";

const MONTHS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];
const VISIBLE_MONTH_INDEXES = [8, 9, 10, 11];

const MONTH_ALIASES = [
  ["JAN", "JANEIRO"],
  ["FEV", "FEVEREIRO"],
  ["MAR", "MARCO"],
  ["ABR", "ABRIL"],
  ["MAI", "MAIO"],
  ["JUN", "JUNHO"],
  ["JUL", "JULHO"],
  ["AGO", "AGOSTO"],
  ["SET", "SETEMBRO"],
  ["OUT", "OUTUBRO"],
  ["NOV", "NOVEMBRO"],
  ["DEZ", "DEZEMBRO"],
];

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function normalizeKey(value) {
  return normalizeText(value).replace(/[^A-Z0-9]/g, "");
}

function getField(row, candidates) {
  const entries = Object.entries(row || {}).map(([key, value]) => [normalizeKey(key), value]);
  for (const candidate of candidates) {
    const wanted = normalizeKey(candidate);
    const exact = entries.find(([key]) => key === wanted);
    if (exact && exact[1] !== "") return exact[1];
  }
  for (const candidate of candidates) {
    const wanted = normalizeKey(candidate);
    if (wanted.length < 4) continue;
    const partial = entries.find(([key]) => key.includes(wanted));
    if (partial && partial[1] !== "") return partial[1];
  }
  return "";
}

function parseDate(value, fallbackYear = 2026) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number") {
    if (value > 20000 && value < 80000) {
      const excel = new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86400000);
      return new Date(excel.getUTCFullYear(), excel.getUTCMonth(), excel.getUTCDate());
    }
    if (value >= 1 && value <= 12) return new Date(fallbackYear, value - 1, 1);
  }

  const text = String(value).trim();
  let match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));

  match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));

  const normalized = normalizeText(text);
  const monthIndex = MONTH_ALIASES.findIndex((aliases) => aliases.some((alias) => normalized === alias || normalized.startsWith(alias + "/") || normalized.startsWith(alias + " ")));
  if (monthIndex >= 0) {
    const yearMatch = normalized.match(/20\d{2}/);
    return new Date(yearMatch ? Number(yearMatch[0]) : fallbackYear, monthIndex, 1);
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value === null || value === undefined || value === "") return 0;
  const raw = String(value).trim().replace(/R\$\s?/gi, "").replace(/\s/g, "");
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function dateLabel(date) {
  return date ? date.toLocaleDateString("pt-BR") : "—";
}

function documentText(item) {
  return normalizeText([
    item?.documento,
    item?.origemSienge,
    item?.lancamento,
    item?.status,
    item?.tipo,
  ].filter(Boolean).join(" "));
}

function isRealizedDocument(item) {
  const value = documentText(item);
  const status = normalizeText(item?.status);
  return value.includes("CTPA.521")
    || /(^|\s|[-_/])NFES?(\s|[-_/]|$)/.test(value)
    || /(^|\s|[-_/])OS(\s|[-_/]|$)/.test(value)
    || status.includes("REALIZADO")
    || status.includes("RECEBIDO")
    || status.includes("EFETIVADO");
}

function isForecastDocument(row) {
  const value = normalizeText(Object.values(row || {}).join(" "));
  if (value.includes("CTPA.521") || /(^|\s)NFES?(\s|$)/.test(value) || /(^|\s)OS(\s|$)/.test(value)) return false;
  return /(^|[^A-Z])PRV([^A-Z]|$)/.test(value)
    || /(^|[^A-Z])PCT([^A-Z]|$)/.test(value)
    || /(^|[^A-Z])CTPA([^A-Z0-9.]|$)/.test(value)
    || /(^|[^A-Z])CTPU([^A-Z]|$)/.test(value)
    || value.includes("A REALIZAR");
}

function monthFromHeader(header) {
  const normalized = normalizeText(header);
  const compact = normalizeKey(header);
  const aliasIndex = MONTH_ALIASES.findIndex((aliases) => aliases.some((alias) => compact === alias || compact.startsWith(alias + "20")));
  if (aliasIndex >= 0) return aliasIndex;

  const numeric = normalized.match(/^(0?[1-9]|1[0-2])[\/.-](20\d{2})$/);
  return numeric ? Number(numeric[1]) - 1 : -1;
}

function projectionProject(row, projectCatalog) {
  const raw = getField(row, [
    "PROJETO", "OBRA", "NOME DO PROJETO", "CENTRO DE CUSTO",
    "NOME CENTRO DE CUSTO", "CONTRATO",
  ]);
  return getOfficialProjectName(raw, projectCatalog) || String(raw || "Sem projeto").trim();
}

function buildForecastNotes(rows, projectCatalog) {
  const notes = [];

  (rows || []).forEach((row, rowIndex) => {
    const project = projectionProject(row, projectCatalog);
    if (!project || normalizeText(project) === "SEM PROJETO") return;

    const yearValue = Number(getField(row, ["ANO", "EXERCICIO"])) || 2026;
    const document = String(getField(row, [
      "DOCUMENTO", "NOTA", "NF", "TIPO", "ORIGEM", "PREVISAO",
    ]) || "Previsão").trim();
    const rowTypeKnown = isForecastDocument(row);
    const dateValue = getField(row, [
      "DATA PREVISTA", "PREVISAO DE FATURAMENTO", "DATA", "COMPETENCIA", "MES",
    ]);
    const value = toNumber(getField(row, [
      "VALOR PREVISTO", "VALOR DA NOTA", "VALOR FATURAMENTO",
      "PREVISAO DE FATURAMENTO", "FATURAMENTO", "VALOR",
    ]));
    const date = parseDate(dateValue, yearValue);

    if (date && value && (rowTypeKnown || document === "Previsão")) {
      notes.push({
        id: `forecast-${rowIndex}`,
        kind: "forecast",
        project,
        projectKey: getProjectKey(project),
        document,
        date,
        value,
        source: "FAT_PROJEÇÃO 2026",
      });
      return;
    }

    Object.entries(row || {}).forEach(([header, cellValue], columnIndex) => {
      const monthIndex = monthFromHeader(header);
      const monthValue = toNumber(cellValue);
      if (monthIndex < 0 || !monthValue) return;
      const headerYear = Number(String(header).match(/20\d{2}/)?.[0]) || yearValue;
      notes.push({
        id: `forecast-${rowIndex}-${columnIndex}`,
        kind: "forecast",
        project,
        projectKey: getProjectKey(project),
        document,
        date: new Date(headerYear, monthIndex, 1),
        value: monthValue,
        source: "FAT_PROJEÇÃO 2026",
      });
    });
  });

  return notes;
}

function buildRealizedNotes(rows, projectCatalog) {
  const consolidated = consolidateFinancialData(rows || [], {
    isProjetosPage: true,
    incluirRateioAdm: true,
    usarValorCaixa: false,
  });

  return consolidated
    .filter((item) => item?.natureza === "Entrada" && isRealizedDocument(item))
    .map((item, index) => {
      const date = parseDate(item.dataEmissao || item.data);
      const project = getOfficialProjectName(item.projeto, projectCatalog) || item.projeto || "Sem projeto";
      const value = toNumber(
        item.valorFaturamentoReceitaTotal
        ?? item.valorFaturamentoTitulo
        ?? item.valorFaturamento
        ?? item.valorTotalTitulo
        ?? item.valorBruto
      );
      return {
        id: `realized-${item.lancamento || item.documento || index}-${item.data || ""}`,
        kind: "realized",
        project,
        projectKey: getProjectKey(project),
        document: item.documento || item.lancamento || "Sem número",
        date,
        value,
        source: item.origemSienge || "CR_GERAL",
      };
    })
    .filter((item) => item.date && item.value);
}

function rateValue(value, includeAdministrativeRate) {
  const allocation = splitProjectReceipt(value);
  return includeAdministrativeRate ? allocation.total : allocation.project;
}

function MetricCard({ icon: Icon, label, value, detail, color }) {
  return (
    <div className="card" style={{ padding: "1.1rem", minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
          <div style={{ color: "var(--text-main)", fontSize: "clamp(1.15rem, 2.2vw, 1.65rem)", fontWeight: 800, marginTop: "0.45rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
          <div style={{ color: "var(--text-secondary)", fontSize: 12, marginTop: "0.3rem" }}>{detail}</div>
        </div>
        <div style={{ width: 40, height: 40, borderRadius: 10, display: "grid", placeItems: "center", color, background: `${color}18`, flexShrink: 0 }}><Icon size={20} /></div>
      </div>
    </div>
  );
}

export default function PrevisaoFaturamentoPage() {
  const router = useRouter();
  const [financialRows, setFinancialRows] = useState([]);
  const [projectionRows, setProjectionRows] = useState([]);
  const [projectCatalog, setProjectCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [month, setMonth] = useState("all");
  const [project, setProject] = useState("all");
  const [status, setStatus] = useState("all");
  const [includeAdministrativeRate, setIncludeAdministrativeRate] = useState(true);

  async function loadData(force = false) {
    try {
      if (force) setRefreshing(true);
      setError("");
      const response = await fetch(force ? "/api/sync?force=1" : "/api/sync", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível carregar os dados financeiros.");
      if (!Array.isArray(result.projecaoFaturamento)) {
        throw new Error("A aba FAT_PROJEÇÃO 2026 ainda não foi carregada. Atualize os dados novamente.");
      }
      setFinancialRows(Array.isArray(result.data) ? result.data : []);
      setProjectionRows(result.projecaoFaturamento);
      setProjectCatalog(Array.isArray(result.projetos) ? result.projetos : []);
    } catch (loadError) {
      setError(loadError.message || "Erro ao carregar os dados.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    let active = true;
    async function initialize() {
      try {
        const response = await fetch("/api/session", { cache: "no-store" });
        const session = await response.json();
        const permissions = Array.isArray(session.user?.permissions) ? session.user.permissions : [];
        const isAllowed = normalizeText(session.user?.username) === "ADMIN" || permissions.includes("previsao_faturamento");
        if (!isAllowed) {
          router.replace("/acesso-negado?origem=/previsao-faturamento");
          return;
        }
        if (!active) return;
        setAuthorized(true);
        await loadData(false);
      } catch {
        router.replace("/login");
      }
    }
    initialize();
    return () => { active = false; };
  }, [router]);

  const forecastNotes = useMemo(
    () => buildForecastNotes(projectionRows, projectCatalog),
    [projectionRows, projectCatalog]
  );
  const realizedNotes = useMemo(
    () => buildRealizedNotes(financialRows, projectCatalog),
    [financialRows, projectCatalog]
  );
  const notes = useMemo(() => [...forecastNotes, ...realizedNotes], [forecastNotes, realizedNotes]);

  const projectOptions = useMemo(() => {
    const map = new Map();
    notes.forEach((note) => {
      if (!note.projectKey) return;
      if (!map.has(note.projectKey) || note.kind === "realized") map.set(note.projectKey, note.project);
    });
    return [...map.entries()]
      .map(([key, name]) => ({ key, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [notes]);

  const selectedYear = 2026;
  const displayedNotes = useMemo(() => notes.map((note) => ({
    ...note,
    displayedValue: rateValue(note.value, includeAdministrativeRate),
  })), [notes, includeAdministrativeRate]);

  const filteredNotes = useMemo(() => displayedNotes.filter((note) => {
    if (note.date?.getFullYear() !== selectedYear) return false;
    if (month !== "all" && note.date.getMonth() !== Number(month)) return false;
    if (project !== "all" && note.projectKey !== project) return false;
    if (status !== "all" && note.kind !== status) return false;
    return true;
  }), [displayedNotes, selectedYear, month, project, status]);

  const monthlyData = useMemo(() => VISIBLE_MONTH_INDEXES.map((monthIndex) => {
    const name = MONTHS[monthIndex];
    const scoped = displayedNotes.filter((note) =>
      note.date?.getFullYear() === selectedYear
      && note.date.getMonth() === monthIndex
      && (project === "all" || note.projectKey === project)
    );
    const forecast = scoped.filter((note) => note.kind === "forecast").reduce((sum, note) => sum + note.displayedValue, 0);
    const realized = scoped.filter((note) => note.kind === "realized").reduce((sum, note) => sum + note.displayedValue, 0);
    return {
      name,
      monthIndex,
      "Valor previsto": forecast,
      "Valor realizado": realized,
      "% atingido": forecast > 0 ? Number(((realized / forecast) * 100).toFixed(1)) : (realized > 0 ? 100 : 0),
    };
  }), [displayedNotes, selectedYear, project]);

  const periodData = useMemo(() => {
    const selectedMonths = month === "all"
      ? monthlyData
      : monthlyData.filter((item) => item.monthIndex === Number(month));
    const forecast = selectedMonths.reduce((sum, item) => sum + item["Valor previsto"], 0);
    const realized = selectedMonths.reduce((sum, item) => sum + item["Valor realizado"], 0);
    return {
      forecast,
      realized,
      balance: Math.max(forecast - realized, 0),
      percent: forecast > 0 ? (realized / forecast) * 100 : (realized > 0 ? 100 : 0),
      forecastCount: filteredNotes.filter((note) => note.kind === "forecast").length,
    };
  }, [monthlyData, month, filteredNotes]);

  const projectSummary = useMemo(() => {
    const grouped = new Map();
    displayedNotes.forEach((note) => {
      if (note.date?.getFullYear() !== selectedYear) return;
      if (month !== "all" && note.date.getMonth() !== Number(month)) return;
      if (project !== "all" && note.projectKey !== project) return;
      const current = grouped.get(note.projectKey) || {
        key: note.projectKey,
        name: note.project,
        forecast: 0,
        realized: 0,
        forecastCount: 0,
        realizedCount: 0,
      };
      if (note.kind === "forecast") {
        current.forecast += note.displayedValue;
        current.forecastCount += 1;
      } else {
        current.realized += note.displayedValue;
        current.realizedCount += 1;
        current.name = note.project;
      }
      grouped.set(note.projectKey, current);
    });
    return [...grouped.values()].map((item) => ({
      ...item,
      balance: Math.max(item.forecast - item.realized, 0),
      percent: item.forecast > 0 ? (item.realized / item.forecast) * 100 : (item.realized > 0 ? 100 : 0),
    })).sort((a, b) => b.forecast - a.forecast);
  }, [displayedNotes, selectedYear, month, project]);

  if (!authorized || loading) {
    return (
      <main style={{ minHeight: "70vh", display: "grid", placeItems: "center", color: "var(--text-secondary)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}><RefreshCw size={18} className="spin" /> Carregando previsão de faturamento...</div>
      </main>
    );
  }

  const selectStyle = {
    width: "100%",
    minHeight: 40,
    padding: "0.55rem 0.7rem",
    borderRadius: 8,
    border: "1px solid var(--border-color)",
    background: "var(--bg-elevated)",
    color: "var(--text-main)",
  };
  const thStyle = {
    padding: "0.8rem", color: "var(--text-secondary)", fontSize: 11,
    textTransform: "uppercase", letterSpacing: "0.04em",
    textAlign: "left", borderBottom: "1px solid var(--border-color)", whiteSpace: "nowrap",
  };
  const tdStyle = {
    padding: "0.8rem", borderBottom: "1px solid var(--border-color)",
    color: "var(--text-main)", fontSize: 13,
  };

  return (
    <main style={{ padding: "clamp(1rem, 2.5vw, 2rem)", maxWidth: 1600, width: "100%", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", flexWrap: "wrap" }}>
            <h1 style={{ color: "var(--text-main)", fontSize: "clamp(1.35rem, 3vw, 2rem)", margin: 0 }}>Previsão de Faturamento</h1>
            <span style={{ background: "rgba(57,198,198,0.12)", color: "var(--primary)", border: "1px solid rgba(57,198,198,0.25)", borderRadius: 999, padding: "0.25rem 0.55rem", fontSize: 11, fontWeight: 800 }}>ACESSO CONTROLADO</span>
          </div>
          <p style={{ color: "var(--text-secondary)", margin: "0.45rem 0 0" }}>Previsão da FAT_PROJEÇÃO 2026 comparada às notas realizadas por projeto e mês.</p>
        </div>
        <button className="btn" onClick={() => loadData(true)} disabled={refreshing} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <RefreshCw size={16} className={refreshing ? "spin" : ""} />
          {refreshing ? "Atualizando..." : "Atualizar dados"}
        </button>
      </div>

      {error && (
        <div className="card" style={{ padding: "0.9rem 1rem", marginBottom: "1rem", color: "var(--danger)", display: "flex", gap: "0.55rem", alignItems: "center" }}>
          <AlertTriangle size={18} /> {error}
        </div>
      )}

      <section className="card" style={{ padding: "1rem", marginBottom: "1rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))", gap: "0.8rem" }}>
          <label style={{ color: "var(--text-secondary)", fontSize: 12 }}>Período
            <select value="2026" disabled style={{ ...selectStyle, marginTop: 5, opacity: 0.8 }}>
              <option value="2026">Set a Dez/2026</option>
            </select>
          </label>
          <label style={{ color: "var(--text-secondary)", fontSize: 12 }}>Mês
            <select value={month} onChange={(event) => setMonth(event.target.value)} style={{ ...selectStyle, marginTop: 5 }}>
              <option value="all">Todos os meses</option>
              {VISIBLE_MONTH_INDEXES.map((index) => <option key={MONTHS[index]} value={index}>{MONTHS[index]}/2026</option>)}
            </select>
          </label>
          <label style={{ color: "var(--text-secondary)", fontSize: 12 }}>Projeto
            <select value={project} onChange={(event) => setProject(event.target.value)} style={{ ...selectStyle, marginTop: 5 }}>
              <option value="all">Todos os projetos</option>
              {projectOptions.map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}
            </select>
          </label>
          <label style={{ color: "var(--text-secondary)", fontSize: 12 }}>Tipo
            <select value={status} onChange={(event) => setStatus(event.target.value)} style={{ ...selectStyle, marginTop: 5 }}>
              <option value="all">Previstas e realizadas</option>
              <option value="forecast">Somente previstas</option>
              <option value="realized">Somente realizadas</option>
            </select>
          </label>
        </div>
        <label style={{ marginTop: "0.9rem", display: "flex", alignItems: "center", gap: "0.55rem", color: "var(--text-main)", fontSize: 13, cursor: "pointer" }}>
          <input type="checkbox" checked={includeAdministrativeRate} onChange={(event) => setIncludeAdministrativeRate(event.target.checked)} style={{ accentColor: "var(--primary)", width: 15, height: 15 }} />
          Incluir rateio administrativo da receita
          <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>Ligado: nota total (80% projeto + 20% ADM). Desligado: somente 80% do projeto.</span>
        </label>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "0.9rem", marginBottom: "1rem" }}>
        <MetricCard icon={Target} label="Valor previsto" value={money(periodData.forecast)} detail="FAT_PROJEÇÃO 2026" color="var(--primary)" />
        <MetricCard icon={CircleDollarSign} label="Valor realizado" value={money(periodData.realized)} detail="NFES, OS e CTPA.521" color="var(--success)" />
        <MetricCard icon={Clock3} label="Saldo da previsão" value={money(periodData.balance)} detail="Valor ainda não realizado" color="var(--warning)" />
        <MetricCard icon={TrendingUp} label="% atingido" value={`${periodData.percent.toFixed(1)}%`} detail="Realizado ÷ previsto" color={periodData.percent >= 100 ? "var(--success)" : "var(--primary)"} />
        <MetricCard icon={FileText} label="Notas previstas" value={periodData.forecastCount} detail="PRV, PCT, CTPA, CTPU e A REALIZAR" color="var(--danger)" />
      </section>

      <section className="card" style={{ padding: "1rem", marginBottom: "1rem" }}>
        <h2 style={{ margin: 0, color: "var(--text-main)", fontSize: "1rem" }}>Visão mensal — setembro a dezembro de 2026</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: 12, margin: "0.25rem 0 0" }}>Valor previsto x valor realizado e percentual atingido.</p>
        <div style={{ width: "100%", height: 360, marginTop: "0.7rem" }}>
          <ResponsiveContainer>
            <ComposedChart data={monthlyData} margin={{ top: 15, right: 16, bottom: 0, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} />
              <YAxis yAxisId="money" stroke="var(--text-secondary)" fontSize={11} tickFormatter={(value) => `${Math.round(value / 1000)}k`} />
              <YAxis yAxisId="percent" orientation="right" stroke="var(--text-secondary)" fontSize={11} tickFormatter={(value) => `${value}%`} />
              <Tooltip contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border-color)", borderRadius: 8 }} formatter={(value, name) => name === "% atingido" ? [`${Number(value).toFixed(1)}%`, name] : [money(value), name]} />
              <Legend />
              <Bar yAxisId="money" dataKey="Valor previsto" fill="var(--primary)" radius={[5, 5, 0, 0]} />
              <Bar yAxisId="money" dataKey="Valor realizado" fill="var(--success)" radius={[5, 5, 0, 0]} />
              <Line yAxisId="percent" type="monotone" dataKey="% atingido" stroke="var(--warning)" strokeWidth={3} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="card" style={{ marginBottom: "1rem", overflow: "hidden" }}>
        <div style={{ padding: "1rem 1rem 0.7rem" }}><h2 style={{ margin: 0, color: "var(--text-main)", fontSize: "1rem" }}>Previsto x realizado por projeto</h2></div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
            <thead><tr>
              <th style={thStyle}>Projeto</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Valor previsto</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Valor realizado</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Saldo</th>
              <th style={{ ...thStyle, textAlign: "center" }}>% atingido</th>
              <th style={{ ...thStyle, textAlign: "center" }}>Notas previstas / realizadas</th>
            </tr></thead>
            <tbody>
              {projectSummary.map((item) => <tr key={item.key}>
                <td style={{ ...tdStyle, fontWeight: 700 }}>{item.name}</td>
                <td style={{ ...tdStyle, textAlign: "right" }}>{money(item.forecast)}</td>
                <td style={{ ...tdStyle, textAlign: "right", color: "var(--success)", fontWeight: 700 }}>{money(item.realized)}</td>
                <td style={{ ...tdStyle, textAlign: "right" }}>{money(item.balance)}</td>
                <td style={{ ...tdStyle, textAlign: "center", color: item.percent >= 100 ? "var(--success)" : "var(--primary)", fontWeight: 800 }}>{item.percent.toFixed(1)}%</td>
                <td style={{ ...tdStyle, textAlign: "center" }}>{item.forecastCount} / {item.realizedCount}</td>
              </tr>)}
              {!projectSummary.length && <tr><td colSpan={6} style={{ ...tdStyle, textAlign: "center", color: "var(--text-secondary)", padding: "2rem" }}>Nenhum projeto encontrado no período.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card" style={{ overflow: "hidden" }}>
        <div style={{ padding: "1rem 1rem 0.7rem", display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" }}>
          <div>
            <h2 style={{ margin: 0, color: "var(--text-main)", fontSize: "1rem" }}>Controle por nota</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 12, margin: "0.25rem 0 0" }}>Notas consolidadas por projeto, sem divisão ou duplicidade por conta.</p>
          </div>
          <span style={{ color: "var(--text-secondary)", fontSize: 12 }}>{filteredNotes.length} nota(s)</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
            <thead><tr>
              <th style={thStyle}>Projeto</th>
              <th style={thStyle}>NF / Documento</th>
              <th style={thStyle}>Competência</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Valor previsto</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Valor realizado</th>
              <th style={{ ...thStyle, textAlign: "center" }}>Classificação</th>
            </tr></thead>
            <tbody>
              {filteredNotes.slice().sort((a, b) => b.date - a.date).map((note) => <tr key={note.id}>
                <td style={{ ...tdStyle, fontWeight: 700 }}>{note.project}</td>
                <td style={tdStyle}>{note.document}</td>
                <td style={tdStyle}>{dateLabel(note.date)}</td>
                <td style={{ ...tdStyle, textAlign: "right", fontWeight: note.kind === "forecast" ? 700 : 400 }}>{note.kind === "forecast" ? money(note.displayedValue) : "—"}</td>
                <td style={{ ...tdStyle, textAlign: "right", color: note.kind === "realized" ? "var(--success)" : "var(--text-secondary)", fontWeight: note.kind === "realized" ? 700 : 400 }}>{note.kind === "realized" ? money(note.displayedValue) : "—"}</td>
                <td style={{ ...tdStyle, textAlign: "center" }}>
                  <span style={{ display: "inline-flex", padding: "0.3rem 0.55rem", borderRadius: 999, fontSize: 11, fontWeight: 800, color: note.kind === "realized" ? "var(--success)" : "var(--warning)", background: note.kind === "realized" ? "rgba(34,197,94,0.12)" : "rgba(245,158,11,0.12)" }}>
                    {note.kind === "realized" ? "Realizada" : "Prevista"}
                  </span>
                </td>
              </tr>)}
              {!filteredNotes.length && <tr><td colSpan={6} style={{ ...tdStyle, textAlign: "center", color: "var(--text-secondary)", padding: "2rem" }}>Nenhuma nota encontrada com os filtros selecionados.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
