'use client';

import { useEffect, useState } from 'react';
import '../equipe/management.css';
import '../equipe/managementExtras.css';

const brl = (n) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n) || 0);

export default function BillingDashboard() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [data, setData] = useState({ rows: [], review: [], expenses: 0 });
  const [selected, setSelected] = useState('');
  const [search, setSearch] = useState('');
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

  const rows = data.rows;
  const visibleRows = rows.filter((row) => `${row.project} ${row.companies?.join(' ') || ''}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')));
  const project = rows.find((row) => row.project === selected) || visibleRows[0];
  const goal = rows.reduce((sum, row) => sum + Number(row.target ?? (row.imported + row.actual)), 0);
  const actual = rows.reduce((sum, row) => sum + row.actual, 0);
  const imported = rows.reduce((sum, row) => sum + row.imported, 0);
  const contracted = rows.reduce((sum, row) => sum + row.contract, 0);
  const billed = rows.reduce((sum, row) => sum + row.billed, 0);
  const balance = rows.reduce((sum, row) => sum + row.balance, 0);
  const unallocated = rows.reduce((sum, row) => sum + row.unallocated, 0);
  const scenarioMax = Math.max(0, goal - actual);
  const chartRows = rows.filter((row) => row.target !== null || row.imported > 0 || row.actual > 0).slice().sort((a, b) => Number(b.target ?? (b.imported + b.actual)) - Number(a.target ?? (a.imported + a.actual))).slice(0, 8);

  async function saveTarget(row) {
    setError(''); setMessage(''); setSaving(true);
    try {
      const response = await fetch('/api/previsao-faturamento', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ month, project: row.project, amount: goals[row.project] }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      await reload(); setMessage(`Meta de ${row.project} registrada para ${month}.`);
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }

  return <div className="mgmt"><header className="mgmt-header"><div><span className="mgmt-eyebrow">CARTEIRA · PREVISÃO · REALIZADO</span><h1>Previsão de faturamento</h1><p>Contratos da base por obra, saldo disponível e metas mensais. Os títulos previstos do CR aparecem como proposta para conferência.</p></div><label>Mês<input type="month" value={month} onChange={(e) => { setMonth(e.target.value); setSelected(''); setScenario(0); setError(''); }} /></label></header>
    {error && <div className="mgmt-alert">{error}</div>}{message && <div className="mgmt-alert good">{message}</div>}
    {data.dateFallbackCount > 0 && <div className="mgmt-alert good">{data.dateFallbackCount} NF(s) realizadas sem data de emissão na base foram posicionadas pela data do CR. Confira o período desses títulos.</div>}
    <div className="mgmt-kpis"><div><span>Valor dos contratos</span><strong>{brl(contracted)}</strong></div><div><span>NF faturadas acumuladas</span><strong>{brl(billed)}</strong></div><div><span>Saldo contratual</span><strong>{brl(balance)}</strong></div><div><span>Saldo sem meta futura</span><strong>{brl(unallocated)}</strong></div></div>
    <div className="mgmt-kpis"><div><span>Meta / proposta do mês</span><strong>{brl(goal)}</strong></div><div><span>NF do mês</span><strong>{brl(actual)}</strong></div><div><span>Diferença para a meta</span><strong>{brl(goal - actual)}</strong></div><div><span>Previsto no CR do mês</span><strong>{brl(imported)}</strong></div></div>
    <section className="mgmt-panel"><div className="mgmt-panel-head"><div><h2>Carteira de contratos · {rows.length} obra(s)</h2><p>Todos os contratos da base aparecem aqui, mesmo sem lançamento no mês. Selecione uma obra para distribuir o saldo na meta do período.</p></div><input className="mgmt-search" aria-label="Buscar obra ou empresa" placeholder="Buscar obra ou empresa" value={search} onChange={(e) => setSearch(e.target.value)} /></div><div className="mgmt-table-wrap"><table className="mgmt-table"><thead><tr><th>Obra / empresa</th><th>Contrato</th><th>NF acumuladas</th><th>% faturado</th><th>NF em 2026</th><th>Saldo contratual</th><th>Sem meta futura</th><th>Meta / proposta mês</th><th>NF mês</th><th>Ação</th></tr></thead><tbody>{visibleRows.map((row) => <tr key={row.key} className={project?.key === row.key ? 'mgmt-selected-row' : ''}><td><strong>{row.project}</strong><br /><small>{row.companies?.join(', ') || '—'}{row.types?.length ? ` · ${row.types.join(', ')}` : ''}</small></td><td>{brl(row.contract)}</td><td>{brl(row.billed)}</td><td>{row.contract > 0 ? `${(row.billed / row.contract * 100).toFixed(1).replace('.', ',')}%` : '—'}</td><td>{brl(row.billed2026)}</td><td><strong>{brl(row.balance)}</strong></td><td>{brl(row.unallocated)}</td><td>{brl(row.target ?? (row.imported + row.actual))}{row.target === null && (row.imported + row.actual > 0) && <small> · proposta</small>}</td><td>{brl(row.actual)}</td><td><button className="mgmt-text-button" onClick={() => setSelected(row.project)}>Alocar</button></td></tr>)}</tbody></table></div>{!visibleRows.length && <p>Nenhum contrato encontrado para a busca.</p>}</section>
    <div className="mgmt-flow"><section className="mgmt-panel"><h2>Meta x realizado por obra</h2><p>O gráfico usa os projetos com valor neste mês.</p>{chartRows.map((row) => { const base = Math.max(1, Number(row.target ?? (row.imported + row.actual))); return <div key={row.project} style={{ marginTop: 18 }}><div className="mgmt-line"><span>{row.project}</span><b>{brl(row.actual)} / {brl(base)}</b></div><div className="mgmt-meter"><i style={{ width: `${Math.min(100, row.actual / base * 100)}%` }} /></div></div>; })}</section>
    <section className="mgmt-panel"><h2>{project?.project || 'Selecione um projeto'}</h2>{project && <><p>Contrato {brl(project.contract)} · NF acumuladas {brl(project.billed)} · saldo contratual {brl(project.balance)} · sem meta futura {brl(project.unallocated)}.</p><div className="mgmt-kpis" style={{ gridTemplateColumns: 'repeat(2,minmax(0,1fr))' }}><div><span>Meta do mês</span><strong>{brl(project.target ?? (project.imported + project.actual))}</strong></div><div><span>NF realizada</span><strong>{brl(project.actual)}</strong></div></div>{project.target === null ? <div className="mgmt-inline"><input aria-label="Valor da meta" type="number" min="0" max={project.unallocated + (month === new Date().toISOString().slice(0, 7) ? project.actual : 0)} step="0.01" value={goals[project.project] ?? ''} onChange={(e) => setGoals({ ...goals, [project.project]: e.target.value })} /><button className="btn btn-primary" disabled={saving} onClick={() => saveTarget(project)}>Alocar meta em {month}</button></div> : <p>Meta registrada. O valor original permanece para comparar no encerramento.</p>}{project.schedule?.length > 0 && <><h3 style={{ fontSize: 13, marginTop: 16 }}>Metas futuras já alocadas</h3>{project.schedule.map((item) => <div className="mgmt-line" key={item.month}><span>{item.month}</span><b>{brl(item.amount)}</b></div>)}</>}<h3 style={{ fontSize: 13, marginTop: 16 }}>Títulos do mês</h3>{project.titles.map((title) => <div className="mgmt-line" key={title.key}><span>{title.document || 'Título'} · {title.forecast ? 'Previsto' : 'NF realizada'} {title.review && '· conferir projeto'} {title.realized && title.dateSource === 'DATA' && '· data do CR'}</span><b>{brl(title.value)}</b></div>)}{!project.titles.length && <p>Sem título deste projeto no período. Você pode alocar parte do saldo para este mês.</p>}</>}</section></div>
    <section className="mgmt-panel"><h2>Simular faturamento do mês</h2><p>Escolha quanto da meta restante pode virar NF. Esta simulação não altera a meta ou os títulos.</p><div className="mgmt-inline"><input aria-label="Valor a faturar na simulação" type="range" min="0" max={scenarioMax} step="1000" value={Math.min(Number(scenario), scenarioMax)} onChange={(e) => setScenario(Number(e.target.value))} /><strong>{brl(scenario)}</strong></div><div className="mgmt-line"><span>NF realizadas + cenário</span><b>{brl(actual + Number(scenario))}</b></div><div className="mgmt-line"><span>Saídas pagas e previstas no CP do mês</span><b>{brl(data.expenses)}</b></div><div className="mgmt-line"><span>Diferença gerencial simulada</span><b>{brl(actual + Number(scenario) - data.expenses)}</b></div><p>Comparação simples de faturamento com saídas do período. Recebimento em caixa e DRE continuam com regras próprias na Visão Financeira.</p></section>
    {data.review.length > 0 && <section className="mgmt-panel"><h2>Conferir projeto na base · {data.review.length} título(s)</h2><p>Esses títulos não entram no resultado por obra até identificar o projeto na base.</p>{data.review.slice(0, 30).map((title) => <div className="mgmt-line" key={title.key}><span>{title.document || 'Título'} · {title.project || 'Projeto indefinido'}</span><b>{brl(title.value)}</b></div>)}</section>}
  </div>;
}
