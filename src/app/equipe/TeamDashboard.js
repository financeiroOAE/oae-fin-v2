'use client';

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar
} from 'recharts';
import './management.css';
import './managementExtras.css';

const brl = (n) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n) || 0);
const compact = (n) => new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(n) || 0);
const monthLabel = (value) => new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' }).format(new Date(`${value}-01T12:00:00Z`));
const norm = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
const getMonth = (raw) => {
  const value = String(raw || '');
  const iso = value.match(/^(\d{4})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2,'0')}`;
  const br = value.match(/^\d{1,2}\/(\d{1,2})\/(\d{4})/);
  return br ? `${br[2]}-${br[1].padStart(2,'0')}` : '';
};

function PersonDrawer({ person, onClose }) {
  if (!person) return null;
  const months = Array.from({ length: 12 }, (_, i) => {
    const key = `2026-${String(i + 1).padStart(2, '0')}`;
    const rows = person.transactions.filter((row) => getMonth(row.data) === key);
    return {
      month: monthLabel(key),
      Pago: rows.filter((row) => row.paid).reduce((sum, row) => sum + Number(row.valor || 0), 0),
      'A pagar': rows.filter((row) => !row.paid).reduce((sum, row) => sum + Number(row.valor || 0), 0),
    };
  });

  const paid = person.transactions.filter((row) => row.paid).reduce((sum, row) => sum + Number(row.valor || 0), 0);
  const open = person.transactions.filter((row) => !row.paid).reduce((sum, row) => sum + Number(row.valor || 0), 0);

  return <div className="mgmt-overlay" onMouseDown={onClose}>
    <div className="mgmt-drawer mgmt-drawer-wide" onMouseDown={(e)=>e.stopPropagation()}>
      <div className="mgmt-panel-head">
        <div><span className="mgmt-eyebrow">FICHA FINANCEIRA · 2026</span><h2>{person.name}</h2><p>{person.roles.join(' · ') || 'Sem função informada'} · {person.departments.join(' · ')}</p></div>
        <button className="btn" onClick={onClose}><X size={16}/> Fechar</button>
      </div>

      <div className="mgmt-kpis">
        <div><span>Pago em 2026</span><strong>{brl(paid)}</strong></div>
        <div><span>A pagar</span><strong>{brl(open)}</strong></div>
        <div><span>Total financeiro</span><strong>{brl(paid + open)}</strong></div>
        <div><span>Projetos / vínculos</span><strong>{person.projects.length}</strong></div>
      </div>

      <section className="mgmt-subcard">
        <h3>Evolução mensal</h3>
        <div style={{ width:'100%', height:280 }}>
          <ResponsiveContainer>
            <LineChart data={months} margin={{ top:10, right:20, bottom:0, left:10 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.18}/>
              <XAxis dataKey="month" tick={{ fontSize:11 }}/>
              <YAxis tickFormatter={compact} tick={{ fontSize:11 }}/>
              <Tooltip formatter={(value)=>brl(value)}/>
              <Legend/>
              <Line type="monotone" dataKey="Pago" strokeWidth={2.5} dot={{ r:3 }}/>
              <Line type="monotone" dataKey="A pagar" strokeWidth={2.5} dot={{ r:3 }}/>
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="mgmt-subcard" style={{ marginTop:14 }}>
        <h3>Relação de pagamentos e valores em aberto</h3>
        <div className="mgmt-table-wrap">
          <table className="mgmt-table">
            <thead><tr><th>Data</th><th>Documento</th><th>Projeto</th><th>Conta</th><th>Situação</th><th>Valor</th></tr></thead>
            <tbody>{[...person.transactions].sort((a,b)=>String(a.data).localeCompare(String(b.data))).map((row)=>
              <tr key={row.sourceKey}>
                <td>{row.data || '—'}</td><td>{row.documento || row.titulo || '—'}</td><td>{row.projeto || '—'}</td>
                <td>{row.contaNome || row.contaCodigo || '—'}</td>
                <td><span className={row.paid ? 'mgmt-pill paid' : 'mgmt-pill open'}>{row.paid ? 'Pago' : 'A pagar'}</span></td>
                <td><strong>{brl(row.valor)}</strong></td>
              </tr>)}
            </tbody>
          </table>
        </div>
        {!person.transactions.length && <p>Sem lançamentos vinculados no CP_GERAL em 2026.</p>}
      </section>
    </div>
  </div>;
}

export default function TeamDashboard() {
  const [data, setData] = useState({ entries: [], monthly: [] });
  const [month, setMonth] = useState('');
  const [personFilter, setPersonFilter] = useState('');
  const [department, setDepartment] = useState('');
  const [project, setProject] = useState('');
  const [status, setStatus] = useState('');
  const [selectedPerson, setSelectedPerson] = useState(null);
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
    if (personFilter && entry.person !== personFilter) return false;
    if (department && entry.department !== department) return false;
    if (project && !(entry.project === project || (entry.projects || []).includes(project))) return false;
    if (status === 'PAGO' && !(entry.transactions || []).some((row) => row.paid)) return false;
    if (status === 'ABERTO' && !(entry.transactions || []).some((row) => !row.paid)) return false;
    return true;
  }), [data.entries, personFilter, department, project, status]);

  const filteredTransactions = useMemo(() => {
    const map = new Map();
    filteredEntries.forEach((entry) => (entry.transactions || []).forEach((row) => {
      if (month && getMonth(row.data) !== month) return;
      map.set(row.sourceKey, { ...row, rosterPerson: entry.person });
    }));
    return [...map.values()];
  }, [filteredEntries, month]);

  const paid = filteredTransactions.filter((r) => r.paid).reduce((s,r)=>s+Number(r.valor||0),0);
  const open = filteredTransactions.filter((r) => !r.paid).reduce((s,r)=>s+Number(r.valor||0),0);

  const peopleRoster = useMemo(() => {
    const map = new Map();
    filteredEntries.forEach((entry) => {
      const key = norm(entry.person);
      const item = map.get(key) || {
        key, name: entry.person, departments: new Set(), roles: new Set(), projects: new Set(),
        contractValues: [], thirdParty: false, fixedMonthly: false, transactions: new Map(),
      };
      if (entry.departmentProject) item.departments.add(entry.departmentProject);
      if (entry.role) item.roles.add(entry.role);
      (entry.project ? [entry.project] : entry.projects || []).filter(Boolean).forEach((p)=>item.projects.add(p));
      if (!entry.fixedMonthly && Number(entry.contractValue || 0) > 0) item.contractValues.push(Number(entry.contractValue));
      item.thirdParty ||= Boolean(entry.thirdParty);
      item.fixedMonthly ||= Boolean(entry.fixedMonthly);
      (entry.transactions || []).forEach((row)=>item.transactions.set(row.sourceKey,row));
      map.set(key,item);
    });
    return [...map.values()].map((item)=>({
      ...item,
      departments:[...item.departments],
      roles:[...item.roles],
      projects:[...item.projects],
      transactions:[...item.transactions.values()],
      referenceValue:item.contractValues.reduce((sum,v)=>sum+v,0),
    })).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
  }, [filteredEntries]);

  const projectRows = useMemo(() => {
    const map = new Map();
    filteredEntries.forEach((entry) => {
      const list = entry.project ? [entry.project] : (entry.projects || []);
      list.forEach((name) => {
        if (!name) return;
        const item = map.get(name) || { name, people: new Set(), paid: 0, open: 0 };
        item.people.add(entry.person);
        (entry.transactions || []).filter((row) => norm(row.projeto) === norm(name)).forEach((row) => {
          if (month && getMonth(row.data) !== month) return;
          item[row.paid ? 'paid' : 'open'] += Number(row.valor || 0);
        });
        map.set(name, item);
      });
    });
    return [...map.values()].map((p)=>({...p, peopleCount:p.people.size, total:p.paid+p.open})).sort((a,b)=>b.total-a.total);
  }, [filteredEntries, month]);

  const evolutionData = useMemo(() => Array.from({length:12},(_,i)=>{
    const key=`2026-${String(i+1).padStart(2,'0')}`;
    const map=new Map();
    filteredEntries.forEach((entry)=>(entry.transactions||[]).forEach((row)=>{
      if(getMonth(row.data)===key) map.set(row.sourceKey,row);
    }));
    const rows=[...map.values()];
    return {
      month:monthLabel(key),
      Pago:rows.filter((row)=>row.paid).reduce((s,row)=>s+Number(row.valor||0),0),
      'A pagar':rows.filter((row)=>!row.paid).reduce((s,row)=>s+Number(row.valor||0),0),
    };
  }), [filteredEntries]);

  const projectChart = projectRows.slice(0,10).map((p)=>({ projeto:p.name, Pago:p.paid, 'A pagar':p.open }));

  return <div className="mgmt">
    <header className="mgmt-header">
      <div><span className="mgmt-eyebrow">EQUIPE · EXERCÍCIO 2026</span><h1>Equipe</h1><p>Visão de cadastro, pagamentos, pendências e distribuição do custo de equipe por obra.</p></div>
    </header>
    {error && <div className="mgmt-alert">{error}</div>}

    <section className="mgmt-panel"><div className="mgmt-filter-grid">
      <label>Mês<select value={month} onChange={(e)=>setMonth(e.target.value)}><option value="">Todos · 2026</option>{Array.from({length:12},(_,i)=>{const m=`2026-${String(i+1).padStart(2,'0')}`;return <option key={m} value={m}>{monthLabel(m)}</option>})}</select></label>
      <label>Pessoa<select value={personFilter} onChange={(e)=>setPersonFilter(e.target.value)}><option value="">Todas</option>{people.map((x)=><option key={x}>{x}</option>)}</select></label>
      <label>Departamento<select value={department} onChange={(e)=>setDepartment(e.target.value)}><option value="">Todos</option>{departments.map((x)=><option key={x}>{x}</option>)}</select></label>
      <label>Projeto<select value={project} onChange={(e)=>setProject(e.target.value)}><option value="">Todos</option>{projects.map((x)=><option key={x}>{x}</option>)}</select></label>
      <label>Situação<select value={status} onChange={(e)=>setStatus(e.target.value)}><option value="">Todas</option><option value="PAGO">Pago</option><option value="ABERTO">A pagar</option></select></label>
    </div></section>

    <div className="mgmt-kpis mgmt-kpis-six">
      <div><span>Custo no período</span><strong>{brl(paid+open)}</strong></div>
      <div><span>Pago</span><strong>{brl(paid)}</strong></div>
      <div><span>A pagar</span><strong>{brl(open)}</strong></div>
      <div><span>Pessoas / empresas</span><strong>{peopleRoster.length}</strong></div>
      <div><span>Terceiros</span><strong>{peopleRoster.filter((e)=>e.thirdParty).length}</strong></div>
      <div><span>Obras com equipe</span><strong>{projectRows.length}</strong></div>
    </div>

    <div className="mgmt-flow mgmt-flow-balanced">
      <section className="mgmt-panel">
        <h2>Evolução mensal da equipe</h2><p>Pago e a pagar de janeiro a dezembro de 2026.</p>
        <div className="mgmt-chart"><ResponsiveContainer>
          <LineChart data={evolutionData} margin={{top:10,right:18,left:5,bottom:0}}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.18}/>
            <XAxis dataKey="month" tick={{fontSize:11}}/><YAxis tickFormatter={compact} tick={{fontSize:11}}/>
            <Tooltip formatter={(v)=>brl(v)}/><Legend/>
            <Line type="monotone" dataKey="Pago" strokeWidth={2.5} dot={{r:3}}/>
            <Line type="monotone" dataKey="A pagar" strokeWidth={2.5} dot={{r:3}}/>
          </LineChart>
        </ResponsiveContainer></div>
      </section>

      <section className="mgmt-panel">
        <h2>Obras com maior gasto de equipe</h2><p>Top 10 por custo total no período selecionado.</p>
        <div className="mgmt-chart"><ResponsiveContainer>
          <BarChart data={projectChart} layout="vertical" margin={{top:5,right:15,left:20,bottom:0}}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.14}/>
            <XAxis type="number" tickFormatter={compact} tick={{fontSize:10}}/>
            <YAxis type="category" dataKey="projeto" width={150} tick={{fontSize:9}}/>
            <Tooltip formatter={(v)=>brl(v)}/><Legend/>
            <Bar dataKey="Pago" stackId="team"/>
            <Bar dataKey="A pagar" stackId="team"/>
          </BarChart>
        </ResponsiveContainer></div>
      </section>
    </div>

    <section className="mgmt-panel">
      <div className="mgmt-panel-head"><div><h2>Cadastro da equipe</h2><p>Clique em uma pessoa ou empresa para abrir a ficha financeira de 2026.</p></div></div>
      <div className="mgmt-table-wrap"><table className="mgmt-table mgmt-clickable-table"><thead><tr><th>Pessoa / empresa</th><th>Departamento / atuação</th><th>Cargo / função</th><th>Tipo</th><th>Valor de referência</th><th>Projetos</th><th>Pago</th><th>A pagar</th></tr></thead><tbody>
        {peopleRoster.map((item)=>{
          const tx = item.transactions.filter((r)=>!month||getMonth(r.data)===month);
          const rowPaid=tx.filter((r)=>r.paid).reduce((s,r)=>s+Number(r.valor||0),0);
          const rowOpen=tx.filter((r)=>!r.paid).reduce((s,r)=>s+Number(r.valor||0),0);
          return <tr key={item.key} onClick={()=>setSelectedPerson(item)}>
            <td><strong>{item.name}</strong></td><td>{item.departments.join(' · ') || '—'}</td><td>{item.roles.join(' · ') || '—'}</td>
            <td>{item.thirdParty ? 'Terceiro' : item.fixedMonthly ? 'Mensal / fixo' : 'Equipe'}</td>
            <td>{item.fixedMonthly && !item.referenceValue ? 'Mensal / fixo' : brl(item.referenceValue)}</td><td>{item.projects.length}</td>
            <td className="mgmt-value-paid">{brl(rowPaid)}</td><td className="mgmt-value-open">{brl(rowOpen)}</td>
          </tr>})}
      </tbody></table></div>
    </section>

    <section className="mgmt-panel">
      <h2>Equipe por projeto</h2>
      <div className="mgmt-table-wrap"><table className="mgmt-table"><thead><tr><th>Projeto</th><th>Pessoas / terceiros</th><th>Pago</th><th>A pagar</th><th>Total</th></tr></thead><tbody>
        {projectRows.map((p)=><tr key={p.name}><td><strong>{p.name}</strong></td><td>{p.peopleCount}</td><td className="mgmt-value-paid">{brl(p.paid)}</td><td className="mgmt-value-open">{brl(p.open)}</td><td><strong>{brl(p.total)}</strong></td></tr>)}
      </tbody></table></div>{!projectRows.length&&<p>Sem projetos para os filtros selecionados.</p>}
    </section>

    <PersonDrawer person={selectedPerson} onClose={()=>setSelectedPerson(null)}/>
  </div>;
}
