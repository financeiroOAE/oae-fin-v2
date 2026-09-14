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

const MONTHS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

const REVENUE_ACCOUNTS = new Set(["1010101", "1010107"]);

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function parseDate(value) {
  if (!value) return null;
  const text = String(value).trim();
  const br = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) {
    const date = new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const iso = new Date(text);
  return Number.isNaN(iso.getTime()) ? null : iso;
}

function toNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value === null || value === undefined || value === "") return 0;
  const raw = String(value).trim().replace(/R\$\s?/g, "").replace(/\s/g, "");
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;
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

function isRealizedStatus(status) {
  const value = normalizeText(status);
  return value.includes("REALIZADO") || value.includes("RECEBIDO") || value.includes("EFETIVADO");
}

function isForecastStatus(status) {
  const value = normalizeText(status);
  return value.includes("A REALIZAR") || value.includes("A RECEBER") || value.includes("PREVISTO");
}

function buildNotes(rows) {
  const groups = new Map();

  rows.forEach((row, index) => {
    if (normalizeText(row.natureza) !== "ENTRADA") return;
    const account = String(row.contaCodigo || "").replace(/\D/g, "");
    if (!REVENUE_ACCOUNTS.has(account)) return;

    const realized = isRealizedStatus(row.status);
    const forecast = isForecastStatus(row.status);
    if (!realized && !forecast) return;

    const plannedDate = parseDate(row.data);
    const actualDate = realized ? parseDate(row.dataEmissao || row.data) : null;
    if (!plannedDate && !actualDate) return;

    const reference = row.lancamento || row.documento || `linha-${index}`;
    const key = [
      reference,
      normalizeText(row.status),
      row.data || "",
      row.dataEmissao || "",
    ].join("|");

    const value = toNumber(
      row.valorFaturamentoOriginal ??
      row.valorFaturamento ??
      row.valorTotalTitulo ??
      row.valorBruto ??
      row.valor
    );

    const current = groups.get(key) || {
      id: key,
      document: row.documento || row.lancamento || "Sem número",
      launch: row.lancamento || "",
      project: row.projeto || "Sem projeto",
      status: row.status || (realized ? "Realizado" : "Previsto"),
      plannedDate,
      actualDate,
      realized,
      value: 0,
    };

    if ((!current.project || current.project === "Sem projeto") && row.projeto) {
      current.project = row.projeto;
    }
    current.value += value;
    groups.set(key, current);
  });

  return [...groups.values()];
}

