'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';
import '../equipe/management.css';
import '../equipe/managementExtras.css';

const brl=(n)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n)||0);
const compact=(n)=>new Intl.NumberFormat('pt-BR',{notation:'compact',maximumFractionDigits:1}).format(Number(n)||0);
const monthLabel=(value)=>new Intl.DateTimeFormat('pt-BR',{month:'short',timeZone:'UTC'}).format(new Date(`${value}-01T12:00:00Z`));
const monthOf=(raw)=>{const value=String(raw||'');const iso=value.match(/^(\d{4})-(\d{1,2})/);if(iso)return `${iso[1]}-${iso[2].padStart(2,'0')}`;const br=value.match(/^\d{1,2}\/(\d{1,2})\/(\d{4})/);return br?`${br[2]}-${br[1].padStart(2,'0')}`:'';};
const typeLabels={RETIRADA:'Retirada dos sócios',EQUIPE_ADM_SOCIO:'Equipe ADM · sócio',EQUIPE_ADM:'Equipe ADM',DESPESA_ADM:'Despesa administrativa'};

function MovementDrawer({ title, rows, onClose }) {
  if(!rows)return null;
  const paid=rows.filter((r)=>r.paid).reduce((s,r)=>s+Number(r.valor||0),0);
  const open=rows.filter((r)=>!r.paid).reduce((s,r)=>s+Number(r.valor||0),0);
  const monthly=Array.from({length:12},(_,i)=>{
    const key=`2026-${String(i+1).padStart(2,'0')}`;
    const items=rows.filter((r)=>monthOf(r.data)===key);
    return {month:monthLabel(key),Pago:items.filter((r)=>r.paid).reduce((s,r)=>s+Number(r.valor||0),0),'A pagar':items.filter((r)=>!r.paid).reduce((s,r)=>s+Number(r.valor||0),0)};
  });
  return <div className="mgmt-overlay" onMouseDown={onClose}><div className="mgmt-drawer mgmt-drawer-wide" onMouseDown={(e)=>e.stopPropagation()}>
    <div className="mgmt-panel-head"><div><span className="mgmt-eyebrow">DETALHAMENTO · 2026</span><h2>{title}</h2><p>Pago {brl(paid)} · A pagar {brl(open)}</p></div><button className="btn" onClick={onClose}><X size={16}/> Fechar</button></div>
    <section className="mgmt-subcard"><h3>Relação mensal</h3><div className="mgmt-chart-sm"><ResponsiveContainer><LineChart data={monthly}><CartesianGrid strokeDasharray="3 3" opacity={0.18}/><XAxis dataKey="month" tick={{fontSize:10}}/><YAxis tickFormatter={compact} tick={{fontSize:10}}/><Tooltip formatter={(v)=>brl(v)}/><Legend/><Line type="monotone" dataKey="Pago" strokeWidth={2.4}/><Line type="monotone" dataKey="A pagar" strokeWidth={2.4}/></LineChart></ResponsiveContainer></div></section>
    <section className="mgmt-subcard" style={{marginTop:14}}><h3>Lançamentos</h3><div className="mgmt-table-wrap"><table className="mgmt-table"><thead><tr><th>Data</th><th>Documento</th><th>Lançamento</th><th>Conta</th><th>Situação</th><th>Valor</th></tr></thead><tbody>{[...rows].sort((a,b)=>String(a.data).localeCompare(String(b.data))).map((r)=><tr key={r.sourceKey}><td>{r.data||'—'}</td><td>{r.documento||'—'}</td><td>{r.lancamento||r.titulo||'—'}</td><td>{r.contaNome||r.contaCodigo||'—'}</td><td><span className={r.paid?'mgmt-pill paid':'mgmt-pill open'}>{r.paid?'Pago':'A pagar'}</span></td><td><strong>{brl(r.valor)}</strong></td></tr>)}</tbody></table></div></section>
  </div></div>;
}

