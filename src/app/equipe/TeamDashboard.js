'use client';
import { applyValidFilterDate } from '@/lib/dateRange';

import { useEffect, useMemo, useState } from 'react';
import { FileText, X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Wallet, CircleDollarSign, Clock3, UsersRound, BriefcaseBusiness, Building2 } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar
} from 'recharts';
import { useReport } from '@/contexts/ReportContext';
import ReportAdder from '@/components/report/ReportAdder';
import InfoTooltip from '@/components/InfoTooltip';
import DataTable from '@/components/DataTable';
import MultiSelect from '@/components/MultiSelect';
import { requestJson } from '@/lib/clientSync';
import FinancialRefreshButton from '@/components/FinancialRefreshButton';
import './management.css';
import './managementExtras.css';

const PAID_COLOR = '#22c55e';
const OPEN_COLOR = '#f59e0b';
const PLAN_COLORS = ['#3b82f6','#a855f7','#14b8a6','#f97316','#e11d48','#64748b','#84cc16','#06b6d4'];
const TEAM_PERIOD_START = '2025-01-01';
const TEAM_DEFAULT_START = '2026-01-01';
const TEAM_PERIOD_END = '2026-12-31';
const monthKeysBetween = (start=TEAM_PERIOD_START,end=TEAM_PERIOD_END) => {
  const safeStart = /^\d{4}-\d{2}/.test(String(start||'')) ? String(start).slice(0,7) : TEAM_PERIOD_START.slice(0,7);
  const safeEnd = /^\d{4}-\d{2}/.test(String(end||'')) ? String(end).slice(0,7) : TEAM_PERIOD_END.slice(0,7);
  const [startYear,startMonth]=safeStart.split('-').map(Number);
  const [endYear,endMonth]=safeEnd.split('-').map(Number);
  const result=[];
  let year=startYear;
  let month=startMonth;
  while(result.length < 36 && (year<endYear || (year===endYear && month<=endMonth))){
    result.push(`${year}-${String(month).padStart(2,'0')}`);
    month+=1;
    if(month===13){month=1;year+=1}
  }
  return result;
};
const monthPeriodLabel = (key) => new Intl.DateTimeFormat('pt-BR',{month:'short',year:'2-digit',timeZone:'UTC'}).format(new Date(`${key}-01T12:00:00Z`));
const financePlan = (row) => accountOptionLabel(row.contaCodigo,row.contaNome||row.contaDescricao);
const monthlyByPlan = (rows,startDate,endDate) => {
  const planTotals = new Map();
  const months = monthKeysBetween(startDate,endDate).map((key)=>({month:monthPeriodLabel(key),key,Pago:0,'A pagar':0}));
  const perMonth = new Map(months.map(month=>[month.key,month]));
  (rows||[]).forEach(row=>{
    const key=getMonth(row.data);
    const month=perMonth.get(key);
    if(!month)return;
    const plan=financePlan(row);
    if(!planTotals.has(plan))planTotals.set(plan,{plan,paid:0,open:0,count:0});
    const total=planTotals.get(plan);
    const value=Number(row.valor)||0;
    total[row.paid?'paid':'open']+=value;
    total.count+=1;
    month[row.paid?'Pago':'A pagar']+=value;
    if(row.paid)month[plan]=(month[plan]||0)+value;
  });
  const plans=[...planTotals.values()].sort((a,b)=>(b.paid+b.open)-(a.paid+a.open)||a.plan.localeCompare(b.plan,'pt-BR'));
  return {plans,months,planKeys:plans.filter(plan=>plan.paid!==0).map(plan=>plan.plan)};
};
const PRIMARY_COLOR = '#3b82f6';
const brl = (n) => new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format(Number(n)||0);
const compact = (n) => new Intl.NumberFormat('pt-BR', { notation:'compact', maximumFractionDigits:1 }).format(Number(n)||0);
const norm = (v) => String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
const getDateKey = (raw) => {
  const value=String(raw??'').trim();
  // Datas Excel numéricas também devem alimentar o filtro e o gráfico mensal.
  if (/^\d{5}(?:\.\d+)?$/.test(value)) {
    const serial=Number(value);
    if(serial>=20000&&serial<=80000) {
      const date=new Date(Date.UTC(1899,11,30)+Math.floor(serial)*86400000);
      return Number.isNaN(date.getTime())?'':date.toISOString().slice(0,10);
    }
  }
  let m=value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if(m) return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
  m=value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}` : '';
};
const getMonth = (raw) => getDateKey(raw).slice(0,7);
const monthLabel = (key) => new Intl.DateTimeFormat('pt-BR',{month:'short',timeZone:'UTC'}).format(new Date(`${key}-01T12:00:00Z`));
const formatPeriodDate = (value) => {
  const key=String(value||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(key))return key||'—';
  const [year,month,day]=key.split('-');
  return `${day}/${month}/${year}`;
};
const selectedPeriodLabel = (start,end) => `${formatPeriodDate(start)} a ${formatPeriodDate(end)}`;
const isFullTeamPeriod = (start,end) => start===TEAM_PERIOD_START&&end===TEAM_PERIOD_END;
const inRange = (row,start,end) => {
  const key=getDateKey(row.data);
  if(!key) return false;
  return (!start||key>=start)&&(!end||key<=end);
};
const inTeamRelationScope = (entry,row) => {
  const key=getDateKey(row.data);
  if(!key)return false;
  if(inRange(row,TEAM_PERIOD_START,TEAM_PERIOD_END))return true;
  return Boolean(entry?.thirdParty && !row?.paid && key>TEAM_PERIOD_END);
};

const projectCodeLabel = (value) => {
  const raw=String(value||'').trim();
  const match=raw.match(/(?:^|\b)P?\.?\s*(\d{3,4}[A-Z0-9]*)/i);
  return match?.[1] || raw.split(/[-\s]/)[0] || raw;
};
const planLabel = (value) => String(value||'')
  .replace(/^\s*\d{6,}\s*[-–—:]?\s*/, '')
  .trim() || String(value||'').trim();
const accountOptionLabel = (code, name) => {
  const normalizedCode=String(code||'').replace(/\D/g,'');
  const normalizedName=planLabel(name);
  if(normalizedCode&&normalizedName)return `${normalizedCode} · ${normalizedName}`;
  return normalizedName || normalizedCode || 'Sem plano';
};
const entryAccountOptions = (entry) => {
  const values=new Set();
  (entry.transactions||[]).forEach(row=>{
    if(row.contaNome||row.contaCodigo||row.contaDescricao) values.add(accountOptionLabel(row.contaCodigo,row.contaNome||row.contaDescricao));
  });
  return [...values].filter(Boolean);
};
const rowAccountOption = (row) => accountOptionLabel(row.contaCodigo,row.contaNome||row.contaDescricao);
const toFinancialRows = (rows, personName) => (rows||[]).map((row)=>({
  ...row,
  natureza:'Saída',
  nome:personName || row.nome,
  contaDescricao:row.contaNome || row.contaDescricao || row.contaCodigo || '',
  status:row.paid ? 'Realizado' : 'A realizar',
  projeto:row.projeto || '',
}));

const reportMovementRows = (rows, personName) => (rows||[]).map((r)=>({
  Data:r.data||'',
  'Pessoa / empresa':personName || r.rosterPerson || r.nome || '',
  Documento:r.documento||r.titulo||'',
  Obra:r.projeto||'',
  Plano:planLabel(r.contaNome||r.contaCodigo),
  Situação:r.paid?'Pago':'A pagar',
  Valor:Number(r.valor||0),
}));

function MetricCard({ icon: Icon, label, value, info, tone = 'primary', currency = true }) {
  return <div className={`mgmt-metric-card tone-${tone}`} data-report-section>
    <div className="mgmt-metric-top">
      <span className="mgmt-metric-icon"><Icon size={17}/></span>
      <InfoTooltip title={label} content={info}/>
    </div>
    <span className="mgmt-metric-label">{label}</span>
    <strong className="mgmt-metric-value">{currency ? brl(value) : value}</strong>
  </div>;
}

function Pager({ total, page, setPage, pageSize, setPageSize }) {
  const showAll = pageSize === 'all';
  const effective = showAll ? Math.max(total, 1) : Number(pageSize) || 10;
  const pages = showAll ? 1 : Math.max(1, Math.ceil(total / effective));
  const current = Math.min(page, pages);
  return <div className="mgmt-pagination">
    <span>{total===0?'0 registros':showAll?`Exibindo todos os ${total}`:`Página ${current} de ${pages} · ${total} registros`}</span>
    <div className="mgmt-pagination-actions">
      <select value={pageSize} onChange={(e)=>{setPageSize(e.target.value==='all'?'all':Number(e.target.value));setPage(1)}}>
        <option value={10}>10 por página</option><option value={30}>30 por página</option><option value={50}>50 por página</option><option value="all">Ver todos</option>
      </select>
      {!showAll&&<>
        <button className="btn" onClick={()=>setPage(1)} disabled={current===1}><ChevronsLeft size={15}/></button>
        <button className="btn" onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={current===1}><ChevronLeft size={15}/></button>
        <button className="btn" onClick={()=>setPage(p=>Math.min(pages,p+1))} disabled={current===pages}><ChevronRight size={15}/></button>
        <button className="btn" onClick={()=>setPage(pages)} disabled={current===pages}><ChevronsRight size={15}/></button>
      </>}
    </div>
  </div>;
}

function PersonModal({ person, onClose }) {
  const [selectedProject, setSelectedProject] = useState(null);
  const { openReportBuilder } = useReport();
  if(!person) return null;
  const startDate=TEAM_PERIOD_START;
  const endDate=TEAM_PERIOD_END;
  const personReportScope=`equipe:ficha:${person.key}`;
  const rows=person.transactions||[];
  const {plans: financialPlans,months,planKeys}=monthlyByPlan(rows.filter(row=>inRange(row,startDate,endDate)),startDate,endDate);
  const period=`${selectedPeriodLabel(startDate,endDate)} + pendências futuras`;
  const includesFutureOpen=rows.some(row=>!row.paid&&getDateKey(row.data)>TEAM_PERIOD_END);
  const displayPlans=financialPlans.map(item=>item.plan);
  const paid=rows.filter(r=>r.paid).reduce((s,r)=>s+Number(r.valor||0),0);
  const open=rows.filter(r=>!r.paid).reduce((s,r)=>s+Number(r.valor||0),0);

  const planReportRows=financialPlans.map(item=>({Plano:item.plan,Pago:item.paid,'A pagar':item.open,Total:item.paid+item.open,Lançamentos:item.count}));

  const byProject=[...rows.reduce((map,row)=>{
    const key=String(row.projeto||'Sem obra').trim()||'Sem obra';
    if(norm(key)==='PROJETOS') return map;
    const item=map.get(key)||{name:key,paid:0,open:0,rows:[]};
    item[row.paid?'paid':'open']+=Number(row.valor||0);
    item.rows.push(row);
    map.set(key,item);
    return map;
  },new Map()).values()].sort((a,b)=>(b.paid+b.open)-(a.paid+a.open));

  const personReportItems=[
    {
      sectionKey:`equipe:export:ficha:${person.key}:resumo`,
      title:'Resumo financeiro',
      componentName:'Resumo da ficha financeira',
      page:'Equipe',
      type:'TABLE',
      filters:{Pessoa:person.name,'Data inicial':startDate,'Data final':endDate,Escopo:includesFutureOpen?'Período selecionado + A pagar futuro de terceiros':'Período selecionado'},
      data:[{
        'Pessoa / empresa':person.name,
        'Cargo / função':person.roles.join(' · ')||'—',
        Tipo:person.thirdParty?'Terceiro':person.fixedMonthly?'Mensal / fixo':'Equipe',
        Projetos:person.projects.length,
        'Plano(s)':displayPlans.join(' · ')||'Não identificado',
        Pago:paid,
        'A pagar':open,
        Total:paid+open,
        Lançamentos:rows.length,
      }],
    },
    {
      sectionKey:`equipe:export:ficha:${person.key}:mensal`,
      title:'Evolução mensal',
      componentName:'Evolução mensal da pessoa',
      page:'Equipe',
      type:'TABLE',
      filters:{Pessoa:person.name,'Data inicial':startDate,'Data final':endDate},
      data:months.map(({key,...month})=>month),
    },
    {
      sectionKey:`equipe:export:ficha:${person.key}:planos`,
      title:'Divisão por plano financeiro',
      componentName:'Pagamentos e pendências por plano financeiro',
      page:'Equipe',
      type:'TABLE',
      filters:{Pessoa:person.name,'Data inicial':startDate,'Data final':endDate,Fonte:'CP_GERAL'},
      data:planReportRows,
    },
    {
      sectionKey:`equipe:export:ficha:${person.key}:obras`,
      title:'Resumo por projeto',
      componentName:'Resumo da pessoa por projeto',
      page:'Equipe',
      type:'TABLE',
      filters:{Pessoa:person.name},
      data:byProject.map(item=>({Projeto:item.name,Pago:item.paid,'A pagar':item.open,Total:item.paid+item.open,Lançamentos:item.rows.length})),
    },
    {
      sectionKey:`equipe:export:ficha:${person.key}:movimentos`,
      title:'Movimentações financeiras',
      componentName:'Movimentações da ficha financeira',
      page:'Equipe',
      type:'TABLE',
      filters:{Pessoa:person.name,'Data inicial':startDate,'Data final':endDate,Escopo:includesFutureOpen?'Período selecionado + A pagar futuro de terceiros':'Período selecionado'},
      data:reportMovementRows(rows,person.name),
    },
  ];

  return <div className="mgmt-overlay mgmt-overlay-center" onMouseDown={onClose}>
    <div className="mgmt-modal-center" onMouseDown={(e)=>e.stopPropagation()}>
      <div className="mgmt-panel-head">
        <div>
          <span className="mgmt-eyebrow">CADASTRO FINANCEIRO · {period}</span>
          <h2>{person.name}</h2>
          <p>{person.roles.join(' · ')||'Sem função informada'} · relatório configurável por blocos e orientação</p>
        </div>
        <div className="mgmt-actions">
          <button className="btn" onClick={()=>openReportBuilder('Equipe',personReportScope,person.name)}><FileText size={15}/> Gerar Relatório</button>
          <button className="btn" onClick={onClose}><X size={16}/> Fechar</button>
        </div>
      </div>

      <div aria-hidden="true" style={{display:'none'}}>
        {personReportItems.map((item)=>(
          <ReportAdder
            key={item.sectionKey}
            sectionKey={item.sectionKey}
            title={item.title}
            componentName={item.componentName}
            page={item.page}
            scope={personReportScope}
            type={item.type}
            data={item.data}
            filters={item.filters}
          />
        ))}
      </div>

      <div className="mgmt-meta-grid mgmt-meta-grid-three">
        <div><span>Tipo</span><strong>{person.thirdParty?'Terceiro':person.fixedMonthly?'Mensal / fixo':'Equipe'}</strong></div>
        <div><span>Plano utilizado</span><strong>{displayPlans.length?displayPlans.join(' · '):'Não identificado'}</strong></div>
        <div><span>Projetos vinculados</span><strong>{person.projects.length}</strong></div>
      </div>

      <div className="mgmt-kpis">
        <div><span>Pago no período</span><strong className="mgmt-value-paid">{brl(paid)}</strong></div>
        <div><span>{includesFutureOpen?'A pagar · inclui futuro':'A pagar no período'}</span><strong className="mgmt-value-open">{brl(open)}</strong></div>
        <div><span>Total financeiro</span><strong>{brl(paid+open)}</strong></div>
        <div><span>Lançamentos</span><strong>{rows.length}</strong></div>
      </div>

      <section className="mgmt-subcard">
        <h3>Pagamentos mensais por plano financeiro</h3>
        <p className="mgmt-muted">Cada cor representa um plano de equipe com lançamentos pagos no CP_GERAL. Valores em aberto são exibidos separadamente.</p>
        <div className="mgmt-chart-sm"><ResponsiveContainer>
          <BarChart data={months}><CartesianGrid strokeDasharray="3 3" opacity={0.16}/><XAxis dataKey="month" tick={{fontSize:10}}/><YAxis tickFormatter={compact} tick={{fontSize:10}}/><Tooltip formatter={(v,name)=>[brl(v),name]}/><Legend/>
            {planKeys.map((plan,index)=><Bar key={plan} dataKey={plan} stackId="pago" fill={PLAN_COLORS[financialPlans.findIndex(item=>item.plan===plan)%PLAN_COLORS.length]} isAnimationActive={false}/>)}
          </BarChart>
        </ResponsiveContainer></div>
        <div className="mgmt-table-wrap" style={{marginTop:12}}><table className="mgmt-table"><thead><tr><th>Plano financeiro</th><th>Pago</th><th>A pagar</th><th>Total</th></tr></thead><tbody>
          {financialPlans.map((item,index)=><tr key={item.plan}><td><span style={{display:'inline-block',width:9,height:9,borderRadius:2,background:PLAN_COLORS[index%PLAN_COLORS.length],marginRight:8}}/>{item.plan}</td><td>{brl(item.paid)}</td><td>{brl(item.open)}</td><td>{brl(item.paid+item.open)}</td></tr>)}
        </tbody></table></div>
      </section>

      <section className="mgmt-subcard" style={{marginTop:14}}>
        <h3>Resumo por obra</h3>
        <div className="mgmt-project-cards">
          {byProject.map(item=><button type="button" className={`mgmt-project-card mgmt-project-card-button ${selectedProject?.name===item.name?'active':''}`} key={item.name} onClick={()=>setSelectedProject(selectedProject?.name===item.name?null:item)}>
            <strong>{item.name}</strong>
            <div><span>Pago</span><b className="mgmt-value-paid">{brl(item.paid)}</b></div>
            <div><span>A pagar</span><b className="mgmt-value-open">{brl(item.open)}</b></div>
            <small>{item.rows.length} lançamento{item.rows.length!==1?'s':''} · clique para ver</small>
          </button>)}
        </div>
        {!byProject.length&&<p>Sem movimentações vinculadas a obras.</p>}

      </section>

      <section className="mgmt-subcard" style={{marginTop:14}}>
        <h3>Pagamentos e valores em aberto</h3>
        <p className="mgmt-muted">Filtros financeiros, 30 movimentos por página, opção de 50 ou Todos e navegação entre páginas.</p>
        <DataTable data={toFinancialRows(rows,person.name)} initialPageSize={30} pageSizeOptions={[30,50,'all']}/>
      </section>
    </div>

    {selectedProject&&<div className="mgmt-overlay mgmt-overlay-center mgmt-overlay-project" onMouseDown={()=>setSelectedProject(null)}>
      <div className="mgmt-modal-center mgmt-project-modal" onMouseDown={(e)=>e.stopPropagation()}>
        <div className="mgmt-panel-head">
          <div><span className="mgmt-eyebrow">MOVIMENTOS DA OBRA · {period}</span><h2>{selectedProject.name}</h2><p>{person.name} · {selectedProject.rows.length} lançamento{selectedProject.rows.length!==1?'s':''}</p></div>
          <div className="mgmt-actions">
            <button className="btn" onClick={()=>openReportBuilder(
              'Equipe',
              `equipe:pessoa-projeto:${person.key}:${projectCodeLabel(selectedProject.name)}`,
              `${person.name} · ${selectedProject.name}`
            )}><FileText size={15}/> Gerar Relatório</button>
            <button className="btn" onClick={()=>setSelectedProject(null)}><X size={16}/> Fechar</button>
          </div>
        </div>
        <div aria-hidden="true" style={{display:'none'}}>
          <ReportAdder
            sectionKey={`equipe:pessoa-projeto:${person.key}:${projectCodeLabel(selectedProject.name)}:resumo`}
            title="Resumo por projeto"
            componentName="Resumo da Pessoa por Projeto"
            page="Equipe"
            scope={`equipe:pessoa-projeto:${person.key}:${projectCodeLabel(selectedProject.name)}`}
            type="SUMMARY"
            data={[{Pessoa:person.name,Projeto:selectedProject.name,Pago:selectedProject.paid,'A pagar':selectedProject.open,Total:selectedProject.paid+selectedProject.open,Lançamentos:selectedProject.rows.length}]}
            filters={{Pessoa:person.name,Projeto:selectedProject.name}}
          />
          <ReportAdder
            sectionKey={`equipe:pessoa-projeto:${person.key}:${projectCodeLabel(selectedProject.name)}:movimentos`}
            title="Movimentações financeiras"
            componentName="Movimentações da Pessoa por Projeto"
            page="Equipe"
            scope={`equipe:pessoa-projeto:${person.key}:${projectCodeLabel(selectedProject.name)}`}
            type="TABLE"
            data={reportMovementRows(selectedProject.rows,person.name)}
            filters={{Pessoa:person.name,Projeto:selectedProject.name}}
          />
        </div>
        <DataTable data={toFinancialRows(selectedProject.rows,person.name)} initialPageSize={30} pageSizeOptions={[30,50,'all']}/>
      </div>
    </div>}
  </div>;
}

function ProjectSummaryModal({ project, onClose }) {
  const { openReportBuilder } = useReport();
  if(!project) return null;
  const startDate=TEAM_PERIOD_START;
  const endDate=TEAM_PERIOD_END;
  const projectReportScope=`equipe:projeto:${projectCodeLabel(project.name)}`;
  const rows=project.rows||[];
  const period=`${selectedPeriodLabel(startDate,endDate)} + pendências futuras`;
  const monthly=monthKeysBetween(startDate,endDate).map((key)=>{
    const monthRows=rows.filter(r=>getMonth(r.data)===key);
    return {
      month:monthPeriodLabel(key),
      Pago:monthRows.filter(r=>r.paid).reduce((s,r)=>s+Number(r.valor||0),0),
      'A pagar':monthRows.filter(r=>!r.paid).reduce((s,r)=>s+Number(r.valor||0),0),
    };
  });
  const tableRows=rows.map(row=>({
    ...row,
    natureza:'Saída',
    nome:row.rosterPerson||row.nome,
    contaDescricao:row.contaNome||row.contaDescricao||row.contaCodigo||'',
    status:row.paid?'Realizado':'A realizar',
    projeto:project.name,
  }));
  const reportRows=rows.map(row=>({
    Data:row.data,
    'Pessoa / empresa':row.rosterPerson||row.nome,
    Documento:row.documento||row.titulo||'',
    Plano:planLabel(row.contaNome||row.contaCodigo),
    Situação:row.paid?'Pago':'A pagar',
    Valor:Number(row.valor||0),
  }));

  return <div className="mgmt-overlay mgmt-overlay-center mgmt-overlay-project" onMouseDown={onClose}>
    <div className="mgmt-modal-center mgmt-project-modal" onMouseDown={(e)=>e.stopPropagation()}>
      <div className="mgmt-panel-head">
        <div>
          <span className="mgmt-eyebrow">EQUIPE POR PROJETO · {period}</span>
          <h2>{project.name}</h2>
          <p>{project.peopleCount} pessoa{project.peopleCount!==1?'s':''} / empresa{project.peopleCount!==1?'s':''} · {rows.length} movimento{rows.length!==1?'s':''} · relatório configurável</p>
        </div>
        <div className="mgmt-actions">
          <button className="btn" onClick={()=>openReportBuilder('Equipe',projectReportScope,`Projeto — ${project.name}`)}><FileText size={15}/> Gerar Relatório</button>
          <button className="btn" onClick={onClose}><X size={16}/> Fechar</button>
        </div>
      </div>

      <div aria-hidden="true" style={{display:'none'}}>
        <ReportAdder
          sectionKey={`equipe:projeto:${projectCodeLabel(project.name)}:resumo`}
          title="Resumo por projeto"
          componentName="Resumo Financeiro da Equipe por Projeto"
          page="Equipe"
          scope={projectReportScope}
          type="SUMMARY"
          data={[{Projeto:project.name,'Pessoas / empresas':project.peopleCount,Pago:project.paid,'A pagar':project.open,Total:project.total,Lançamentos:rows.length}]}
          filters={{Projeto:project.name,'Data inicial':startDate,'Data final':endDate}}
        />
        <ReportAdder
          sectionKey={`equipe:projeto:${projectCodeLabel(project.name)}:mensal`}
          title="Fluxo mensal"
          componentName="Fluxo Mensal da Equipe por Projeto"
          page="Equipe"
          scope={projectReportScope}
          type="TABLE"
          data={monthly}
          filters={{Projeto:project.name,'Data inicial':startDate,'Data final':endDate}}
        />
        <ReportAdder
          sectionKey={`equipe:projeto:${projectCodeLabel(project.name)}:movimentos`}
          title="Movimentações financeiras"
          componentName="Movimentações da Equipe por Projeto"
          page="Equipe"
          scope={projectReportScope}
          type="TABLE"
          data={reportRows}
          filters={{Projeto:project.name,'Data inicial':startDate,'Data final':endDate}}
        />
      </div>

      <section className="mgmt-subcard">
        <h3>Fluxo mensal de pagamentos · {period}</h3>
        <div className="mgmt-chart-sm"><ResponsiveContainer>
          <BarChart data={monthly}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.16}/>
            <XAxis dataKey="month" tick={{fontSize:10}}/>
            <YAxis tickFormatter={compact} tick={{fontSize:10}}/>
            <Tooltip formatter={(v)=>brl(v)}/>
            <Legend/>
            <Bar dataKey="Pago" fill={PAID_COLOR} radius={[4,4,0,0]}/>
            <Bar dataKey="A pagar" fill={OPEN_COLOR} radius={[4,4,0,0]}/>
          </BarChart>
        </ResponsiveContainer></div>
      </section>

      <section className="mgmt-subcard" style={{marginTop:14}}>
        <h3>Movimentações e pessoas do projeto</h3>
        <DataTable data={tableRows} initialPageSize={10} pageSizeOptions={[10,30,50,'all']}/>
      </section>
    </div>
  </div>;
}

export default function TeamDashboard(){
  const {isReportMode,openReportBuilder,exitReportMode}=useReport();
  const[data,setData]=useState({entries:[],monthly:[]});
  const[startDate,setStartDate]=useState(TEAM_DEFAULT_START);
  const[endDate,setEndDate]=useState(TEAM_PERIOD_END);
  const[personFilters,setPersonFilters]=useState([]);
  const[projectFilters,setProjectFilters]=useState([]);
  const[accountFilters,setAccountFilters]=useState([]);
  const[statusFilters,setStatusFilters]=useState([]);
  const[rosterPage,setRosterPage]=useState(1);
  const[rosterPageSize,setRosterPageSize]=useState(10);
  const[projectPage,setProjectPage]=useState(1);
  const[projectPageSize,setProjectPageSize]=useState(10);

  const[rosterNameFilters,setRosterNameFilters]=useState([]);
  const[rosterRoleFilters,setRosterRoleFilters]=useState([]);
  const[rosterTypeFilters,setRosterTypeFilters]=useState([]);
  const[rosterProjectFilters,setRosterProjectFilters]=useState([]);
  const[rosterPaidFilter,setRosterPaidFilter]=useState('');
  const[rosterOpenFilter,setRosterOpenFilter]=useState('');

  const[projectNameFilters,setProjectNameFilters]=useState([]);
  const[projectPeopleFilter,setProjectPeopleFilter]=useState('');
  const[projectPaidFilter,setProjectPaidFilter]=useState('');
  const[projectOpenFilter,setProjectOpenFilter]=useState('');
  const[projectTotalFilter,setProjectTotalFilter]=useState('');
  const[selectedPerson,setSelectedPerson]=useState(null);
  const[selectedProjectSummary,setSelectedProjectSummary]=useState(null);
  const[error,setError]=useState('');

  const reloadTeamData=async()=>{
    const result=await requestJson('/api/equipe');
    setData(result);
    setError('');
    return result;
  };

  useEffect(()=>{let active=true;requestJson('/api/equipe').then(result=>{if(active){setData(result);setError('')}}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[]);

  const people=useMemo(()=>[...new Set(data.entries.map(e=>e.person).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR')),[data.entries]);
  const projects=useMemo(()=>[...new Set(data.entries.flatMap(e=>e.project?[e.project]:e.projects||[]).filter(Boolean).filter(p=>norm(p)!=='PROJETOS'))].sort((a,b)=>a.localeCompare(b,'pt-BR')),[data.entries]);
  const accounts=useMemo(()=>[...new Set(data.entries.flatMap(entry=>entryAccountOptions(entry)))].filter(Boolean).sort((a,b)=>a.localeCompare(b,'pt-BR')),[data.entries]);

  const filteredEntries=useMemo(()=>data.entries.filter(entry=>{
    if(personFilters.length>0&&!personFilters.includes(entry.person))return false;
    const relevantRows=(entry.transactions||[]).filter(r=>inRange(r,startDate,endDate));
    if(relevantRows.length===0)return false;
    if(projectFilters.length>0&&!relevantRows.some(r=>projectFilters.includes(r.projeto)))return false;
    if(accountFilters.length>0){
      const hasAccount=relevantRows.some(row=>accountFilters.includes(rowAccountOption(row)));
      if(!hasAccount)return false;
    }
    if(statusFilters.length>0){
      const labels=relevantRows.map(r=>r.paid?'Pago':'A pagar');
      if(!statusFilters.some(value=>labels.includes(value)))return false;
    }
    return true;
  }),[data.entries,personFilters,projectFilters,accountFilters,statusFilters,startDate,endDate]);

  // Cadastro da equipe e Equipe por projeto sempre consultam a base completa
  // de 2025 e 2026. O filtro de data do topo afeta somente os indicadores e
  // gráficos iniciais, evitando que pessoas com histórico em 2025 desapareçam.
  const relationEntries=useMemo(()=>data.entries.filter(entry=>{
    if(personFilters.length>0&&!personFilters.includes(entry.person))return false;
    const relevantRows=(entry.transactions||[]).filter(row=>inTeamRelationScope(entry,row));
    if(projectFilters.length>0&&!relevantRows.some(row=>projectFilters.includes(row.projeto)))return false;
    if(accountFilters.length>0){
      const hasAccount=relevantRows.some(row=>accountFilters.includes(rowAccountOption(row)));
      if(!hasAccount)return false;
    }
    if(statusFilters.length>0){
      const labels=relevantRows.map(row=>row.paid?'Pago':'A pagar');
      if(!statusFilters.some(value=>labels.includes(value)))return false;
    }
    return true;
  }),[data.entries,personFilters,projectFilters,accountFilters,statusFilters]);

  const filteredTransactions=useMemo(()=>{
    const map=new Map();
    filteredEntries.forEach(entry=>(entry.transactions||[]).forEach(row=>{
      if(!inRange(row,startDate,endDate))return;
      if(projectFilters.length>0&&!projectFilters.includes(row.projeto))return;
      if(accountFilters.length>0&&!accountFilters.includes(rowAccountOption(row)))return;
      if(statusFilters.length>0&&!statusFilters.includes(row.paid?'Pago':'A pagar'))return;
      map.set(row.sourceKey,{...row,rosterPerson:entry.person});
    }));
    return[...map.values()];
  },[filteredEntries,startDate,endDate,projectFilters,accountFilters,statusFilters]);

  const paid=filteredTransactions.filter(r=>r.paid).reduce((s,r)=>s+Number(r.valor||0),0);
  const open=filteredTransactions.filter(r=>!r.paid).reduce((s,r)=>s+Number(r.valor||0),0);

  const peopleRoster=useMemo(()=>{
    const map=new Map();
    relationEntries.forEach(entry=>{
      const key=norm(entry.person);
      const item=map.get(key)||{key,name:entry.person,roles:new Set(),projects:new Set(),accounts:new Set(),thirdParty:false,fixedMonthly:false,transactions:new Map()};
      if(entry.role)item.roles.add(entry.role);
      (entry.project?[entry.project]:entry.projects||[]).filter(Boolean).filter(p=>norm(p)!=='PROJETOS').filter(p=>projectFilters.length===0||projectFilters.includes(p)).forEach(p=>item.projects.add(p));
      item.thirdParty ||= Boolean(entry.thirdParty);
      item.fixedMonthly ||= Boolean(entry.fixedMonthly);
      (entry.transactions||[]).forEach(row=>{
        if(!inTeamRelationScope(entry,row))return;
        if(projectFilters.length>0&&!projectFilters.includes(row.projeto))return;
        if(accountFilters.length>0&&!accountFilters.includes(rowAccountOption(row)))return;
        if(statusFilters.length>0&&!statusFilters.includes(row.paid?'Pago':'A pagar'))return;
        if(row.contaNome||row.contaCodigo)item.accounts.add(row.contaNome||row.contaCodigo);
        item.transactions.set(row.sourceKey,{...row,rosterPerson:entry.person});
      });
      map.set(key,item);
    });
    return[...map.values()]
      .map(item=>({...item,roles:[...item.roles],projects:[...item.projects],accounts:[...item.accounts],transactions:[...item.transactions.values()]}))
      .sort((a,b)=>{
        const openA=a.transactions.filter(row=>!row.paid).reduce((sum,row)=>sum+Number(row.valor||0),0);
        const openB=b.transactions.filter(row=>!row.paid).reduce((sum,row)=>sum+Number(row.valor||0),0);
        return openB-openA || a.name.localeCompare(b.name,'pt-BR');
      });
  },[relationEntries,projectFilters,accountFilters,statusFilters]);

  const projectRows=useMemo(()=>{
    const map=new Map();
    filteredEntries.forEach(entry=>{
      const list=(entry.project?[entry.project]:(entry.projects||[])).filter(name=>projectFilters.length===0||projectFilters.includes(name));
      list.forEach(name=>{
        if(!name||norm(name)==='PROJETOS')return;
        const item=map.get(name)||{name,people:new Set(),paid:0,open:0,rows:new Map()};
        item.people.add(entry.person);
        (entry.transactions||[])
          .filter(row=>norm(row.projeto)===norm(name)&&inRange(row,startDate,endDate))
          .filter(row=>accountFilters.length===0||accountFilters.includes(rowAccountOption(row)))
          .filter(row=>statusFilters.length===0||statusFilters.includes(row.paid?'Pago':'A pagar'))
          .forEach(row=>{
            item[row.paid?'paid':'open']+=Number(row.valor||0);
            item.rows.set(row.sourceKey,{...row,rosterPerson:entry.person,thirdParty:Boolean(entry.thirdParty)});
          });
        map.set(name,item);
      });
    });
    return[...map.values()].map(p=>({...p,peopleCount:p.people.size,total:p.paid+p.open,rows:[...p.rows.values()]})).sort((a,b)=>b.total-a.total);
  },[filteredEntries,startDate,endDate,projectFilters,accountFilters,statusFilters]);

  const projectRelationRows=useMemo(()=>{
    const map=new Map();
    relationEntries.forEach(entry=>{
      const list=(entry.project?[entry.project]:(entry.projects||[])).filter(name=>projectFilters.length===0||projectFilters.includes(name));
      list.forEach(name=>{
        if(!name||norm(name)==='PROJETOS')return;
        const scopedRows=(entry.transactions||[])
          .filter(row=>norm(row.projeto)===norm(name)&&inTeamRelationScope(entry,row))
          .filter(row=>accountFilters.length===0||accountFilters.includes(rowAccountOption(row)))
          .filter(row=>statusFilters.length===0||statusFilters.includes(row.paid?'Pago':'A pagar'));
        if(scopedRows.length===0)return;

        const item=map.get(name)||{name,people:new Set(),paid:0,open:0,rows:new Map()};
        item.people.add(entry.person);
        scopedRows.forEach(row=>{
          item[row.paid?'paid':'open']+=Number(row.valor||0);
          item.rows.set(row.sourceKey,{...row,rosterPerson:entry.person,thirdParty:Boolean(entry.thirdParty)});
        });
        map.set(name,item);
      });
    });
    return[...map.values()].map(p=>({...p,peopleCount:p.people.size,total:p.paid+p.open,rows:[...p.rows.values()]})).sort((a,b)=>b.paid-a.paid || b.total-a.total || a.name.localeCompare(b.name,'pt-BR'));
  },[relationEntries,projectFilters,accountFilters,statusFilters]);

  const evolutionData=useMemo(()=>monthKeysBetween(startDate,endDate).map((key)=>{
    const paidMap=new Map();
    const forecastMap=new Map();

    filteredEntries.forEach(entry=>(entry.transactions||[]).forEach(row=>{
      if(getMonth(row.data)!==key||!inRange(row,startDate,endDate))return;
      if(projectFilters.length>0&&!projectFilters.includes(row.projeto))return;
      if(accountFilters.length>0&&!accountFilters.includes(rowAccountOption(row)))return;

      if(row.paid){
        if(statusFilters.length===0||statusFilters.includes('Pago')) paidMap.set(row.sourceKey,row);
        return;
      }

      if(statusFilters.length===0||statusFilters.includes('A pagar')){
        forecastMap.set(row.sourceKey,row);
      }
    }));

    return{
      month:monthPeriodLabel(key),
      'Pago total':[...paidMap.values()].reduce((sum,row)=>sum+Number(row.valor||0),0),
      'Previsão':[...forecastMap.values()].reduce((sum,row)=>sum+Number(row.valor||0),0),
    };
  }),[filteredEntries,startDate,endDate,projectFilters,accountFilters,statusFilters]);

  const reportFilters={'Data inicial':startDate,'Data final':endDate,Pessoa:personFilters.length?personFilters.join(', '):'Todas',Projeto:projectFilters.length?projectFilters.join(', '):'Todos','Conta / Plano':accountFilters.length?accountFilters.join(', '):'Todas',Situação:statusFilters.length?statusFilters.join(', '):'Todas'};
  const relationReportFilters={'Período':'01/01/2025 a 31/12/2026',Pessoa:personFilters.length?personFilters.join(', '):'Todas',Projeto:projectFilters.length?projectFilters.join(', '):'Todos','Conta / Plano':accountFilters.length?accountFilters.join(', '):'Todas',Situação:statusFilters.length?statusFilters.join(', '):'Todas'};
  const projectChart=projectRows.slice(0,10).map(p=>({Projeto:projectCodeLabel(p.name),'Obra completa':p.name,Pago:p.paid,'A pagar':p.open}));
  const rosterReport=peopleRoster.map(item=>({'Pessoa / empresa':item.name,'Cargo / função':item.roles.join(' · '),'Tipo':item.thirdParty?'Terceiro':item.fixedMonthly?'Mensal / fixo':'Equipe','Projetos':item.projects.length,'Plano(s)':item.accounts.map(planLabel).join(' · '),'Pago':item.transactions.filter(r=>r.paid).reduce((s,r)=>s+Number(r.valor||0),0),'A pagar':item.transactions.filter(r=>!r.paid).reduce((s,r)=>s+Number(r.valor||0),0)}));
  const detailedRosterReport=peopleRoster.flatMap(item=>{
    const rows=item.transactions;
    const base={
      'Pessoa / empresa':item.name,
      'Cargo / função':item.roles.join(' · '),
      'Tipo':item.thirdParty?'Terceiro':item.fixedMonthly?'Mensal / fixo':'Equipe',
      'Projetos vinculados':item.projects.join(' · '),
      'Plano(s) movimentado(s)':item.accounts.map(planLabel).join(' · '),
    };
    if(rows.length===0) return [{...base,Data:'',Documento:'',Obra:'',Plano:'',Situação:'Sem movimentação',Valor:0}];
    return rows.map(r=>({
      ...base,
      Data:r.data||'',
      Documento:r.documento||r.titulo||'',
      Obra:r.projeto||'',
      Plano:planLabel(r.contaNome||r.contaCodigo),
      Situação:r.paid?'Pago':'A pagar',
      Valor:Number(r.valor||0),
    }));
  });
  const rosterRelationTransactions=[...peopleRoster.reduce((map,item)=>{
    item.transactions.forEach(row=>map.set(row.sourceKey,row));
    return map;
  },new Map()).values()];
  const rosterRelationPaid=rosterRelationTransactions.filter(row=>row.paid).reduce((sum,row)=>sum+Number(row.valor||0),0);
  const rosterRelationOpen=rosterRelationTransactions.filter(row=>!row.paid).reduce((sum,row)=>sum+Number(row.valor||0),0);
  const rosterSummaryReport=[{
    'Pessoas / empresas':peopleRoster.length,
    'Terceiros':peopleRoster.filter(e=>e.thirdParty).length,
    'Obras com equipe':projectRelationRows.length,
    'Pago':rosterRelationPaid,
    'A pagar':rosterRelationOpen,
    'Custo total':rosterRelationPaid+rosterRelationOpen,
  }];

  const rosterRoles=useMemo(()=>[...new Set(peopleRoster.flatMap(item=>item.roles).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR')),[peopleRoster]);
  const rosterTypes=['Equipe','Mensal / fixo','Terceiro'];
  const rosterProjects=useMemo(()=>[...new Set(peopleRoster.flatMap(item=>item.projects).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR')),[peopleRoster]);

  const parseNumericFilter=(value)=>{
    const normalized=String(value||'').trim().replace(/\./g,'').replace(',','.').replace(/[^\d.-]/g,'');
    return normalized ? Number(normalized) : null;
  };
  const matchesNumeric=(actual,filterValue)=>{
    const target=parseNumericFilter(filterValue);
    if(target===null||Number.isNaN(target)) return true;
    return Math.abs(Number(actual||0)-target)<0.01;
  };

  const rosterFiltered=useMemo(()=>peopleRoster.filter(item=>{
    const rows=item.transactions;
    const rowPaid=rows.filter(r=>r.paid).reduce((s,r)=>s+Number(r.valor||0),0);
    const rowOpen=rows.filter(r=>!r.paid).reduce((s,r)=>s+Number(r.valor||0),0);
    const type=item.thirdParty?'Terceiro':item.fixedMonthly?'Mensal / fixo':'Equipe';

    if(rosterNameFilters.length>0&&!rosterNameFilters.includes(item.name))return false;
    if(rosterRoleFilters.length>0&&!item.roles.some(role=>rosterRoleFilters.includes(role)))return false;
    if(rosterTypeFilters.length>0&&!rosterTypeFilters.includes(type))return false;
    if(rosterProjectFilters.length>0&&!item.projects.some(project=>rosterProjectFilters.includes(project)))return false;
    if(!matchesNumeric(rowPaid,rosterPaidFilter))return false;
    if(!matchesNumeric(rowOpen,rosterOpenFilter))return false;
    return true;
  }),[peopleRoster,startDate,endDate,rosterNameFilters,rosterRoleFilters,rosterTypeFilters,rosterProjectFilters,rosterPaidFilter,rosterOpenFilter]);

  const projectFiltered=useMemo(()=>projectRelationRows.filter(item=>{
    if(projectNameFilters.length>0&&!projectNameFilters.includes(item.name))return false;
    if(!matchesNumeric(item.peopleCount,projectPeopleFilter))return false;
    if(!matchesNumeric(item.paid,projectPaidFilter))return false;
    if(!matchesNumeric(item.open,projectOpenFilter))return false;
    if(!matchesNumeric(item.total,projectTotalFilter))return false;
    return true;
  }),[projectRelationRows,projectNameFilters,projectPeopleFilter,projectPaidFilter,projectOpenFilter,projectTotalFilter]);


  const rosterEffective=rosterPageSize==='all'?Math.max(rosterFiltered.length,1):rosterPageSize;
  const visibleRoster=rosterPageSize==='all'?rosterFiltered:rosterFiltered.slice((rosterPage-1)*rosterEffective,rosterPage*rosterEffective);
  const projectEffective=projectPageSize==='all'?Math.max(projectFiltered.length,1):projectPageSize;
  const visibleProjects=projectPageSize==='all'?projectFiltered:projectFiltered.slice((projectPage-1)*projectEffective,projectPage*projectEffective);

  useEffect(()=>{setRosterPage(1);setProjectPage(1)},[startDate,endDate,personFilters,projectFilters,accountFilters,statusFilters]);
  useEffect(()=>{setRosterPage(1)},[rosterNameFilters,rosterRoleFilters,rosterTypeFilters,rosterProjectFilters,rosterPaidFilter,rosterOpenFilter]);
  useEffect(()=>{setProjectPage(1)},[projectNameFilters,projectPeopleFilter,projectPaidFilter,projectOpenFilter,projectTotalFilter]);

  return <div className="mgmt">
    <header className="mgmt-header">
      <div><h1>Equipe</h1><p>Cadastro, pagamentos, pendências e custo de equipe por obra.</p></div>
      <div className="mgmt-actions">
        <FinancialRefreshButton onUpdated={reloadTeamData} onError={setError} label="Atualizar dados"/>
        <button onClick={()=>isReportMode?exitReportMode():openReportBuilder('Equipe')} className={`btn ${isReportMode?'btn-primary':''}`}><FileText size={14}/>{isReportMode?'Sair do Modo Relatório':'Gerar Relatório'}</button>
      </div>
    </header>
    {error&&<div className="mgmt-alert">{error}</div>}

    <section className="mgmt-panel"><div className="mgmt-filter-grid mgmt-filter-grid-team">
      <label>Data inicial<input type="date" min={TEAM_PERIOD_START} max={TEAM_PERIOD_END} value={startDate} onChange={e=>applyValidFilterDate(e.target.value, setStartDate)}/></label>
      <label>Data final<input type="date" min={TEAM_PERIOD_START} max={TEAM_PERIOD_END} value={endDate} onChange={e=>applyValidFilterDate(e.target.value, setEndDate)}/></label>
      <label>Pessoa<MultiSelect options={people} selected={personFilters} onChange={setPersonFilters} placeholder="Todas as pessoas"/></label>
      <label>Projeto<MultiSelect options={projects} selected={projectFilters} onChange={setProjectFilters} placeholder="Todos os projetos"/></label>
      <label>Conta / Plano<MultiSelect options={accounts} selected={accountFilters} onChange={setAccountFilters} placeholder="Todas as contas"/></label>
      <label>Situação<MultiSelect options={['Pago','A pagar']} selected={statusFilters} onChange={setStatusFilters} placeholder="Todas as situações"/></label>
    </div></section>

    <div className="mgmt-metrics-grid mgmt-metrics-six">
      <MetricCard icon={Wallet} label="Custo no período" value={paid+open} tone="primary" info="Soma de todos os pagamentos realizados e valores em aberto da equipe dentro do intervalo selecionado."/>
      <MetricCard icon={CircleDollarSign} label="Pago" value={paid} tone="success" info="Valores do CP_GERAL com situação realizada/paga no período."/>
      <MetricCard icon={Clock3} label="A pagar" value={open} tone="warning" info="Valores ainda pendentes no CP_GERAL com vencimento dentro do período."/>
      <MetricCard icon={UsersRound} label="Pessoas / empresas" value={new Set(filteredTransactions.map(row=>row.rosterPerson).filter(Boolean)).size} currency={false} tone="info" info="Quantidade de pessoas ou empresas com movimentação dentro do período selecionado no filtro principal."/>
      <MetricCard icon={BriefcaseBusiness} label="Terceiros" value={peopleRoster.filter(e=>e.thirdParty).length} currency={false} tone="violet" info="Quantidade de cadastros classificados como TERCEIRO na aba EQUIPE."/>
      <MetricCard icon={Building2} label="Obras com equipe" value={projectRows.length} currency={false} tone="cyan" info="Quantidade de obras com vínculo ou movimentação de equipe, excluindo o centro transitório PROJETOS."/>
    </div>

    <div className="mgmt-flow mgmt-flow-balanced">
      <section id="report-equipe-evolucao" data-report-section className="mgmt-panel">
        <ReportAdder sectionKey="equipe:evolucao" title="Evolução mensal da Equipe" componentName="Gráfico de Evolução Mensal" page="Equipe" type="CHART" data={evolutionData} filters={reportFilters} captureId="report-equipe-evolucao" style={{float:'right'}}/>
        <h2>Evolução mensal da equipe</h2><p>Total pago e previsão de pagamentos da equipe por mês no período selecionado, incluindo o retroativo de 2025.</p>
        <div className="mgmt-chart"><ResponsiveContainer><LineChart data={evolutionData}><CartesianGrid strokeDasharray="3 3" opacity={0.16}/><XAxis dataKey="month" tick={{fontSize:10}}/><YAxis tickFormatter={compact} tick={{fontSize:10}}/><Tooltip formatter={v=>brl(v)}/><Legend/><Line type="monotone" dataKey="Pago total" stroke={PAID_COLOR} strokeWidth={3} dot={{r:3}} activeDot={{r:5}}/><Line type="monotone" dataKey="Previsão" stroke={OPEN_COLOR} strokeWidth={2.6} strokeDasharray="6 4" dot={{r:3}} activeDot={{r:5}}/></LineChart></ResponsiveContainer></div>
      </section>

      <section id="report-equipe-obras" data-report-section className="mgmt-panel">
        <ReportAdder sectionKey="equipe:obras-maior-gasto" title="Obras com maior gasto de equipe" componentName="Ranking de Obras" page="Equipe" type="CHART" data={projectChart} filters={reportFilters} captureId="report-equipe-obras" style={{float:'right'}}/>
        <h2>Obras com maior gasto de equipe</h2><p>Top 10 do período. O centro transitório <strong>PROJETOS</strong> é desconsiderado.</p>
        <div className="mgmt-chart"><ResponsiveContainer><BarChart data={projectChart} layout="vertical" margin={{top:5,right:15,left:20,bottom:0}}><CartesianGrid strokeDasharray="3 3" opacity={0.14}/><XAxis type="number" tickFormatter={compact} tick={{fontSize:10}}/><YAxis type="category" dataKey="Projeto" width={72} tick={{fontSize:12,fontWeight:700}}/><Tooltip formatter={v=>brl(v)}/><Legend/><Bar dataKey="Pago" stackId="team" fill={PAID_COLOR}/><Bar dataKey="A pagar" stackId="team" fill={OPEN_COLOR}/></BarChart></ResponsiveContainer></div>
      </section>
    </div>

    <section className="mgmt-panel" data-report-section>
      <ReportAdder
        sectionKey="equipe:cadastro"
        title="Cadastro da Equipe"
        componentName="Tabela de Cadastro da Equipe"
        page="Equipe"
        type="TABLE"
        data={rosterReport}
        dataSets={{
          summary: rosterSummaryReport,
          visible: visibleRoster.map(item=>rosterReport.find(row=>row['Pessoa / empresa']===item.name)).filter(Boolean),
          all: detailedRosterReport,
        }}
        detailMode="visible"
        detailOptions={['summary','visible','all']}
        filters={relationReportFilters}
        style={{float:'right'}}
      />
      <div className="mgmt-panel-head"><div><h2>Cadastro da equipe</h2><p>Cadastro completo com movimentações de 2025 e 2026 e pendências futuras registradas, inclusive até 2030.</p></div></div>
      <div className="mgmt-table-filters mgmt-table-filters-six">
        <label>Pessoa / empresa<MultiSelect options={peopleRoster.map(item=>item.name)} selected={rosterNameFilters} onChange={setRosterNameFilters} placeholder="Todas"/></label>
        <label>Cargo / função<MultiSelect options={rosterRoles} selected={rosterRoleFilters} onChange={setRosterRoleFilters} placeholder="Todos"/></label>
        <label>Tipo<MultiSelect options={rosterTypes} selected={rosterTypeFilters} onChange={setRosterTypeFilters} placeholder="Todos"/></label>
        <label>Projetos<MultiSelect options={rosterProjects} selected={rosterProjectFilters} onChange={setRosterProjectFilters} placeholder="Todos"/></label>
        <label>Pago<input type="text" value={rosterPaidFilter} onChange={e=>setRosterPaidFilter(e.target.value)} placeholder="Valor exato"/></label>
        <label>A pagar<input type="text" value={rosterOpenFilter} onChange={e=>setRosterOpenFilter(e.target.value)} placeholder="Valor exato"/></label>
      </div>
      <div className="mgmt-table-wrap"><table className="mgmt-table mgmt-clickable-table"><thead><tr><th>Pessoa / empresa</th><th>Cargo / função</th><th>Tipo</th><th>Projetos</th><th>Pago</th><th>A pagar</th></tr></thead><tbody>
        {visibleRoster.map(item=>{const rows=item.transactions;const rowPaid=rows.filter(r=>r.paid).reduce((s,r)=>s+Number(r.valor||0),0);const rowOpen=rows.filter(r=>!r.paid).reduce((s,r)=>s+Number(r.valor||0),0);return <tr key={item.key} onClick={()=>setSelectedPerson(item)}><td><strong>{item.name}</strong></td><td>{item.roles.join(' · ')||'—'}</td><td>{item.thirdParty?'Terceiro':item.fixedMonthly?'Mensal / fixo':'Equipe'}</td><td>{item.projects.length}</td><td className="mgmt-value-paid">{brl(rowPaid)}</td><td className="mgmt-value-open">{brl(rowOpen)}</td></tr>})}
      </tbody></table></div>
      <Pager total={rosterFiltered.length} page={rosterPage} setPage={setRosterPage} pageSize={rosterPageSize} setPageSize={setRosterPageSize}/>
    </section>

    <section className="mgmt-panel" data-report-section>
      <ReportAdder sectionKey="equipe:obras-custos" title="Custos por Obra" componentName="Tabela de Custos por Obra" page="Equipe" type="TABLE" data={projectRelationRows.map(p=>({Projeto:p.name,'Pessoas / terceiros':p.peopleCount,Pago:p.paid,'A pagar':p.open,Total:p.total}))} filters={relationReportFilters} style={{float:'right'}}/>
      <h2>Equipe por projeto</h2>
      <p>Movimentações de 2025 e 2026 por projeto, mantendo também pendências futuras registradas, inclusive até 2030.</p>
      <div className="mgmt-table-filters mgmt-table-filters-five">
        <label>Projeto<MultiSelect options={projectRelationRows.map(item=>item.name)} selected={projectNameFilters} onChange={setProjectNameFilters} placeholder="Todos"/></label>
        <label>Pessoas / terceiros<input type="number" min="0" value={projectPeopleFilter} onChange={e=>setProjectPeopleFilter(e.target.value)} placeholder="Qtd. exata"/></label>
        <label>Pago<input type="text" value={projectPaidFilter} onChange={e=>setProjectPaidFilter(e.target.value)} placeholder="Valor exato"/></label>
        <label>A pagar<input type="text" value={projectOpenFilter} onChange={e=>setProjectOpenFilter(e.target.value)} placeholder="Valor exato"/></label>
        <label>Total<input type="text" value={projectTotalFilter} onChange={e=>setProjectTotalFilter(e.target.value)} placeholder="Valor exato"/></label>
      </div>
      <div className="mgmt-table-wrap"><table className="mgmt-table mgmt-clickable-table"><thead><tr><th>Projeto</th><th>Pessoas / terceiros</th><th>Pago</th><th>A pagar</th><th>Total</th></tr></thead><tbody>{visibleProjects.map(p=><tr key={p.name} onClick={()=>setSelectedProjectSummary(p)}><td><strong>{p.name}</strong></td><td>{p.peopleCount}</td><td className="mgmt-value-paid">{brl(p.paid)}</td><td className="mgmt-value-open">{brl(p.open)}</td><td><strong>{brl(p.total)}</strong></td></tr>)}</tbody></table></div>
      <Pager total={projectFiltered.length} page={projectPage} setPage={setProjectPage} pageSize={projectPageSize} setPageSize={setProjectPageSize}/>
    </section>

    <ProjectSummaryModal project={selectedProjectSummary} onClose={()=>setSelectedProjectSummary(null)}/>
    <PersonModal person={selectedPerson} onClose={()=>setSelectedPerson(null)}/>
  </div>;
}
