'use client';

import { useEffect, useMemo, useState } from 'react';
import { FileText, FileDown, FileSpreadsheet, ChevronDown, ChevronUp, X, Landmark, CircleDollarSign, Clock3, TrendingUp, Gauge, ReceiptText } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine
} from 'recharts';
import { useReport } from '@/contexts/ReportContext';
import ReportAdder from '@/components/report/ReportAdder';
import InfoTooltip from '@/components/InfoTooltip';
import DataTable from '@/components/DataTable';
import MultiSelect from '@/components/MultiSelect';
import { requestJson } from '@/lib/clientSync';
import FinancialRefreshButton from '@/components/FinancialRefreshButton';
import { exportReportToExcel, exportReportToPdf } from '@/lib/reportExport';
import '../equipe/management.css';
import '../equipe/managementExtras.css';

const COLORS={received:'#2563eb',paidExpense:'#ef4444',open:'#f59e0b',franFixed:'#8b5cf6',franWithdrawal:'#ec4899',pauloFixed:'#06b6d4',pauloWithdrawal:'#eab308'};
const brl=(n)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n)||0);
const compact=(n)=>new Intl.NumberFormat('pt-BR',{notation:'compact',maximumFractionDigits:1}).format(Number(n)||0);
const getDateKey=(raw)=>{const value=String(raw||'');let m=value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);if(m)return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;m=value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);return m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:'';};
const monthOf=(raw)=>getDateKey(raw).slice(0,7);
const monthLabel=(value)=>new Intl.DateTimeFormat('pt-BR',{month:'short',timeZone:'UTC'}).format(new Date(`${value}-01T12:00:00Z`));
const inRange=(row,start,end)=>{const key=getDateKey(row.data);if(!key)return false;return(!start||key>=start)&&(!end||key<=end)};
const planName=(value)=>String(value||'').replace(/^\s*\d{6,}\s*[-–—:]?\s*/,'').trim()||String(value||'').trim();
const accountOption=(row)=>{
  const code=String(row?.contaCodigo||'').replace(/\D/g,'');
  const name=planName(row?.contaNome||row?.contaDescricao||'');
  return code&&name?`${code} · ${name}`:(name||code||'Sem plano');
};
const expenseStatus=(row)=>row?.paid?'Pago':'A pagar';

function AdminMetricCard({ icon: Icon, label, value, info, tone = 'primary', percent = false }) {
  return <div className={`mgmt-metric-card tone-${tone}`}>
    <div className="mgmt-metric-top">
      <span className="mgmt-metric-icon"><Icon size={17}/></span>
      <InfoTooltip title={label} content={info}/>
    </div>
    <span className="mgmt-metric-label">{label}</span>
    <strong className="mgmt-metric-value">{percent ? `${(Number(value||0)*100).toFixed(1)}%` : brl(value)}</strong>
  </div>;
}

function MovementModal({title,rows,onClose}){
  if(!rows)return null;
  const paid=rows.filter(r=>r.paid).reduce((s,r)=>s+Number(r.valor||0),0);
  const open=rows.filter(r=>!r.paid).reduce((s,r)=>s+Number(r.valor||0),0);
  const monthly=Array.from({length:12},(_,i)=>{const key=`2026-${String(i+1).padStart(2,'0')}`;const items=rows.filter(r=>monthOf(r.data)===key);return{month:monthLabel(key),Pago:items.filter(r=>r.paid).reduce((s,r)=>s+Number(r.valor||0),0),'A pagar':items.filter(r=>!r.paid).reduce((s,r)=>s+Number(r.valor||0),0)}});
  const tableRows=rows.map(r=>({...r,natureza:'Saída',projeto:r.projeto||'ADMINISTRAÇÃO',contaDescricao:r.contaNome||r.contaCodigo||'',status:r.paid?'Realizado':'A realizar'}));
  const reportRows=rows.map(r=>({Data:r.data,Documento:r.documento||'',Lançamento:r.lancamento||r.titulo||'',Nome:r.nome,Conta:r.contaNome||r.contaCodigo||'',Situação:r.paid?'Pago':'A pagar',Valor:r.valor}));
  const sectionKey=`administrativo:detalhe:${title.replace(/[^a-z0-9]+/gi,'-').toLowerCase()}`;
  const exportItems=[
    {sectionKey:`${sectionKey}:resumo`,title:'Resumo',componentName:'Resumo do detalhamento administrativo',page:'Administrativo',type:'TABLE',filters:{Ano:2026},data:[{Descrição:title,Pago:paid,'A pagar':open,Total:paid+open,Lançamentos:rows.length}]},
    {sectionKey:`${sectionKey}:mensal`,title:'Relação mensal',componentName:'Relação mensal administrativa',page:'Administrativo',type:'TABLE',filters:{Ano:2026},data:monthly},
    {sectionKey:`${sectionKey}:movimentos`,title:'Lançamentos',componentName:'Detalhamento Administrativo',page:'Administrativo',type:'TABLE',filters:{Ano:2026},data:reportRows},
  ];
  const exportConfig={title,orientation:'auto',includeExplanations:true};
  return <div className="mgmt-overlay mgmt-overlay-center" onMouseDown={onClose}><div className="mgmt-modal-center" onMouseDown={e=>e.stopPropagation()}>
    <div className="mgmt-panel-head"><div><span className="mgmt-eyebrow">DETALHAMENTO · 2026</span><h2>{title}</h2><p>Pago {brl(paid)} · A pagar {brl(open)}</p></div><div className="mgmt-actions"><button className="btn" onClick={()=>exportReportToPdf(exportItems,exportConfig)}><FileDown size={15}/> PDF</button><button className="btn" onClick={()=>exportReportToExcel(exportItems,exportConfig)}><FileSpreadsheet size={15}/> Excel</button><ReportAdder sectionKey={sectionKey} title={title} componentName="Detalhamento Administrativo" page="Administrativo" type="TABLE" data={reportRows} filters={{Ano:2026}}/><button className="btn" onClick={onClose}><X size={16}/> Fechar</button></div></div>
    <section className="mgmt-subcard"><h3>Relação mensal</h3><div className="mgmt-chart-sm"><ResponsiveContainer><LineChart data={monthly}><CartesianGrid strokeDasharray="3 3" opacity={0.16}/><XAxis dataKey="month" tick={{fontSize:10}}/><YAxis tickFormatter={compact} tick={{fontSize:10}}/><Tooltip formatter={v=>brl(v)}/><Legend/><Line type="monotone" dataKey="Pago" stroke="#22c55e" strokeWidth={2.5}/><Line type="monotone" dataKey="A pagar" stroke={COLORS.open} strokeWidth={2.5}/></LineChart></ResponsiveContainer></div></section>
    <section className="mgmt-subcard" style={{marginTop:14}}><h3>Lançamentos</h3><p className="mgmt-muted">Filtros, 30 por página, 50 ou Todos.</p><DataTable data={tableRows} initialPageSize={30} pageSizeOptions={[30,50,'all']}/></section>
  </div></div>;
}

