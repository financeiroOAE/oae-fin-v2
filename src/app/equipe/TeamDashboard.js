'use client';

import { useEffect, useMemo, useState } from 'react';
import { FileText, X } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar
} from 'recharts';
import { useReport } from '@/contexts/ReportContext';
import ReportAdder from '@/components/report/ReportAdder';
import InfoTooltip from '@/components/InfoTooltip';
import './management.css';
import './managementExtras.css';

const PAID_COLOR = '#22c55e';
const OPEN_COLOR = '#f59e0b';
const PRIMARY_COLOR = '#3b82f6';
const brl = (n) => new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format(Number(n)||0);
const compact = (n) => new Intl.NumberFormat('pt-BR', { notation:'compact', maximumFractionDigits:1 }).format(Number(n)||0);
const norm = (v) => String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
const getDateKey = (raw) => {
  const value=String(raw||'');
  let m=value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if(m) return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
  m=value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}` : '';
};
const getMonth = (raw) => getDateKey(raw).slice(0,7);
const monthLabel = (key) => new Intl.DateTimeFormat('pt-BR',{month:'short',timeZone:'UTC'}).format(new Date(`${key}-01T12:00:00Z`));
const inRange = (row,start,end) => {
  const key=getDateKey(row.data);
  if(!key) return false;
  return (!start||key>=start)&&(!end||key<=end);
};

function PersonModal({ person, onClose }) {
  if(!person) return null;
  const rows=person.transactions||[];
  const paid=rows.filter(r=>r.paid).reduce((s,r)=>s+Number(r.valor||0),0);
  const open=rows.filter(r=>!r.paid).reduce((s,r)=>s+Number(r.valor||0),0);

  const months=Array.from({length:12},(_,i)=>{
    const key=`2026-${String(i+1).padStart(2,'0')}`;
    const monthRows=rows.filter(r=>getMonth(r.data)===key);
    return {month:monthLabel(key),Pago:monthRows.filter(r=>r.paid).reduce((s,r)=>s+Number(r.valor||0),0),'A pagar':monthRows.filter(r=>!r.paid).reduce((s,r)=>s+Number(r.valor||0),0)};
  });

  const byProject=[...rows.reduce((map,row)=>{
    const key=String(row.projeto||'Sem obra').trim()||'Sem obra';
    if(norm(key)==='PROJETOS') return map;
    const item=map.get(key)||{name:key,paid:0,open:0,rows:[]};
    item[row.paid?'paid':'open']+=Number(row.valor||0);
    item.rows.push(row);
    map.set(key,item);
    return map;
  },new Map()).values()].sort((a,b)=>(b.paid+b.open)-(a.paid+a.open));

  return <div className="mgmt-overlay mgmt-overlay-center" onMouseDown={onClose}>
    <div className="mgmt-modal-center" onMouseDown={(e)=>e.stopPropagation()}>
      <div className="mgmt-panel-head">
        <div>
          <span className="mgmt-eyebrow">CADASTRO FINANCEIRO · 2026</span>
          <h2>{person.name}</h2>
          <p>{person.roles.join(' · ')||'Sem função informada'}</p>
        </div>
        <button className="btn" onClick={onClose}><X size={16}/> Fechar</button>
      </div>

      <div className="mgmt-meta-grid">
        <div><span>Tipo</span><strong>{person.thirdParty?'Terceiro':person.fixedMonthly?'Mensal / fixo':'Equipe'}</strong></div>
        <div><span>Conta / plano utilizado</span><strong>{person.accounts.length?person.accounts.join(' · '):'Não identificado'}</strong></div>
        <div><span>Projetos vinculados</span><strong>{person.projects.length}</strong></div>
        <div><span>Valor de referência</span><strong>{person.fixedMonthly&&!person.referenceValue?'Mensal / fixo':brl(person.referenceValue)}</strong></div>
      </div>

      <div className="mgmt-kpis">
        <div><span>Pago em 2026</span><strong className="mgmt-value-paid">{brl(paid)}</strong></div>
        <div><span>A pagar até dez/2026</span><strong className="mgmt-value-open">{brl(open)}</strong></div>
        <div><span>Total financeiro</span><strong>{brl(paid+open)}</strong></div>
        <div><span>Lançamentos</span><strong>{rows.length}</strong></div>
      </div>

      <section className="mgmt-subcard">
        <h3>Evolução mensal</h3>
        <div className="mgmt-chart-sm"><ResponsiveContainer>
          <LineChart data={months}><CartesianGrid strokeDasharray="3 3" opacity={0.16}/><XAxis dataKey="month" tick={{fontSize:10}}/><YAxis tickFormatter={compact} tick={{fontSize:10}}/><Tooltip formatter={(v)=>brl(v)}/><Legend/>
            <Line type="monotone" dataKey="Pago" stroke={PAID_COLOR} strokeWidth={2.6} dot={{r:3}}/>
            <Line type="monotone" dataKey="A pagar" stroke={OPEN_COLOR} strokeWidth={2.6} dot={{r:3}}/>
          </LineChart>
        </ResponsiveContainer></div>
      </section>

      <section className="mgmt-subcard" style={{marginTop:14}}>
        <h3>Resumo por obra</h3>
        <div className="mgmt-project-cards">
          {byProject.map(item=><div className="mgmt-project-card" key={item.name}>
            <strong>{item.name}</strong>
            <div><span>Pago</span><b className="mgmt-value-paid">{brl(item.paid)}</b></div>
            <div><span>A pagar</span><b className="mgmt-value-open">{brl(item.open)}</b></div>
            <small>{item.rows.length} lançamento{item.rows.length!==1?'s':''}</small>
          </div>)}
        </div>
        {!byProject.length&&<p>Sem movimentações vinculadas a obras.</p>}
      </section>

      <section className="mgmt-subcard" style={{marginTop:14}}>
        <h3>Pagamentos e valores em aberto</h3>
        <div className="mgmt-table-wrap"><table className="mgmt-table"><thead><tr><th>Data</th><th>Documento</th><th>Obra</th><th>Conta / plano</th><th>Situação</th><th>Valor</th></tr></thead><tbody>
          {[...rows].sort((a,b)=>getDateKey(b.data).localeCompare(getDateKey(a.data))).map(row=><tr key={row.sourceKey}>
            <td>{row.data||'—'}</td><td>{row.documento||row.titulo||'—'}</td><td>{row.projeto||'—'}</td><td>{row.contaNome||row.contaCodigo||'—'}</td>
            <td><span className={row.paid?'mgmt-pill paid':'mgmt-pill open'}>{row.paid?'Pago':'A pagar'}</span></td><td><strong>{brl(row.valor)}</strong></td>
          </tr>)}
        </tbody></table></div>
      </section>
    </div>
  </div>;
}

export default function TeamDashboard(){
  const {isReportMode,openReportBuilder,exitReportMode}=useReport();
  const[data,setData]=useState({entries:[],monthly:[]});
  const[startDate,setStartDate]=useState('2026-01-01');
  const[endDate,setEndDate]=useState('2026-12-31');
  const[personFilter,setPersonFilter]=useState('');
  const[project,setProject]=useState('');
  const[status,setStatus]=useState('');
  const[selectedPerson,setSelectedPerson]=useState(null);
  const[error,setError]=useState('');

  useEffect(()=>{let active=true;fetch('/api/equipe',{cache:'no-store'}).then(async r=>{const result=await r.json();if(!r.ok)throw new Error(result.error||'Não foi possível carregar a equipe.');if(active)setData(result)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[]);

  const people=useMemo(()=>[...new Set(data.entries.map(e=>e.person).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR')),[data.entries]);
  const projects=useMemo(()=>[...new Set(data.entries.flatMap(e=>e.project?[e.project]:e.projects||[]).filter(Boolean).filter(p=>norm(p)!=='PROJETOS'))].sort((a,b)=>a.localeCompare(b,'pt-BR')),[data.entries]);

  const filteredEntries=useMemo(()=>data.entries.filter(entry=>{
    if(personFilter&&entry.person!==personFilter)return false;
    if(project&&!(entry.project===project||(entry.projects||[]).includes(project)))return false;
    if(status==='PAGO'&&!(entry.transactions||[]).some(r=>r.paid&&inRange(r,startDate,endDate)))return false;
    if(status==='ABERTO'&&!(entry.transactions||[]).some(r=>!r.paid&&inRange(r,startDate,endDate)))return false;
    return true;
  }),[data.entries,personFilter,project,status,startDate,endDate]);

  const filteredTransactions=useMemo(()=>{
    const map=new Map();
    filteredEntries.forEach(entry=>(entry.transactions||[]).forEach(row=>{
      if(!inRange(row,startDate,endDate))return;
      map.set(row.sourceKey,{...row,rosterPerson:entry.person});
    }));
    return[...map.values()];
  },[filteredEntries,startDate,endDate]);

  const paid=filteredTransactions.filter(r=>r.paid).reduce((s,r)=>s+Number(r.valor||0),0);
  const open=filteredTransactions.filter(r=>!r.paid).reduce((s,r)=>s+Number(r.valor||0),0);

  const peopleRoster=useMemo(()=>{
    const map=new Map();
    filteredEntries.forEach(entry=>{
      const key=norm(entry.person);
      const item=map.get(key)||{key,name:entry.person,roles:new Set(),projects:new Set(),accounts:new Set(),contractValues:[],thirdParty:false,fixedMonthly:false,transactions:new Map()};
      if(entry.role)item.roles.add(entry.role);
      if(entry.account)item.accounts.add(entry.account);
      (entry.project?[entry.project]:entry.projects||[]).filter(Boolean).filter(p=>norm(p)!=='PROJETOS').forEach(p=>item.projects.add(p));
      if(!entry.fixedMonthly&&Number(entry.contractValue||0)>0)item.contractValues.push(Number(entry.contractValue));
      item.thirdParty ||= Boolean(entry.thirdParty);
      item.fixedMonthly ||= Boolean(entry.fixedMonthly);
      (entry.transactions||[]).forEach(row=>{if(row.contaNome||row.contaCodigo)item.accounts.add(row.contaNome||row.contaCodigo);item.transactions.set(row.sourceKey,row)});
      map.set(key,item);
    });
    return[...map.values()].map(item=>({...item,roles:[...item.roles],projects:[...item.projects],accounts:[...item.accounts],transactions:[...item.transactions.values()],referenceValue:item.contractValues.reduce((s,v)=>s+v,0)})).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
  },[filteredEntries]);

  const projectRows=useMemo(()=>{
    const map=new Map();
    filteredEntries.forEach(entry=>{
      const list=entry.project?[entry.project]:(entry.projects||[]);
      list.forEach(name=>{
        if(!name||norm(name)==='PROJETOS')return;
        const item=map.get(name)||{name,people:new Set(),paid:0,open:0};
        item.people.add(entry.person);
        (entry.transactions||[]).filter(row=>norm(row.projeto)===norm(name)&&inRange(row,startDate,endDate)).forEach(row=>{item[row.paid?'paid':'open']+=Number(row.valor||0)});
        map.set(name,item);
      });
    });
    return[...map.values()].map(p=>({...p,peopleCount:p.people.size,total:p.paid+p.open})).sort((a,b)=>b.total-a.total);
  },[filteredEntries,startDate,endDate]);

  const evolutionData=useMemo(()=>Array.from({length:12},(_,i)=>{
    const key=`2026-${String(i+1).padStart(2,'0')}`;
    const map=new Map();
    filteredEntries.forEach(entry=>(entry.transactions||[]).forEach(row=>{if(getMonth(row.data)===key&&inRange(row,startDate,endDate))map.set(row.sourceKey,row)}));
    const rows=[...map.values()];
    return{month:monthLabel(key),Pago:rows.filter(r=>r.paid).reduce((s,r)=>s+Number(r.valor||0),0),'A pagar':rows.filter(r=>!r.paid).reduce((s,r)=>s+Number(r.valor||0),0)};
  }),[filteredEntries,startDate,endDate]);

  const reportFilters={'Data inicial':startDate,'Data final':endDate,Pessoa:personFilter||'Todas',Projeto:project||'Todos',Situação:status||'Todas'};
  const projectChart=projectRows.slice(0,10).map(p=>({Projeto:p.name,Pago:p.paid,'A pagar':p.open}));
  const rosterReport=peopleRoster.map(item=>({'Pessoa / empresa':item.name,'Cargo / função':item.roles.join(' · '),'Tipo':item.thirdParty?'Terceiro':item.fixedMonthly?'Mensal / fixo':'Equipe','Valor de referência':item.referenceValue,'Projetos':item.projects.length,'Pago':item.transactions.filter(r=>r.paid&&inRange(r,startDate,endDate)).reduce((s,r)=>s+Number(r.valor||0),0),'A pagar':item.transactions.filter(r=>!r.paid&&inRange(r,startDate,endDate)).reduce((s,r)=>s+Number(r.valor||0),0)}));

  return <div className="mgmt">
    <header className="mgmt-header">
      <div><span className="mgmt-eyebrow">EQUIPE · EXERCÍCIO 2026</span><h1>Equipe</h1><p>Cadastro, pagamentos, pendências e custo de equipe por obra.</p></div>
      <button onClick={()=>isReportMode?exitReportMode():openReportBuilder('Equipe')} className={`btn ${isReportMode?'btn-primary':''}`}><FileText size={14}/>{isReportMode?'Sair do Modo Relatório':'Gerar Relatório'}</button>
    </header>
    {error&&<div className="mgmt-alert">{error}</div>}

    <section className="mgmt-panel"><div className="mgmt-filter-grid mgmt-filter-grid-team">
      <label>Data inicial<input type="date" min="2026-01-01" max="2026-12-31" value={startDate} onChange={e=>setStartDate(e.target.value)}/></label>
      <label>Data final<input type="date" min="2026-01-01" max="2026-12-31" value={endDate} onChange={e=>setEndDate(e.target.value)}/></label>
      <label>Pessoa<select value={personFilter} onChange={e=>setPersonFilter(e.target.value)}><option value="">Todas</option>{people.map(x=><option key={x}>{x}</option>)}</select></label>
      <label>Projeto<select value={project} onChange={e=>setProject(e.target.value)}><option value="">Todos</option>{projects.map(x=><option key={x}>{x}</option>)}</select></label>
      <label>Situação<select value={status} onChange={e=>setStatus(e.target.value)}><option value="">Todas</option><option value="PAGO">Pago</option><option value="ABERTO">A pagar</option></select></label>
    </div></section>

    <div className="mgmt-kpis mgmt-kpis-six">
      {[
        ['Custo no período',paid+open,'Soma de todos os pagamentos realizados e valores em aberto da equipe dentro do intervalo selecionado.'],
        ['Pago',paid,'Valores do CP_GERAL com situação realizada/paga no período.'],
        ['A pagar',open,'Valores ainda pendentes no CP_GERAL com vencimento dentro do período.'],
        ['Pessoas / empresas',peopleRoster.length,'Quantidade de pessoas ou empresas da equipe após os filtros aplicados.'],
        ['Terceiros',peopleRoster.filter(e=>e.thirdParty).length,'Quantidade de cadastros classificados como TERCEIRO na aba EQUIPE.'],
        ['Obras com equipe',projectRows.length,'Quantidade de obras com vínculo ou movimentação de equipe, excluindo o centro transitório PROJETOS.']
      ].map(([label,value,info])=><div key={label} data-report-section><div className="mgmt-kpi-title"><span>{label}</span><InfoTooltip title={label} content={info}/></div><strong>{typeof value==='number'&&label!=='Pessoas / empresas'&&label!=='Terceiros'&&label!=='Obras com equipe'?brl(value):value}</strong></div>)}
    </div>

    <div className="mgmt-flow mgmt-flow-balanced">
      <section id="report-equipe-evolucao" data-report-section className="mgmt-panel">
        <ReportAdder sectionKey="equipe:evolucao" title="Evolução mensal da Equipe" componentName="Gráfico de Evolução Mensal" page="Equipe" type="CHART" data={evolutionData} filters={reportFilters} captureId="report-equipe-evolucao" style={{float:'right'}}/>
        <h2>Evolução mensal da equipe</h2><p>Pago e a pagar de janeiro a dezembro de 2026.</p>
        <div className="mgmt-chart"><ResponsiveContainer><LineChart data={evolutionData}><CartesianGrid strokeDasharray="3 3" opacity={0.16}/><XAxis dataKey="month" tick={{fontSize:10}}/><YAxis tickFormatter={compact} tick={{fontSize:10}}/><Tooltip formatter={v=>brl(v)}/><Legend/><Line type="monotone" dataKey="Pago" stroke={PAID_COLOR} strokeWidth={2.8}/><Line type="monotone" dataKey="A pagar" stroke={OPEN_COLOR} strokeWidth={2.8}/></LineChart></ResponsiveContainer></div>
      </section>

      <section id="report-equipe-obras" data-report-section className="mgmt-panel">
        <ReportAdder sectionKey="equipe:obras-maior-gasto" title="Obras com maior gasto de equipe" componentName="Ranking de Obras" page="Equipe" type="CHART" data={projectChart} filters={reportFilters} captureId="report-equipe-obras" style={{float:'right'}}/>
        <h2>Obras com maior gasto de equipe</h2><p>Top 10 do período. O centro transitório <strong>PROJETOS</strong> é desconsiderado.</p>
        <div className="mgmt-chart"><ResponsiveContainer><BarChart data={projectChart} layout="vertical" margin={{top:5,right:15,left:20,bottom:0}}><CartesianGrid strokeDasharray="3 3" opacity={0.14}/><XAxis type="number" tickFormatter={compact} tick={{fontSize:10}}/><YAxis type="category" dataKey="Projeto" width={150} tick={{fontSize:9}}/><Tooltip formatter={v=>brl(v)}/><Legend/><Bar dataKey="Pago" stackId="team" fill={PAID_COLOR}/><Bar dataKey="A pagar" stackId="team" fill={OPEN_COLOR}/></BarChart></ResponsiveContainer></div>
      </section>
    </div>

    <section className="mgmt-panel" data-report-section>
      <ReportAdder sectionKey="equipe:cadastro" title="Cadastro da Equipe" componentName="Tabela de Cadastro da Equipe" page="Equipe" type="TABLE" data={rosterReport} filters={reportFilters} style={{float:'right'}}/>
      <div className="mgmt-panel-head"><div><h2>Cadastro da equipe</h2><p>Clique no cadastro para abrir a ficha financeira completa no centro da tela.</p></div></div>
      <div className="mgmt-table-wrap"><table className="mgmt-table mgmt-clickable-table"><thead><tr><th>Pessoa / empresa</th><th>Cargo / função</th><th>Tipo</th><th>Valor de referência</th><th>Projetos</th><th>Pago</th><th>A pagar</th></tr></thead><tbody>
        {peopleRoster.map(item=>{const rows=item.transactions.filter(r=>inRange(r,startDate,endDate));const rowPaid=rows.filter(r=>r.paid).reduce((s,r)=>s+Number(r.valor||0),0);const rowOpen=rows.filter(r=>!r.paid).reduce((s,r)=>s+Number(r.valor||0),0);return <tr key={item.key} onClick={()=>setSelectedPerson(item)}><td><strong>{item.name}</strong></td><td>{item.roles.join(' · ')||'—'}</td><td>{item.thirdParty?'Terceiro':item.fixedMonthly?'Mensal / fixo':'Equipe'}</td><td>{item.fixedMonthly&&!item.referenceValue?'Mensal / fixo':brl(item.referenceValue)}</td><td>{item.projects.length}</td><td className="mgmt-value-paid">{brl(rowPaid)}</td><td className="mgmt-value-open">{brl(rowOpen)}</td></tr>})}
      </tbody></table></div>
    </section>

    <section className="mgmt-panel" data-report-section>
      <ReportAdder sectionKey="equipe:obras-custos" title="Custos por Obra" componentName="Tabela de Custos por Obra" page="Equipe" type="TABLE" data={projectRows.map(p=>({Projeto:p.name,'Pessoas / terceiros':p.peopleCount,Pago:p.paid,'A pagar':p.open,Total:p.total}))} filters={reportFilters} style={{float:'right'}}/>
      <h2>Equipe por projeto</h2><div className="mgmt-table-wrap"><table className="mgmt-table"><thead><tr><th>Projeto</th><th>Pessoas / terceiros</th><th>Pago</th><th>A pagar</th><th>Total</th></tr></thead><tbody>{projectRows.map(p=><tr key={p.name}><td><strong>{p.name}</strong></td><td>{p.peopleCount}</td><td className="mgmt-value-paid">{brl(p.paid)}</td><td className="mgmt-value-open">{brl(p.open)}</td><td><strong>{brl(p.total)}</strong></td></tr>)}</tbody></table></div>
    </section>

    <PersonModal person={selectedPerson} onClose={()=>setSelectedPerson(null)}/>
  </div>;
}
