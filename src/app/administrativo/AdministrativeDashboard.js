'use client';

import { useEffect, useMemo, useState } from 'react';
import '../equipe/management.css';
import '../equipe/managementExtras.css';

const brl = (n) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n) || 0);
const monthLabel = (value) => new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' }).format(new Date(`${value}-01T12:00:00Z`));
const monthOf = (raw) => { const value=String(raw||''); const iso=value.match(/^(\d{4})-(\d{1,2})/); if(iso)return `${iso[1]}-${iso[2].padStart(2,'0')}`; const br=value.match(/^\d{1,2}\/(\d{1,2})\/(\d{4})/); return br?`${br[2]}-${br[1].padStart(2,'0')}`:''; };
const typeLabels = { RETIRADA:'Retirada dos sócios', EQUIPE_ADM_SOCIO:'Equipe ADM · sócio', EQUIPE_ADM:'Equipe ADM', DESPESA_ADM:'Despesa administrativa' };

export default function AdministrativeDashboard() {
  const [data,setData]=useState({ revenue:[], expenses:[], monthly:[] });
  const [month,setMonth]=useState('');
  const [person,setPerson]=useState('');
  const [account,setAccount]=useState('');
  const [status,setStatus]=useState('');
  const [type,setType]=useState('');
  const [error,setError]=useState('');

  useEffect(()=>{let active=true; fetch('/api/administrativo',{cache:'no-store'}).then(async(r)=>{const result=await r.json(); if(!r.ok)throw new Error(result.error||'Não foi possível carregar o Administrativo.'); if(active)setData(result)}).catch((e)=>{if(active)setError(e.message)}); return()=>{active=false}},[]);

  const people=useMemo(()=>[...new Set(data.expenses.map((r)=>r.nome).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR')),[data.expenses]);
  const accounts=useMemo(()=>[...new Set(data.expenses.map((r)=>r.contaNome).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR')),[data.expenses]);

  const expenses=useMemo(()=>data.expenses.filter((r)=>{
    if(month && monthOf(r.data)!==month)return false;
    if(person && r.nome!==person)return false;
    if(account && r.contaNome!==account)return false;
    if(status==='PAGO' && !r.paid)return false;
    if(status==='ABERTO' && r.paid)return false;
    if(type && r.type!==type)return false;
    return true;
  }),[data.expenses,month,person,account,status,type]);

  const revenue=useMemo(()=>data.revenue.filter((r)=>!month||r.month===month),[data.revenue,month]);
  const revenueTotal=revenue.reduce((s,r)=>s+Number(r.adminValue||0),0);
  const received=revenue.filter((r)=>r.realized).reduce((s,r)=>s+Number(r.adminValue||0),0);
  const receivable=revenue.filter((r)=>!r.realized).reduce((s,r)=>s+Number(r.adminValue||0),0);
  const paid=expenses.filter((r)=>r.paid).reduce((s,r)=>s+Number(r.valor||0),0);
  const open=expenses.filter((r)=>!r.paid).reduce((s,r)=>s+Number(r.valor||0),0);
  const withdrawals=expenses.filter((r)=>r.type==='RETIRADA').reduce((s,r)=>s+Number(r.valor||0),0);
  const result=revenueTotal-paid-open;

  const byAccount=useMemo(()=>{
    const map=new Map();
    expenses.forEach((r)=>{const key=r.contaNome||'Sem conta'; const item=map.get(key)||{name:key,paid:0,open:0}; item[r.paid?'paid':'open']+=Number(r.valor||0); map.set(key,item)});
    return [...map.values()].sort((a,b)=>(b.paid+b.open)-(a.paid+a.open));
  },[expenses]);

  const adminTeam=useMemo(()=>{
    const map=new Map();
    expenses.filter((r)=>['EQUIPE_ADM','EQUIPE_ADM_SOCIO'].includes(r.type)).forEach((r)=>{const item=map.get(r.nome)||{name:r.nome,paid:0,open:0}; item[r.paid?'paid':'open']+=Number(r.valor||0); map.set(r.nome,item)});
    return [...map.values()].sort((a,b)=>(b.paid+b.open)-(a.paid+a.open));
  },[expenses]);

  const partners=useMemo(()=>{
    const names=['FRANCIELLE','PAULO HENRIQUE'];
    return names.map((token)=>{
      const rows=expenses.filter((r)=>String(r.nome||'').toUpperCase().includes(token) && ['RETIRADA','EQUIPE_ADM_SOCIO'].includes(r.type));
      return {name: token==='FRANCIELLE'?'Francielle Paiva':'Paulo Henrique Araújo', team:rows.filter((r)=>r.type==='EQUIPE_ADM_SOCIO').reduce((s,r)=>s+Number(r.valor||0),0), withdrawal:rows.filter((r)=>r.type==='RETIRADA').reduce((s,r)=>s+Number(r.valor||0),0)};
    });
  },[expenses]);

  const maxMonthly=Math.max(1,...data.monthly.map((m)=>Math.max(m.revenue,m.paid+m.open)));

  return <div className="mgmt">
    <header className="mgmt-header"><div><span className="mgmt-eyebrow">ADMINISTRATIVO · EXERCÍCIO 2026</span><h1>Administrativo</h1><p>Receita administrativa de 20%, despesas do centro Administração e movimentações específicas dos sócios.</p></div></header>
    {error&&<div className="mgmt-alert">{error}</div>}

    <section className="mgmt-panel"><div className="mgmt-filter-grid">
      <label>Mês<select value={month} onChange={(e)=>setMonth(e.target.value)}><option value="">Todos · 2026</option>{Array.from({length:12},(_,i)=>{const m=`2026-${String(i+1).padStart(2,'0')}`;return <option key={m} value={m}>{monthLabel(m)}</option>})}</select></label>
      <label>Pessoa / fornecedor<select value={person} onChange={(e)=>setPerson(e.target.value)}><option value="">Todos</option>{people.map((x)=><option key={x}>{x}</option>)}</select></label>
      <label>Conta<select value={account} onChange={(e)=>setAccount(e.target.value)}><option value="">Todas</option>{accounts.map((x)=><option key={x}>{x}</option>)}</select></label>
      <label>Situação<select value={status} onChange={(e)=>setStatus(e.target.value)}><option value="">Todas</option><option value="PAGO">Pago</option><option value="ABERTO">A pagar</option></select></label>
      <label>Tipo<select value={type} onChange={(e)=>setType(e.target.value)}><option value="">Todos</option>{Object.entries(typeLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
    </div></section>

    <div className="mgmt-kpis mgmt-kpis-six">
      <div><span>Receita ADM</span><strong>{brl(revenueTotal)}</strong></div>
      <div><span>Recebido ADM</span><strong>{brl(received)}</strong></div>
      <div><span>A receber ADM</span><strong>{brl(receivable)}</strong></div>
      <div><span>Despesas pagas</span><strong>{brl(paid)}</strong></div>
      <div><span>Despesas a pagar</span><strong>{brl(open)}</strong></div>
      <div><span>Resultado ADM</span><strong>{brl(result)}</strong></div>
    </div>

    <div className="mgmt-flow">
      <section className="mgmt-panel"><h2>Receita x despesa · Jan–Dez/2026</h2><div className="mgmt-bars">{data.monthly.map((m)=><div className="mgmt-bar-row" key={m.month}><span>{monthLabel(m.month)}</span><div className="mgmt-bar-track"><i className="mgmt-bar-paid" style={{width:`${m.revenue/maxMonthly*100}%`}}/><i className="mgmt-bar-open" style={{width:`${(m.paid+m.open)/maxMonthly*100}%`}}/></div><b>{brl(m.result)}</b></div>)}</div><p>Verde: receita ADM · Âmbar: despesas · valor à direita: resultado.</p></section>
      <section className="mgmt-panel"><h2>Resumo do período</h2><div className="mgmt-line"><span>Receita administrativa</span><b>{brl(revenueTotal)}</b></div><div className="mgmt-line"><span>Despesas administrativas</span><b>{brl(paid+open)}</b></div><div className="mgmt-line"><span>Retiradas dos sócios</span><b>{brl(withdrawals)}</b></div><div className="mgmt-line"><span>Resultado</span><b>{brl(result)}</b></div></section>
    </div>

    <section className="mgmt-panel"><h2>Despesas por conta</h2><div className="mgmt-table-wrap"><table className="mgmt-table"><thead><tr><th>Conta</th><th>Pago</th><th>A pagar</th><th>Total</th></tr></thead><tbody>{byAccount.map((x)=><tr key={x.name}><td>{x.name}</td><td>{brl(x.paid)}</td><td>{brl(x.open)}</td><td><strong>{brl(x.paid+x.open)}</strong></td></tr>)}</tbody></table></div></section>

    <div className="mgmt-flow">
      <section className="mgmt-panel"><h2>Equipe administrativa</h2>{adminTeam.map((x)=><div className="mgmt-line" key={x.name}><span>{x.name}</span><b>{brl(x.paid+x.open)}</b></div>)}{!adminTeam.length&&<p>Sem movimentações de Equipe ADM no período.</p>}</section>
      <section className="mgmt-panel"><h2>Movimentação dos sócios</h2><p>Somente Retirada dos Sócios e Equipe ADM.</p><div className="mgmt-table-wrap"><table className="mgmt-table"><thead><tr><th>Pessoa</th><th>Equipe ADM</th><th>Retiradas</th><th>Total</th></tr></thead><tbody>{partners.map((x)=><tr key={x.name}><td>{x.name}</td><td>{brl(x.team)}</td><td>{brl(x.withdrawal)}</td><td><strong>{brl(x.team+x.withdrawal)}</strong></td></tr>)}</tbody></table></div></section>
    </div>

    <section className="mgmt-panel"><h2>Demonstrativo administrativo</h2><div className="mgmt-table-wrap"><table className="mgmt-table"><thead><tr><th>Data</th><th>Documento</th><th>Nome</th><th>Conta</th><th>Tipo</th><th>Situação</th><th>Valor</th></tr></thead><tbody>{expenses.sort((a,b)=>String(a.data).localeCompare(String(b.data))).map((r)=><tr key={r.sourceKey}><td>{r.data}</td><td>{r.documento||r.titulo||'—'}</td><td>{r.nome}</td><td>{r.contaNome||'—'}</td><td>{typeLabels[r.type]}</td><td>{r.paid?'Pago':'A pagar'}</td><td><strong>{brl(r.valor)}</strong></td></tr>)}</tbody></table></div>{!expenses.length&&<p>Sem despesas administrativas para os filtros selecionados.</p>}</section>
  </div>;
}
