'use client';

import { useEffect, useMemo, useState } from 'react';
import './management.css';
import './managementExtras.css';

const brl = (n) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n) || 0);
const monthLabel = (value) => new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' }).format(new Date(`${value}-01T12:00:00Z`));
const norm = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();

export default function TeamDashboard() {
  const [data, setData] = useState({ entries: [], monthly: [] });
  const [month, setMonth] = useState('');
  const [person, setPerson] = useState('');
  const [department, setDepartment] = useState('');
  const [project, setProject] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/equipe', { cache: 'no-store' }).then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível carregar a equipe.');
      if (active) setData(result);
    }).catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, []);

  const departments = useMemo(() => [...new Set(data.entries.map((e) => e.department).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR')), [data.entries]);
  const projects = useMemo(() => [...new Set(data.entries.flatMap((e) => e.project ? [e.project] : e.projects || []).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR')), [data.entries]);
  const people = useMemo(() => [...new Set(data.entries.map((e) => e.person).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR')), [data.entries]);

  const filteredEntries = useMemo(() => data.entries.filter((entry) => {
    if (person && entry.person !== person) return false;
    if (department && entry.department !== department) return false;
    if (project && !(entry.project === project || (entry.projects || []).includes(project))) return false;
    if (month) {
      const has = (entry.transactions || []).some((row) => String(row.data || '').includes(`/${month.slice(5)}/2026`) || String(row.data || '').startsWith(month));
      if (!has && entry.fixedMonthly === false) return false;
    }
    if (status === 'PAGO' && !(entry.transactions || []).some((row) => row.paid)) return false;
    if (status === 'ABERTO' && !(entry.transactions || []).some((row) => !row.paid)) return false;
    return true;
  }), [data.entries, month, person, department, project, status]);

  const filteredTransactions = useMemo(() => {
    const map = new Map();
    filteredEntries.forEach((entry) => (entry.transactions || []).forEach((row) => {
      const rowMonth = (() => {
        const raw = String(row.data || '');
        const br = raw.match(/^\d{1,2}\/(\d{1,2})\/(\d{4})/);
        if (br) return `${br[2]}-${br[1].padStart(2,'0')}`;
        return raw.slice(0,7);
      })();
      if (month && rowMonth !== month) return;
      map.set(row.sourceKey, { ...row, rosterPerson: entry.person, rosterDepartment: entry.department });
    }));
    return [...map.values()];
  }, [filteredEntries, month]);

  const paid = filteredTransactions.filter((r) => r.paid).reduce((s,r)=>s+Number(r.valor||0),0);
  const open = filteredTransactions.filter((r) => !r.paid).reduce((s,r)=>s+Number(r.valor||0),0);
  const entryPeriodTotals = (entry) => {
    if (!month) return { paid: entry.paid, open: entry.open, total: entry.total };
    const rows = (entry.transactions || []).filter((row) => {
      const raw = String(row.data || '');
      const br = raw.match(/^\d{1,2}\/(\d{1,2})\/(\d{4})/);
      const rowMonth = br ? `${br[2]}-${br[1].padStart(2,'0')}` : raw.slice(0,7);
      return rowMonth === month;
    });
    const rowPaid = rows.filter((row)=>row.paid).reduce((sum,row)=>sum+Number(row.valor||0),0);
    const rowOpen = rows.filter((row)=>!row.paid).reduce((sum,row)=>sum+Number(row.valor||0),0);
    return { paid: rowPaid, open: rowOpen, total: rowPaid + rowOpen };
  };
  const uniquePeople = new Set(filteredEntries.map((e)=>norm(e.person))).size;
  const thirdParties = new Set(filteredEntries.filter((e)=>e.thirdParty).map((e)=>norm(e.person))).size;
  const uniqueProjects = new Set(filteredEntries.flatMap((e)=>e.project ? [e.project] : e.projects || []).filter(Boolean)).size;

  const monthly = data.monthly || [];
  const maxMonthly = Math.max(1, ...monthly.map((m)=>m.paid+m.open));

  const projectRows = useMemo(() => {
    const map = new Map();
    filteredEntries.forEach((entry) => {
      const list = entry.project ? [entry.project] : (entry.projects || []);
      list.forEach((name) => {
        if (!name) return;
        const item = map.get(name) || { name, people: new Set(), paid: 0, open: 0 };
        item.people.add(entry.person);
        (entry.transactions || []).filter((row) => norm(row.projeto) === norm(name)).forEach((row) => {
          if (month) {
            const raw = String(row.data || '');
            const br = raw.match(/^\d{1,2}\/(\d{1,2})\/(\d{4})/);
            const m = br ? `${br[2]}-${br[1].padStart(2,'0')}` : raw.slice(0,7);
            if (m !== month) return;
          }
          item[row.paid ? 'paid' : 'open'] += Number(row.valor || 0);
        });
        map.set(name, item);
      });
    });
    return [...map.values()].sort((a,b)=>(b.paid+b.open)-(a.paid+a.open));
  }, [filteredEntries, month]);

  return <div className="mgmt">
    <header className="mgmt-header">
      <div><span className="mgmt-eyebrow">EQUIPE · CP_GERAL · EXERCÍCIO 2026</span><h1>Equipe</h1><p>Cadastro da aba EQUIPE cruzado com pagamentos e pendências do CP_GERAL. Valor CT zerado é tratado como mensal/fixo.</p></div>
    </header>
    {error && <div className="mgmt-alert">{error}</div>}
    <section className="mgmt-panel">
      <div className="mgmt-filter-grid">
        <label>Mês<select value={month} onChange={(e)=>setMonth(e.target.value)}><option value="">Todos · 2026</option>{Array.from({length:12},(_,i)=>{const m=`2026-${String(i+1).padStart(2,'0')}`; return <option value={m} key={m}>{monthLabel(m)}</option>})}</select></label>
        <label>Pessoa<select value={person} onChange={(e)=>setPerson(e.target.value)}><option value="">Todas</option>{people.map((x)=><option key={x}>{x}</option>)}</select></label>
        <label>Departamento<select value={department} onChange={(e)=>setDepartment(e.target.value)}><option value="">Todos</option>{departments.map((x)=><option key={x}>{x}</option>)}</select></label>
        <label>Projeto<select value={project} onChange={(e)=>setProject(e.target.value)}><option value="">Todos</option>{projects.map((x)=><option key={x}>{x}</option>)}</select></label>
        <label>Situação<select value={status} onChange={(e)=>setStatus(e.target.value)}><option value="">Todas</option><option value="PAGO">Pago</option><option value="ABERTO">A pagar</option></select></label>
      </div>
    </section>

    <div className="mgmt-kpis mgmt-kpis-six">
      <div><span>Custo no período</span><strong>{brl(paid+open)}</strong></div>
      <div><span>Pago</span><strong>{brl(paid)}</strong></div>
      <div><span>A pagar</span><strong>{brl(open)}</strong></div>
      <div><span>Pessoas</span><strong>{uniquePeople}</strong></div>
      <div><span>Terceiros</span><strong>{thirdParties}</strong></div>
      <div><span>Projetos</span><strong>{uniqueProjects}</strong></div>
    </div>

    <div className="mgmt-flow">
      <section className="mgmt-panel"><h2>Evolução mensal · 2026</h2><p>Pago x a pagar de janeiro a dezembro.</p><div className="mgmt-bars">{monthly.map((item)=><div className="mgmt-bar-row" key={item.month}><span>{monthLabel(item.month)}</span><div className="mgmt-bar-track"><i className="mgmt-bar-paid" style={{width:`${item.paid/maxMonthly*100}%`}}/><i className="mgmt-bar-open" style={{width:`${item.open/maxMonthly*100}%`}}/></div><b>{brl(item.paid+item.open)}</b></div>)}</div></section>
      <section className="mgmt-panel"><h2>Leitura da base</h2><div className="mgmt-line"><span>Cadastros carregados</span><b>{data.entries.length}</b></div><div className="mgmt-line"><span>Mensal/fixo (Valor CT = 0)</span><b>{data.entries.filter((e)=>e.fixedMonthly).length}</b></div><div className="mgmt-line"><span>Terceiros por obra</span><b>{data.entries.filter((e)=>e.thirdParty).length}</b></div><p className="mgmt-muted">O Valor CT é referência cadastral. Pago e a pagar vêm do CP_GERAL.</p></section>
    </div>

    <section className="mgmt-panel">
      <h2>Pessoas e vínculos</h2>
      <div className="mgmt-table-wrap"><table className="mgmt-table"><thead><tr><th>Pessoa</th><th>Departamento / obra</th><th>Cargo</th><th>Tipo</th><th>Valor CT</th><th>Pago</th><th>A pagar</th><th>Total</th></tr></thead><tbody>
        {filteredEntries.map((e)=>{const period=entryPeriodTotals(e); return <tr key={e.id}><td><strong>{e.person}</strong></td><td>{e.departmentProject}</td><td>{e.role || '—'}</td><td>{e.thirdParty ? 'Terceiro' : e.fixedMonthly ? 'Mensal / fixo' : 'Equipe'}</td><td>{e.fixedMonthly ? 'Mensal / fixo' : brl(e.contractValue)}</td><td>{brl(period.paid)}</td><td>{brl(period.open)}</td><td><strong>{brl(period.total)}</strong></td></tr>})}
      </tbody></table></div>
    </section>

    <section className="mgmt-panel">
      <h2>Equipe por projeto</h2>
      <div className="mgmt-table-wrap"><table className="mgmt-table"><thead><tr><th>Projeto</th><th>Pessoas / terceiros</th><th>Pago</th><th>A pagar</th><th>Total</th></tr></thead><tbody>
        {projectRows.map((p)=><tr key={p.name}><td><strong>{p.name}</strong></td><td>{p.people.size}</td><td>{brl(p.paid)}</td><td>{brl(p.open)}</td><td><strong>{brl(p.paid+p.open)}</strong></td></tr>)}
      </tbody></table></div>{!projectRows.length && <p>Sem projetos para os filtros selecionados.</p>}
    </section>

    <section className="mgmt-panel">
      <h2>Lançamentos do CP</h2>
      <div className="mgmt-table-wrap"><table className="mgmt-table"><thead><tr><th>Data</th><th>Pessoa</th><th>Documento</th><th>Projeto</th><th>Conta</th><th>Situação</th><th>Valor</th></tr></thead><tbody>
        {filteredTransactions.sort((a,b)=>String(a.data).localeCompare(String(b.data))).map((r)=><tr key={r.sourceKey}><td>{r.data}</td><td>{r.rosterPerson}</td><td>{r.documento || r.titulo || '—'}</td><td>{r.projeto || '—'}</td><td>{r.contaNome || '—'}</td><td>{r.paid ? 'Pago' : 'A pagar'}</td><td><strong>{brl(r.valor)}</strong></td></tr>)}
      </tbody></table></div>{!filteredTransactions.length && <p>Sem lançamentos do CP para os filtros selecionados.</p>}
    </section>
  </div>;
}