const scopeToken=(value)=>String(value||'item').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');

function DirectorPersonModal({ partner, projects, onProject, onClose }){
  if(!partner)return null;
  const paid=partner.rows.filter((row)=>row.paid).reduce((sum,row)=>sum+Number(row.valor||0),0);
  const open=partner.rows.filter((row)=>!row.paid).reduce((sum,row)=>sum+Number(row.valor||0),0);
  return <div className="mgmt-overlay mgmt-overlay-center" onMouseDown={onClose}>
    <div className="mgmt-modal-center" onMouseDown={(e)=>e.stopPropagation()}>
      <div className="mgmt-panel-head">
        <div><span className="mgmt-eyebrow">DIRETORA · 2026</span><h2>{partner.name}</h2><p>Pago {brl(paid)} · A pagar {brl(open)}</p></div>
        <button className="btn" onClick={onClose}><X size={16}/> Fechar</button>
      </div>

      <div className="mgmt-meta-grid mgmt-meta-grid-three">
        <div><span>Pago como equipe</span><strong className="mgmt-value-paid">{brl(partner.fixedPaid)}</strong></div>
        <div><span>Retiradas realizadas</span><strong>{brl(partner.withdrawal)}</strong></div>
        <div><span>Total mensal + retiradas</span><strong>{brl(Number(partner.fixedPaid||0)+Number(partner.withdrawal||0))}</strong></div>
      </div>

      <section className="mgmt-subcard" style={{marginTop:14}}>
        <h3>Resumo por obra</h3>
        <div className="mgmt-project-cards">
          {projects.map((item)=><button
            type="button"
            className="mgmt-project-card mgmt-project-card-button"
            key={item.name}
            onClick={()=>onProject({partner,project:item})}
          >
            <strong>{item.name}</strong>
            <div><span>Pago</span><b className="mgmt-value-paid">{brl(item.paid)}</b></div>
            <div><span>A pagar</span><b className="mgmt-value-open">{brl(item.open)}</b></div>
            <small>{item.rows.length} lançamento{item.rows.length!==1?'s':''} · clique para ver</small>
          </button>)}
        </div>
        {!projects.length&&<p className="mgmt-muted">Sem movimentações vinculadas a obras.</p>}
      </section>
    </div>
  </div>;
}

