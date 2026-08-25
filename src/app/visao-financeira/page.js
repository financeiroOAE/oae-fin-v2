"use client";

import { useState, useEffect, useMemo } from "react";
import { RefreshCw, AlertCircle, TrendingUp, TrendingDown, LayoutDashboard, Calendar, DollarSign, Database, ChevronLeft, ChevronRight, Building2, Activity, FilterX, Landmark, FileText, CheckCircle, Target, ArrowDownCircle, ArrowUpCircle, ArrowDown, ArrowUp } from "lucide-react";
import IncomeExpenseChart from "@/components/charts/IncomeExpenseChart";
import MonthlyResultChart from "@/components/charts/MonthlyResultChart";
import TopBarChart from "@/components/charts/TopBarChart";
import AccountBarChart from "@/components/charts/AccountBarChart";
import PieStatusChart from "@/components/charts/PieStatusChart";
import AnnualFlowChart from "@/components/charts/AnnualFlowChart";
import DataTable from "@/components/DataTable";
import MultiSelect from "@/components/MultiSelect";
import { consolidateFinancialData } from "@/lib/consolidation";
import { useReport } from "@/contexts/ReportContext";
import ReportAdder from "@/components/report/ReportAdder";
import { getRolling30DayRange } from "@/lib/dateRange";
import { classifyFinancialEntry } from "@/lib/financialClassification";

