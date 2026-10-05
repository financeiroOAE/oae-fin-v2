'use client';

import { useEffect, useMemo, useState } from 'react';
import { FileText, ChevronDown, ChevronUp, X } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine
} from 'recharts';
import { useReport } from '@/contexts/ReportContext';
import ReportAdder from '@/components/report/ReportAdder';
import InfoTooltip from '@/components/InfoTooltip';
import DataTable from '@/components/DataTable';
import '../equipe/management.css';
import '../equipe/managementExtras.css';

const COLORS={revenue:'#3b82f6',paid:'#22c55e',open:'#f59e0b',danger:'#ef4444',fran:'#a855f7',paulo:'#06b6d4',fixed:'#22c55e',withdrawal:'#f97316'};
const brl=(n)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n)||0);
const compact=(n)=>new Intl.NumberFormat('pt-BR',{notation:'compact',maximumFractionDigits:1}).format(Number(n)||0);
const getDateKey=(raw)=>{const value=String(raw||'');let m=value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);if(m)return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;m=value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);return m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:'';};
const monthOf=(raw)=>getDateKey(raw).slice(0,7);
const monthLabel=(value)=>new Intl.DateTimeFormat('pt-BR',{month:'short',timeZone:'UTC'}).format(new Date(`${value}-01T12:00:00Z`));
const inRange=(row,start,end)=>{const key=getDateKey(row.data);if(!key)return false;return(!start||key>=start)&&(!end||key<=end)};

function MovementModal({title,rows,onClose}){
  if(!rows)return null;
  const paid=rows.filter(r=>r.paid).reduce((s,r)=>s+Number(r.valor||0),0);
  const open=rows.filter(r=>!r.paid).reduce((s,r)=>s+Number(r.valor||0),0);
  const monthly=Array.from({length:12},(_,i)=>{const key=`2026-${String(i+1).padStart(2,'0')}`;const items=rows.filter(r=>monthOf(r.data)===key);return{month:monthLabel(key),Pago:items.filter(r=>r.paid).reduce((s,r)=>s+Number(r.valor||0),0),'A pagar':items.filter(r=>!r.paid).reduce((s,r)=>s+Number(r.valor||0),0)}});
  return <div className="mgmt-overlay mgmt-overlay-center" onMouseDown={onClose}><div className="mgmt-modal-center" onMouseDown={e=>e.stopPropagation()}>
    <div className="mgmt-panel-head"><div><span className="mgmt-eyebrow">DETALHAMENTO · 2026</span><h2>{title}</h2><p>Pago {brl(paid)} · A pagar {brl(open)}</p></div><button className="btn" onClick={onClose}><X size={16}/> Fechar</button></div>
    <section className="mgmt-subcard"><h3>Relação mensal</h3><div className="mgmt-chart-sm"><ResponsiveContainer><LineChart data={monthly}><CartesianGrid strokeDasharray="3 3" opacity={0.16}/><XAxis dataKey="month" tick={{fontSize:10}}/><YAxis tickFormatter={compact} tick={{fontSize:10}}/><Tooltip formatter={v=>brl(v)}/><Legend/><Line type="monotone" dataKey="Pago" stroke={COLORS.paid} strokeWidth={2.5}/><Line type="monotone" dataKey="A pagar" stroke={COLORS.open} strokeWidth={2.5}/></LineChart></ResponsiveContainer></div></section>
    <section className="mgmt-subcard" style={{marginTop:14}}><h3>Lançamentos</h3><div className="mgmt-table-wrap"><table className="mgmt-table"><thead><tr><th>Data</th><th>Documento</th><th>Lançamento</th><th>Conta</th><th>Situação</th><th>Valor</th></tr></thead><tbody>{[...rows].sort((a,b)=>getDateKey(b.data).localeCompare(getDateKey(a.data))).map(r=><tr key={r.sourceKey}><td>{r.data||'—'}</td><td>{r.documento||'—'}</td><td>{r.lancamento||r.titulo||'—'}</td><td>{r.contaNome||r.contaCodigo||'—'}</td><td><span className={r.paid?'mgmt-pill paid':'mgmt-pill open'}>{r.paid?'Pago':'A pagar'}</span></td><td><strong>{brl(r.valor)}</strong></td></tr>)}</tbody></table></div></section>
  </div></div>;
}