function MetricCard({ icon: Icon, label, value, detail, color }) {
  return (
    <div className="card" style={{ padding: "1.1rem", minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: "var(--text-secondary)", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            {label}
          </div>
          <div style={{ color: "var(--text-main)", fontSize: "clamp(1.15rem, 2.2vw, 1.65rem)", fontWeight: 800, marginTop: "0.45rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {value}
          </div>
          <div style={{ color: "var(--text-secondary)", fontSize: "12px", marginTop: "0.3rem" }}>{detail}</div>
        </div>
        <div style={{ width: 40, height: 40, borderRadius: 10, display: "grid", placeItems: "center", color, background: `${color}18`, flexShrink: 0 }}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

export default function PrevisaoFaturamentoPage() {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("all");
  const [project, setProject] = useState("all");
  const [status, setStatus] = useState("all");

  async function loadData(force = false) {
    try {
      if (force) setRefreshing(true);
      setError("");
      const response = await fetch(force ? "/api/sync?force=true" : "/api/sync", { cache: "no-store" });
      if (!response.ok) throw new Error("Não foi possível carregar os dados financeiros.");
      const result = await response.json();
      setRows(Array.isArray(result.data) ? result.data : []);
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
        const isAllowed = normalizeText(session.user?.username) === "ADMIN";
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

  const notes = useMemo(() => buildNotes(rows), [rows]);

  const years = useMemo(() => {
    const values = new Set();
    notes.forEach((note) => {
      if (note.plannedDate) values.add(note.plannedDate.getFullYear());
      if (note.actualDate) values.add(note.actualDate.getFullYear());
    });
    return [...values].sort((a, b) => b - a);
  }, [notes]);

  useEffect(() => {
    if (!year && years.length) {
      const current = new Date().getFullYear();
      setYear(String(years.includes(current) ? current : years[0]));
    }
  }, [year, years]);

  const projects = useMemo(
    () => [...new Set(notes.map((note) => note.project))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [notes]
  );

  const selectedYear = Number(year);

  const noteMatchesScope = (note) => {
    const plannedMatches = note.plannedDate?.getFullYear() === selectedYear &&
      (month === "all" || note.plannedDate.getMonth() === Number(month));
    const actualMatches = note.actualDate?.getFullYear() === selectedYear &&
      (month === "all" || note.actualDate.getMonth() === Number(month));
    return plannedMatches || actualMatches;
  };

  const scopedNotes = useMemo(
    () => notes.filter((note) => {
      if (!noteMatchesScope(note)) return false;
      if (project !== "all" && note.project !== project) return false;
      if (status === "realized" && !note.realized) return false;
      if (status === "pending" && note.realized) return false;
      return true;
    }),
    [notes, selectedYear, month, project, status]
  );

  const monthlyData = useMemo(() => MONTHS.map((name, monthIndex) => {
    const relevant = notes.filter((note) => project === "all" || note.project === project);
    const forecast = relevant
      .filter((note) => note.plannedDate?.getFullYear() === selectedYear && note.plannedDate.getMonth() === monthIndex)
      .reduce((sum, note) => sum + note.value, 0);
    const realized = relevant
      .filter((note) => note.realized && note.actualDate?.getFullYear() === selectedYear && note.actualDate.getMonth() === monthIndex)
      .reduce((sum, note) => sum + note.value, 0);
    return {
      name,
      "Meta prevista": forecast,
      Faturado: realized,
      "% atingido": forecast > 0 ? Number(((realized / forecast) * 100).toFixed(1)) : (realized > 0 ? 100 : 0),
    };
  }), [notes, project, selectedYear]);

  const periodData = useMemo(() => {
    const indexes = month === "all" ? monthlyData.map((_, index) => index) : [Number(month)];
    const forecast = indexes.reduce((sum, index) => sum + monthlyData[index]["Meta prevista"], 0);
    const realized = indexes.reduce((sum, index) => sum + monthlyData[index].Faturado, 0);
    const pendingNotes = scopedNotes.filter((note) => !note.realized).length;
    return {
      forecast,
      realized,
      balance: Math.max(forecast - realized, 0),
      percent: forecast > 0 ? (realized / forecast) * 100 : (realized > 0 ? 100 : 0),
      pendingNotes,
    };
  }, [monthlyData, month, scopedNotes]);

  const projectSummary = useMemo(() => {
    const selectedMonth = month === "all" ? null : Number(month);
    return projects
      .filter((name) => project === "all" || name === project)
      .map((name) => {
        const projectNotes = notes.filter((note) => note.project === name);
        const forecast = projectNotes
          .filter((note) => note.plannedDate?.getFullYear() === selectedYear && (selectedMonth === null || note.plannedDate.getMonth() === selectedMonth))
          .reduce((sum, note) => sum + note.value, 0);
        const realized = projectNotes
          .filter((note) => note.realized && note.actualDate?.getFullYear() === selectedYear && (selectedMonth === null || note.actualDate.getMonth() === selectedMonth))
          .reduce((sum, note) => sum + note.value, 0);
        const pending = projectNotes.filter((note) =>
          !note.realized &&
          note.plannedDate?.getFullYear() === selectedYear &&
          (selectedMonth === null || note.plannedDate.getMonth() === selectedMonth)
        ).length;
        return {
          name,
          forecast,
          realized,
          pending,
          percent: forecast > 0 ? (realized / forecast) * 100 : (realized > 0 ? 100 : 0),
        };
      })
      .filter((item) => item.forecast || item.realized || item.pending)
      .sort((a, b) => b.forecast - a.forecast);
  }, [notes, projects, project, selectedYear, month]);

  if (!authorized || loading) {
    return (
      <main style={{ minHeight: "70vh", display: "grid", placeItems: "center", color: "var(--text-secondary)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
          <RefreshCw size={18} className="spin" /> Carregando previsão de faturamento...
        </div>
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
    padding: "0.8rem",
    color: "var(--text-secondary)",
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    textAlign: "left",
    borderBottom: "1px solid var(--border-color)",
    whiteSpace: "nowrap",
  };

  const tdStyle = {
    padding: "0.8rem",
    borderBottom: "1px solid var(--border-color)",
    color: "var(--text-main)",
    fontSize: "13px",
  };

  return (
    <main style={{ padding: "clamp(1rem, 2.5vw, 2rem)", maxWidth: 1600, width: "100%", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
            <h1 style={{ color: "var(--text-main)", fontSize: "clamp(1.35rem, 3vw, 2rem)", margin: 0 }}>Previsão de Faturamento</h1>
            <span style={{ background: "rgba(57,198,198,0.12)", color: "var(--primary)", border: "1px solid rgba(57,198,198,0.25)", borderRadius: 999, padding: "0.25rem 0.55rem", fontSize: 11, fontWeight: 800 }}>
              VISÃO ADMIN
            </span>
          </div>
          <p style={{ color: "var(--text-secondary)", margin: "0.45rem 0 0" }}>
            Acompanhamento mensal da meta prevista versus o faturamento realizado por nota e projeto.
          </p>
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
          <label style={{ color: "var(--text-secondary)", fontSize: 12 }}>Ano
            <select value={year} onChange={(event) => setYear(event.target.value)} style={{ ...selectStyle, marginTop: 5 }}>
              {years.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label style={{ color: "var(--text-secondary)", fontSize: 12 }}>Mês
            <select value={month} onChange={(event) => setMonth(event.target.value)} style={{ ...selectStyle, marginTop: 5 }}>
              <option value="all">Todos os meses</option>
              {MONTHS.map((name, index) => <option key={name} value={index}>{name}</option>)}
            </select>
          </label>
          <label style={{ color: "var(--text-secondary)", fontSize: 12 }}>Projeto
            <select value={project} onChange={(event) => setProject(event.target.value)} style={{ ...selectStyle, marginTop: 5 }}>
              <option value="all">Todos os projetos</option>
              {projects.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <label style={{ color: "var(--text-secondary)", fontSize: 12 }}>Situação da nota
            <select value={status} onChange={(event) => setStatus(event.target.value)} style={{ ...selectStyle, marginTop: 5 }}>
              <option value="all">Todas</option>
              <option value="pending">Previstas</option>
              <option value="realized">Faturadas</option>
            </select>
          </label>
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "0.9rem", marginBottom: "1rem" }}>
        <MetricCard icon={Target} label="Meta prevista" value={money(periodData.forecast)} detail="Notas previstas no período" color="var(--primary)" />
        <MetricCard icon={CircleDollarSign} label="Faturado" value={money(periodData.realized)} detail="Notas realizadas no período" color="var(--success)" />
        <MetricCard icon={Clock3} label="Saldo da meta" value={money(periodData.balance)} detail="Valor ainda não atingido" color="var(--warning)" />
        <MetricCard icon={TrendingUp} label="% atingido" value={`${periodData.percent.toFixed(1)}%`} detail="Faturado ÷ meta prevista" color={periodData.percent >= 100 ? "var(--success)" : "var(--primary)"} />
        <MetricCard icon={FileText} label="Notas pendentes" value={periodData.pendingNotes} detail="Ainda previstas no período" color="var(--danger)" />
      </section>

      <section className="card" style={{ padding: "1rem", marginBottom: "1rem" }}>
        <div style={{ marginBottom: "0.8rem" }}>
          <h2 style={{ margin: 0, color: "var(--text-main)", fontSize: "1rem" }}>Evolução mensal — {year}</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: 12, margin: "0.25rem 0 0" }}>Meta prevista x faturado e percentual atingido.</p>
        </div>
        <div style={{ width: "100%", height: 360 }}>
          <ResponsiveContainer>
            <ComposedChart data={monthlyData} margin={{ top: 15, right: 16, bottom: 0, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} />
              <YAxis yAxisId="money" stroke="var(--text-secondary)" fontSize={11} tickFormatter={(value) => `${Math.round(value / 1000)}k`} />
              <YAxis yAxisId="percent" orientation="right" stroke="var(--text-secondary)" fontSize={11} tickFormatter={(value) => `${value}%`} />
              <Tooltip
                contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border-color)", borderRadius: 8 }}
                formatter={(value, name) => name === "% atingido" ? [`${Number(value).toFixed(1)}%`, name] : [money(value), name]}
              />
              <Legend />
              <Bar yAxisId="money" dataKey="Meta prevista" fill="var(--primary)" radius={[5, 5, 0, 0]} />
              <Bar yAxisId="money" dataKey="Faturado" fill="var(--success)" radius={[5, 5, 0, 0]} />
              <Line yAxisId="percent" type="monotone" dataKey="% atingido" stroke="var(--warning)" strokeWidth={3} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="card" style={{ marginBottom: "1rem", overflow: "hidden" }}>
        <div style={{ padding: "1rem 1rem 0.7rem" }}>
          <h2 style={{ margin: 0, color: "var(--text-main)", fontSize: "1rem" }}>Desempenho por projeto</h2>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
            <thead>
              <tr>
                <th style={thStyle}>Projeto</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Meta prevista</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Faturado</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Saldo</th>
                <th style={{ ...thStyle, textAlign: "center" }}>% atingido</th>
                <th style={{ ...thStyle, textAlign: "center" }}>Notas pendentes</th>
              </tr>
            </thead>
            <tbody>
              {projectSummary.map((item) => (
                <tr key={item.name}>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>{item.name}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{money(item.forecast)}</td>
                  <td style={{ ...tdStyle, textAlign: "right", color: "var(--success)", fontWeight: 700 }}>{money(item.realized)}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{money(Math.max(item.forecast - item.realized, 0))}</td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    <span style={{ color: item.percent >= 100 ? "var(--success)" : "var(--primary)", fontWeight: 800 }}>{item.percent.toFixed(1)}%</span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>{item.pending}</td>
                </tr>
              ))}
              {!projectSummary.length && (
                <tr><td colSpan={6} style={{ ...tdStyle, textAlign: "center", color: "var(--text-secondary)", padding: "2rem" }}>Nenhum projeto encontrado no período.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card" style={{ overflow: "hidden" }}>
        <div style={{ padding: "1rem 1rem 0.7rem", display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" }}>
          <div>
            <h2 style={{ margin: 0, color: "var(--text-main)", fontSize: "1rem" }}>Controle por nota</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 12, margin: "0.25rem 0 0" }}>Detalhamento das notas previstas e faturadas.</p>
          </div>
          <span style={{ color: "var(--text-secondary)", fontSize: 12 }}>{scopedNotes.length} nota(s)</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820 }}>
            <thead>
              <tr>
                <th style={thStyle}>Projeto</th>
                <th style={thStyle}>NF / Documento</th>
                <th style={thStyle}>Previsão</th>
                <th style={thStyle}>Emissão</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Valor da nota</th>
                <th style={{ ...thStyle, textAlign: "center" }}>Situação</th>
              </tr>
            </thead>
            <tbody>
              {scopedNotes
                .slice()
                .sort((a, b) => (b.actualDate || b.plannedDate || 0) - (a.actualDate || a.plannedDate || 0))
                .map((note) => (
                  <tr key={note.id}>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>{note.project}</td>
                    <td style={tdStyle}>{note.document}</td>
                    <td style={tdStyle}>{dateLabel(note.plannedDate)}</td>
                    <td style={tdStyle}>{dateLabel(note.actualDate)}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700 }}>{money(note.value)}</td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      <span style={{
                        display: "inline-flex",
                        padding: "0.3rem 0.55rem",
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 800,
                        color: note.realized ? "var(--success)" : "var(--warning)",
                        background: note.realized ? "rgba(34,197,94,0.12)" : "rgba(245,158,11,0.12)",
                      }}>
                        {note.realized ? "Faturada" : "Prevista"}
                      </span>
                    </td>
                  </tr>
                ))}
              {!scopedNotes.length && (
                <tr><td colSpan={6} style={{ ...tdStyle, textAlign: "center", color: "var(--text-secondary)", padding: "2rem" }}>Nenhuma nota encontrada com os filtros selecionados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
