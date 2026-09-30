'use client';

import { useEffect, useState } from 'react';
import '../equipe/management.css';

const brl = (n) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n) || 0);

export default function BillingDashboard() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [data, setData] = useState({ rows: [], review: [], expenses: 0 });
  const [selected, setSelected] = useState('');
  const [goals, setGoals] = useState({});
  const [scenario, setScenario] = useState(0);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  async function reload(value = month) {
    const response = await fetch(`/api/previsao-faturamento?month=${encodeURIComponent(value)}`, { cache: 'no-store' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    setData(result);
    setGoals(Object.fromEntries(result.rows.map((row) => [row.project, String(row.target ?? (row.imported + row.actual))])));
  }
  useEffect(() => { let active = true; fetch(`/api/previsao-faturamento?month=${month}`, { cache: 'no-store' }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error); if (active) { setData(d); setGoals(Object.fromEntries(d.rows.map((row) => [row.project, String(row.target ?? (row.imported + row.actual))]))); } }).catch((err) => { if (active) setError(err.message); }); return () => { active = false; }; }, [month]);

  const rows = data.rows.filter((row) => row.target !== null || row.imported > 0 || row.actual > 0);
  const project = data.rows.find((row) => row.project === selected) || rows[0];
  const goal = rows.reduce((sum, row) => sum + Number(row.target ?? (row.imported + row.actual)), 0);
  const actual = rows.reduce((sum, row) => sum + row.actual, 0);
  const imported = rows.reduce((sum, row) => sum + row.imported, 0);
  const scenarioMax = Math.max(0, goal - actual);
  const chartRows = rows.slice().sort((a, b) => Number(b.target ?? (b.imported + b.actual)) - Number(a.target ?? (a.imported + a.actual))).slice(0, 8);

  async function saveTarget(row) {
    setError(''); setMessage(''); setSaving(true);
    try {
      const response = await fetch('/api/previsao-faturamento', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ month, project: row.project, amount: goals[row.project] }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      await reload(); setMessage(`Meta de ${row.project} registrada para ${month}.`);
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }

  return <div className="mgmt"><header className="mgmt-header"><div><span className="mgmt-eyebrow">CONTRATO · META · NOTAS</span><h1>Previsão de faturamento</h1><p>Os títulos previstos do CR entram por projeto. Registre a meta do mês e compare com as NF realizadas.</p></div><label>Mês<input type="month" value={month} onChange={(e) => { setMonth(e.target.value); setSelected(''); setScenario(0); setError(''); }} /></label></header>
    {error && <div className="mgmt-alert">{error}</div>}{message && <div className="mgmt-alert good">{message}</div>}
    <div className="mgmt-kpis"><div><span>Meta registrada / previsão atual</span><strong>{brl(goal)}</strong></div><div><span>NF conferidas no mês</span><strong>{brl(actual)}</strong></div><div><span>Diferença para a meta</span><strong>{brl(goal - actual)}</strong></div><div><span>Títulos ainda previstos no CR</span><strong>{brl(imported)}</strong></div></div>
    <section className="mgmt-panel"><h2>Por projeto</h2><p>Meta registrada permanece fixa. Sem meta, a previsão atual do CR aparece como proposta para conferência.</p><div className="mgmt-table-wrap"><table className="mgmt-table"><thead><tr><th>Obra</th><th>Contrato</th><th>NF acumuladas</th><th>Saldo contratual</th><th>Meta mês</th><th>NF mês</th><th>Diferença</th></tr></thead><tbody>{rows.map((row) => <tr key={row.project} onClick={() => setSelected(row.project)} style={{ cursor: 'pointer', background: project?.project === row.project ? 'var(--bg-card-hover)' : undefined }}><td><strong>{row.project}</strong></td><td>{brl(row.contract)}</td><td>{brl(row.billed)}</td><td>{brl(row.balance)}</td><td>{brl(row.target ?? (row.imported + row.actual))}{row.target === null && ' · proposta'}</td><td>{brl(row.actual)}</td><td>{brl(Number(row.target ?? (row.imported + row.actual)) - row.actual)}</td></tr>)}</tbody></table></div>{!rows.length && <p>Nenhum título de faturamento encontrado para este mês.</p>}</section>
    <div className="mgmt-flow"><section className="mgmt-panel"><h2>Meta x realizado por obra</h2><p>O gráfico usa os projetos com valor neste mês.</p>{chartRows.map((row) => { const base = Math.max(1, Number(row.target ?? (row.imported + row.actual))); return <div key={row.project} style={{ marginTop: 18 }}><div className="mgmt-line"><span>{row.project}</span><b>{brl(row.actual)} / {brl(base)}</b></div><div className="mgmt-meter"><i style={{ width: `${Math.min(100, row.actual / base * 100)}%` }} /></div></div>; })}</section>
    <section className="mgmt-panel"><h2>{project?.project || 'Selecione um projeto'}</h2>{project && <><p>Contrato {brl(project.contract)} · faturado acumulado {brl(project.billed)} · saldo {brl(project.balance)}.</p><div className="mgmt-kpis" style={{ gridTemplateColumns: 'repeat(2,minmax(0,1fr))' }}><div><span>Meta do mês</span><strong>{brl(project.target ?? (project.imported + project.actual))}</strong></div><div><span>Realizado</span><strong>{brl(project.actual)}</strong></div></div>{project.target === null ? <div className="mgmt-inline"><input aria-label="Valor da meta" type="number" min="0" max={project.balance + project.actual} step="0.01" value={goals[project.project] ?? ''} onChange={(e) => setGoals({ ...goals, [project.project]: e.target.value })} /><button className="btn btn-primary" disabled={saving} onClick={() => saveTarget(project)}>Registrar meta</button></div> : <p>Meta registrada. O valor original permanece para comparar no encerramento.</p>}<h3 style={{ fontSize: 13, marginTop: 16 }}>Títulos identificados</h3>{project.titles.map((title) => <div className="mgmt-line" key={title.key}><span>{title.document || 'Título'} · {title.forecast ? 'Previsto' : 'NF realizada'} {title.review && '· conferir data/projeto'}</span><b>{brl(title.value)}</b></div>)}</>}</section></div>
    <section className="mgmt-panel"><h2>Simular faturamento do mês</h2><p>Escolha quanto da meta restante pode virar NF. Esta simulação não altera a meta ou os títulos.</p><div className="mgmt-inline"><input aria-label="Valor a faturar na simulação" type="range" min="0" max={scenarioMax} step="1000" value={Math.min(Number(scenario), scenarioMax)} onChange={(e) => setScenario(Number(e.target.value))} /><strong>{brl(scenario)}</strong></div><div className="mgmt-line"><span>NF realizadas + cenário</span><b>{brl(actual + Number(scenario))}</b></div><div className="mgmt-line"><span>Saídas pagas e previstas no CP do mês</span><b>{brl(data.expenses)}</b></div><div className="mgmt-line"><span>Diferença gerencial simulada</span><b>{brl(actual + Number(scenario) - data.expenses)}</b></div><p>Comparação simples de faturamento com saídas do período. Recebimento em caixa e DRE continuam com regras próprias na Visão Financeira.</p></section>
    {data.review.length > 0 && <section className="mgmt-panel"><h2>Conferir na base · {data.review.length} título(s)</h2><p>Esses títulos não entram no realizado por obra enquanto o projeto ou a data da nota não estiverem confiáveis.</p>{data.review.slice(0, 30).map((title) => <div className="mgmt-line" key={title.key}><span>{title.document || 'Título'} · {title.project || 'Projeto indefinido'} · {title.dateSource === 'DATA' ? 'data da nota pendente' : 'projeto a conferir'}</span><b>{brl(title.value)}</b></div>)}</section>}
  </div>;
}