function DirectorProjectModal({ selection, onClose }){
  const {openReportBuilder}=useReport();
  if(!selection)return null;
  const {partner,project}=selection;
  const rows=project.rows||[];
  const tableRows=rows.map(r=>({...r,natureza:'Saída',projeto:r.projeto||project.name,contaDescricao:r.contaNome||r.contaCodigo||'',status:r.paid?'Realizado':'A realizar'}));
  const reportRows=rows.map(r=>({Data:r.data,Documento:r.documento||'',Lançamento:r.lancamento||r.titulo||'',Nome:r.nome||partner.name,Projeto:r.projeto||project.name,Conta:r.contaNome||r.contaCodigo||'',Situação:r.paid?'Pago':'A pagar',Valor:r.valor}));
  const scope=`administrativo:diretoria:pessoa-projeto:${scopeToken(partner.short)}:${scopeToken(project.name)}`;

  return <div className="mgmt-overlay mgmt-overlay-center mgmt-overlay-project" onMouseDown={onClose}>
    <div className="mgmt-modal-center mgmt-project-modal" onMouseDown={(e)=>e.stopPropagation()}>
      <div className="mgmt-panel-head">
        <div><span className="mgmt-eyebrow">MOVIMENTOS DA OBRA · 2026</span><h2>{project.name}</h2><p>{partner.name} · {rows.length} lançamento{rows.length!==1?'s':''}</p></div>
        <div className="mgmt-actions">
          <button className="btn" onClick={()=>openReportBuilder('Administrativo',scope,`${partner.name} · ${project.name}`)}><FileText size={15}/> Gerar Relatório</button>
          <button className="btn" onClick={onClose}><X size={16}/> Fechar</button>
        </div>
      </div>
      <div aria-hidden="true" style={{display:'none'}}>
        <ReportAdder
          sectionKey={`${scope}:resumo`}
          title={`Resumo — ${partner.name} — ${project.name}`}
          componentName="Resumo da Diretoria por Projeto"
          page="Administrativo"
          scope={scope}
          type="SUMMARY"
          data={[{Pessoa:partner.name,Projeto:project.name,Pago:project.paid,'A pagar':project.open,Total:project.paid+project.open,Lançamentos:rows.length}]}
          filters={{Pessoa:partner.name,Projeto:project.name}}
        />
        <ReportAdder
          sectionKey={`${scope}:movimentos`}
          title={`Movimentações — ${partner.name} — ${project.name}`}
          componentName="Movimentações da Diretoria por Projeto"
          page="Administrativo"
          scope={scope}
          type="TABLE"
          data={reportRows}
          filters={{Pessoa:partner.name,Projeto:project.name}}
        />
      </div>
      <DataTable data={tableRows} initialPageSize={30} pageSizeOptions={[30,50,'all']}/>
    </div>
  </div>;
}

