"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  RefreshCw, AlertCircle, Activity, FilterX,
  Landmark, ArrowDownCircle, ArrowUpCircle, Wallet, Calendar, Banknote,
  ChevronDown, ChevronRight, FileText
} from "lucide-react";
import MultiSelect from "@/components/MultiSelect";
import DataTable from "@/components/DataTable";
import ChartHeader from "@/components/charts/ChartHeader";
import IncomeExpenseChart from "@/components/charts/IncomeExpenseChart";
import AnnualFlowChart from "@/components/charts/AnnualFlowChart";
import CustomTooltip from "@/components/charts/CustomTooltip";
import { consolidateFinancialData } from "@/lib/consolidation";
import { useReport } from "@/contexts/ReportContext";
import ReportAdder from "@/components/report/ReportAdder";
import { getRolling30DayRange } from "@/lib/dateRange";
import { getActiveProjectNames } from "@/lib/projectRules";
import {
  BarChart, Bar, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, ReferenceLine, Cell
} from "recharts";

export default function FluxoDeCaixa() {
  const { isReportMode, openReportBuilder, exitReportMode } = useReport();
  const [isSyncing, setIsSyncing] = useState(false);
  const [data, setData] = useState([]);
  const [projetosBrutos, setProjetosBrutos] = useState([]);
  const [saldosBancarios, setSaldosBancarios] = useState([]);
  const [error, setError] = useState(null);
  const [lastSync, setLastSync] = useState(null);

  const [filterDataInicial, setFilterDataInicial] = useState(() => getRolling30DayRange().start);
  const [filterDataFinal, setFilterDataFinal] = useState(() => getRolling30DayRange().end);
  const [filterProjetos, setFilterProjetos] = useState([]);
  const [filterStatus, setFilterStatus] = useState([]);
  const [filterNomes, setFilterNomes] = useState([]);
  const [filterContas, setFilterContas] = useState([]);

  // Modal para detalhamento do Resumo de Hoje
  const [modalResumo, setModalResumo] = useState(null);
  const [expandedEmpresa, setExpandedEmpresa] = useState(null);

  const fetchDados = async (force = false) => {
    setIsSyncing(true);
    setError(null);
    try {
      const response = await fetch(force ? '/api/sync?force=1' : '/api/sync', { method: 'GET', cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || result.details?.message || 'Erro desconhecido');

      setData(result.data || []);
      setProjetosBrutos(result.projetos || []);
      setSaldosBancarios(result.saldosBancarios || []);
      const syncDate = result.syncedAt || result.snapshotAt;
      setLastSync(syncDate ? new Date(syncDate).toLocaleString('pt-BR') : null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
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

  const projetosDisponiveis = useMemo(() => getActiveProjectNames(projetosBrutos, true), [projetosBrutos]);
  const nomesDisponiveis = Array.from(new Set(baseData.map(d => d.nome).filter(Boolean))).sort();
  const contasDisponiveis = Array.from(new Set(baseData.map(d => d.contaDescricao).filter(Boolean))).sort();
  const statusDisponiveis = ["Recebido", "A receber", "Pago", "A pagar"];

  const entradasRealizadas = filteredData.filter(r => r.statusExibicao === 'Recebido').reduce((acc, r) => acc + r.valor, 0);
  const entradasARealizar = filteredData.filter(r => r.statusExibicao === 'A receber').reduce((acc, r) => acc + r.valor, 0);
  const saidasRealizadas = filteredData.filter(r => r.statusExibicao === 'Pago').reduce((acc, r) => acc + r.valor, 0);
  const saidasARealizar = filteredData.filter(r => r.statusExibicao === 'A pagar').reduce((acc, r) => acc + r.valor, 0);

  const totalEntradas = entradasRealizadas + entradasARealizar;
  const totalSaidas = saidasRealizadas + saidasARealizar;
  const resultadoTotal = totalEntradas - totalSaidas;
  const totalBancario = saldosBancarios.reduce((acc, row) => acc + (Number(row.Saldo) || 0), 0);

  // Evolução do Fluxo (Mensal / Período selecionado)
  const isDaily = useMemo(() => {
    if (!filterDataInicial || !filterDataFinal) return false;
    const diffTime = Math.abs(new Date(filterDataFinal).getTime() - new Date(filterDataInicial).getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) <= 60;
  }, [filterDataInicial, filterDataFinal]);

  const evolutionData = useMemo(() => {
    const map = {};

    if (isDaily && filterDataInicial && filterDataFinal) {
      const cursor = new Date(filterDataInicial + 'T00:00:00');
      const end = new Date(filterDataFinal + 'T00:00:00');
      while (cursor <= end) {
        const label = `${String(cursor.getDate()).padStart(2, '0')}/${String(cursor.getMonth() + 1).padStart(2, '0')}`;
        const ts = cursor.getTime();
        map[label] = { dataExibicao: label, Entradas: 0, Saídas: 0, Resultado: 0, timestamp: ts };
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    filteredData.forEach(item => {
      if (!item.data) return;
      const parts = item.data.split('/');
      if (parts.length !== 3) return;

      const label = isDaily ? `${parts[0]}/${parts[1]}` : `${parts[1]}/${parts[2]}`;
      const ts = isDaily ? item.dataTimestamp : new Date(parts[2], parts[1] - 1, 1).getTime();

      if (!map[label]) {
        map[label] = { dataExibicao: label, Entradas: 0, Saídas: 0, Resultado: 0, timestamp: ts };
      }
      if (item.natureza === 'Entrada') {
        map[label].Entradas += item.valor;
        map[label].Resultado += item.valor;
      }
      if (item.natureza === 'Saída') {
        map[label].Saídas += item.valor;
        map[label].Resultado -= item.valor;
      }
    });
    return Object.values(map).sort((a, b) => a.timestamp - b.timestamp);
  }, [filteredData, isDaily, filterDataInicial, filterDataFinal]);

  // Visões anuais respeitam os demais filtros, sem usar Data Inicial/Data Final.
  const annualFilteredData = useMemo(() => baseData.filter(item => {
    if (filterStatus.length > 0 && !filterStatus.includes(item.statusExibicao)) return false;
    if (filterProjetos.length > 0 && !filterProjetos.includes(item.projeto)) return false;
    if (filterNomes.length > 0 && !filterNomes.includes(item.nome)) return false;
    if (filterContas.length > 0 && !filterContas.includes(item.contaDescricao)) return false;
    return true;
  }), [baseData, filterProjetos, filterStatus, filterNomes, filterContas]);

  // Visão anual fixa de 2026; os filtros de conteúdo continuam válidos, mas o filtro de datas não limita este gráfico
  const annualData2026 = useMemo(() => {
    const map = {};
    const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    meses.forEach((m, i) => map[i] = { mesNome: m, Recebido: 0, 'A receber': 0, Pago: 0, 'A pagar': 0, Resultado: 0, id: i });
    
    annualFilteredData.forEach(item => {
      if (!item.data) return;
      const dataStr = String(item.data).trim();
      const parts = dataStr.split('/');
      if (parts.length === 3 && parts[2] === '2026') {
        const m = parseInt(parts[1], 10) - 1;
        if (map[m]) {
          const status = String(item.status || '').trim().toUpperCase();
          const isRealizado = status === 'REALIZADO';
          const isPrevisto = status === 'A REALIZAR';
          if (!isRealizado && !isPrevisto) return;
          if (item.natureza === 'Entrada') {
            if (isPrevisto) map[m]['A receber'] += item.valor;
            else map[m].Recebido += item.valor;
            map[m].Resultado += item.valor;
          }
          if (item.natureza === 'Saída') {
            if (isPrevisto) map[m]['A pagar'] += item.valor;
            else map[m].Pago += item.valor;
            map[m].Resultado -= item.valor;
          }
        }
      }
    });
    return Object.values(map).sort((a, b) => a.id - b.id);
  }, [annualFilteredData]);

  const hojeObj = useMemo(() => {
    const d = new Date();
    d.setHours(0,0,0,0);
    return d;
  }, []);

  const clearFilters = () => {
    setFilterProjetos([]);
    setFilterStatus([]);
    setFilterNomes([]);
    setFilterContas([]);
    const range = getRolling30DayRange();
    setFilterDataInicial(range.start);
    setFilterDataFinal(range.end);
  };

  // Novos blocos analíticos (Dia e Faturamento)
  const faturamentosNfes = useMemo(() => {
    const rawList = baseData.filter(item =>
      item.natureza === 'Entrada' &&
      item.statusExibicao === 'A receber' &&
      item.documento &&
      item.documento.toUpperCase().includes('NFES')
    );

    // A NF pode vir dividida entre faturamento operacional e administrativo.
    // O Valor exibido continua seguindo a regra atual; o Valor Real da NF usa
    // Valor total titulo apenas uma vez, sem somar a divisao ADM/operacional.
    const map = {};
    rawList.forEach(item => {
      const key = String(item.lancamento || 'SEM-LANCAMENTO') + '|' + String(item.documento || item.nome || 'SEM-DOCUMENTO');
      const linhas = Array.isArray(item.linhasOriginais) && item.linhasOriginais.length
        ? item.linhasOriginais
        : [item];

      const valoresReais = [
        Number(item.valorTotalTitulo) || 0,
        ...linhas.map(linha => Number(linha.valorTotalTitulo) || 0),
      ].filter(valor => valor > 0);

      const projetoObra = linhas
        .map(linha => String(linha.projeto || '').trim())
        .find(projeto => {
          const upper = projeto.toUpperCase();
          return projeto && !upper.includes('ADMINISTRA') && upper !== 'GRUPO OAE' && upper !== 'SEM PROJETO';
        }) || item.projeto;
      const valorRealNota = valoresReais.length ? Math.max(...valoresReais) : 0;

      if (!map[key]) {
        map[key] = {
          ...item,
          projeto: projetoObra,
          valorRealNota,
        };
      } else {
        map[key].valor += Number(item.valor) || 0;
        map[key].valorRealNota = Math.max(map[key].valorRealNota || 0, valorRealNota);
        if ((!map[key].projeto || String(map[key].projeto).toUpperCase().includes('ADMINISTRA')) && projetoObra) {
          map[key].projeto = projetoObra;
        }
      }
    });
    return Object.values(map).sort((a, b) => b.dataTimestamp - a.dataTimestamp);
  }, [baseData]);

  const [filtroFaturamento, setFiltroFaturamento] = useState('MES_ATUAL');

  const faturamentosNfesFiltrados = useMemo(() => {
    const hoje = new Date();
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();

    return faturamentosNfes
      .filter((row) => {
        if (filtroFaturamento === 'TODOS') return true;
        if (!row.data) return false;
        const [d, m, y] = String(row.data).split('/').map(Number);
        if (!d || !m || !y) return false;
        const vencimento = new Date(y, m - 1, d);
        return vencimento.getMonth() === mesAtual && vencimento.getFullYear() === anoAtual;
      })
      .sort((a, b) => (a.dataTimestamp || 0) - (b.dataTimestamp || 0));
  }, [faturamentosNfes, filtroFaturamento]);

  const totalFaturamentosNfes = faturamentosNfesFiltrados.reduce((acc, row) => acc + row.valor, 0);
  const totalValorRealNfes = faturamentosNfesFiltrados.reduce((acc, row) => acc + (Number(row.valorRealNota) || 0), 0);

  const compromissosDoDia = useMemo(() => {
    return baseData.filter(item => item.natureza === 'Saída' && item.statusExibicao === 'A pagar' && item.dataTimestamp === hojeObj.getTime());
  }, [baseData, hojeObj]);

  const receitasDoDia = useMemo(() => {
    return baseData.filter(item => item.natureza === 'Entrada' && item.statusExibicao === 'A receber' && item.dataTimestamp === hojeObj.getTime());
  }, [baseData, hojeObj]);

  const totalReceitasDia = receitasDoDia.reduce((acc, curr) => acc + curr.valor, 0);
  const totalCompromissosDia = compromissosDoDia.reduce((acc, curr) => acc + curr.valor, 0);

  const formatDateBR = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

  const previsao7Dias = useMemo(() => {
    const map = {};
    for(let i=0; i<7; i++) {
      const d = new Date(hojeObj);
      d.setDate(hojeObj.getDate() + i);
      const ts = d.getTime();
      const label = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth()+1).padStart(2, '0')}`;
      map[ts] = { dataExibicao: label, Entradas: 0, Saídas: 0, Resultado: 0, timestamp: ts };
    }

    baseData.forEach(item => {
      const status = String(item.status || '').trim().toUpperCase();
      if(status === 'A REALIZAR' && map[item.dataTimestamp]) {
        if (item.natureza === 'Entrada') {
          map[item.dataTimestamp].Entradas += item.valor;
          map[item.dataTimestamp].Resultado += item.valor;
        }
        if (item.natureza === 'Saída') {
          map[item.dataTimestamp].Saídas += item.valor;
          map[item.dataTimestamp].Resultado -= item.valor;
        }
      }
    });

    return Object.values(map).sort((a,b) => a.timestamp - b.timestamp);
  }, [baseData, hojeObj]);

  const reportFilters = {
    "Data inicial": filterDataInicial || "Todas",
    "Data final": filterDataFinal || "Todas",
    Projetos: filterProjetos.length ? filterProjetos : "Todos",
    Situação: filterStatus.length ? filterStatus : "Todas",
    Nomes: filterNomes.length ? filterNomes : "Todos",
    Contas: filterContas.length ? filterContas : "Todas",
  };
  const reportMovementRows = filteredData.map((item) => ({
    Data: item.data,
    Projeto: item.projeto,
    Nome: item.nome,
    Conta: item.contaDescricao,
    Situação: item.statusExibicao,
    Natureza: item.natureza,
    Valor: item.valor,
  }));

  const handleBarClick = (e) => {
    if (e && e.activePayload && e.activePayload.length > 0) {
      const tableElem = document.getElementById('tabela-movimentacoes');
      if(tableElem) tableElem.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (data.length === 0 && !isSyncing && !lastSync) {
    return (
      <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%', padding: '4rem 2rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '600', marginBottom: '1rem', color: 'var(--text-main)' }}>Fluxo de Caixa</h1>
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
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '600', marginBottom: '0.25rem', color: 'var(--text-main)', letterSpacing: '-0.5px' }}>
            Fluxo de Caixa
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            Acompanhamento de saldos, entradas, saídas e compromissos financeiros
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button onClick={() => isReportMode ? exitReportMode() : openReportBuilder('Fluxo de Caixa')} className={`btn ${isReportMode ? 'btn-primary' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '13px', background: isReportMode ? 'var(--primary)' : 'var(--bg-elevated)', color: isReportMode ? '#fff' : 'var(--text-main)', border: '1px solid var(--border-color)' }}>
            <FileText size={14} /> {isReportMode ? 'Sair do Modo Relatório' : 'Gerar Relatório'}
          </button>
          {isSyncing && <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Atualizando...</span>}
          <button onClick={() => fetchDados(true)} disabled={isSyncing} className="btn" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}>
            <RefreshCw size={16} className={isSyncing ? 'spin' : ''} style={{ marginRight: '0.5rem' }} /> Sincronizar
          </button>
        </div>
      </header>

      {/* Barra de Filtros */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 150px' }}>
          <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem', display: 'block' }}>Data Inicial</label>
          <input type="date" value={filterDataInicial} onChange={(e) => setFilterDataInicial(e.target.value)} />
        </div>
        <div style={{ flex: '1 1 150px' }}>
          <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem', display: 'block' }}>Data Final</label>
          <input type="date" value={filterDataFinal} onChange={(e) => setFilterDataFinal(e.target.value)} />
        </div>
        <div style={{ flex: '2 1 200px', minWidth: 0 }}>
          <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem', display: 'block' }}>Situação</label>
          <MultiSelect options={statusDisponiveis} selected={filterStatus} onChange={setFilterStatus} placeholder="Todas as situações" />
        </div>
        <div style={{ flex: '2 1 200px', minWidth: 0 }}>
          <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem', display: 'block' }}>Projeto / Obra</label>
          <MultiSelect options={projetosDisponiveis} selected={filterProjetos} onChange={setFilterProjetos} placeholder="Todos os projetos" />
        </div>
        <div style={{ flex: '2 1 200px', minWidth: 0 }}>
          <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem', display: 'block' }}>Conta</label>
          <MultiSelect options={contasDisponiveis} selected={filterContas} onChange={setFilterContas} placeholder="Todas as contas" />
        </div>
        <div style={{ flex: '2 1 200px', minWidth: 0 }}>
          <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem', display: 'block' }}>Nome</label>
          <MultiSelect options={nomesDisponiveis} selected={filterNomes} onChange={setFilterNomes} placeholder="Todos os nomes" />
        </div>
        <div style={{ flex: '0 0 auto' }}>
          <button onClick={clearFilters} className="btn" style={{ height: '42px', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-main)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Limpar Filtros">
            <FilterX size={16} />
          </button>
        </div>
      </div>

      {/* Linha Executiva Compacta de KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem', alignItems: 'stretch' }}>
        <div className="card" data-report-section style={{ padding: '1.25rem', borderLeft: '4px solid var(--info)' }}>
          <ReportAdder sectionKey="fluxo:kpis" title="Resumo Executivo do Fluxo de Caixa" componentName="Indicadores do Fluxo de Caixa" page="Fluxo de Caixa" type="SUMMARY" data={[{ "Saldo Bancário": totalBancario, Entradas: totalEntradas, Saídas: totalSaidas, Resultado: resultadoTotal, "A Receber": entradasARealizar, "A Pagar": saidasARealizar }]} filters={reportFilters} presetTags={["executive-financial"]} explanation="Resumo de saldos, entradas, saídas e compromissos conforme os filtros ativos." style={{ float: 'right' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '600' }}>Saldo Bancário</p>
            <Landmark size={16} color="var(--info)" />
          </div>
          <p style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-main)' }}>{formatCurrency(totalBancario)}</p>
        </div>

        <div className="card" style={{ padding: '1.25rem', height: '100%', minWidth: 0, borderLeft: '4px solid var(--success)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '600' }}>Entradas</p>
            <ArrowUpCircle size={16} color="var(--success)" />
          </div>
          <p style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-main)' }}>{formatCurrency(totalEntradas)}</p>
        </div>

        <div className="card" style={{ padding: '1.25rem', height: '100%', minWidth: 0, borderLeft: '4px solid var(--danger)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '600' }}>Saídas</p>
            <ArrowDownCircle size={16} color="var(--danger)" />
          </div>
          <p style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-main)' }}>{formatCurrency(totalSaidas)}</p>
        </div>

        <div className="card" style={{ padding: '1.25rem', height: '100%', minWidth: 0, borderLeft: `4px solid ${resultadoTotal >= 0 ? 'var(--success)' : 'var(--danger)'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '600' }}>Resultado</p>
            <Activity size={16} color={resultadoTotal >= 0 ? 'var(--success)' : 'var(--danger)'} />
          </div>
          <p style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-main)' }}>{formatCurrency(resultadoTotal)}</p>
        </div>

        <div className="card" style={{ padding: '1.25rem', height: '100%', minWidth: 0, borderLeft: '4px solid var(--warning)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '600' }}>A Receber</p>
            <Calendar size={16} color="var(--warning)" />
          </div>
          <p style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-main)' }}>{formatCurrency(entradasARealizar)}</p>
        </div>

        <div className="card" style={{ padding: '1.25rem', height: '100%', minWidth: 0, borderLeft: '4px solid var(--orange)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '600' }}>A Pagar</p>
            <Banknote size={16} color="var(--orange)" />
          </div>
          <p style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-main)' }}>{formatCurrency(saidasARealizar)}</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {/* Consolidação Saldos Bancários */}
        <div data-report-section className="card" style={{ padding: '1.5rem', flex: '1 1 350px' }}>
          <ReportAdder sectionKey="fluxo:saldos-bancarios" title="Saldos Bancários" componentName="Lista de Saldos Bancários" page="Fluxo de Caixa" type="TABLE" data={saldosBancarios.map(row => ({ Empresa: row.Sigla || row.Empresa_Conta, Banco: row.Banco, Conta: row.Conta, Data: row.Data, Saldo: Number(row.Saldo) || 0 }))} filters={{ "Data da posição": saldosBancarios.find(row => row.Data)?.Data || "Não disponível" }} presetTags={["executive-financial"]} style={{ float: 'right' }} />
          {(() => {
            // Pegar a data da primeira conta bancária que tiver data preenchida
            const dataBase = saldosBancarios.find(r => r.Data)?.Data || 'Data não disponível';
            
            return (
              <ChartHeader
                title="Saldos Bancários"
                infoTitle={`Posição bancária em ${dataBase}`}
                infoContent={`Saldos bancários consolidados por empresa na data de referência ${dataBase}.`}
              />
            );
          })()}
          {(() => {
            // Agrupar pela sigla da empresa para manter a leitura compacta.
            const grupoEmpresas = {};
            saldosBancarios.forEach(row => {
              const emp = row.Sigla || row.Empresa_Conta || 'OUTRAS';
              if (!grupoEmpresas[emp]) grupoEmpresas[emp] = { total: 0, contas: [] };
              grupoEmpresas[emp].total += Number(row.Saldo) || 0;
              grupoEmpresas[emp].contas.push(row);
            });
            const empresasArr = Object.entries(grupoEmpresas).sort((a, b) => b[1].total - a[1].total);

            if (empresasArr.length === 0) {
              return (
                <div style={{ marginTop: '1rem', padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
                  Nenhum saldo encontrado. Sincronize os dados.
                </div>
              );
            }

            return (
              <div style={{ marginTop: '1rem' }}>
                {/* Lista por empresa */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '310px', overflowY: 'auto' }}>
                  {empresasArr.map(([emp, { total, contas }]) => (
                    <div key={emp}>
                      {/* Linha da empresa (clicável) */}
                      <div
                        onClick={() => setExpandedEmpresa(expandedEmpresa === emp ? null : emp)}
                        style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '0.75rem 1rem', borderRadius: '8px', cursor: 'pointer',
                          background: expandedEmpresa === emp ? 'rgba(57,198,198,0.08)' : 'var(--bg-elevated)',
                          border: `1px solid ${expandedEmpresa === emp ? 'rgba(57,198,198,0.3)' : 'transparent'}`,
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={e => { if (expandedEmpresa !== emp) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                        onMouseLeave={e => { if (expandedEmpresa !== emp) e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', minWidth: 0, flex: 1, flexWrap: 'wrap' }}>
                          <div style={{
                            width: '20px', height: '20px', borderRadius: '50%',
                            background: total < 0 ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                          }}>
                            <span style={{ fontSize: '10px', color: total < 0 ? 'var(--danger)' : 'var(--success)' }}>
                              {expandedEmpresa === emp ? '▲' : '▼'}
                            </span>
                          </div>
                          <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>{emp}</span>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>({contas.length} conta{contas.length !== 1 ? 's' : ''})</span>
                        </div>
                        <span style={{ fontSize: '14px', fontWeight: '700', color: total < 0 ? 'var(--danger)' : 'var(--success)', whiteSpace: 'nowrap', flexShrink: 0, marginLeft: '0.75rem' }}>
                          {formatCurrency(total)}
                        </span>
                      </div>

                      {/* Detalhamento das contas (expandido) */}
                      {expandedEmpresa === emp && (
                        <div style={{ marginTop: '0.25rem', marginLeft: '1rem', borderLeft: '2px solid rgba(57,198,198,0.2)', paddingLeft: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          {contas.map((c, cIdx) => (
                            <div key={cIdx} style={{
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              padding: '0.5rem 0.75rem', borderRadius: '6px', background: 'var(--bg-main)',
                              fontSize: '12px'
                            }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem', minWidth: 0, paddingRight: '0.75rem' }}>
                                <span style={{ color: 'var(--text-main)', fontWeight: '500', whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{c.Banco || '-'}</span>
                                <span style={{ color: 'var(--text-secondary)', fontSize: '11px', whiteSpace: 'normal', overflowWrap: 'anywhere' }}>Conta: {c.Conta || '-'}</span>
                              </div>
                              <span style={{ fontWeight: '700', color: (Number(c.Saldo) || 0) < 0 ? 'var(--danger)' : 'var(--text-main)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                {formatCurrency(Number(c.Saldo) || 0)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Evolução do Fluxo */}
        <div id="report-fluxo-evolucao" data-report-section className="card" style={{ padding: '1.5rem', flex: '2 1 600px', display: 'flex', flexDirection: 'column' }}>
          <ReportAdder sectionKey="fluxo:evolucao" title="Evolução do Fluxo de Caixa" componentName="Gráfico de Evolução" page="Fluxo de Caixa" type="CHART" data={evolutionData} filters={reportFilters} captureId="report-fluxo-evolucao" presetTags={["executive-financial"]} style={{ alignSelf: 'flex-end' }} />
          <ChartHeader
            title="Evolução do Fluxo de Caixa"
            infoTitle="Evolução do Fluxo"
            infoContent="Entradas, saídas e resultado ao longo do período selecionado."
          />
          <div style={{ flex: 1, minHeight: '300px', marginTop: '1rem' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={evolutionData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis dataKey="dataExibicao" stroke="var(--text-secondary)" fontSize={10} tickMargin={10} axisLine={false} tickLine={false} interval={0} angle={-45} textAnchor="end" height={52} />
                <YAxis stroke="var(--text-secondary)" fontSize={11} tickFormatter={(val) => formatCurrency(val)} axisLine={false} tickLine={false} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="Entradas" fill="var(--success)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="Saídas" fill="var(--danger)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="Resultado" fill="var(--info)" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {evolutionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.Resultado >= 0 ? 'var(--info)' : 'var(--danger)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Resumo de hoje e faturamento no topo; previsão semanal abaixo */}
      <div className="fluxo-highlight-grid">

        <div id="report-fluxo-previsao" data-report-section className="card fluxo-weekly-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <ReportAdder sectionKey="fluxo:previsao-7-dias" title="Previsão Semanal — Próximos 7 Dias" componentName="Gráfico de Previsão Semanal" page="Fluxo de Caixa" type="CHART" data={previsao7Dias} filters={{ "Data-base": formatDateBR(hojeObj) }} captureId="report-fluxo-previsao" presetTags={["executive-financial"]} style={{ alignSelf: 'flex-end' }} />
          <ChartHeader
            title="Previsão Semanal (Próximos 7 Dias)"
            infoTitle="Previsão Semanal"
            infoContent="Entradas e saídas previstas para os próximos 7 dias."
          />
          <div style={{ flex: 1, minHeight: '250px', marginTop: '1rem', cursor: 'pointer' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={previsao7Dias} margin={{ top: 10, right: 10, left: 10, bottom: 0 }} onClick={handleBarClick}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis dataKey="dataExibicao" stroke="var(--text-secondary)" fontSize={12} tickMargin={10} axisLine={false} tickLine={false} />
                <YAxis stroke="var(--text-secondary)" fontSize={10} width={110} tickFormatter={(val) => formatCurrency(val)} axisLine={false} tickLine={false} />
                <RechartsTooltip content={<CustomTooltip />} cursor={{fill: 'rgba(255,255,255,0.05)'}} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="Entradas" fill="var(--success)" radius={[4, 4, 0, 0]} maxBarSize={30} />
                <Bar dataKey="Saídas" fill="var(--danger)" radius={[4, 4, 0, 0]} maxBarSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '0.5rem' }}>* Clique em uma data no gráfico para ver o detalhamento</p>
        </div>

        <div className="fluxo-highlight-content">

          <div data-report-section className="card fluxo-today-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
            <ReportAdder sectionKey="fluxo:resumo-hoje" title={`Resumo de Hoje — ${formatDateBR(hojeObj)}`} componentName="Resumo de Hoje" page="Fluxo de Caixa" type="SUMMARY" data={[{ "A Receber Hoje": totalReceitasDia, "Lançamentos a Receber": receitasDoDia.length, "A Pagar Hoje": totalCompromissosDia, "Lançamentos a Pagar": compromissosDoDia.length }]} filters={{ Data: formatDateBR(hojeObj) }} style={{ alignSelf: 'flex-end' }} />
            <ChartHeader
              title={`Resumo de Hoje — ${formatDateBR(hojeObj)}`}
              infoTitle="Dia Atual"
              infoContent="Contas a receber e contas a pagar previstas para hoje."
            />
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '1.25rem', marginTop: '0.25rem' }}>Movimentações previstas para hoje</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gridTemplateRows: 'repeat(2, minmax(0, 1fr))', gap: '0.75rem', flex: 1 }}>
              <div
                onClick={() => receitasDoDia.length > 0 && setModalResumo({ title: 'Recebimentos previstos para hoje', data: receitasDoDia, total: totalReceitasDia })}
                style={{
                  background: 'rgba(16, 185, 129, 0.05)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  borderRadius: '8px',
                  padding: '1rem 1.25rem',
                  cursor: receitasDoDia.length > 0 ? 'pointer' : 'default',
                  transition: 'background 0.2s',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center'
                }}
                onMouseOver={(e) => receitasDoDia.length > 0 && (e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)')}
                onMouseOut={(e) => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.05)'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <ArrowUpCircle size={18} color="var(--success)" />
                  <h3 style={{ fontSize: '13px', fontWeight: '600', color: 'var(--success)', textTransform: 'uppercase', margin: 0 }}>A Receber Hoje</h3>
                </div>
                <p style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '0.25rem' }}>{formatCurrency(totalReceitasDia)}</p>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                  {receitasDoDia.length > 0 ? `${receitasDoDia.length} lançamento${receitasDoDia.length > 1 ? 's' : ''}` : 'Nenhum lançamento'}
                </p>
              </div>

              <div
                onClick={() => compromissosDoDia.length > 0 && setModalResumo({ title: 'Pagamentos previstos para hoje', data: compromissosDoDia, total: totalCompromissosDia })}
                style={{
                  background: 'rgba(239, 68, 68, 0.05)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: '8px',
                  padding: '1rem 1.25rem',
                  cursor: compromissosDoDia.length > 0 ? 'pointer' : 'default',
                  transition: 'background 0.2s',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center'
                }}
                onMouseOver={(e) => compromissosDoDia.length > 0 && (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)')}
                onMouseOut={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.05)'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <ArrowDownCircle size={18} color="var(--danger)" />
                  <h3 style={{ fontSize: '13px', fontWeight: '600', color: 'var(--danger)', textTransform: 'uppercase', margin: 0 }}>A Pagar Hoje</h3>
                </div>
                <p style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '0.25rem' }}>{formatCurrency(totalCompromissosDia)}</p>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                  {compromissosDoDia.length > 0 ? `${compromissosDoDia.length} lançamento${compromissosDoDia.length > 1 ? 's' : ''}` : 'Nenhum lançamento'}
                </p>
              </div>
            </div>
          </div>

          <div data-report-section className="card fluxo-billing-card" style={{ padding: '1.5rem' }}>
            <ReportAdder sectionKey="fluxo:faturamento-nfes" title="Painel de Faturamento (NFES)" componentName="Tabela de Faturamentos" page="Fluxo de Caixa" type="TABLE" data={faturamentosNfesFiltrados.map(row => ({ Documento: row.documento, Projeto: row.projeto, Vencimento: row.data, "Valor Bruto": row.valorRealNota, "Valor Líquido": row.valor }))} filters={{ Tipo: "NFES", Situação: "A receber" }} style={{ float: 'right' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <ChartHeader
                title="Painel de Faturamento (NFES)"
                infoTitle="Faturamento"
                infoContent="Relação de notas faturadas — A receber."
              />
              <select
                value={filtroFaturamento}
                onChange={(e) => setFiltroFaturamento(e.target.value)}
                style={{ minWidth: '220px' }}
                aria-label="Filtro do Painel de Faturamento"
              >
                <option value="MES_ATUAL">Vencimento no mês atual</option>
                <option value="TODOS">Todos emitidos</option>
              </select>
            </div>
            <div className="table-container" style={{ marginTop: '1rem', maxHeight: '360px', overflowY: 'auto' }}>
              <table style={{ fontSize: '12px', minWidth: '760px' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr>
                    <th>Documento</th>
                    <th>Projeto</th>
                    <th>Vencimento</th>
                    <th style={{ textAlign: 'right' }}>Valor Bruto</th>
                    <th style={{ textAlign: 'right' }}>Valor Líquido</th>
                  </tr>
                </thead>
                <tbody>
                  {faturamentosNfesFiltrados.length > 0 ? faturamentosNfesFiltrados.map((row, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: '500' }}>{row.documento}</td>
                      <td style={{ maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={row.projeto}>{row.projeto}</td>
                      <td>{row.data}</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-main)', fontWeight: '600' }}>{formatCurrency(row.valorRealNota)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--success)' }}>{formatCurrency(row.valor)}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan="5" style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)' }}>Nenhum faturamento encontrado.</td></tr>
                  )}
                </tbody>
                {faturamentosNfesFiltrados.length > 0 && (
                  <tfoot style={{ position: 'sticky', bottom: 0, background: 'var(--bg-elevated)', zIndex: 10, boxShadow: '0 -2px 10px rgba(0,0,0,0.1)' }}>
                    <tr>
                      <td colSpan="3" style={{ fontWeight: '600', textAlign: 'right', borderTop: '2px solid var(--border-color)', padding: '0.5rem' }}>Total:</td>
                      <td style={{ fontWeight: '700', color: 'var(--text-main)', textAlign: 'right', borderTop: '2px solid var(--border-color)', padding: '0.5rem' }}>{formatCurrency(totalValorRealNfes)}</td>
                      <td style={{ fontWeight: '700', color: 'var(--success)', textAlign: 'right', borderTop: '2px solid var(--border-color)', padding: '0.5rem' }}>{formatCurrency(totalFaturamentosNfes)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

        </div>
      </div>

      {/* Fluxo anual imediatamente antes das movimentações */}
      <div id="report-fluxo-anual" data-report-section className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <ReportAdder sectionKey="fluxo:anual" title="Movimentações Financeiras Anuais — 2026" componentName="Gráfico de Fluxo Anual" page="Fluxo de Caixa" type="CHART" data={annualData2026} filters={{ Ano: 2026 }} captureId="report-fluxo-anual" presetTags={["executive-financial"]} style={{ float: 'right' }} />
        <ChartHeader
          title="Movimentações Financeiras Anuais — 2026"
          infoTitle="Fluxo Anual 2026"
          infoContent="Recebido, a receber, pago, a pagar e resultado por mês de 2026."
        />
        <div style={{ height: '300px', marginTop: '1rem' }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={annualData2026} margin={{ top: 10, right: 18, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
              <XAxis dataKey="mesNome" stroke="var(--text-secondary)" fontSize={12} tickMargin={10} axisLine={false} tickLine={false} />
              <YAxis stroke="var(--text-secondary)" fontSize={12} tickFormatter={(val) => formatCurrency(val)} axisLine={false} tickLine={false} />
              <RechartsTooltip content={<CustomTooltip />} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
              <ReferenceLine y={0} stroke="var(--border-color)" />
              <Bar dataKey="Recebido" fill="var(--success)" radius={[4, 4, 0, 0]} maxBarSize={50} />
              <Bar dataKey="A receber" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={50} />
              <Bar dataKey="Pago" fill="var(--danger)" radius={[4, 4, 0, 0]} maxBarSize={42} />
              <Bar dataKey="A pagar" fill="var(--warning)" radius={[4, 4, 0, 0]} maxBarSize={42} />
              <Line type="monotone" dataKey="Resultado" stroke="var(--info)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabela de Movimentações */}
      <div id="tabela-movimentacoes" data-report-section style={{ marginBottom: '2rem' }}>
        <ReportAdder sectionKey="fluxo:movimentacoes" title="Movimentações Financeiras" componentName="Tabela de Movimentações" page="Fluxo de Caixa" type="TABLE" data={reportMovementRows} dataSets={{ summary: [{ "Quantidade de lançamentos": reportMovementRows.length, "Valor total": filteredData.reduce((sum, item) => sum + (item.valor || 0), 0) }], visible: reportMovementRows.slice(0, 15), all: reportMovementRows }} detailMode="visible" detailOptions={["summary", "visible", "all"]} filters={reportFilters} presetTags={["executive-financial"]} style={{ float: 'right' }} />
        <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '1rem' }}>Movimentações Financeiras</h2>
        <DataTable data={filteredData} />
      </div>

      {/* Modal Drawer para Resumo de Hoje */}
      {modalResumo && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'stretch', justifyContent: 'center', zIndex: 2147482000,
          padding: '1rem'
        }}>
          <div className="card" style={{
            width: 'min(1100px, 100%)', maxWidth: '1100px', maxHeight: 'calc(100vh - 2rem)',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            overflow: 'hidden'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', padding: '1.5rem', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-elevated)' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.25rem' }}>{modalResumo.title}</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {modalResumo.data.length} lançamento{modalResumo.data.length > 1 ? 's' : ''} | Total: <strong style={{ color: 'var(--text-main)' }}>{formatCurrency(modalResumo.total)}</strong>
                </p>
              </div>
              <button
                onClick={() => setModalResumo(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.5rem', borderRadius: '50%' }}
                onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text-main)'; }}
                onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
              >
                <FilterX size={20} />
              </button>
            </div>
            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
              <div className="table-container">
                <table style={{ fontSize: '12px', minWidth: '760px', width: '100%' }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                    <tr>
                      <th>{modalResumo.title.includes('Recebimentos') ? 'Cliente / Nome' : 'Fornecedor / Nome'}</th>
                      <th>Documento / Título</th>
                      <th>Projeto / Obra</th>
                      <th>Conta</th>
                      <th>Situação</th>
                      <th style={{ textAlign: 'right' }}>Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalResumo.data.map((row, idx) => (
                      <tr key={idx}>
                        <td style={{ maxWidth: '180px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={row.nome}>{row.nome || '-'}</td>
                        <td>{row.documento || row.lancamento || '-'}</td>
                        <td style={{ maxWidth: '120px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={row.projeto}>{row.projeto || '-'}</td>
                        <td style={{ maxWidth: '120px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={row.contaDescricao}>{row.contaDescricao || '-'}</td>
                        <td>
                          <span className={`badge ${row.statusExibicao === 'A receber' ? 'badge-info' : 'badge-warning'}`}>
                            {row.statusExibicao}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: '600', color: row.natureza === 'Entrada' ? 'var(--success)' : 'var(--danger)' }}>
                          {formatCurrency(row.valor)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