export default function AdministrativeDashboard(){
  const {isReportMode,openReportBuilder,exitReportMode}=useReport();
  const[data,setData]=useState({revenue:[],expenses:[],monthly:[]});
  const[startDate,setStartDate]=useState('2026-01-01');
  const[endDate,setEndDate]=useState('2026-12-31');
  const[showAllAccounts,setShowAllAccounts]=useState(false);
  const[detail,setDetail]=useState(null);
  const[partnerView,setPartnerView]=useState('TODOS');
  const[error,setError]=useState('');

  useEffect(()=>{let active=true;fetch('/api/administrativo',{cache:'no-store'}).then(async r=>{const result=await r.json();if(!r.ok)throw new Error(result.error||'Não foi possível carregar o Administrativo.');if(active)setData(result)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[]);

  const expenses=useMemo(()=>data.expenses.filter(r=>inRange(r,startDate,endDate)),[data.expenses,startDate,endDate]);
  const revenue=useMemo(()=>data.revenue.filter(r=>{const key=`${r.month}-01`;return(!startDate||key>=startDate.slice(0,7)+'-01')&&(!endDate||key<=endDate.slice(0,7)+'-31')}),[data.revenue,startDate,endDate]);

  const revenueTotal=revenue.reduce((s,r)=>s+Number(r.adminValue||0),0);
  const received=revenue.filter(r=>r.realized).reduce((s,r)=>s+Number(r.adminValue||0),0);
  const receivable=revenue.filter(r=>!r.realized).reduce((s,r)=>s+Number(r.adminValue||0),0);
  const paid=expenses.filter(r=>r.paid).reduce((s,r)=>s+Number(r.valor||0),0);
  const open=expenses.filter(r=>!r.paid).reduce((s,r)=>s+Number(r.valor||0),0);
  const result=revenueTotal-paid-open;
  const coverage=paid+open>0?revenueTotal/(paid+open):0;

  const byAccount=useMemo(()=>{const map=new Map();expenses.forEach(r=>{const key=r.contaNome||r.contaCodigo||'Sem conta';const item=map.get(key)||{name:key,paid:0,open:0,rows:[]};item[r.paid?'paid':'open']+=Number(r.valor||0);item.rows.push(r);map.set(key,item)});return[...map.values()].map(x=>({...x,total:x.paid+x.open})).sort((a,b)=>b.total-a.total)},[expenses]);
  const visibleAccounts=showAllAccounts?byAccount:byAccount.slice(0,10);

  // A visão de Equipe ADM é anual por regra: realizado de jan-dez/2026 + tudo que está em aberto até dez/2026.
  const adminTeamYearRows=useMemo(()=>data.expenses.filter(r=>r.adminTeamEntity&&getDateKey(r.data)>='2026-01-01'&&getDateKey(r.data)<='2026-12-31'),[data.expenses]);
  const adminTeam=useMemo(()=>{const map=new Map();adminTeamYearRows.forEach(r=>{const item=map.get(r.nome)||{name:r.nome,paid:0,open:0,rows:[]};item[r.paid?'paid':'open']+=Number(r.valor||0);item.rows.push(r);map.set(r.nome,item)});return[...map.values()].map(x=>({...x,total:x.paid+x.open})).sort((a,b)=>b.total-a.total)},[adminTeamYearRows]);
  const adminTeamMonthly=useMemo(()=>Array.from({length:12},(_,i)=>{const key=`2026-${String(i+1).padStart(2,'0')}`;const rows=adminTeamYearRows.filter(r=>monthOf(r.data)===key);return{month:monthLabel(key),Pago:rows.filter(r=>r.paid).reduce((s,r)=>s+Number(r.valor||0),0),'A pagar':rows.filter(r=>!r.paid).reduce((s,r)=>s+Number(r.valor||0),0)}}),[adminTeamYearRows]);

  const chartMonthly=useMemo(()=>Array.from({length:12},(_,i)=>{const key=`2026-${String(i+1).padStart(2,'0')}`;const active=(!startDate||`${key}-31`>=startDate)&&(!endDate||`${key}-01`<=endDate);const source=(data.monthly||[]).find(m=>m.month===key)||{};return{month:monthLabel(key),'Receita ADM':active?Number(source.revenue||0):0,'Despesa paga':active?Number(source.paid||0):0,'A pagar':active?Number(source.open||0):0,Resultado:active?Number(source.result||0):0}}),[data.monthly,startDate,endDate]);

  const deficitMonths=chartMonthly.filter(m=>m.Resultado<0).length;
  const largestAccount=byAccount[0];

  const partnerDefs=[
    {token:'FRANCIELLE',name:'Francielle Paiva',short:'Francielle',fixed:25000,color:COLORS.fran},
    {token:'PAULO HENRIQUE',name:'Paulo Henrique Araújo',short:'Paulo',fixed:42000,color:COLORS.paulo}
  ];
  const partners=useMemo(()=>partnerDefs.map(def=>{const rows=data.expenses.filter(r=>String(r.nome||'').toUpperCase().includes(def.token)&&['RETIRADA','EQUIPE_ADM_SOCIO'].includes(r.type)&&getDateKey(r.data)>='2026-01-01'&&getDateKey(r.data)<='2026-12-31');return{...def,rows,fixedPaid:rows.filter(r=>r.type==='EQUIPE_ADM_SOCIO').reduce((s,r)=>s+Number(r.valor||0),0),withdrawal:rows.filter(r=>r.type==='RETIRADA').reduce((s,r)=>s+Number(r.valor||0),0)}}),[data.expenses]);

  const partnerMonthly=useMemo(()=>Array.from({length:12},(_,i)=>{const key=`2026-${String(i+1).padStart(2,'0')}`;const row={month:monthLabel(key)};partners.forEach(p=>{const rows=p.rows.filter(r=>monthOf(r.data)===key);row[`${p.short} · Fixo pago`]=rows.filter(r=>r.type==='EQUIPE_ADM_SOCIO').reduce((s,r)=>s+Number(r.valor||0),0);row[`${p.short} · Retirada`]=rows.filter(r=>r.type==='RETIRADA').reduce((s,r)=>s+Number(r.valor||0),0)});return row}),[partners]);

  const partnerSeries=partnerView==='FRAN'?['Francielle · Fixo pago','Francielle · Retirada']:partnerView==='PAULO'?['Paulo · Fixo pago','Paulo · Retirada']:['Francielle · Fixo pago','Francielle · Retirada','Paulo · Fixo pago','Paulo · Retirada'];

  const adminFinancialRows=useMemo(()=>expenses.map(r=>({...r,natureza:'Saída',projeto:'ADMINISTRAÇÃO',contaDescricao:r.contaNome||r.contaCodigo,status:r.paid?'Realizado':'A realizar'})),[expenses]);
  const reportFilters={'Data inicial':startDate,'Data final':endDate};
  const reportMovementRows=adminFinancialRows.map(r=>({Data:r.data,'Nome / fornecedor':r.nome,Conta:r.contaDescricao,Documento:r.documento||'',Lançamento:r.lancamento||r.titulo||'',Situação:r.paid?'Pago':'A pagar',Valor:r.valor}));

  return <div className="mgmt">
    <header className="mgmt-header">
      <div><span className="mgmt-eyebrow">ADMINISTRATIVO · EXERCÍCIO 2026</span><h1>Administrativo</h1><p>Receita administrativa, custos, equipe ADM, sócios e contas a pagar.</p></div>
      <button onClick={()=>isReportMode?exitReportMode():openReportBuilder('Administrativo')} className={`btn ${isReportMode?'btn-primary':''}`}><FileText size={14}/>{isReportMode?'Sair do Modo Relatório':'Gerar Relatório'}</button>
    </header>
    {error&&<div className="mgmt-alert">{error}</div>}

    <section className="mgmt-panel"><div className="mgmt-filter-grid mgmt-filter-grid-dates">
      <label>Data inicial<input type="date" min="2026-01-01" max="2026-12-31" value={startDate} onChange={e=>setStartDate(e.target.value)}/></label>
      <label>Data final<input type="date" min="2026-01-01" max="2026-12-31" value={endDate} onChange={e=>setEndDate(e.target.value)}/></label>
    </div></section>

    <section className="mgmt-revenue-banner" data-report-section>
      <ReportAdder sectionKey="administrativo:receita-20" title="Receita Administrativa — 20%" componentName="Resumo de Receita Administrativa" page="Administrativo" type="SUMMARY" data={[{'Receita ADM':revenueTotal,'Recebido ADM':received,'A receber ADM':receivable}]} filters={reportFilters} style={{position:'absolute',right:12,top:12}}/>
      <div><div className="mgmt-kpi-title"><span>20% · Receita administrativa</span><InfoTooltip title="Receita administrativa" content="20% das receitas dos projetos no período selecionado, conforme a regra de rateio administrativo do painel."/></div><strong>{brl(revenueTotal)}</strong><small>Parcela administrativa das receitas</small></div>
      <div><div className="mgmt-kpi-title"><span>20% já recebido</span><InfoTooltip title="Recebido ADM" content="Parcela administrativa correspondente às receitas já realizadas/recebidas."/></div><strong>{brl(received)}</strong><small>Receita ADM realizada</small></div>
      <div><div className="mgmt-kpi-title"><span>20% a receber</span><InfoTooltip title="A receber ADM" content="Parcela administrativa das receitas previstas e ainda não recebidas até o fim do período."/></div><strong>{brl(receivable)}</strong><small>Receita ADM prevista</small></div>
    </section>

    <div className="mgmt-kpis">
      {[
        ['Despesas pagas',paid,'Total efetivamente pago no centro de custo ADMINISTRAÇÃO dentro do período selecionado.'],
        ['Despesas a pagar',open,'Compromissos administrativos ainda em aberto dentro do período selecionado.'],
        ['Resultado projetado',result,'Receita ADM menos despesas já pagas e valores ainda a pagar.'],
        ['Cobertura da despesa',coverage,'Percentual das despesas totais do período coberto pela Receita Administrativa de 20%.']
      ].map(([label,value,info])=><div key={label}><div className="mgmt-kpi-title"><span>{label}</span><InfoTooltip title={label} content={info}/></div><strong className={label==='Despesas pagas'?'mgmt-value-paid':label==='Despesas a pagar'?'mgmt-value-open':''}>{label==='Cobertura da despesa'?((Number(value)||0)*100).toFixed(1)+'%':brl(value)}</strong></div>)}
    </div>

    <div className="mgmt-flow mgmt-flow-balanced">
      <section id="report-adm-receita-despesa" data-report-section className="mgmt-panel">
        <ReportAdder sectionKey="administrativo:receita-despesa" title="Receita x Despesa — 2026" componentName="Gráfico Receita x Despesa" page="Administrativo" type="CHART" data={chartMonthly} filters={reportFilters} captureId="report-adm-receita-despesa" style={{float:'right'}}/>
        <h2>Receita x despesa · Jan–Dez/2026</h2><p>Receita ADM, despesa paga e compromissos em aberto.</p>
        <div className="mgmt-chart"><ResponsiveContainer><BarChart data={chartMonthly}><CartesianGrid strokeDasharray="3 3" opacity={0.16}/><XAxis dataKey="month" tick={{fontSize:10}}/><YAxis tickFormatter={compact} tick={{fontSize:10}}/><Tooltip formatter={v=>brl(v)}/><Legend/><Bar dataKey="Receita ADM" fill={COLORS.revenue} radius={[4,4,0,0]}/><Bar dataKey="Despesa paga" fill={COLORS.paid} radius={[4,4,0,0]}/><Bar dataKey="A pagar" fill={COLORS.open} radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div>
      </section>

      <section className="mgmt-panel mgmt-insights-panel">
        <div className="mgmt-insight-hero"><span>Resultado após compromissos</span><strong className={result>=0?'mgmt-value-paid':'mgmt-value-danger'}>{brl(result)}</strong><small>{result>=0?'Receita administrativa cobre as despesas do período.':'Despesas e compromissos superam a receita administrativa do período.'}</small></div>
        <div className="mgmt-decision-grid">
          <div><span>Meses negativos</span><strong>{deficitMonths}/12</strong><div className="mgmt-mini-meter"><i style={{width:`${deficitMonths/12*100}%`}}/></div><small>Meses em que a despesa supera a Receita ADM.</small></div>
          <div><span>Maior grupo de despesa</span><strong>{largestAccount?.name||'—'}</strong><small>{largestAccount?brl(largestAccount.total):'Sem movimento'}</small></div>
          <div><span>Exposição em aberto</span><strong className="mgmt-value-open">{brl(open)}</strong><small>{paid+open>0?((open/(paid+open))*100).toFixed(1):'0,0'}% da despesa ainda não foi paga.</small></div>
          <div><span>Cobertura</span><strong>{(coverage*100).toFixed(1)}%</strong><div className="mgmt-mini-meter success"><i style={{width:`${Math.min(100,coverage*100)}%`}}/></div><small>Quanto os 20% administrativos cobrem da despesa.</small></div>
        </div>
      </section>
    </div>

    <section className="mgmt-panel" data-report-section>
      <ReportAdder sectionKey="administrativo:despesas-conta" title="Despesas por Conta" componentName="Tabela das Principais Contas Administrativas" page="Administrativo" type="TABLE" data={byAccount.map(x=>({Conta:x.name,Pago:x.paid,'A pagar':x.open,Total:x.total}))} filters={reportFilters} style={{float:'right'}}/>
      <div className="mgmt-panel-head"><div><h2>Despesas por conta</h2><p>As 10 maiores aparecem primeiro; clique em uma linha para ver os lançamentos.</p></div>{byAccount.length>10&&<button className="btn" onClick={()=>setShowAllAccounts(v=>!v)}>{showAllAccounts?<><ChevronUp size={15}/> Mostrar top 10</>:<><ChevronDown size={15}/> Ver todas ({byAccount.length})</>}</button>}</div>
      <div className="mgmt-table-wrap"><table className="mgmt-table mgmt-clickable-table"><thead><tr><th>Conta</th><th>Pago</th><th>A pagar</th><th>Total</th><th>% despesa</th></tr></thead><tbody>{visibleAccounts.map(x=><tr key={x.name} onClick={()=>setDetail({title:x.name,rows:x.rows})}><td><strong>{x.name}</strong></td><td className="mgmt-value-paid">{brl(x.paid)}</td><td className="mgmt-value-open">{brl(x.open)}</td><td><strong>{brl(x.total)}</strong></td><td>{paid+open>0?((x.total/(paid+open))*100).toFixed(1):'0,0'}%</td></tr>)}</tbody></table></div>
    </section>

    <section id="report-adm-equipe" data-report-section className="mgmt-panel">
      <ReportAdder sectionKey="administrativo:equipe-adm" title="Visão da Equipe Administrativa" componentName="Equipe Administrativa 2026" page="Administrativo" type="CHART" data={adminTeamMonthly} captureId="report-adm-equipe" filters={{Ano:2026}} style={{float:'right'}}/>
      <div className="mgmt-panel-head"><div><h2>Visão da equipe administrativa</h2><p>Regra anual: todo o pago em 2026 e todo o a pagar previsto até dezembro/2026.</p></div><InfoTooltip title="Equipe Administrativa" content="Este bloco ignora o filtro superior de período por regra: mostra o exercício completo de janeiro a dezembro/2026."/></div>
      <div className="mgmt-chart-sm"><ResponsiveContainer><LineChart data={adminTeamMonthly}><CartesianGrid strokeDasharray="3 3" opacity={0.16}/><XAxis dataKey="month" tick={{fontSize:10}}/><YAxis tickFormatter={compact} tick={{fontSize:10}}/><Tooltip formatter={v=>brl(v)}/><Legend/><Line type="monotone" dataKey="Pago" stroke={COLORS.paid} strokeWidth={2.5}/><Line type="monotone" dataKey="A pagar" stroke={COLORS.open} strokeWidth={2.5}/></LineChart></ResponsiveContainer></div>
      <div className="mgmt-table-wrap"><table className="mgmt-table mgmt-clickable-table"><thead><tr><th>Pessoa / empresa</th><th>Pago 2026</th><th>A pagar até dez/2026</th><th>Total</th></tr></thead><tbody>{adminTeam.map(x=><tr key={x.name} onClick={()=>setDetail({title:`Equipe ADM · ${x.name}`,rows:x.rows})}><td><strong>{x.name}</strong></td><td className="mgmt-value-paid">{brl(x.paid)}</td><td className="mgmt-value-open">{brl(x.open)}</td><td>{brl(x.total)}</td></tr>)}</tbody></table></div>
      {!adminTeam.length&&<p>Sem pessoas/empresas classificadas como Equipe ADM.</p>}
    </section>

    <section id="report-adm-socios" data-report-section className="mgmt-panel">
      <ReportAdder sectionKey="administrativo:socios" title="Movimentação dos Sócios" componentName="Salários e Retiradas dos Sócios" page="Administrativo" type="CHART" data={partnerMonthly} captureId="report-adm-socios" filters={{Ano:2026,Visão:partnerView}} style={{float:'right'}}/>
      <div className="mgmt-panel-head"><div><h2>Movimentação dos sócios</h2><p>Fixo e retirada separados, com análise individual ou conjunta.</p></div><div className="mgmt-segmented"><button className={partnerView==='TODOS'?'active':''} onClick={()=>setPartnerView('TODOS')}>Conjunto</button><button className={partnerView==='FRAN'?'active':''} onClick={()=>setPartnerView('FRAN')}>Francielle</button><button className={partnerView==='PAULO'?'active':''} onClick={()=>setPartnerView('PAULO')}>Paulo</button></div></div>

      <div className="mgmt-partner-summary">
        {partners.map(p=><button key={p.name} className="mgmt-partner-card" onClick={()=>setDetail({title:`Movimentação · ${p.name}`,rows:p.rows})}>
          <div className="mgmt-partner-name"><span>{p.name}</span><small>Fixo mensal de referência: {brl(p.fixed)}</small></div>
          <div><span>Fixo pago em 2026</span><strong className="mgmt-value-paid">{brl(p.fixedPaid)}</strong></div>
          <div><span>Retiradas em 2026</span><strong className="mgmt-value-open">{brl(p.withdrawal)}</strong></div>
          <div><span>Total movimentado</span><strong>{brl(p.fixedPaid+p.withdrawal)}</strong></div>
        </button>)}
      </div>

      <div className="mgmt-chart"><ResponsiveContainer><BarChart data={partnerMonthly}><CartesianGrid strokeDasharray="3 3" opacity={0.14}/><XAxis dataKey="month" tick={{fontSize:10}}/><YAxis tickFormatter={compact} tick={{fontSize:10}}/><Tooltip formatter={v=>brl(v)}/><Legend/>
        {partnerSeries.includes('Francielle · Fixo pago')&&<Bar dataKey="Francielle · Fixo pago" fill={COLORS.fran} opacity={0.82}/>}
        {partnerSeries.includes('Francielle · Retirada')&&<Bar dataKey="Francielle · Retirada" fill={COLORS.withdrawal}/>}
        {partnerSeries.includes('Paulo · Fixo pago')&&<Bar dataKey="Paulo · Fixo pago" fill={COLORS.paulo} opacity={0.82}/>}
        {partnerSeries.includes('Paulo · Retirada')&&<Bar dataKey="Paulo · Retirada" fill={COLORS.open}/>}
        {partnerView==='FRAN'&&<ReferenceLine y={25000} stroke={COLORS.fran} strokeDasharray="5 5" label={{value:'Fixo R$ 25 mil',fill:COLORS.fran,fontSize:10}}/>}
        {partnerView==='PAULO'&&<ReferenceLine y={42000} stroke={COLORS.paulo} strokeDasharray="5 5" label={{value:'Fixo R$ 42 mil',fill:COLORS.paulo,fontSize:10}}/>}
      </BarChart></ResponsiveContainer></div>
    </section>

    <section data-report-section style={{marginBottom:'2rem'}}>
      <ReportAdder sectionKey="administrativo:movimentacoes" title="Movimentações Financeiras — Administrativo" componentName="Tabela de Movimentações Administrativas" page="Administrativo" type="TABLE" data={reportMovementRows} dataSets={{summary:[{'Quantidade de lançamentos':reportMovementRows.length,'Pago':paid,'A pagar':open}],visible:reportMovementRows.slice(0,30),all:reportMovementRows}} detailMode="visible" detailOptions={['summary','visible','all']} filters={reportFilters} style={{float:'right'}}/>
      <h2 style={{fontSize:'18px',fontWeight:600,marginBottom:'1rem'}}>Movimentações Financeiras · Administrativo</h2>
      <p style={{fontSize:'12px',color:'var(--text-secondary)',marginBottom:'1rem'}}>Mesma estrutura do Fluxo de Caixa, restrita às contas pagas e a pagar do Administrativo. Receita não entra nesta tabela.</p>
      <DataTable data={adminFinancialRows} initialPageSize={30} pageSizeOptions={[30,60,90]}/>
    </section>

    <MovementModal title={detail?.title} rows={detail?.rows} onClose={()=>setDetail(null)}/>
  </div>;
}