export default function AdministrativeDashboard(){
  const[data,setData]=useState({revenue:[],expenses:[],monthly:[]});
  const[month,setMonth]=useState('');
  const[person,setPerson]=useState('');
  const[account,setAccount]=useState('');
  const[status,setStatus]=useState('');
  const[type,setType]=useState('');
  const[showAllAccounts,setShowAllAccounts]=useState(false);
  const[detail,setDetail]=useState(null);
  const[error,setError]=useState('');

  useEffect(()=>{let active=true;fetch('/api/administrativo',{cache:'no-store'}).then(async(r)=>{const result=await r.json();if(!r.ok)throw new Error(result.error||'Não foi possível carregar o Administrativo.');if(active)setData(result)}).catch((e)=>{if(active)setError(e.message)});return()=>{active=false}},[]);

  const people=useMemo(()=>[...new Set(data.expenses.map((r)=>r.nome).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR')),[data.expenses]);
  const accounts=useMemo(()=>[...new Set(data.expenses.map((r)=>r.contaNome).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR')),[data.expenses]);

  const expenses=useMemo(()=>data.expenses.filter((r)=>{
    if(month&&monthOf(r.data)!==month)return false;
    if(person&&r.nome!==person)return false;
    if(account&&r.contaNome!==account)return false;
    if(status==='PAGO'&&!r.paid)return false;
    if(status==='ABERTO'&&r.paid)return false;
    if(type&&r.type!==type)return false;
    return true;
  }),[data.expenses,month,person,account,status,type]);

  const revenue=useMemo(()=>data.revenue.filter((r)=>!month||r.month===month),[data.revenue,month]);
  const revenueTotal=revenue.reduce((s,r)=>s+Number(r.adminValue||0),0);
  const received=revenue.filter((r)=>r.realized).reduce((s,r)=>s+Number(r.adminValue||0),0);
  const receivable=revenue.filter((r)=>!r.realized).reduce((s,r)=>s+Number(r.adminValue||0),0);
  const paid=expenses.filter((r)=>r.paid).reduce((s,r)=>s+Number(r.valor||0),0);
  const open=expenses.filter((r)=>!r.paid).reduce((s,r)=>s+Number(r.valor||0),0);
  const result=revenueTotal-paid-open;
  const coverage=(paid+open)>0?revenueTotal/(paid+open):0;

  const byAccount=useMemo(()=>{const map=new Map();expenses.forEach((r)=>{const key=r.contaNome||'Sem conta';const item=map.get(key)||{name:key,paid:0,open:0,rows:[]};item[r.paid?'paid':'open']+=Number(r.valor||0);item.rows.push(r);map.set(key,item)});return[...map.values()].map((x)=>({...x,total:x.paid+x.open})).sort((a,b)=>b.total-a.total)},[expenses]);
  const visibleAccounts=showAllAccounts?byAccount:byAccount.slice(0,10);

  const adminTeam=useMemo(()=>{const map=new Map();expenses.filter((r)=>r.adminTeamEntity).forEach((r)=>{const item=map.get(r.nome)||{name:r.nome,paid:0,open:0,rows:[]};item[r.paid?'paid':'open']+=Number(r.valor||0);item.rows.push(r);map.set(r.nome,item)});return[...map.values()].map((x)=>({...x,total:x.paid+x.open})).sort((a,b)=>b.total-a.total)},[expenses]);

  const adminTeamMonthly=useMemo(()=>Array.from({length:12},(_,i)=>{const key=`2026-${String(i+1).padStart(2,'0')}`;const rows=expenses.filter((r)=>r.adminTeamEntity&&monthOf(r.data)===key);return{month:monthLabel(key),Pago:rows.filter((r)=>r.paid).reduce((s,r)=>s+Number(r.valor||0),0),'A pagar':rows.filter((r)=>!r.paid).reduce((s,r)=>s+Number(r.valor||0),0)}}),[expenses]);

  const chartMonthly=useMemo(()=>(data.monthly||[]).map((m)=>({month:monthLabel(m.month),'Receita ADM':m.revenue,'Despesa paga':m.paid,'A pagar':m.open,Resultado:m.result})),[data.monthly]);
  const deficitMonths=(data.monthly||[]).filter((m)=>m.result<0).length;
  const largestAccount=byAccount[0];

  const partners=useMemo(()=>{
    const defs=[{token:'FRANCIELLE',name:'Francielle Paiva'},{token:'PAULO HENRIQUE',name:'Paulo Henrique Araújo'}];
    return defs.map((def)=>{
      const rows=data.expenses.filter((r)=>String(r.nome||'').toUpperCase().includes(def.token)&&['RETIRADA','EQUIPE_ADM_SOCIO'].includes(r.type));
      return{...def,rows,team:rows.filter((r)=>r.type==='EQUIPE_ADM_SOCIO').reduce((s,r)=>s+Number(r.valor||0),0),withdrawal:rows.filter((r)=>r.type==='RETIRADA').reduce((s,r)=>s+Number(r.valor||0),0)};
    });
  },[data.expenses]);

  const partnerMonthly=useMemo(()=>Array.from({length:12},(_,i)=>{
    const key=`2026-${String(i+1).padStart(2,'0')}`;
    const row={month:monthLabel(key)};
    partners.forEach((p)=>{const rows=p.rows.filter((r)=>monthOf(r.data)===key);row[`${p.name} · Salário`]=rows.filter((r)=>r.type==='EQUIPE_ADM_SOCIO').reduce((s,r)=>s+Number(r.valor||0),0);row[`${p.name} · Retirada`]=rows.filter((r)=>r.type==='RETIRADA').reduce((s,r)=>s+Number(r.valor||0),0)});
    return row;
  }),[partners]);

  return <div className="mgmt">
    <header className="mgmt-header"><div><span className="mgmt-eyebrow">ADMINISTRATIVO · EXERCÍCIO 2026</span><h1>Administrativo</h1><p>Receita administrativa, custo operacional, equipe ADM, retiradas e movimentações do contas a pagar.</p></div></header>
    {error&&<div className="mgmt-alert">{error}</div>}

    <section className="mgmt-panel"><div className="mgmt-filter-grid">
      <label>Mês<select value={month} onChange={(e)=>setMonth(e.target.value)}><option value="">Todos · 2026</option>{Array.from({length:12},(_,i)=>{const m=`2026-${String(i+1).padStart(2,'0')}`;return<option key={m} value={m}>{monthLabel(m)}</option>})}</select></label>
      <label>Pessoa / fornecedor<select value={person} onChange={(e)=>setPerson(e.target.value)}><option value="">Todos</option>{people.map((x)=><option key={x}>{x}</option>)}</select></label>
      <label>Conta<select value={account} onChange={(e)=>setAccount(e.target.value)}><option value="">Todas</option>{accounts.map((x)=><option key={x}>{x}</option>)}</select></label>
      <label>Situação<select value={status} onChange={(e)=>setStatus(e.target.value)}><option value="">Todas</option><option value="PAGO">Pago</option><option value="ABERTO">A pagar</option></select></label>
      <label>Tipo<select value={type} onChange={(e)=>setType(e.target.value)}><option value="">Todos</option>{Object.entries(typeLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
    </div></section>

    <section className="mgmt-revenue-banner">
      <div><span>20% · Receita administrativa</span><strong>{brl(revenueTotal)}</strong><small>Parcela administrativa das receitas do período</small></div>
      <div><span>20% já recebido</span><strong>{brl(received)}</strong><small>Receita ADM realizada</small></div>
      <div><span>20% a receber</span><strong>{brl(receivable)}</strong><small>Receita ADM prevista</small></div>
    </section>

    <div className="mgmt-kpis">
      <div><span>Despesas pagas</span><strong className="mgmt-value-paid">{brl(paid)}</strong></div>
      <div><span>Despesas a pagar</span><strong className="mgmt-value-open">{brl(open)}</strong></div>
      <div><span>Resultado projetado</span><strong>{brl(result)}</strong></div>
      <div><span>Cobertura da despesa</span><strong>{(coverage*100).toFixed(1)}%</strong></div>
    </div>

    <div className="mgmt-flow mgmt-flow-balanced">
      <section className="mgmt-panel">
        <h2>Receita x despesa · Jan–Dez/2026</h2><p>Colunas mensais com receita ADM, despesa paga e valores ainda a pagar.</p>
        <div className="mgmt-chart"><ResponsiveContainer><BarChart data={chartMonthly} margin={{top:10,right:10,left:5,bottom:0}}><CartesianGrid strokeDasharray="3 3" opacity={0.16}/><XAxis dataKey="month" tick={{fontSize:10}}/><YAxis tickFormatter={compact} tick={{fontSize:10}}/><Tooltip formatter={(v)=>brl(v)}/><Legend/><Bar dataKey="Receita ADM"/><Bar dataKey="Despesa paga"/><Bar dataKey="A pagar"/></BarChart></ResponsiveContainer></div>
      </section>

      <section className="mgmt-panel">
        <h2>Indicadores para decisão</h2>
        <div className="mgmt-decision-grid">
          <div><span>Meses com resultado negativo</span><strong>{deficitMonths}/12</strong><small>Receita ADM inferior à despesa do mês</small></div>
          <div><span>Maior grupo de despesa</span><strong>{largestAccount?.name||'—'}</strong><small>{largestAccount?brl(largestAccount.total):'Sem movimento'}</small></div>
          <div><span>Exposição a pagar</span><strong>{brl(open)}</strong><small>{paid+open>0?((open/(paid+open))*100).toFixed(1):'0,0'}% da despesa do período</small></div>
          <div><span>Resultado após compromissos</span><strong>{brl(result)}</strong><small>Receita ADM menos pago e a pagar</small></div>
        </div>
      </section>
    </div>

    <section className="mgmt-panel">
      <div className="mgmt-panel-head"><div><h2>Despesas por conta</h2><p>10 maiores contas por padrão. Pago e a pagar permanecem separados.</p></div>{byAccount.length>10&&<button className="btn" onClick={()=>setShowAllAccounts((v)=>!v)}>{showAllAccounts?<><ChevronUp size={15}/> Mostrar top 10</>:<><ChevronDown size={15}/> Ver todas ({byAccount.length})</>}</button>}</div>
      <div className="mgmt-table-wrap"><table className="mgmt-table mgmt-clickable-table"><thead><tr><th>Conta</th><th>Pago</th><th>A pagar</th><th>Total</th><th>% despesa</th></tr></thead><tbody>{visibleAccounts.map((x)=><tr key={x.name} onClick={()=>setDetail({title:x.name,rows:x.rows})}><td><strong>{x.name}</strong></td><td className="mgmt-value-paid">{brl(x.paid)}</td><td className="mgmt-value-open">{brl(x.open)}</td><td><strong>{brl(x.total)}</strong></td><td>{paid+open>0?((x.total/(paid+open))*100).toFixed(1):'0,0'}%</td></tr>)}</tbody></table></div>
    </section>

    <div className="mgmt-flow mgmt-flow-balanced">
      <section className="mgmt-panel">
        <h2>Visão da equipe administrativa</h2><p>Relação mensal apenas de pessoas e empresas reconhecidas como equipe ADM.</p>
        <div className="mgmt-chart-sm"><ResponsiveContainer><LineChart data={adminTeamMonthly}><CartesianGrid strokeDasharray="3 3" opacity={0.16}/><XAxis dataKey="month" tick={{fontSize:10}}/><YAxis tickFormatter={compact} tick={{fontSize:10}}/><Tooltip formatter={(v)=>brl(v)}/><Legend/><Line type="monotone" dataKey="Pago" strokeWidth={2.4}/><Line type="monotone" dataKey="A pagar" strokeWidth={2.4}/></LineChart></ResponsiveContainer></div>
        <div className="mgmt-table-wrap"><table className="mgmt-table mgmt-clickable-table"><thead><tr><th>Pessoa / empresa</th><th>Pago</th><th>A pagar</th><th>Total</th></tr></thead><tbody>{adminTeam.map((x)=><tr key={x.name} onClick={()=>setDetail({title:`Equipe ADM · ${x.name}`,rows:x.rows})}><td><strong>{x.name}</strong></td><td className="mgmt-value-paid">{brl(x.paid)}</td><td className="mgmt-value-open">{brl(x.open)}</td><td>{brl(x.total)}</td></tr>)}</tbody></table></div>
        {!adminTeam.length&&<p>Sem pessoas/empresas de Equipe ADM no período.</p>}
      </section>

      <section className="mgmt-panel">
        <h2>Movimentação dos sócios</h2><p>Evolução mensal de salário/Equipe ADM e retiradas de Francielle e Paulo.</p>
        <div className="mgmt-chart"><ResponsiveContainer><LineChart data={partnerMonthly}><CartesianGrid strokeDasharray="3 3" opacity={0.16}/><XAxis dataKey="month" tick={{fontSize:10}}/><YAxis tickFormatter={compact} tick={{fontSize:10}}/><Tooltip formatter={(v)=>brl(v)}/><Legend/><Line type="monotone" dataKey="Francielle Paiva · Salário" strokeWidth={2}/><Line type="monotone" dataKey="Francielle Paiva · Retirada" strokeWidth={2}/><Line type="monotone" dataKey="Paulo Henrique Araújo · Salário" strokeWidth={2}/><Line type="monotone" dataKey="Paulo Henrique Araújo · Retirada" strokeWidth={2}/></LineChart></ResponsiveContainer></div>
        <div className="mgmt-table-wrap"><table className="mgmt-table mgmt-clickable-table"><thead><tr><th>Pessoa</th><th>Equipe ADM / salário</th><th>Retiradas</th><th>Total</th></tr></thead><tbody>{partners.map((x)=><tr key={x.name} onClick={()=>setDetail({title:`Movimentação · ${x.name}`,rows:x.rows})}><td><strong>{x.name}</strong></td><td>{brl(x.team)}</td><td>{brl(x.withdrawal)}</td><td><strong>{brl(x.team+x.withdrawal)}</strong></td></tr>)}</tbody></table></div>
      </section>
    </div>

    <section className="mgmt-panel">
      <div className="mgmt-panel-head"><div><h2>Movimentações financeiras · Administrativo</h2><p>Somente contas a pagar e pagas do centro administrativo. Receita não é exibida neste demonstrativo.</p></div><div className="mgmt-status-legend"><span className="mgmt-pill paid">Pago</span><span className="mgmt-pill open">A pagar</span></div></div>
      <div className="mgmt-table-wrap"><table className="mgmt-table"><thead><tr><th>Data</th><th>Documento</th><th>Lançamento</th><th>Nome / fornecedor</th><th>Conta</th><th>Situação</th><th>Pago</th><th>A pagar</th></tr></thead><tbody>{[...expenses].sort((a,b)=>String(a.data).localeCompare(String(b.data))).map((r)=><tr key={r.sourceKey}><td>{r.data||'—'}</td><td>{r.documento||'—'}</td><td>{r.lancamento||r.titulo||'—'}</td><td>{r.nome||'—'}</td><td>{r.contaNome||r.contaCodigo||'—'}</td><td><span className={r.paid?'mgmt-pill paid':'mgmt-pill open'}>{r.paid?'Pago':'A pagar'}</span></td><td className="mgmt-value-paid">{r.paid?brl(r.valor):'—'}</td><td className="mgmt-value-open">{!r.paid?brl(r.valor):'—'}</td></tr>)}</tbody></table></div>
      {!expenses.length&&<p>Sem movimentações administrativas para os filtros selecionados.</p>}
    </section>

    <MovementDrawer title={detail?.title} rows={detail?.rows} onClose={()=>setDetail(null)}/>
  </div>;
}