export default function AdministrativeDashboard({ view = 'overview' }){
  const {isReportMode,openReportBuilder,exitReportMode}=useReport();
  const[data,setData]=useState({revenue:[],expenses:[],adminTeamRows:[],partnerRows:[],monthly:[]});
  const[startDate,setStartDate]=useState('2026-01-01');
  const[endDate,setEndDate]=useState('2026-12-31');
  const[personFilters,setPersonFilters]=useState([]);
  const[accountFilters,setAccountFilters]=useState([]);
  const[statusFilters,setStatusFilters]=useState([]);
  const[showAllAccounts,setShowAllAccounts]=useState(false);
  const[detail,setDetail]=useState(null);
  const[selectedDirectorPerson,setSelectedDirectorPerson]=useState(null);
  const[selectedDirectorProject,setSelectedDirectorProject]=useState(null);
  const[error,setError]=useState('');

  const reloadAdministrativeData=async()=>{
    const result=await requestJson('/api/administrativo');
    setData(result);
    setError('');
    return result;
  };

  useEffect(()=>{let active=true;requestJson('/api/administrativo').then(result=>{if(active){setData(result);setError('')}}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[]);

  const peopleOptions=useMemo(()=>[...new Set((data.expenses||[]).map(r=>r.nome).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR')),[data.expenses]);
  const accountOptions=useMemo(()=>[...new Set((data.expenses||[]).map(accountOption).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR')),[data.expenses]);

  const matchesExpenseFilters=(row,{ignoreDate=false}={})=>{
    if(!ignoreDate&&!inRange(row,startDate,endDate))return false;
    if(personFilters.length>0&&!personFilters.includes(row.nome))return false;
    if(accountFilters.length>0&&!accountFilters.includes(accountOption(row)))return false;
    if(statusFilters.length>0&&!statusFilters.includes(expenseStatus(row)))return false;
    return true;
  };

  const expenses=useMemo(()=>data.expenses.filter(r=>matchesExpenseFilters(r)),[data.expenses,startDate,endDate,personFilters,accountFilters,statusFilters]);
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
  const adminTeamYearRows=useMemo(()=>(data.adminTeamRows||[])
    .filter(r=>getDateKey(r.data)>='2026-01-01'&&getDateKey(r.data)<='2026-12-31')
    .filter(r=>matchesExpenseFilters(r,{ignoreDate:true})),[data.adminTeamRows,personFilters,accountFilters,statusFilters]);
  const adminTeam=useMemo(()=>{const map=new Map();adminTeamYearRows.forEach(r=>{const item=map.get(r.nome)||{name:r.nome,paid:0,open:0,rows:[]};item[r.paid?'paid':'open']+=Number(r.valor||0);item.rows.push(r);map.set(r.nome,item)});return[...map.values()].map(x=>({...x,total:x.paid+x.open})).sort((a,b)=>b.total-a.total)},[adminTeamYearRows]);
  const adminTeamMonthly=useMemo(()=>Array.from({length:12},(_,i)=>{const key=`2026-${String(i+1).padStart(2,'0')}`;const rows=adminTeamYearRows.filter(r=>monthOf(r.data)===key);return{month:monthLabel(key),Pago:rows.filter(r=>r.paid).reduce((s,r)=>s+Number(r.valor||0),0),'A pagar':rows.filter(r=>!r.paid).reduce((s,r)=>s+Number(r.valor||0),0)}}),[adminTeamYearRows]);

  const chartMonthly=useMemo(()=>Array.from({length:12},(_,i)=>{
    const key=`2026-${String(i+1).padStart(2,'0')}`;
    const active=(!startDate||`${key}-31`>=startDate)&&(!endDate||`${key}-01`<=endDate);
    const monthRevenue=(data.revenue||[]).filter(r=>r.month===key);
    const monthExpenses=expenses.filter(r=>monthOf(r.data)===key);
    const receivedAdmin=active?monthRevenue.filter(r=>r.realized).reduce((s,r)=>s+Number(r.adminValue||0),0):0;
    const forecastAdmin=active&&i>=9
      ? monthRevenue.filter(r=>!r.realized).reduce((s,r)=>s+Number(r.adminValue||0),0)
      : 0;
    const paidExpense=active?monthExpenses.filter(r=>r.paid).reduce((s,r)=>s+Number(r.valor||0),0):0;
    const openExpense=active?monthExpenses.filter(r=>!r.paid).reduce((s,r)=>s+Number(r.valor||0),0):0;
    return{
      month:monthLabel(key),
      'Recebido ADM':receivedAdmin,
      'Previsão recebimento ADM':forecastAdmin,
      'Despesa paga':paidExpense,
      'A pagar':openExpense,
    };
  }),[data.revenue,expenses,startDate,endDate]);

  const partnerDefs=[
    {token:'FRANCIELLE',name:'Francielle Paiva',short:'Francielle',fixed:25000},
    {token:'PAULO HENRIQUE LEMES ARAUJO',name:'Paulo Henrique Lemes Araujo',short:'Paulo',fixed:42000}
  ];
  const partners=useMemo(()=>partnerDefs.map(def=>{
    const rows=(data.partnerRows||[])
      .filter(r=>String(r.nome||'').toUpperCase().includes(def.token)&&getDateKey(r.data)>='2026-01-01'&&getDateKey(r.data)<='2026-12-31')
      .filter(r=>matchesExpenseFilters(r,{ignoreDate:true}));
    const fixedRows=rows.filter(r=>r.type==='EQUIPE_ADM_SOCIO');
    const withdrawalRows=rows.filter(r=>r.type==='RETIRADA');
    const otherRows=rows.filter(r=>r.type==='OUTRO_PAGAMENTO_SOCIO');
    return{
      ...def,
      rows,
      fixedPaid:fixedRows.filter(r=>r.paid).reduce((s,r)=>s+Number(r.valor||0),0),
      fixedOpen:fixedRows.filter(r=>!r.paid).reduce((s,r)=>s+Number(r.valor||0),0),
      withdrawal:withdrawalRows.filter(r=>r.paid).reduce((s,r)=>s+Number(r.valor||0),0),
      otherPaid:otherRows.filter(r=>r.paid).reduce((s,r)=>s+Number(r.valor||0),0),
    };
  }),[data.partnerRows,personFilters,accountFilters,statusFilters]);

  const partnerMonthly=useMemo(()=>Array.from({length:12},(_,i)=>{const key=`2026-${String(i+1).padStart(2,'0')}`;const row={month:monthLabel(key)};partners.forEach(p=>{const rows=p.rows.filter(r=>monthOf(r.data)===key);row[`${p.short} · Fixo pago`]=rows.filter(r=>r.type==='EQUIPE_ADM_SOCIO'&&r.paid).reduce((s,r)=>s+Number(r.valor||0),0);row[`${p.short} · Retirada`]=rows.filter(r=>r.type==='RETIRADA'&&r.paid).reduce((s,r)=>s+Number(r.valor||0),0)});return row}),[partners]);

  const partnerGeneralMonthly=useMemo(()=>partnerMonthly.map((row)=>({
    month:row.month,
    'Equipe ADM':Number(row['Francielle · Fixo pago']||0)+Number(row['Paulo · Fixo pago']||0),
    'Retiradas':Number(row['Francielle · Retirada']||0)+Number(row['Paulo · Retirada']||0),
  })),[partnerMonthly]);

  const directorSummary=useMemo(()=>{
    const withdrawals=partners.reduce((sum,partner)=>sum+Number(partner.withdrawal||0),0);
    const teamPaid=partners.reduce((sum,partner)=>sum+Number(partner.fixedPaid||0),0);
    return {
      withdrawals,
      teamPaid,
      total:withdrawals+teamPaid,
    };
  },[partners]);

  const projectParticipation=useMemo(()=>Object.fromEntries(partners.map((partner)=>{
    const map=new Map();
    partner.rows
      .forEach((row)=>{
        const project=String(row.projeto||'').trim();
        const normalized=project.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
        if(!project||normalized.includes('ADMINISTR')||normalized==='PROJETOS'||normalized==='SEM PROJETO') return;
        const item=map.get(project)||{name:project,paid:0,open:0,rows:[]};
        item[row.paid?'paid':'open']+=Number(row.valor||0);
        item.rows.push(row);
        map.set(project,item);
      });
    return [partner.short,[...map.values()]
      .map((item)=>({...item,paid:Math.round(item.paid*100)/100,open:Math.round(item.open*100)/100}))
      .sort((a,b)=>(b.paid+b.open)-(a.paid+a.open))];
  })),[partners]);

  const franMonthly=partnerMonthly.map((row)=>({month:row.month,'Fixo pago':row['Francielle · Fixo pago'],'Retirada':row['Francielle · Retirada']}));
  const pauloMonthly=partnerMonthly.map((row)=>({month:row.month,'Fixo pago':row['Paulo · Fixo pago'],'Retirada':row['Paulo · Retirada']}));

  const directorFinancialRows=useMemo(()=>partners
    .flatMap((partner)=>partner.rows.map((row)=>({
      ...row,
      natureza:'Saída',
      projeto:row.projeto||'ADMINISTRAÇÃO',
      contaDescricao:row.contaNome||row.contaCodigo||'',
      status:row.paid?'Realizado':'A realizar',
    })))
    .sort((a,b)=>getDateKey(b.data).localeCompare(getDateKey(a.data))),[partners]);

  const directorReportRows=useMemo(()=>directorFinancialRows.map((row)=>({
    Data:row.data,
    Pessoa:row.nome,
    Projeto:row.projeto||'ADMINISTRAÇÃO',
    Conta:row.contaNome||row.contaCodigo||'',
    Documento:row.documento||'',
    Lançamento:row.lancamento||row.titulo||'',
    Situação:row.paid?'Pago':'A pagar',
    Valor:row.valor,
  })),[directorFinancialRows]);


  const adminFinancialRows=useMemo(()=>expenses.map(r=>({...r,natureza:'Saída',projeto:'ADMINISTRAÇÃO',contaDescricao:r.contaNome||r.contaCodigo,status:r.paid?'Realizado':'A realizar'})),[expenses]);
  const reportFilters={
    'Data inicial':startDate,
    'Data final':endDate,
    'Pessoa / fornecedor':personFilters.length?personFilters.join(', '):'Todos',
    'Plano de contas':accountFilters.length?accountFilters.join(', '):'Todos',
    'Situação':statusFilters.length?statusFilters.join(', '):'Todas',
  };
  const reportMovementRows=adminFinancialRows.map(r=>({Data:r.data,'Nome / fornecedor':r.nome,Conta:r.contaDescricao,Documento:r.documento||'',Lançamento:r.lancamento||r.titulo||'',Situação:r.paid?'Pago':'A pagar',Valor:r.valor}));

  const partnerSection=<section id="report-adm-socios" data-report-section className="mgmt-panel">
    <ReportAdder sectionKey="administrativo:socios" title="Visão Geral dos Sócios" componentName="Movimentação Geral dos Sócios" page="Administrativo" type="CHART" data={partnerGeneralMonthly} captureId="report-adm-socios" filters={{Ano:2026}} style={{float:'right'}}/>
    <div className="mgmt-panel-head"><div><h2>Visão geral dos sócios</h2><p>Leitura mensal consolidada: Equipe ADM dos dois e retiradas dos dois.</p></div></div>

    <div className="mgmt-partner-summary">
      {partners.map(p=><div key={p.name} className="mgmt-partner-card mgmt-partner-card-light">
        <div className="mgmt-partner-name"><span>{p.name}</span><small>Visão financeira individual</small></div>
        <div><span>Pago como equipe em 2026</span><strong className="mgmt-value-paid">{brl(p.fixedPaid)}</strong></div>
        <div><span>A pagar como equipe</span><strong className="mgmt-value-open">{brl(p.fixedOpen)}</strong></div>
        <div><span>Retiradas realizadas</span><strong>{brl(p.withdrawal)}</strong></div>
      </div>)}
    </div>

    <div className="mgmt-chart mgmt-partner-general-chart"><ResponsiveContainer><LineChart data={partnerGeneralMonthly} margin={{top:12,right:18,left:0,bottom:4}}><CartesianGrid strokeDasharray="2 6" opacity={0.09} vertical={false}/><XAxis dataKey="month" tick={{fontSize:10}} axisLine={false} tickLine={false}/><YAxis tickFormatter={compact} tick={{fontSize:10}} axisLine={false} tickLine={false}/><Tooltip formatter={(v)=>brl(v)} contentStyle={{borderRadius:10,padding:'9px 11px',fontSize:11,boxShadow:'0 10px 28px rgba(0,0,0,.14)'}} cursor={{stroke:'var(--border-color)',strokeWidth:1}}/><Legend iconType="circle" wrapperStyle={{fontSize:11}}/>
      <Line type="monotone" dataKey="Equipe ADM" stroke={COLORS.received} strokeWidth={2.6} dot={false} activeDot={{r:4}}/>
      <Line type="monotone" dataKey="Retiradas" stroke={COLORS.franWithdrawal} strokeWidth={2.6} dot={false} activeDot={{r:4}}/>
    </LineChart></ResponsiveContainer></div>
  </section>;

  if(view==='socios'){
    const fran=partners.find((p)=>p.short==='Francielle');
    const paulo=partners.find((p)=>p.short==='Paulo');
    const directorPanels=[
      {partner:fran,monthly:franMonthly,projects:projectParticipation.Francielle||[],tone:'fran'},
      {partner:paulo,monthly:pauloMonthly,projects:projectParticipation.Paulo||[],tone:'paulo'},
    ].filter((item)=>item.partner);

    return <div className="mgmt mgmt-admin mgmt-fin-diretoria">
      <header className="mgmt-header mgmt-director-header">
        <div><span className="mgmt-eyebrow">ADMINISTRATIVO · DIRETORIA · 2026</span><h1>Diretora</h1><p>Visão financeira de Francielle Paiva e Paulo Henrique Lemes Araujo.</p></div>
        <div className="mgmt-actions">
          <FinancialRefreshButton onUpdated={reloadAdministrativeData} onError={setError} label="Atualizar"/>
          <button onClick={()=>isReportMode?exitReportMode():openReportBuilder('Administrativo')} className={`btn btn-quiet ${isReportMode?'btn-primary':''}`}><FileText size={14}/>{isReportMode?'Sair do relatório':'Relatório'}</button>
        </div>
      </header>
      {error&&<div className="mgmt-alert">{error}</div>}

      <div className="mgmt-metrics-grid mgmt-director-summary">
        <AdminMetricCard icon={CircleDollarSign} label="Total de retiradas" value={directorSummary.withdrawals} tone="warning" info="Soma das retiradas realizadas de Francielle e Paulo em 2026."/>
        <AdminMetricCard icon={ReceiptText} label="Pagamento mensal" value={directorSummary.teamPaid} tone="success" info="Soma dos pagamentos mensais realizados aos dois no plano de Equipe ADM em 2026."/>
        <AdminMetricCard icon={Landmark} label="Total geral" value={directorSummary.total} tone="info" info="Total de retiradas + pagamentos mensais realizados para Francielle e Paulo em 2026."/>
      </div>

      {partnerSection}

      <div className="mgmt-director-grid">
        {directorPanels.map(({partner,monthly,projects,tone})=><section key={partner.short} className="mgmt-panel mgmt-director-panel" data-report-section>
          <div className="mgmt-panel-head">
            <div><span className="mgmt-eyebrow">{partner.short.toUpperCase()} · VISÃO INDIVIDUAL</span><h2>{partner.name}</h2><p>Fixo pago, retiradas e participação financeira por projeto.</p></div>
            <ReportAdder sectionKey={`administrativo:diretoria:${partner.short.toLowerCase()}`} title={`Diretora · ${partner.short}`} componentName={`Visão individual · ${partner.short}`} page="Administrativo" type="CHART" data={monthly} filters={{Ano:2026}}/>
          </div>

          <button className="btn btn-primary mgmt-director-open-primary" onClick={()=>setSelectedDirectorPerson(partner)}>
            Ver resumo por obra
          </button>

          <div className="mgmt-chart-sm mgmt-director-chart"><ResponsiveContainer><BarChart data={monthly}><CartesianGrid strokeDasharray="3 3" opacity={0.12}/><XAxis dataKey="month" tick={{fontSize:10}}/><YAxis tickFormatter={compact} tick={{fontSize:10}}/><Tooltip formatter={v=>brl(v)}/><Legend/>
            <Bar dataKey="Fixo pago" fill={tone==='fran'?COLORS.franFixed:COLORS.pauloFixed} opacity={0.9}/>
            <Bar dataKey="Retirada" fill={tone==='fran'?COLORS.franWithdrawal:COLORS.pauloWithdrawal}/>
            <ReferenceLine y={partner.fixed} stroke={tone==='fran'?COLORS.franFixed:COLORS.pauloFixed} strokeDasharray="5 5" label={{value:`Fixo ${brl(partner.fixed)}`,fill:tone==='fran'?COLORS.franFixed:COLORS.pauloFixed,fontSize:9}}/>
          </BarChart></ResponsiveContainer></div>


        </section>)}
      </div>

      <section className="mgmt-panel mgmt-director-movements-unified" data-report-section>
        <div className="mgmt-panel-head">
          <div><h2>Movimentação Financeira</h2><p>Movimentações de Francielle Paiva e Paulo Henrique Lemes Araujo em uma única relação.</p></div>
          <ReportAdder
            sectionKey="administrativo:diretora:movimentacoes"
            title="Movimentação Financeira — Diretora"
            componentName="Movimentação Financeira da Diretora"
            page="Administrativo"
            type="TABLE"
            data={directorReportRows}
            dataSets={{summary:[{'Quantidade de lançamentos':directorReportRows.length}],visible:directorReportRows.slice(0,30),all:directorReportRows}}
            detailMode="visible"
            detailOptions={['summary','visible','all']}
            filters={{Ano:2026,Pessoas:'Francielle Paiva + Paulo Henrique Lemes Araujo'}}
          />
        </div>
        <DataTable data={directorFinancialRows} initialPageSize={30} pageSizeOptions={[30,50,'all']}/>
      </section>

      <MovementModal title={detail?.title} rows={detail?.rows} onClose={()=>setDetail(null)}/>
      <DirectorPersonModal
        partner={selectedDirectorPerson}
        projects={selectedDirectorPerson ? (projectParticipation[selectedDirectorPerson.short]||[]) : []}
        onProject={setSelectedDirectorProject}
        onClose={()=>setSelectedDirectorPerson(null)}
      />
      <DirectorProjectModal selection={selectedDirectorProject} onClose={()=>setSelectedDirectorProject(null)}/>
    </div>;
  }

  return <div className="mgmt mgmt-admin">
    <header className="mgmt-header">
      <div><span className="mgmt-eyebrow">ADMINISTRATIVO · EXERCÍCIO 2026</span><h1>Administrativo</h1><p>Receita administrativa, custos, equipe ADM, sócios e contas a pagar.</p></div>
      <div className="mgmt-actions">
        <FinancialRefreshButton onUpdated={reloadAdministrativeData} onError={setError} label="Atualizar dados"/>
        <button onClick={()=>isReportMode?exitReportMode():openReportBuilder('Administrativo')} className={`btn ${isReportMode?'btn-primary':''}`}><FileText size={14}/>{isReportMode?'Sair do Modo Relatório':'Gerar Relatório'}</button>
      </div>
    </header>
    {error&&<div className="mgmt-alert">{error}</div>}

    <section className="mgmt-panel mgmt-admin-filters">
      <div className="mgmt-panel-head">
        <div><h2>Período de análise</h2><p>Selecione o intervalo dentro do exercício de 2026.</p></div>
      </div>
      <div className="mgmt-filter-grid mgmt-admin-filter-grid">
        <label>Data inicial<input type="date" min="2026-01-01" max="2026-12-31" value={startDate} onChange={e=>setStartDate(e.target.value)}/></label>
        <label>Data final<input type="date" min="2026-01-01" max="2026-12-31" value={endDate} onChange={e=>setEndDate(e.target.value)}/></label>
        <label>Pessoa / fornecedor<MultiSelect options={peopleOptions} selected={personFilters} onChange={setPersonFilters} placeholder="Todas as pessoas"/></label>
        <label>Plano de contas<MultiSelect options={accountOptions} selected={accountFilters} onChange={setAccountFilters} placeholder="Todos os planos"/></label>
        <label>Situação<MultiSelect options={['Pago','A pagar']} selected={statusFilters} onChange={setStatusFilters} placeholder="Todas as situações"/></label>
      </div>
    </section>

    <section className="mgmt-revenue-section" data-report-section>
      <div className="mgmt-revenue-report">
        <ReportAdder sectionKey="administrativo:receita-20" title="Receita Administrativa — 20%" componentName="Resumo de Receita Administrativa" page="Administrativo" type="SUMMARY" data={[{'Receita ADM':revenueTotal,'Recebido ADM':received,'A receber ADM':receivable}]} filters={reportFilters}/>
      </div>
      <div className="mgmt-revenue-banner">
        <div className="tone-primary"><div className="mgmt-banner-head"><span className="mgmt-banner-icon"><Landmark size={18}/></span><div className="mgmt-kpi-title"><span>20% · Receita administrativa</span><InfoTooltip title="Receita administrativa" content="20% das receitas dos projetos no período selecionado, conforme a regra de rateio administrativo do painel."/></div></div><strong>{brl(revenueTotal)}</strong><small>Parcela administrativa das receitas</small></div>
        <div className="tone-success"><div className="mgmt-banner-head"><span className="mgmt-banner-icon"><CircleDollarSign size={18}/></span><div className="mgmt-kpi-title"><span>20% já recebido</span><InfoTooltip title="Recebido ADM" content="Parcela administrativa correspondente às receitas já realizadas/recebidas."/></div></div><strong>{brl(received)}</strong><small>Receita ADM realizada</small></div>
        <div className="tone-warning"><div className="mgmt-banner-head"><span className="mgmt-banner-icon"><Clock3 size={18}/></span><div className="mgmt-kpi-title"><span>20% a receber</span><InfoTooltip title="A receber ADM" content="Parcela administrativa das receitas previstas e ainda não recebidas até o fim do período."/></div></div><strong>{brl(receivable)}</strong><small>Receita ADM prevista</small></div>
      </div>
    </section>

    <div className="mgmt-metrics-grid">
      <AdminMetricCard icon={ReceiptText} label="Despesas pagas" value={paid} tone="danger" info="Total efetivamente pago no centro de custo ADMINISTRAÇÃO dentro do período selecionado."/>
      <AdminMetricCard icon={Clock3} label="Despesas a pagar" value={open} tone="warning" info="Compromissos administrativos ainda em aberto dentro do período selecionado."/>
      <AdminMetricCard icon={TrendingUp} label="Resultado projetado" value={result} tone={result>=0?'success':'danger'} info="Receita ADM menos despesas já pagas e valores ainda a pagar."/>
      <AdminMetricCard icon={Gauge} label="Cobertura da despesa" value={coverage} percent tone="info" info="Percentual das despesas totais do período coberto pela Receita Administrativa de 20%."/>
    </div>

    <section id="report-adm-receita-despesa" data-report-section className="mgmt-panel mgmt-panel-wide">
      <div className="mgmt-panel-head">
        <div><h2>Receita x despesa · Jan–Dez/2026</h2><p>Recebido administrativo, previsão de recebimento de out–dez/2026, despesas pagas e compromissos em aberto.</p></div>
        <ReportAdder sectionKey="administrativo:receita-despesa" title="Receita x Despesa — 2026" componentName="Gráfico Receita x Despesa" page="Administrativo" type="CHART" data={chartMonthly} filters={{...reportFilters,'Previsão de recebimento':'Out–Dez/2026'}} captureId="report-adm-receita-despesa"/>
      </div>
      <div className="mgmt-chart mgmt-chart-wide"><ResponsiveContainer><BarChart data={chartMonthly}><CartesianGrid strokeDasharray="3 3" opacity={0.16}/><XAxis dataKey="month" tick={{fontSize:10}}/><YAxis tickFormatter={compact} tick={{fontSize:10}}/><Tooltip formatter={v=>brl(v)}/><Legend/><Bar dataKey="Recebido ADM" fill={COLORS.received} radius={[4,4,0,0]}/><Bar dataKey="Previsão recebimento ADM" fill="#0ea5e9" radius={[4,4,0,0]}/><Bar dataKey="Despesa paga" fill={COLORS.paidExpense} radius={[4,4,0,0]}/><Bar dataKey="A pagar" fill={COLORS.open} radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div>
    </section>

    <section className="mgmt-panel" data-report-section>
      <ReportAdder sectionKey="administrativo:despesas-conta" title="Despesas por Conta" componentName="Tabela das Principais Contas Administrativas" page="Administrativo" type="TABLE" data={byAccount.map(x=>({Conta:x.name,Pago:x.paid,'A pagar':x.open,Total:x.total}))} filters={reportFilters} style={{float:'right'}}/>
      <div className="mgmt-panel-head"><div><h2>Despesas por conta</h2><p>As 10 maiores aparecem primeiro; clique em uma linha para ver os lançamentos.</p></div>{byAccount.length>10&&<button className="btn" onClick={()=>setShowAllAccounts(v=>!v)}>{showAllAccounts?<><ChevronUp size={15}/> Mostrar top 10</>:<><ChevronDown size={15}/> Ver todas ({byAccount.length})</>}</button>}</div>
      <div className="mgmt-table-wrap"><table className="mgmt-table mgmt-clickable-table"><thead><tr><th>Conta</th><th>Pago</th><th>A pagar</th><th>Total</th><th>% despesa</th></tr></thead><tbody>{visibleAccounts.map(x=><tr key={x.name} onClick={()=>setDetail({title:x.name,rows:x.rows})}><td><strong>{x.name}</strong></td><td className="mgmt-value-paid">{brl(x.paid)}</td><td className="mgmt-value-open">{brl(x.open)}</td><td><strong>{brl(x.total)}</strong></td><td>{paid+open>0?((x.total/(paid+open))*100).toFixed(1):'0,0'}%</td></tr>)}</tbody></table></div>
    </section>

    <section id="report-adm-equipe" data-report-section className="mgmt-panel">
      <ReportAdder sectionKey="administrativo:equipe-adm" title="Visão da Equipe Administrativa" componentName="Equipe Administrativa 2026" page="Administrativo" type="CHART" data={adminTeamMonthly} captureId="report-adm-equipe" filters={{Ano:2026}} style={{float:'right'}}/>
      <div className="mgmt-panel-head"><div><h2>Visão da equipe administrativa</h2><p>Regra anual: todo o pago em 2026 e todo o a pagar previsto até dezembro/2026.</p></div><InfoTooltip title="Equipe Administrativa" content="Este bloco ignora o filtro superior de período por regra: mostra o exercício completo de janeiro a dezembro/2026."/></div>
      <div className="mgmt-chart-sm"><ResponsiveContainer><LineChart data={adminTeamMonthly}><CartesianGrid strokeDasharray="3 3" opacity={0.16}/><XAxis dataKey="month" tick={{fontSize:10}}/><YAxis tickFormatter={compact} tick={{fontSize:10}}/><Tooltip formatter={v=>brl(v)}/><Legend/><Line type="monotone" dataKey="Pago" stroke="#22c55e" strokeWidth={2.5}/><Line type="monotone" dataKey="A pagar" stroke={COLORS.open} strokeWidth={2.5}/></LineChart></ResponsiveContainer></div>
      <div className="mgmt-table-wrap"><table className="mgmt-table mgmt-clickable-table"><thead><tr><th>Pessoa / empresa</th><th>Pago 2026</th><th>A pagar até dez/2026</th><th>Total</th></tr></thead><tbody>{adminTeam.map(x=><tr key={x.name} onClick={()=>setDetail({title:`Equipe ADM · ${x.name}`,rows:x.rows})}><td><strong>{x.name}</strong></td><td className="mgmt-value-paid">{brl(x.paid)}</td><td className="mgmt-value-open">{brl(x.open)}</td><td>{brl(x.total)}</td></tr>)}</tbody></table></div>
      {!adminTeam.length&&<p>Sem pessoas/empresas classificadas como Equipe ADM.</p>}
    </section>

    <section data-report-section style={{marginBottom:'2rem'}}>
      <ReportAdder sectionKey="administrativo:movimentacoes" title="Movimentações Financeiras — Administrativo" componentName="Tabela de Movimentações Administrativas" page="Administrativo" type="TABLE" data={reportMovementRows} dataSets={{summary:[{'Quantidade de lançamentos':reportMovementRows.length,'Pago':paid,'A pagar':open}],visible:reportMovementRows.slice(0,30),all:reportMovementRows}} detailMode="visible" detailOptions={['summary','visible','all']} filters={reportFilters} style={{float:'right'}}/>
      <h2 style={{fontSize:'18px',fontWeight:600,marginBottom:'1rem'}}>Movimentações Financeiras · Administrativo</h2>
      <p style={{fontSize:'12px',color:'var(--text-secondary)',marginBottom:'1rem'}}>Mesma estrutura do Fluxo de Caixa, restrita às contas pagas e a pagar do Administrativo. Receita não entra nesta tabela.</p>
      <DataTable data={adminFinancialRows} initialPageSize={30} pageSizeOptions={[30,50,'all']}/>
    </section>

    <MovementModal title={detail?.title} rows={detail?.rows} onClose={()=>setDetail(null)}/>
  </div>;
}