export default function VisaoFinanceira() {
  const { isReportMode, openReportBuilder, exitReportMode } = useReport();
  const [isSyncing, setIsSyncing] = useState(false);
  const [data, setData] = useState([]);
  const [saldosBancarios, setSaldosBancarios] = useState([]);
  const [somaProjetos, setSomaProjetos] = useState(0);
  const [error, setError] = useState(null);
  const [lastSync, setLastSync] = useState(null);

  // Global Filters - Inicializando para Últimos 30 Dias no mount, mas o useState não roda window aqui diretamente no SSR
  // Usaremos um useEffect para setar as datas padrão.
  const [filterDataInicial, setFilterDataInicial] = useState(() => getRolling30DayRange().start);
  const [filterDataFinal, setFilterDataFinal] = useState(() => getRolling30DayRange().end);
  // filtros multi-select (array vazio = Todos)
  const [filterProjetos, setFilterProjetos] = useState([]);
  const [filterStatus, setFilterStatus] = useState([]);
  const [filterNomes, setFilterNomes] = useState([]);
  const [filterContas, setFilterContas] = useState([]);

  const fetchDados = async (force = false) => {
    setIsSyncing(true);
    setError(null);
    try {
      const response = await fetch(force ? '/api/sync?force=1' : '/api/sync', { method: 'GET', cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || result.details?.message || 'Erro desconhecido');

      setData(result.data || []);
      setSaldosBancarios(result.saldosBancarios || []);
      setSomaProjetos(result.somaProjetosSaldo || 0);
      setLastSync(new Date().toLocaleString('pt-BR'));
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    // Seta 30 dias padrão se vazio
    fetchDados();
  }, []);

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const rawBaseData = useMemo(() => {
    return data.map(item => {
      let statusAmigavel = item.status;
      if (item.natureza === 'Entrada') {
        if (item.status === 'Realizado') statusAmigavel = 'Recebido';
        if (item.status === 'A realizar') statusAmigavel = 'A receber';
      } else if (item.natureza === 'Saída') {
        if (item.status === 'Realizado') statusAmigavel = 'Pago';
        if (item.status === 'A realizar') statusAmigavel = 'A pagar';
      }

      let dataTimestamp = 0;
      if (item.data) {
        const [d, m, y] = item.data.split('/');
        dataTimestamp = new Date(`${y}-${m}-${d}T12:00:00`).getTime();
      }
      return { ...item, statusExibicao: statusAmigavel, dataTimestamp };
    });
  }, [data]);

  const baseData = useMemo(() => {
    return consolidateFinancialData(rawBaseData, {
      filterProjetos,
      isProjetosPage: false
    });
  }, [rawBaseData, filterProjetos]);

  const filteredData = useMemo(() => {
    return baseData.filter(item => {
      if (filterStatus.length > 0 && !filterStatus.includes(item.statusExibicao)) return false;
      if (filterProjetos.length > 0 && !filterProjetos.includes(item.projeto)) return false;
      if (filterNomes.length > 0 && !filterNomes.includes(item.nome)) return false;
      if (filterContas.length > 0 && !filterContas.includes(item.contaDescricao)) return false;
      if (filterDataInicial) {
        const dIni = new Date(filterDataInicial + 'T00:00:00').getTime();
        if (item.dataTimestamp < dIni) return false;
      }
      if (filterDataFinal) {
        const dFim = new Date(filterDataFinal + 'T23:59:59').getTime();
        if (item.dataTimestamp > dFim) return false;
      }
      return true;
    });
  }, [baseData, filterDataInicial, filterDataFinal, filterProjetos, filterStatus, filterNomes, filterContas]);

  const realizedFilteredData = useMemo(() => filteredData.filter(item =>
    String(item.status || '').trim().toUpperCase() === 'REALIZADO'
  ), [filteredData]);

  const projetosDisponiveis = Array.from(new Set(baseData.map(d => d.projeto).filter(Boolean))).sort();
  const nomesDisponiveis = Array.from(new Set(baseData.map(d => d.nome).filter(Boolean))).sort();
  const contasDisponiveis = Array.from(new Set(baseData.map(d => d.contaDescricao).filter(Boolean))).sort();

  // KPIs
  const totalBancario = saldosBancarios.reduce((acc, row) => acc + (Number(row.Saldo) || 0), 0);
  
  const entradasRealizadas = realizedFilteredData.filter(r => r.natureza === 'Entrada').reduce((acc, r) => acc + r.valor, 0);
  const entradasARealizar = filteredData.filter(r => r.natureza === 'Entrada' && r.status === 'A realizar').reduce((acc, r) => acc + r.valor, 0);
  const saidasRealizadas = realizedFilteredData.filter(r => r.natureza === 'Saída').reduce((acc, r) => acc + r.valor, 0);
  const saidasARealizar = filteredData.filter(r => r.natureza === 'Saída' && r.status === 'A realizar').reduce((acc, r) => acc + r.valor, 0);

  const resultadoRealizado = entradasRealizadas - saidasRealizadas;
  const resultadoPrevisto = entradasARealizar - saidasARealizar;
  
  // Agrupamentos Dinâmicos (Diário vs Mensal)
  const isDaily = useMemo(() => {
    if (!filterDataInicial || !filterDataFinal) return false;
    const diffTime = Math.abs(new Date(filterDataFinal) - new Date(filterDataInicial));
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) <= 60;
  }, [filterDataInicial, filterDataFinal]);

  const flowData = useMemo(() => {
    const map = {};
    filteredData.forEach(item => {
      if (!item.data) return;
      const parts = item.data.split('/');
      if (parts.length !== 3) return;
      
      const label = isDaily ? `${parts[0]}/${parts[1]}` : `${parts[1]}/${parts[2]}`;
      const ts = isDaily ? item.dataTimestamp : new Date(parts[2], parts[1] - 1, 1).getTime();

      if (!map[label]) {
        map[label] = { label, Entradas: 0, Saídas: 0, timestamp: ts };
      }
      if (item.natureza === 'Entrada') map[label].Entradas += item.valor;
      if (item.natureza === 'Saída') map[label].Saídas += item.valor;
    });
    return Object.values(map).sort((a, b) => a.timestamp - b.timestamp);
  }, [filteredData, isDaily]);

  // Status Pie Charts
  const pieRecebimentos = [
    { name: 'Recebido', value: entradasRealizadas },
    { name: 'A receber', value: entradasARealizar }
  ];
  const piePagamentos = [
    { name: 'Pago', value: saidasRealizadas },
    { name: 'A pagar', value: saidasARealizar }
  ];

  // Top Projetos Entradas / Saídas
  const topProjetosEntradas = useMemo(() => {
    const map = {};
    filteredData.filter(i => {
      const classification = classifyFinancialEntry(i);
      return classification.type === 'receita_projeto' && i.projeto && !String(i.projeto).toUpperCase().includes('ADMINISTRA');
    }).forEach(i => {
      map[i.projeto] = (map[i.projeto] || 0) + i.valor;
    });
    return Object.entries(map).map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor).slice(0, 10);
  }, [filteredData]);

  const topProjetosSaidas = useMemo(() => {
    const map = {};
    filteredData.filter(i => i.natureza === 'Saída' && i.projeto).forEach(i => {
      map[i.projeto] = (map[i.projeto] || 0) + i.valor;
    });
    return Object.entries(map).map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor).slice(0, 10);
  }, [filteredData]);

  // Top Contas Entradas / Saídas
  const entryCategoryData = useMemo(() => {
    const map = {};
    filteredData.filter(i => i.natureza === 'Entrada').forEach(i => {
      const classification = classifyFinancialEntry(i);
      map[classification.label] = (map[classification.label] || 0) + (Number(i.valor) || 0);
    });
    return Object.entries(map).map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor);
  }, [filteredData]);

  const topContasSaidas = useMemo(() => {
    const map = {};
    filteredData.filter(i => i.natureza === 'Saída' && i.contaDescricao).forEach(i => {
      map[i.contaDescricao] = (map[i.contaDescricao] || 0) + i.valor;
    });
    return Object.entries(map).map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor).slice(0, 10);
  }, [filteredData]);

  // Visões anuais respeitam os filtros de conteúdo, mas nunca o recorte de datas.
  const annualFilteredData = useMemo(() => baseData.filter(item => {
    if (filterStatus.length > 0 && !filterStatus.includes(item.statusExibicao)) return false;
    if (filterProjetos.length > 0 && !filterProjetos.includes(item.projeto)) return false;
    if (filterNomes.length > 0 && !filterNomes.includes(item.nome)) return false;
    if (filterContas.length > 0 && !filterContas.includes(item.contaDescricao)) return false;
    return true;
  }), [baseData, filterProjetos, filterStatus, filterNomes, filterContas]);

  // Fluxo Anual
  const anoAnual = '2026';
  const annualData = useMemo(() => {
    const map = {};
    const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    
    meses.forEach((m, idx) => {
      map[idx] = { mesNome: m, 'Entradas Realizadas': 0, 'Entradas Programadas': 0, Saídas: 0, mesId: idx };
    });

    annualFilteredData.forEach(item => {
      if (!item.data) return;
      const dataStr = String(item.data).trim();
      const parts = dataStr.split('/');
      if (parts.length === 3 && parts[2] === anoAnual) {
        const mIdx = parseInt(parts[1], 10) - 1;
        if (map[mIdx]) {
          const status = String(item.status || '').trim().toUpperCase();
          const isRealizado = status === 'REALIZADO';
          const isPrevisto = status === 'A REALIZAR';
          if (!isRealizado && !isPrevisto) return;
          if (item.natureza === 'Entrada') {
            if (isPrevisto) map[mIdx]['Entradas Programadas'] += item.valor;
            else map[mIdx]['Entradas Realizadas'] += item.valor;
          }
          if (item.natureza === 'Saída') map[mIdx].Saídas += item.valor;
        }
      }
    });

    return Object.values(map).sort((a, b) => a.mesId - b.mesId);
  }, [annualFilteredData]);

  const reportFilters = {
    "Data inicial": filterDataInicial || "Todas",
    "Data final": filterDataFinal || "Todas",
    Projetos: filterProjetos.length ? filterProjetos : "Todos",
    Situação: filterStatus.length ? filterStatus : "Todas",
    "Nome / fornecedor": filterNomes.length ? filterNomes : "Todos",
    Contas: filterContas.length ? filterContas : "Todas",
  };
  const reportMovementRows = filteredData.map((item) => ({
    Data: item.data,
    Projeto: item.projeto,
    "Nome / Fornecedor": item.nome,
    Conta: item.contaDescricao,
    Documento: item.documento || '',
    Lançamento: item.lancamento || '',
    Situação: item.statusExibicao,
    Natureza: item.natureza,
    Valor: item.valor,
  }));

  // O período financeiro padrão permanece fixo entre hoje e os próximos 30 dias.
  const setFilter30Dias = () => {
    const range = getRolling30DayRange();
    setFilterDataInicial(range.start);
    setFilterDataFinal(range.end);
  };

  if (data.length === 0 && !isSyncing && !lastSync) {
    return (
      <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%', padding: '4rem 2rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '600', marginBottom: '1rem', color: 'var(--text-main)' }}>Visão Financeira</h1>
        <div className="card" style={{ maxWidth: '400px', margin: '0 auto', padding: '2rem' }}>
          <AlertCircle size={48} style={{ margin: '0 auto', marginBottom: '1rem', color: 'var(--text-secondary)' }} />
          <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.5rem' }}>Dados não sincronizados</h2>
          <button onClick={() => fetchDados(true)} className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
            <RefreshCw size={16} style={{ marginRight: '0.5rem' }} /> Sincronizar Dados
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ maxWidth: '1400px', margin: '0 auto', width: '100%', paddingBottom: '3rem' }}>
      
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '600', marginBottom: '0.25rem', color: 'var(--text-main)', letterSpacing: '-0.5px' }}>
            Visão Financeira
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            Visão executiva consolidada da Oliveira Araújo Engenharia
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button onClick={() => isReportMode ? exitReportMode() : openReportBuilder('Visão Financeira')} className={`btn ${isReportMode ? 'btn-primary' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '13px', background: isReportMode ? 'var(--primary)' : 'var(--bg-elevated)', color: isReportMode ? '#fff' : 'var(--text-main)', border: '1px solid var(--border-color)' }}>
            <FileText size={14} /> {isReportMode ? 'Sair do Modo Relatório' : 'Gerar Relatório'}
          </button>
          {lastSync && <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}><Database size={12} style={{display:'inline', marginRight:'4px'}}/> {lastSync}</span>}
          <button onClick={() => fetchDados(true)} className="btn btn-primary" disabled={isSyncing} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '13px' }}>
            <RefreshCw size={14} className={isSyncing ? "spinner" : ""} /> {isSyncing ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>
      </header>

      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', padding: '0.75rem 1rem', borderRadius: '6px', marginBottom: '1rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '13px' }}>
          <AlertCircle size={18} /> <strong>Erro:</strong> {error}
        </div>
      )}

      {/* Filtros Globais */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '2px solid var(--primary)' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600', marginRight: '0.5rem' }}>Período padrão:</span>
          <button onClick={setFilter30Dias} className="btn" style={{ fontSize: '11px', padding: '0.25rem 0.5rem', background: 'var(--bg-elevated)' }}>Hoje + próximos 30 dias</button>
        </div>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 140px', minWidth: 0 }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.35rem', display: 'block' }}>Data Inicial</label>
            <input type="date" value={filterDataInicial} onChange={(e) => setFilterDataInicial(e.target.value)} style={{ width: '100%', height: '34px', fontSize: '13px', background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '6px', padding: '0 0.5rem' }} />
          </div>
          <div style={{ flex: '1 1 140px', minWidth: 0 }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.35rem', display: 'block' }}>Data Final</label>
            <input type="date" value={filterDataFinal} onChange={(e) => setFilterDataFinal(e.target.value)} style={{ width: '100%', height: '34px', fontSize: '13px', background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '6px', padding: '0 0.5rem' }} />
          </div>
          <div style={{ flex: '2 1 220px', minWidth: 0 }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}><Building2 size={12}/> Projeto / Centro de Custo</label>
            <MultiSelect options={projetosDisponiveis} value={filterProjetos} onChange={setFilterProjetos} placeholder="Todos os projetos" />
          </div>
          <div style={{ flex: '2 1 200px', minWidth: 0 }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.35rem', display: 'block' }}>Nome / Fornecedor</label>
            <MultiSelect options={nomesDisponiveis} value={filterNomes} onChange={setFilterNomes} placeholder="Todos" />
          </div>
          <div style={{ flex: '2 1 200px', minWidth: 0 }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.35rem', display: 'block' }}>Conta</label>
            <MultiSelect options={contasDisponiveis} value={filterContas} onChange={setFilterContas} placeholder="Todas as contas" />
          </div>
          <div style={{ flex: '1 1 160px', minWidth: 0 }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}><Activity size={12}/> Situação</label>
            <MultiSelect options={['Pago', 'A pagar', 'Recebido', 'A receber']} value={filterStatus} onChange={setFilterStatus} placeholder="Todas" />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button 
              onClick={() => { setFilter30Dias(); setFilterProjetos([]); setFilterStatus([]); setFilterNomes([]); setFilterContas([]); }}
              className="btn" 
              style={{ height: '34px', fontSize: '12px', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap', marginTop: '1.6rem' }}
            >
              <FilterX size={14} /> Limpar
            </button>
          </div>
        </div>
      </div>

      {/* KPIs Principais */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" data-report-section style={{ padding: '1.5rem' }}>
          <ReportAdder sectionKey="visao:kpis" title="Resumo Executivo Financeiro" componentName="Indicadores Financeiros" page="Visão Financeira" type="SUMMARY" data={[{ "Saldo Bancário": totalBancario, "Saldo Contratos": somaProjetos, "Resultado Realizado": resultadoRealizado, "Resultado Previsto": resultadoPrevisto, Recebido: entradasRealizadas, "A Receber": entradasARealizar, Pago: saidasRealizadas, "A Pagar": saidasARealizar }]} columnFormats={{ "Saldo Bancário": "currency", "Saldo Contratos": "currency", "Resultado Realizado": "currency", "Resultado Previsto": "currency", Recebido: "currency", "A Receber": "currency", Pago: "currency", "A Pagar": "currency" }} filters={reportFilters} presetTags={["executive-financial"]} explanation="Consolidação dos principais saldos e resultados conforme os filtros ativos." style={{ float: 'right' }} />
          <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem', fontWeight: '600' }}><Landmark size={16} color="var(--primary)"/> Saldo Bancário Total</p>
          <p style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-main)' }}>{formatCurrency(totalBancario)}</p>
        </div>
        <div className="card" style={{ padding: '1.5rem' }}>
          <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem', fontWeight: '600' }}><FileText size={16} color="var(--purple)"/> Saldo Contratos</p>
          <p style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-main)' }}>{formatCurrency(somaProjetos)}</p>
        </div>
        <div className="card" style={{ padding: '1.5rem' }}>
          <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem', fontWeight: '600' }}><CheckCircle size={16} color="var(--primary)"/> Resultado Realizado</p>
          <p style={{ fontSize: '24px', fontWeight: '700', color: resultadoRealizado >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {formatCurrency(resultadoRealizado)}
          </p>
        </div>
        <div className="card" style={{ padding: '1.5rem' }}>
          <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem', fontWeight: '600' }}><Target size={16} color="var(--primary)"/> Resultado Previsto</p>
          <p style={{ fontSize: '24px', fontWeight: '700', color: resultadoPrevisto >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {formatCurrency(resultadoPrevisto)}
          </p>
        </div>
      </div>

      {/* KPIs Secundários */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--success)' }}>
          <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}><ArrowDownCircle size={14} color="var(--success)"/> Entradas Realizadas</p>
          <p style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-main)' }}>{formatCurrency(entradasRealizadas)}</p>
        </div>
        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid rgba(16, 185, 129, 0.4)' }}>
          <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}><ArrowUpCircle size={14} color="var(--success)"/> A Receber</p>
          <p style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-main)' }}>{formatCurrency(entradasARealizar)}</p>
        </div>
        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--danger)' }}>
          <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}><ArrowUp size={14} color="var(--danger)"/> Pago</p>
          <p style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-main)' }}>{formatCurrency(saidasRealizadas)}</p>
        </div>
        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid rgba(239, 68, 68, 0.4)' }}>
          <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}><ArrowDown size={14} color="var(--danger)"/> A Pagar</p>
          <p style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-main)' }}>{formatCurrency(saidasARealizar)}</p>
        </div>
      </div>

      {/* Grid Principal dos Gráficos (Dashboard) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '1.5rem' }}>
        
        {/* ROW 1: Evolução Operacional e Resultado Financeiro */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '1.5rem' }}>
          <div id="report-visao-fluxo" data-report-section className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
            <ReportAdder sectionKey="visao:fluxo-operacional" title="Fluxo Operacional de Entradas e Saídas" componentName="Gráfico de Fluxo Operacional" page="Visão Financeira" type="CHART" data={flowData} columns={[{ key: "label", label: "Período" }, { key: "Entradas", label: "Entradas", format: "currency" }, { key: "Saídas", label: "Saídas", format: "currency" }]} filters={reportFilters} captureId="report-visao-fluxo" presetTags={["executive-financial"]} explanation="Evolução das entradas e saídas no período selecionado." style={{ alignSelf: 'flex-end' }} />
            <h2 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.5rem' }}>Fluxo Operacional de Entradas e Saídas (R$)</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Evolução do período selecionado</p>
            <div style={{ flex: 1, minHeight: '260px' }}>
              <IncomeExpenseChart data={flowData} />
            </div>
          </div>
          <div id="report-visao-resultado" data-report-section className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
            <ReportAdder sectionKey="visao:resultado" title="Resultado Financeiro Consolidado" componentName="Gráfico de Resultado Financeiro" page="Visão Financeira" type="CHART" data={flowData.map(row => ({ Período: row.label, Resultado: row.Entradas - row.Saídas }))} filters={reportFilters} captureId="report-visao-resultado" presetTags={["executive-financial"]} explanation="Resultado líquido obtido pela diferença entre entradas e saídas." style={{ alignSelf: 'flex-end' }} />
            <h2 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.5rem' }}>Resultado Financeiro Consolidado (R$)</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Evolução do saldo (Entradas - Saídas) no período selecionado</p>
            <div style={{ flex: 1, minHeight: '260px' }}>
              <MonthlyResultChart data={flowData} />
            </div>
          </div>
        </div>

        {/* ROW 2: Status Financeiro e Fluxo Anual */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '1.5rem' }}>
          <div id="report-visao-status" data-report-section className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
            <ReportAdder sectionKey="visao:status" title="Status Financeiro Consolidado" componentName="Gráficos de Status" page="Visão Financeira" type="CHART" data={[...pieRecebimentos, ...piePagamentos]} filters={reportFilters} captureId="report-visao-status" presetTags={["executive-financial"]} style={{ alignSelf: 'flex-end' }} />
            <h2 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '1.5rem' }}>Status Financeiro Consolidado</h2>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem', justifyContent: 'center' }}>
              <PieStatusChart realizado={entradasRealizadas} pendente={entradasARealizar} colorRealizado="var(--success)" colorPendente="rgba(16, 185, 129, 0.3)" titulo="Entradas" />
              <PieStatusChart realizado={saidasRealizadas} pendente={saidasARealizar} colorRealizado="var(--danger)" colorPendente="rgba(239, 68, 68, 0.3)" titulo="Pagamentos" />
            </div>
          </div>
          <div id="report-visao-anual" data-report-section className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
            <ReportAdder sectionKey="visao:anual" title="Movimentações Financeiras Anuais — 2026" componentName="Gráfico de Fluxo Anual" page="Visão Financeira" type="CHART" data={annualData} filters={{ Ano: 2026 }} captureId="report-visao-anual" presetTags={["executive-financial"]} style={{ alignSelf: 'flex-end' }} />
            <h2 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '0.25rem', color: 'var(--text-main)' }}>Movimentações Financeiras Anuais — 2026</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Entradas realizadas, títulos programados a receber e saídas. Entradas programadas não são meta nem orçamento. Visão anual independente do filtro de datas.</p>
            <div style={{ flex: 1, minHeight: '240px' }}>
              <AnnualFlowChart data={annualData} />
            </div>
          </div>
        </div>

        {/* ROW 3: Centro de Custo */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '3rem' }}>
          <div id="report-visao-centros-entrada" data-report-section className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
            <ReportAdder sectionKey="visao:centros-entrada" title="10 Projetos por Receita de Projetos" componentName="Ranking de Entradas" page="Visão Financeira" type="CHART" data={topProjetosEntradas} filters={reportFilters} captureId="report-visao-centros-entrada" style={{ alignSelf: 'flex-end' }} />
            <h2 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.25rem' }}>10 Projetos por Receita de Projetos</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Projetos com maior volume de receita no período selecionado; Administração, empréstimos e aportes não entram neste ranking.</p>
            <div style={{ flex: 1, minHeight: '360px' }}>
              <TopBarChart data={topProjetosEntradas} color="var(--success)" />
            </div>
          </div>
          <div id="report-visao-centros-saida" data-report-section className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
            <ReportAdder sectionKey="visao:centros-saida" title="10 Centros de Custo por Saídas" componentName="Ranking de Saídas" page="Visão Financeira" type="CHART" data={topProjetosSaidas} filters={reportFilters} captureId="report-visao-centros-saida" style={{ alignSelf: 'flex-end' }} />
            <h2 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.25rem' }}>10 Centros de Custo por Saídas</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Maiores volumes pagos e a pagar</p>
            <div style={{ flex: 1, minHeight: '360px' }}>
              <TopBarChart data={topProjetosSaidas} color="var(--danger)" />
            </div>
          </div>
        </div>

        {/* ROW 4: Plano de Contas */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '3rem' }}>
          <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
            <AccountBarChart 
              data={entryCategoryData} 
              title="Composição das Entradas por Natureza" 
              infoContent="Separa Receita de Projetos, Receitas Administrativas, Outras Receitas, Empréstimos/Financiamentos, Aportes, Movimentações Financeiras e Outras Entradas. Empréstimos e aportes são entradas de caixa, mas não são receita." 
              color="var(--success)" 
            />
          </div>
          <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
            <AccountBarChart 
              data={topContasSaidas} 
              title="Despesas por Plano de Conta" 
              infoContent="Concentração por contas contábeis de Saídas" 
              color="var(--danger)" 
            />
          </div>
        </div>

      </div>

      {/* Tabela Interativa de Movimentações */}
      <div data-report-section style={{ marginBottom: '2rem' }}>
        <ReportAdder sectionKey="visao:movimentacoes" title="Movimentações Financeiras" componentName="Tabela de Movimentações" page="Visão Financeira" type="TABLE" data={reportMovementRows} dataSets={{ summary: [{ "Quantidade de lançamentos": reportMovementRows.length, "Valor total": filteredData.reduce((sum, item) => sum + (item.valor || 0), 0) }], visible: reportMovementRows.slice(0, 15), all: reportMovementRows }} detailMode="visible" detailOptions={["summary", "visible", "all"]} filters={reportFilters} presetTags={["executive-financial"]} style={{ float: 'right' }} />
        <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '1rem' }}>Movimentações Financeiras</h2>
        <DataTable data={filteredData} />
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .spinner { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .fade-in { animation: fadeIn 0.3s ease-in-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
        
        input[type="date"] {
          background-color: var(--bg-elevated);
          border: 1px solid var(--border-color);
          color: var(--text-main);
          border-radius: 6px;
          padding: 0 0.5rem;
          color-scheme: dark;
        }
      `}} />
    </div>
  );
}
