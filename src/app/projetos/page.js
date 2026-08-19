"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { 
  RefreshCw, AlertCircle, Database, Building2, 
  FileText, Target, ArrowDownCircle, ArrowUpCircle, ArrowDown, ArrowUp,
  Percent, Briefcase, X, ArrowUpDown, ArrowUpAZ, ArrowDownAZ, LayoutDashboard,
  FilterX, PieChart, Activity, ChevronLeft, ChevronRight
} from "lucide-react";
import DataTable from "@/components/DataTable";
import ABCClassDonut from "@/components/charts/ABCClassDonut";
import StackedProgressChart from "@/components/charts/StackedProgressChart";
import RankingBarChart from "@/components/charts/RankingBarChart";
import MultiSelect from "@/components/MultiSelect";
import InfoTooltip from "@/components/InfoTooltip";
import { consolidateFinancialData } from "@/lib/consolidation";
import { useReport } from "@/contexts/ReportContext";
import ReportAdder from "@/components/report/ReportAdder";
import { getRolling30DayRange } from "@/lib/dateRange";

const TABLE_PAGE_SIZE = 15;

// O nome da obra pode estar abreviado ou grafado de formas diferentes entre
// PROJETOS_2026, CP_GERAL e CR_GERAL. O código inicial é o identificador estável.
const getProjectKey = (value) => {
  const normalized = String(value || '').trim().toUpperCase();
  const code = normalized.match(/^(\d+(?:A\d+)?)/)?.[1];
  return code || normalized.replace(/[^A-Z0-9]/g, '');
};

export default function Projetos() {
  const { isReportMode, openReportBuilder, exitReportMode } = useReport();
  const [isSyncing, setIsSyncing] = useState(false);
  const [data, setData] = useState([]);
  const [projetosBrutos, setProjetosBrutos] = useState([]);
  const [error, setError] = useState(null);
  const [lastSync, setLastSync] = useState(null);

  // Filtros Globais (multi-select arrays — array vazio = Todos)
  const [filterDataInicial, setFilterDataInicial] = useState(() => getRolling30DayRange().start);
  const [filterDataFinal, setFilterDataFinal] = useState(() => getRolling30DayRange().end);
  const [filterProjetos, setFilterProjetos] = useState([]);
  const [filterEmpresas, setFilterEmpresas] = useState([]);
  const [filterTipos, setFilterTipos] = useState([]);
  
  // Filtros Inline da Tabela
  const [colFilterProjeto, setColFilterProjeto] = useState('');
  const [colFilterEmpresa, setColFilterEmpresa] = useState('');
  const [colFilterMinFaturadoPerc, setColFilterMinFaturadoPerc] = useState('');
  
  // Sort + Paginação
  const [sortConfig, setSortConfig] = useState({ key: 'contratado', direction: 'desc' });
  const [tablePage, setTablePage] = useState(1);
  
  // Drawer e Toggle
  const [selectedProject, setSelectedProject] = useState(null);
  const [incluirRateioAdm, setIncluirRateioAdm] = useState(false);

  const fetchDados = async (force = false) => {
    setIsSyncing(true);
    setError(null);
    try {
      const response = await fetch(force ? '/api/sync?force=1' : '/api/sync', { method: 'GET', cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || result.details?.message || 'Erro desconhecido');
      setData(result.data || []);
      setProjetosBrutos(result.projetos || []);
      setLastSync(new Date().toLocaleString('pt-BR'));
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => { fetchDados(); }, []);

  const formatCurrency = (val) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val || 0);
  const formatPercent = (val) => `${(val * 100).toFixed(2)}%`;

  const dIni = filterDataInicial ? new Date(filterDataInicial + 'T00:00:00').getTime() : 0;
  const dFim = filterDataFinal ? new Date(filterDataFinal + 'T23:59:59').getTime() : Infinity;
  const currentYear = new Date().getFullYear();
  const realizadoIni = new Date(currentYear, 0, 1).getTime();
  const realizadoFim = new Date().setHours(23, 59, 59, 999);

  const baseData = useMemo(() => {
    return consolidateFinancialData(data, {
      isProjetosPage: true,
      incluirRateioAdm
    });
  }, [data, incluirRateioAdm]);

  const projetosCruzados = useMemo(() => {
    const mapaProjetos = {};
    projetosBrutos.forEach(p => {
      const nomeObra = String(p.OBRA || '').trim();
      if (!nomeObra || nomeObra.toUpperCase().includes('ADMINISTRATIVO')) return;
      const projectKey = getProjectKey(p.ID || nomeObra);
      mapaProjetos[projectKey] = {
        projectKey,
        nome: nomeObra,
        empresa: p.EMPRESA || 'N/A',
        tipo: p.TIPO || 'N/A',
        contratado: Number(p.CONTRATO) || 0,
        faturado: Number(p['NF FATURADAS']) || 0,
        saldoContratual: Number(p['SALDO CONTRATUAL']) || 0,
        recebido: 0, aReceber: 0, pago: 0, aPagar: 0,
        receitaDireta: 0, receitaAdm: 0, // Apenas para exibição do InfoTooltip
        titulosAdmAssociados: []
      };
    });

    baseData.forEach(item => {
      let ts = 0;
      if (item.data) {
        const parts = item.data.split('/');
        if (parts.length === 3) ts = new Date(parts[2], parts[1] - 1, parts[0]).getTime();
      }
      const projetoNome = item.projeto;
      const projectKey = getProjectKey(projetoNome);
      
      if (projetoNome && mapaProjetos[projectKey]) {
        const projeto = mapaProjetos[projectKey];
        const st = String(item.status || '').toUpperCase();
        const isRealizado = st.includes('REALIZADO') || st.includes('RECEBIDO') || st.includes('PAGO') || st.includes('EFETIVADO');
        const isPrevisto = !isRealizado && (st.includes('A REALIZAR') || st.includes('A RECEBER') || st.includes('A PAGAR') || st.includes('PREVISTO'));
        if (isRealizado && (ts < realizadoIni || ts > realizadoFim)) return;
        if (isPrevisto && (ts < dIni || ts > dFim)) return;
        if (!isRealizado && !isPrevisto) return;
        
        if (item.natureza === 'Entrada') {
          if (isRealizado) {
            projeto.recebido += item.valor;
            projeto.receitaDireta += item.valorDireto || 0;
            projeto.receitaAdm += item.valorAdministrativo || 0;
          } else {
            projeto.aReceber += item.valor;
          }
        } else if (item.natureza === 'Saída') {
          if (isRealizado) projeto.pago += item.valor;
          else projeto.aPagar += item.valor;
        }
      }
    });

    return Object.values(mapaProjetos).map(p => ({
      ...p,
      percentFaturado: p.contratado > 0 ? (p.faturado / p.contratado) : 0,
      resultadoCaixa: p.recebido - p.pago,
      receitaConsideradaTooltip: p.receitaDireta + (incluirRateioAdm ? p.receitaAdm : 0)
    }));
  }, [projetosBrutos, baseData, dIni, dFim, realizadoIni, realizadoFim, incluirRateioAdm]);

  const filteredProjetos = useMemo(() => {
    return projetosCruzados.filter(p => {
      if (filterProjetos.length > 0 && !filterProjetos.includes(p.nome)) return false;
      if (filterEmpresas.length > 0 && !filterEmpresas.includes(p.empresa)) return false;
      if (filterTipos.length > 0 && !filterTipos.includes(p.tipo)) return false;
      if (colFilterProjeto && !p.nome.toLowerCase().includes(colFilterProjeto.toLowerCase())) return false;
      if (colFilterEmpresa && !p.empresa.toLowerCase().includes(colFilterEmpresa.toLowerCase())) return false;
      if (colFilterMinFaturadoPerc && (p.percentFaturado * 100) < Number(colFilterMinFaturadoPerc)) return false;
      return true;
    });
  }, [projetosCruzados, filterProjetos, filterEmpresas, filterTipos, colFilterProjeto, colFilterEmpresa, colFilterMinFaturadoPerc]);

  const listaProjetos = Array.from(new Set(projetosCruzados.map(p => p.nome))).sort();
  const listaEmpresas = Array.from(new Set(projetosCruzados.map(p => p.empresa))).sort();
  const listaTipos = Array.from(new Set(projetosCruzados.map(p => p.tipo))).sort();

  const sortedProjetos = useMemo(() => {
    const sortable = [...filteredProjetos];
    if (sortConfig.key) {
      sortable.sort((a, b) => {
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortable;
  }, [filteredProjetos, sortConfig]);

  const totalTablePages = Math.ceil(sortedProjetos.length / TABLE_PAGE_SIZE);
  const paginatedProjetos = useMemo(() => {
    const start = (tablePage - 1) * TABLE_PAGE_SIZE;
    return sortedProjetos.slice(start, start + TABLE_PAGE_SIZE);
  }, [sortedProjetos, tablePage]);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
    setTablePage(1);
  };

  const [kpiModal, setKpiModal] = useState(null);

  const kpiBreakdown = useMemo(() => {
    if (!kpiModal) return [];
    const map = {};
    filteredProjetos.forEach(p => {
      const val = kpiModal === 'contratado' ? p.contratado : (kpiModal === 'faturado' ? p.faturado : p.saldoContratual);
      if (val > 0) {
        map[p.empresa] = (map[p.empresa] || 0) + val;
      }
    });
    return Object.entries(map).map(([empresa, valor]) => ({ empresa, valor })).sort((a, b) => b.valor - a.valor);
  }, [kpiModal, filteredProjetos]);

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return <ArrowUpDown size={12} style={{ opacity: 0.3 }} />;
    return sortConfig.direction === 'asc' ? <ArrowUpAZ size={12} /> : <ArrowDownAZ size={12} />;
  };

  // KPIs
  const totalContratado = filteredProjetos.reduce((acc, p) => acc + p.contratado, 0);
  const totalFaturado = filteredProjetos.reduce((acc, p) => acc + p.faturado, 0);
  const totalSaldo = filteredProjetos.reduce((acc, p) => acc + p.saldoContratual, 0);
  const percentTotalFaturado = totalContratado > 0 ? totalFaturado / totalContratado : 0;
  
  const totalRecebido = filteredProjetos.reduce((acc, p) => acc + p.recebido, 0);
  const totalAReceber = filteredProjetos.reduce((acc, p) => acc + p.aReceber, 0);
  const totalPago = filteredProjetos.reduce((acc, p) => acc + p.pago, 0);
  const totalAPagar = filteredProjetos.reduce((acc, p) => acc + p.aPagar, 0);
  const totalResultado = totalRecebido - totalPago;
  
  const totalRecebidoAdmGlobal = filteredProjetos.reduce((acc, p) => acc + p.recebidoAdm, 0);

  function isCDP(planoFinanceiro) {
    const raw = String(planoFinanceiro || '');
    const dashIdx = raw.indexOf(' - ');
    const descricao = dashIdx >= 0 ? raw.slice(dashIdx + 3) : raw;
    return descricao.trim().toUpperCase().startsWith('C.D.P');
  }

  // Helper para classificar tributos no gráfico de Impostos
  const getTaxCategory = useCallback((item) => {
    const infoStr = `${item.dreClasse || ''} ${item.drePacote || ''} ${item.dreLinha || ''} ${item.contaDescricao || ''} ${item.contaNome || ''}`.toUpperCase();
    if (infoStr.includes('PIS/COFINS/CSLL/ISS') || infoStr.includes('RETENÇÕES AGRUPADAS')) return 'Retenções agrupadas';
    if (infoStr.includes('ISS') || infoStr.includes('IMPOSTO SOBRE SERVIÇO')) return 'ISS';
    if (infoStr.includes('PIS/COFINS')) return 'PIS/COFINS';
    if (infoStr.includes('COFINS')) return 'COFINS';
    if (infoStr.includes('PIS')) return 'PIS';
    if (infoStr.includes('IRPJ')) return 'IRPJ';
    if (infoStr.includes('CSLL')) return 'CSLL';
    if (infoStr.includes('SIMPLES NACIONAL')) return 'SIMPLES NACIONAL';
    if (infoStr.includes('IMPOSTOS SOBRE RECEITA') || infoStr.includes('DEDUÇÕES DA RECEITA')) return 'Outros impostos';
    return null;
  }, []);

  const dreStats = useMemo(() => {
    // Receita: usar a mesma lógica de consolidação 80/20 já validada
    const receitaConsolidada = consolidateFinancialData(
      data.filter(item => {
        let ts = 0;
        if (item.data) {
          const parts = item.data.split('/');
          if (parts.length === 3) ts = new Date(parts[2], parts[1] - 1, parts[0]).getTime();
        }
        if (item.natureza !== 'Entrada') return false;
        const st = String(item.status || '').toUpperCase();
        const isRealizado = st.includes('REALIZADO') || st.includes('RECEBIDO') || st.includes('EFETIVADO');
        const isPrevisto = !isRealizado && (st.includes('A REALIZAR') || st.includes('A RECEBER') || st.includes('PREVISTO'));
        if (isRealizado) return ts >= realizadoIni && ts <= realizadoFim;
        if (isPrevisto) return ts >= dIni && ts <= dFim;
        return false;
      }),
      { isProjetosPage: true, incluirRateioAdm }
    );

    const allowedProjects = new Set(filteredProjetos.map(p => p.projectKey));

    let recReceita = 0, recAReceber = 0;
    receitaConsolidada.forEach(item => {
      if (!allowedProjects.has(getProjectKey(item.projeto))) return;
      const st = String(item.status || '').toUpperCase();
      const isRealizado = st.includes('REALIZADO') || st.includes('RECEBIDO') || st.includes('PAGO') || st.includes('EFETIVADO');
      if (isRealizado) recReceita += item.valor || 0;
      else recAReceber += item.valor || 0;
    });

    // Custos e Despesas: usar a classificação gerencial da DRE (DEPARA)
    let cPago = 0, cAPagar = 0, dPago = 0, dAPagar = 0, nc = 0;
    
    data.forEach(item => {
      if (item.natureza !== 'Saída') return;
      if (!allowedProjects.has(getProjectKey(item.projeto))) return;
      if (item.projeto && String(item.projeto).toUpperCase().includes('ADMINISTRA')) return; // Não trazer custos do CC ADMINISTRAÇÃO

      let ts = 0;
      if (item.data) {
        const parts = item.data.split('/');
        if (parts.length === 3) ts = new Date(parts[2], parts[1] - 1, parts[0]).getTime();
      }
      const valor = Math.abs(item.valor || 0);
      const st = String(item.status || '').toUpperCase();
      const isRealizado = st.includes('REALIZADO') || st.includes('PAGO') || st.includes('EFETIVADO');
      const isPrevisto = !isRealizado && (st.includes('A REALIZAR') || st.includes('A PAGAR') || st.includes('PREVISTO'));

      // Se não for nem realizado nem previsto, ignora (ex: Cancelado)
      if (!isRealizado && !isPrevisto) return;
      if (isRealizado && (ts < realizadoIni || ts > realizadoFim)) return;
      if (isPrevisto && (ts < dIni || ts > dFim)) return;

      const dreInfo = `${item.dreClasse || ''} ${item.dreLinha || ''} ${item.contaDescricao || ''}`.toLowerCase();
      
      if (dreInfo.includes('custo')) {
        if (isRealizado) cPago += valor;
        else if (isPrevisto) cAPagar += valor;
      } else if (dreInfo.includes('despesa')) {
        if (isRealizado) dPago += valor;
        else if (isPrevisto) dAPagar += valor;
      } else {
        if (isRealizado) nc += valor;
      }
    });

    return {
      receita: recReceita,
      receitaAReceber: recAReceber,
      custo: cPago,
      custoAPagar: cAPagar,
      despesa: dPago,
      despesaAPagar: dAPagar,
      naoClassificado: nc
    };
  }, [data, filteredProjetos, dIni, dFim, realizadoIni, realizadoFim, incluirRateioAdm]);

  const taxesData = useMemo(() => {
    const taxesMap = {};
    let totalTaxes = 0;
    const allowedProjects = new Set(filteredProjetos.map(p => p.projectKey));

    data.forEach(item => {
      if (item.natureza !== 'Saída') return;
      if (!allowedProjects.has(getProjectKey(item.projeto))) return;

      let ts = 0;
      if (item.data) {
        const parts = item.data.split('/');
        if (parts.length === 3) ts = new Date(parts[2], parts[1] - 1, parts[0]).getTime();
      }
      const st = String(item.status || '').toUpperCase();
      const isRealizado = st.includes('REALIZADO') || st.includes('PAGO') || st.includes('EFETIVADO');
      if (!isRealizado || ts < realizadoIni || ts > realizadoFim) return;

      const taxCategory = getTaxCategory(item);

      if (taxCategory) {
        const val = Math.abs(item.valor || 0);
        taxesMap[taxCategory] = (taxesMap[taxCategory] || 0) + val;
        totalTaxes += val;
      }
    });

    const arr = Object.entries(taxesMap).map(([name, Valor]) => ({ name, Valor })).sort((a, b) => b.Valor - a.Valor);
    return { list: arr, total: totalTaxes };
  }, [data, filteredProjetos, realizadoIni, realizadoFim, getTaxCategory]);

  const margemFinanceira = dreStats.receita > 0 ? ((dreStats.receita - dreStats.custo - dreStats.despesa) / dreStats.receita) * 100 : null;
  const resultadoGerencial = dreStats.receita - dreStats.custo - dreStats.despesa;
  const taxPercentage = dreStats.receita > 0 ? (taxesData.total / dreStats.receita) * 100 : 0;

  const abcDonutData = useMemo(() => {
    const sortedForABC = [...filteredProjetos].filter(p => p.contratado > 0).sort((a, b) => b.contratado - a.contratado);
    const sumTotal = sortedForABC.reduce((acc, p) => acc + p.contratado, 0);
    let accPercent = 0;
    let aTotal = 0, aProjects = [];
    let bTotal = 0, bProjects = [];
    let cTotal = 0, cProjects = [];
    sortedForABC.forEach(p => {
      const pInd = sumTotal > 0 ? (p.contratado / sumTotal) * 100 : 0;
      accPercent += pInd;
      if (accPercent <= 80) { aTotal += p.contratado; aProjects.push(p); }
      else if (accPercent <= 95) { bTotal += p.contratado; bProjects.push(p); }
      else { cTotal += p.contratado; cProjects.push(p); }
    });
    return [
      { name: 'Classe A', value: aTotal, count: aProjects.length, color: 'var(--success)', projects: aProjects, rule: 'Projetos que somam os primeiros 80% do Valor Contratado total' },
      { name: 'Classe B', value: bTotal, count: bProjects.length, color: 'var(--warning)', projects: bProjects, rule: 'Projetos que somam entre 80% e 95% do Valor Contratado total' },
      { name: 'Classe C', value: cTotal, count: cProjects.length, color: 'var(--danger)', projects: cProjects, rule: 'Projetos que somam os últimos 5% do Valor Contratado total (cauda)' },
    ].filter(item => item.value > 0);
  }, [filteredProjetos]);

  const allProjectsData = useMemo(() =>
    [...filteredProjetos].filter(p => p.contratado > 0).sort((a, b) => b.contratado - a.contratado)
      .map(p => ({ nome: p.nome, Contratado: p.contratado, Faturado: p.faturado, Saldo: p.saldoContratual })),
    [filteredProjetos]);

  const topEntradasData = useMemo(() =>
    [...filteredProjetos].filter(p => p.recebido > 0).sort((a, b) => b.recebido - a.recebido).slice(0, 5)
      .map(p => ({ nome: p.nome, Valor: p.recebido })),
    [filteredProjetos]);

  const topSaidasData = useMemo(() =>
    [...filteredProjetos].filter(p => p.pago > 0).sort((a, b) => b.pago - a.pago).slice(0, 5)
      .map(p => ({ nome: p.nome, Valor: p.pago })),
    [filteredProjetos]);

  const reportFilters = {
    "Data inicial": filterDataInicial || "Todas",
    "Data final": filterDataFinal || "Todas",
    Projetos: filterProjetos.length ? filterProjetos : "Todos",
    Empresas: filterEmpresas.length ? filterEmpresas : "Todas",
    Tipos: filterTipos.length ? filterTipos : "Todos",
    "Rateio administrativo": incluirRateioAdm ? "Incluído" : "Não incluído",
  };
  const projectReportRows = sortedProjetos.map((project) => ({
    Projeto: project.nome,
    Empresa: project.empresa,
    Contratado: project.contratado,
    Faturado: project.faturado,
    Saldo: project.saldoContratual,
    Recebido: project.recebido,
    "A Receber": project.aReceber,
    Pago: project.pago,
    "A Pagar": project.aPagar,
    Resultado: project.resultadoCaixa,
  }));

  const selectedProjectMoves = useMemo(() => {
    if (!selectedProject) return [];
    return data.filter(item => getProjectKey(item.projeto) === selectedProject.projectKey);
  }, [selectedProject, data]);

  const clearAllFilters = () => {
    setFilterProjetos([]); setFilterEmpresas([]); setFilterTipos([]);
    const range = getRolling30DayRange();
    setFilterDataInicial(range.start); setFilterDataFinal(range.end);
    setColFilterProjeto(''); setColFilterEmpresa(''); setColFilterMinFaturadoPerc('');
    setTablePage(1);
  };

  if (projetosBrutos.length === 0 && !isSyncing && !lastSync) {
    return (
      <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%', padding: '4rem 2rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '600', marginBottom: '1rem', color: 'var(--text-main)' }}>Projetos</h1>
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
    <div className="fade-in" style={{ maxWidth: '1400px', margin: '0 auto', width: '100%', paddingBottom: '3rem', position: 'relative' }}>

      {/* 1. Cabeçalho */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '600', marginBottom: '0.25rem', color: 'var(--text-main)', letterSpacing: '-0.5px' }}>Projetos</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Acompanhamento executivo da carteira de obras</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button onClick={() => isReportMode ? exitReportMode() : openReportBuilder('Projetos')} className={`btn ${isReportMode ? 'btn-primary' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '13px', background: isReportMode ? 'var(--primary)' : 'var(--bg-elevated)', color: isReportMode ? '#fff' : 'var(--text-main)', border: '1px solid var(--border-color)' }}>
            <FileText size={14} /> {isReportMode ? 'Sair do Modo Relatório' : 'Gerar Relatório'}
          </button>
          {lastSync && <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}><Database size={12} style={{ display: 'inline', marginRight: '4px' }} /> {lastSync}</span>}
          <button onClick={() => fetchDados(true)} className="btn btn-primary" disabled={isSyncing} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '13px' }}>
            <RefreshCw size={14} className={isSyncing ? "spinner" : ""} /> {isSyncing ? 'Atualizando...' : 'Atualizar Dados'}
          </button>
        </div>
      </header>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid var(--danger)', padding: '0.75rem 1rem', borderRadius: '6px', marginBottom: '1rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '13px' }}>
          <AlertCircle size={18} /> <strong>Erro:</strong> {error}
        </div>
      )}

      {/* 2. Filtros Globais com MultiSelect */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem', borderTop: '2px solid var(--purple)' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          
          <div style={{ flex: '2 1 220px', minWidth: 0 }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Briefcase size={12} /> Projeto / Obra
            </label>
            <MultiSelect options={listaProjetos} value={filterProjetos} onChange={(v) => { setFilterProjetos(v); setTablePage(1); }} placeholder="Todos os projetos" />
          </div>

          <div style={{ flex: '1 1 160px', minWidth: 0 }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Building2 size={12} /> Empresa
            </label>
            <MultiSelect options={listaEmpresas} value={filterEmpresas} onChange={(v) => { setFilterEmpresas(v); setTablePage(1); }} placeholder="Todas as empresas" />
          </div>

          <div style={{ flex: '1 1 140px', minWidth: 0 }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <LayoutDashboard size={12} /> Tipo
            </label>
            <MultiSelect options={listaTipos} value={filterTipos} onChange={(v) => { setFilterTipos(v); setTablePage(1); }} placeholder="Todos os tipos" />
          </div>

          <div style={{ flex: '1 1 140px', minWidth: 0 }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.35rem', display: 'block' }}>Caixa: Data Inicial</label>
            <input type="date" value={filterDataInicial} readOnly aria-readonly="true" title="Período fixo: hoje"
              style={{ width: '100%', height: '34px', fontSize: '13px', color: 'var(--text-main)', background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0 0.5rem' }} />
          </div>

          <div style={{ flex: '1 1 140px', minWidth: 0 }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.35rem', display: 'block' }}>Caixa: Data Final</label>
            <input type="date" value={filterDataFinal} readOnly aria-readonly="true" title="Período fixo: 30 dias à frente"
              style={{ width: '100%', height: '34px', fontSize: '13px', color: 'var(--text-main)', background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0 0.5rem' }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '0' }}>
            <button onClick={clearAllFilters} className="btn"
              style={{ height: '34px', fontSize: '12px', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap', marginTop: '1.6rem' }}>
              <FilterX size={14} /> Limpar Tudo
            </button>
          </div>
        </div>

        {/* Badges dos filtros ativos */}
        {(filterProjetos.length > 0 || filterEmpresas.length > 0 || filterTipos.length > 0) && (
          <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)', fontSize: '11px', color: 'var(--text-secondary)' }}>
            <strong>{filteredProjetos.length}</strong> projeto{filteredProjetos.length !== 1 ? 's' : ''} exibido{filteredProjetos.length !== 1 ? 's' : ''} com os filtros aplicados.
          </div>
        )}
      </div>

      {/* 3. KPIs Contratos */}
      <h3 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Consolidado de Contratos</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" onClick={() => setKpiModal('contratado')} style={{ padding: '1.5rem', borderLeft: '4px solid var(--purple)', cursor: 'pointer', transition: 'all 0.2s ease' }} title="Clique para ver por empresa" onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseOut={e => e.currentTarget.style.transform = 'none'}>
          <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem', fontWeight: '600' }}><FileText size={16} color="var(--purple)" /> Valor Contratado</p>
          <p style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-main)' }}>{formatCurrency(totalContratado)}</p>
        </div>
        <div className="card" onClick={() => setKpiModal('faturado')} style={{ padding: '1.5rem', borderLeft: '4px solid var(--primary)', cursor: 'pointer', transition: 'all 0.2s ease' }} title="Clique para ver por empresa" onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseOut={e => e.currentTarget.style.transform = 'none'}>
          <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem', fontWeight: '600' }}><Target size={16} color="var(--primary)" /> Faturado</p>
          <p style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-main)' }}>{formatCurrency(totalFaturado)}</p>
        </div>
        <div className="card" onClick={() => setKpiModal('saldo')} style={{ padding: '1.5rem', borderLeft: '4px solid var(--warning)', cursor: 'pointer', transition: 'all 0.2s ease' }} title="Clique para ver por empresa" onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseOut={e => e.currentTarget.style.transform = 'none'}>
          <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem', fontWeight: '600' }}><Briefcase size={16} color="var(--warning)" /> Saldo Contratual</p>
          <p style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-main)' }}>{formatCurrency(totalSaldo)}</p>
        </div>
        <div className="card" style={{ padding: '1.5rem', borderLeft: '4px solid var(--success)' }}>
          <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem', fontWeight: '600' }}><Percent size={16} color="var(--success)" /> % Faturado</p>
          <p style={{ fontSize: '22px', fontWeight: '700', color: 'var(--success)' }}>{formatPercent(percentTotalFaturado)}</p>
        </div>
      </div>

      {/* 4. KPIs Caixa e Toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h3 style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Consolidado de Caixa</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-elevated)', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <label style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input 
              type="checkbox" 
              checked={incluirRateioAdm} 
              onChange={e => setIncluirRateioAdm(e.target.checked)}
              style={{ accentColor: 'var(--primary)', width: '14px', height: '14px', cursor: 'pointer' }}
            />
            Incluir rateio administrativo da receita
          </label>
          <InfoTooltip 
            title="Receita Administrativa Vinculada" 
            content={
              <>
                <p>Parcela da receita de um título lançada em centro de custo administrativo, mas vinculada ao projeto pela correspondência do mesmo Lançamento/Documento/Nome.</p>
                <p style={{ marginTop: '0.5rem' }}>Esta opção adiciona somente receitas administrativas vinculadas; despesas administrativas não são incorporadas ao projeto.</p>
                <ul style={{ paddingLeft: '1rem', marginTop: '0.5rem' }}>
                  <li><strong>Status Atual:</strong> {incluirRateioAdm ? 'Ativado (considerando rateio)' : 'Desativado (somente Receita Direta)'}</li>
                  <li><strong>Receita Adm. Total Vinculada:</strong> {formatCurrency(totalRecebidoAdmGlobal)}</li>
                </ul>
              </>
            } 
          />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--success)' }}>
          <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}><ArrowDownCircle size={14} color="var(--success)" /> Recebido em 2026</p>
          <p style={{ fontSize: '17px', fontWeight: '600', color: 'var(--text-main)' }}>{formatCurrency(totalRecebido)}</p>
        </div>
        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid rgba(16,185,129,0.4)' }}>
          <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}><ArrowUpCircle size={14} color="var(--success)" /> A Receber</p>
          <p style={{ fontSize: '17px', fontWeight: '600', color: 'var(--text-main)' }}>{formatCurrency(totalAReceber)}</p>
        </div>
        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--danger)' }}>
          <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}><ArrowUp size={14} color="var(--danger)" /> Pago em 2026</p>
          <p style={{ fontSize: '17px', fontWeight: '600', color: 'var(--text-main)' }}>{formatCurrency(totalPago)}</p>
        </div>
        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid rgba(239,68,68,0.4)' }}>
          <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}><ArrowDown size={14} color="var(--danger)" /> A Pagar</p>
          <p style={{ fontSize: '17px', fontWeight: '600', color: 'var(--text-main)' }}>{formatCurrency(totalAPagar)}</p>
        </div>
        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--primary)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
            <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}><Percent size={14} color="var(--primary)" /> Impostos sobre Faturamento</p>
            <ReportAdder sectionKey="projetos:impostos" title="Impostos sobre Faturamento" componentName="Resumo de Impostos" page="Projetos" type="SUMMARY" data={[{ "Total de Impostos": taxesData.total, "% sobre o Faturamento": taxPercentage }]} filters={reportFilters} />
          </div>
          <p style={{ fontSize: '17px', fontWeight: '600', color: 'var(--text-main)' }}>{formatCurrency(taxesData.total)}</p>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '0.2rem' }}><strong style={{ color: 'var(--primary)' }}>{taxPercentage.toFixed(2).replace('.', ',')}%</strong> do faturamento total</p>
        </div>
      </div>

      {/* 5. Composição Financeira + Resultado */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
        <div className="card" style={{ padding: '1.5rem', borderTop: '2px solid var(--primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <PieChart size={16} color="var(--primary)" /> Composição Financeira
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Classificação dos valores realizados em 2026</p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <ReportAdder sectionKey="projetos:composicao" title="Composição Financeira" componentName="Composição Financeira - Projetos" page="Projetos" type="SUMMARY" data={[{ "Receita Líquida": dreStats.receita, "Custos Diretos": dreStats.custo, "Despesas Admin.": dreStats.despesa, "Não Classificado": dreStats.naoClassificado }]} filters={reportFilters} presetTags={["project-executive"]} explanation="Composição gerencial da receita, custos e despesas dos projetos selecionados." />
              <InfoTooltip title="Composição Financeira (DRE)" content={<><p>Receita, Custo e Despesa são classificados através do DEPARA/DRE da conta financeira.</p><ul style={{ paddingLeft: '1rem', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}><li><strong>Receita:</strong> contas classificadas como Receita. Deduções abatem este valor.</li><li><strong>Custo:</strong> contas classificadas como Custos dos Serviços.</li><li><strong>Despesa:</strong> despesas administrativas/operacionais.</li></ul><p style={{ marginTop: '0.5rem' }}>Movimentações sem classificação ficam em "Não Classificado".</p></>} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '120px' }}>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Receita Líquida</p>
              <p style={{ fontSize: '19px', fontWeight: '700', color: 'var(--success)' }}>{formatCurrency(dreStats.receita)}</p>
            </div>
            <div style={{ flex: 1, minWidth: '120px' }}>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Custos Diretos</p>
              <p style={{ fontSize: '19px', fontWeight: '700', color: 'var(--warning)' }}>{formatCurrency(dreStats.custo)}</p>
              {dreStats.receita > 0 && <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{((dreStats.custo / dreStats.receita) * 100).toFixed(1)}% da Receita</span>}
            </div>
            <div style={{ flex: 1, minWidth: '120px' }}>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Despesas Admin.</p>
              <p style={{ fontSize: '19px', fontWeight: '700', color: 'var(--danger)' }}>{formatCurrency(dreStats.despesa)}</p>
              {dreStats.receita > 0 && <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{((dreStats.despesa / dreStats.receita) * 100).toFixed(1)}% da Receita</span>}
            </div>
          </div>
          {dreStats.receita > 0 && (
            <div style={{ width: '100%', height: '12px', background: 'var(--bg-main)', borderRadius: '6px', display: 'flex', overflow: 'hidden' }}>
              <div style={{ width: `${Math.max(0, 100 - ((dreStats.custo + dreStats.despesa) / dreStats.receita) * 100)}%`, background: 'var(--success)', transition: 'width 0.3s ease' }} />
              <div style={{ width: `${(dreStats.custo / dreStats.receita) * 100}%`, background: 'var(--warning)', transition: 'width 0.3s ease' }} />
              <div style={{ width: `${(dreStats.despesa / dreStats.receita) * 100}%`, background: 'var(--danger)', transition: 'width 0.3s ease' }} />
            </div>
          )}
          {dreStats.naoClassificado > 0 && (
            <div style={{ marginTop: '1rem', fontSize: '11px', color: 'var(--warning)', padding: '0.5rem', background: 'rgba(245,158,11,0.1)', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Aviso: <strong>{formatCurrency(dreStats.naoClassificado)}</strong> ainda sem classificação DRE válida.</span>
              <InfoTooltip title="Movimentações Não Classificadas" content="Essas movimentações não entram na composição Receita/Custo/Despesa até terem classificação segura. Isso evita que o resultado gerencial seja calculado incorretamente." />
            </div>
          )}
        </div>

        <div className="card" style={{ padding: '1.5rem', borderTop: '2px solid var(--primary)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Activity size={16} color="var(--primary)" /> Resultado Gerencial
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Receita - Custos - Despesas</p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <ReportAdder sectionKey="projetos:resultado" title="Resultado Gerencial" componentName="Cards Resultado Gerencial" page="Projetos" type="SUMMARY" data={[{ "Resultado Gerencial": resultadoGerencial, "Margem de Resultado (%)": margemFinanceira }]} filters={reportFilters} presetTags={["project-executive"]} explanation="Resultado após custos diretos e despesas administrativas, com a margem correspondente." />
              <InfoTooltip title="Resultado e Margem" content={<><p><strong>Fórmula do Resultado:</strong><br />Receita Líquida - Custos Diretos - Despesas Administrativas.</p><p style={{ marginTop: '0.5rem' }}><strong>Fórmula da Margem:</strong><br />(Resultado / Receita Líquida) × 100</p></>} />
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <p style={{ fontSize: '28px', fontWeight: '700', color: resultadoGerencial >= 0 ? 'var(--success)' : 'var(--danger)', letterSpacing: '-1px' }}>
              {formatCurrency(resultadoGerencial)}
            </p>
            <div style={{ marginTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                <span>Margem de Resultado</span>
                <strong style={{ color: margemFinanceira !== null ? (margemFinanceira >= 0 ? 'var(--success)' : 'var(--danger)') : 'var(--text-secondary)' }}>
                  {margemFinanceira !== null ? `${margemFinanceira.toFixed(1)}%` : 'Não aplicável'}
                </strong>
              </div>
              <div style={{ width: '100%', height: '6px', background: 'var(--bg-main)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: `${margemFinanceira !== null ? Math.min(100, Math.max(0, margemFinanceira)) : 0}%`, background: margemFinanceira !== null && margemFinanceira >= 0 ? 'var(--success)' : 'var(--danger)', height: '100%' }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Gráficos Analíticos */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', marginBottom: '2rem' }}>

        {/* Curva ABC */}
        <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.25rem' }}>Concentração da Carteira — Curva ABC</h2>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Projetos classificados pelo Valor Contratado. Clique em cada classe para expandir a lista.</p>
            </div>
            <InfoTooltip title="Curva ABC" content={<><p>Classifica a relevância dos projetos filtrados com base em seu Valor Contratado.</p><ul style={{ paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.5rem' }}><li><strong style={{ color: 'var(--success)' }}>Classe A:</strong> Projetos que somam os primeiros 80% do valor total da carteira.</li><li><strong style={{ color: 'var(--warning)' }}>Classe B:</strong> Projetos que somam entre 80% e 95% do valor total.</li><li><strong style={{ color: 'var(--danger)' }}>Classe C:</strong> Projetos que compõem os últimos 5% (cauda).</li></ul><p style={{ marginTop: '0.5rem' }}>A separação é feita ordenando todos os projetos do maior para o menor contrato e calculando o acumulado percentual.</p></>} />
          </div>
          <ABCClassDonut data={abcDonutData} />
        </div>

        {/* Maiores Entradas */}
        <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', flex: '1 1 400px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.25rem' }}>5 Maiores Entradas de Caixa</h2>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Projetos com maior volume recebido em 2026</p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <ReportAdder sectionKey="projetos:top-entradas" title="5 Maiores Entradas de Caixa" componentName="Gráfico Maiores Entradas" page="Projetos" type="TABLE" data={topEntradasData} filters={reportFilters} presetTags={["project-executive"]} />
              <InfoTooltip title="5 Maiores Entradas" content={<><p>Exibe os 5 projetos com maior total de movimentações de <strong>Entrada</strong> realizadas em 2026.</p><p style={{ marginTop: '0.5rem' }}>Não deduz saídas. Foco exclusivo no volume recebido.</p></>} />
            </div>
          </div>
          <RankingBarChart data={topEntradasData} dataKey="Valor" color="var(--success)" emptyMessage="Sem recebimentos realizados em 2026." />
        </div>

        {/* Maiores Saídas */}
        <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', flex: '1 1 400px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.25rem' }}>5 Maiores Saídas de Caixa</h2>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Projetos com maior volume pago em 2026</p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <ReportAdder sectionKey="projetos:top-saidas" title="5 Maiores Saídas de Caixa" componentName="Gráfico Maiores Saídas" page="Projetos" type="TABLE" data={topSaidasData} filters={reportFilters} presetTags={["project-executive"]} />
              <InfoTooltip title="5 Maiores Saídas" content={<><p>Exibe os 5 projetos com maior total de movimentações de <strong>Saída</strong> realizadas em 2026.</p><p style={{ marginTop: '0.5rem' }}>Não inclui previsões a pagar. Foco exclusivo no valor desembolsado.</p></>} />
            </div>
          </div>
          <RankingBarChart data={topSaidasData} dataKey="Valor" color="var(--danger)" emptyMessage="Sem pagamentos realizados em 2026." />
        </div>

        {/* Impostos sobre Faturamento */}
        <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', flex: '1 1 400px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.25rem' }}>Impostos sobre Faturamento</h2>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Total de Impostos: <strong style={{color:'var(--text-main)'}}>{formatCurrency(taxesData.total)}</strong> ({taxPercentage.toFixed(2).replace('.', ',')}% sobre o faturamento)
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <ReportAdder sectionKey="projetos:impostos-chart" title="Impostos sobre Faturamento" componentName="Gráfico Impostos" page="Projetos" type="TABLE" data={taxesData.list} filters={reportFilters} presetTags={["project-executive"]} />
              <InfoTooltip title="Impostos sobre Notas Fiscais" content={<><p>Mostra os tributos e retenções associados ao faturamento.</p></>} />
            </div>
          </div>
          <RankingBarChart data={taxesData.list} dataKey="Valor" color="var(--primary)" emptyMessage="Sem impostos registrados no período." onClickItem={(cat) => setTaxDrillDown && setTaxDrillDown(cat.name)} />
        </div>


        {/* Progresso de Contratos */}
        <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.25rem' }}>Progresso de Contratos</h2>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Maiores contratos com barra de preenchimento de faturamento</p>
            </div>
            <InfoTooltip title="Progresso de Contrato" content={<><p>A barra total representa o <strong>Valor Contratado</strong> do projeto.</p><p>A parte turquesa representa o quanto já foi <strong>Faturado</strong>.</p><p>A parte amarela representa o <strong>Saldo</strong> restante a faturar.</p><p style={{ marginTop: '0.5rem' }}>Use os botões de filtro para aumentar a quantidade exibida.</p></>} />
          </div>
          <StackedProgressChart data={allProjectsData} />
        </div>
      </div>

      {/* 7. Relatório Executivo com Paginação */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-main)' }}>Relatório Executivo de Projetos</h2>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <ReportAdder sectionKey="projetos:relatorio-executivo" title="Relatório Executivo de Projetos" componentName="Tabela de Projetos" page="Projetos" type="TABLE" data={projectReportRows} dataSets={{ summary: [{ Projetos: projectReportRows.length, "Total Contratado": totalContratado, "Total Faturado": totalFaturado, "Saldo Contratual": totalSaldo, "Resultado de Caixa": totalResultado }], visible: projectReportRows.slice((tablePage - 1) * TABLE_PAGE_SIZE, tablePage * TABLE_PAGE_SIZE), all: projectReportRows }} detailMode="visible" detailOptions={["summary", "visible", "all"]} filters={reportFilters} presetTags={["project-executive"]} explanation="Posição executiva dos contratos, faturamento e caixa dos projetos filtrados." />
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Mostrando {paginatedProjetos.length} de {sortedProjetos.length} projetos
          </span>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '1rem' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: '900px', borderCollapse: 'collapse' }}>
            <thead style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-color)' }}>
              <tr style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                <th style={{ padding: '1rem 1rem 0.5rem 1rem', textAlign: 'left', cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => handleSort('nome')}>Projeto / Obra <SortIcon columnKey="nome" /></th>
                <th style={{ padding: '1rem 1rem 0.5rem 1rem', textAlign: 'left', cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => handleSort('empresa')}>Empresa <SortIcon columnKey="empresa" /></th>
                <th style={{ padding: '1rem 1rem 0.5rem 1rem', textAlign: 'right', cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => handleSort('contratado')}>Contratado <SortIcon columnKey="contratado" /></th>
                <th style={{ padding: '1rem 1rem 0.5rem 1rem', textAlign: 'right', cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => handleSort('faturado')}>Faturado <SortIcon columnKey="faturado" /></th>
                <th style={{ padding: '1rem 1rem 0.5rem 1rem', textAlign: 'right', cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => handleSort('percentFaturado')}>% Fat. <SortIcon columnKey="percentFaturado" /></th>
                <th style={{ padding: '1rem 1rem 0.5rem 1rem', textAlign: 'right', cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => handleSort('saldoContratual')}>Saldo <SortIcon columnKey="saldoContratual" /></th>
                <th style={{ padding: '1rem 1rem 0.5rem 1rem', textAlign: 'right', cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => handleSort('recebido')}>Recebido <SortIcon columnKey="recebido" /></th>
                <th style={{ padding: '1rem 1rem 0.5rem 1rem', textAlign: 'right', cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => handleSort('pago')}>Pago <SortIcon columnKey="pago" /></th>
                <th style={{ padding: '1rem 1rem 0.5rem 1rem', textAlign: 'right', cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => handleSort('resultadoCaixa')}>Resultado <SortIcon columnKey="resultadoCaixa" /></th>
              </tr>
              <tr style={{ borderTop: 'none' }}>
                <th style={{ padding: '0 1rem 0.75rem 1rem' }}>
                  <input type="text" placeholder="Filtrar projeto..." value={colFilterProjeto} onChange={e => { setColFilterProjeto(e.target.value); setTablePage(1); }}
                    style={{ width: '100%', height: '24px', fontSize: '11px', padding: '0 0.25rem', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '4px' }} />
                </th>
                <th style={{ padding: '0 1rem 0.75rem 1rem' }}>
                  <input type="text" placeholder="Filtrar empresa..." value={colFilterEmpresa} onChange={e => { setColFilterEmpresa(e.target.value); setTablePage(1); }}
                    style={{ width: '100%', height: '24px', fontSize: '11px', padding: '0 0.25rem', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '4px' }} />
                </th>
                <th colSpan={2} style={{ padding: '0 1rem 0.75rem 1rem' }}></th>
                <th style={{ padding: '0 1rem 0.75rem 1rem' }}>
                  <input type="number" placeholder="Min %" value={colFilterMinFaturadoPerc} onChange={e => { setColFilterMinFaturadoPerc(e.target.value); setTablePage(1); }}
                    style={{ width: '100%', height: '24px', fontSize: '11px', padding: '0 0.25rem', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '4px', textAlign: 'center' }} />
                </th>
                <th colSpan={4} style={{ padding: '0 1rem 0.75rem 1rem' }}></th>
              </tr>
            </thead>
            <tbody style={{ fontSize: '13px' }}>
              {paginatedProjetos.map((p, idx) => (
                <tr key={idx} onClick={() => setSelectedProject(p)}
                  style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '0.85rem 1rem', fontWeight: '500', color: 'var(--primary)' }}>{p.nome}</td>
                  <td style={{ padding: '0.85rem 1rem', color: 'var(--text-main)' }}>{p.empresa}</td>
                  <td style={{ padding: '0.85rem 1rem', textAlign: 'right', color: 'var(--text-main)' }}>{formatCurrency(p.contratado)}</td>
                  <td style={{ padding: '0.85rem 1rem', textAlign: 'right', color: 'var(--text-main)' }}>{formatCurrency(p.faturado)}</td>
                  <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: '500', color: p.percentFaturado >= 1 ? 'var(--success)' : 'var(--text-main)' }}>{formatPercent(p.percentFaturado)}</td>
                  <td style={{ padding: '0.85rem 1rem', textAlign: 'right', color: 'var(--text-main)' }}>{formatCurrency(p.saldoContratual)}</td>
                  <td style={{ padding: '0.85rem 1rem', textAlign: 'right', color: 'var(--success)' }}>{formatCurrency(p.recebido)}</td>
                  <td style={{ padding: '0.85rem 1rem', textAlign: 'right', color: 'var(--danger)' }}>{formatCurrency(p.pago)}</td>
                  <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: '600', color: p.resultadoCaixa >= 0 ? 'var(--success)' : 'var(--danger)' }}>{formatCurrency(p.resultadoCaixa)}</td>
                </tr>
              ))}
              {paginatedProjetos.length === 0 && (
                <tr><td colSpan={9} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>Nenhum projeto encontrado com os filtros aplicados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paginação */}
      {totalTablePages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem' }}>
          <button onClick={() => setTablePage(1)} disabled={tablePage === 1} className="btn"
            style={{ padding: '6px 10px', fontSize: '12px', opacity: tablePage === 1 ? 0.4 : 1, background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}>«</button>
          <button onClick={() => setTablePage(p => Math.max(1, p - 1))} disabled={tablePage === 1} className="btn"
            style={{ padding: '6px 10px', fontSize: '12px', opacity: tablePage === 1 ? 0.4 : 1, background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)', display: 'flex', alignItems: 'center' }}>
            <ChevronLeft size={14} />
          </button>
          {Array.from({ length: totalTablePages }, (_, i) => i + 1).map(page => (
            <button key={page} onClick={() => setTablePage(page)} className="btn"
              style={{ padding: '6px 12px', fontSize: '12px', background: tablePage === page ? 'var(--primary)' : 'transparent', border: `1px solid ${tablePage === page ? 'var(--primary)' : 'var(--border-color)'}`, color: tablePage === page ? '#fff' : 'var(--text-main)', fontWeight: tablePage === page ? '600' : '400' }}>
              {page}
            </button>
          ))}
          <button onClick={() => setTablePage(p => Math.min(totalTablePages, p + 1))} disabled={tablePage === totalTablePages} className="btn"
            style={{ padding: '6px 10px', fontSize: '12px', opacity: tablePage === totalTablePages ? 0.4 : 1, background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)', display: 'flex', alignItems: 'center' }}>
            <ChevronRight size={14} />
          </button>
          <button onClick={() => setTablePage(totalTablePages)} disabled={tablePage === totalTablePages} className="btn"
            style={{ padding: '6px 10px', fontSize: '12px', opacity: tablePage === totalTablePages ? 0.4 : 1, background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}>»</button>
        </div>
      )}

      {/* 8. Drawer */}
      {selectedProject && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', justifyContent: 'flex-end', backdropFilter: 'blur(2px)' }}>
          <div style={{ width: '100%', maxWidth: '1000px', height: '100%', backgroundColor: 'var(--bg-main)', borderLeft: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', boxShadow: '-10px 0 30px rgba(0,0,0,0.5)', animation: 'slideIn 0.3s ease-out' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-elevated)' }}>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'block' }}>{selectedProject.empresa} • {selectedProject.tipo}</span>
                <h2 style={{ fontSize: '20px', fontWeight: '600', color: 'var(--primary)' }}>{selectedProject.nome}</h2>
              </div>
              <button onClick={() => setSelectedProject(null)} className="btn" style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '50%' }}>
                <X size={20} color="var(--text-secondary)" />
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                <div className="card" style={{ padding: '1.5rem', borderTop: '3px solid var(--purple)' }}>
                  <h3 style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '1rem' }}>Visão Contratual</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Contratado</span><strong style={{ color: 'var(--text-main)' }}>{formatCurrency(selectedProject.contratado)}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Faturado</span><strong style={{ color: 'var(--text-main)' }}>{formatCurrency(selectedProject.faturado)}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>% Faturado</span><strong style={{ color: 'var(--success)' }}>{formatPercent(selectedProject.percentFaturado)}</strong></div>
                    <div style={{ height: '1px', background: 'var(--border-color)', margin: '0.25rem 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px' }}><span style={{ color: 'var(--text-main)' }}>Saldo Contratual</span><strong style={{ color: 'var(--warning)' }}>{formatCurrency(selectedProject.saldoContratual)}</strong></div>
                  </div>
                </div>
                <div className="card" style={{ padding: '1.5rem', borderTop: '3px solid var(--primary)' }}>
                    <h3 style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '1rem' }}>Visão Financeira (Caixa)</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Recebido (Direto)</span><strong style={{ color: 'var(--success)' }}>{formatCurrency(selectedProject.recebido - (incluirRateioAdm ? (selectedProject.receitaAdm || 0) : 0))}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>A Receber (Direto)</span><strong style={{ color: 'var(--success)', opacity: 0.8 }}>{formatCurrency(selectedProject.aReceber)}</strong></div>
                      <div style={{ height: '1px', background: 'var(--border-color)', margin: '0.25rem 0' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          Rateio Administrativo
                          {selectedProject.receitaAdm > 0 && <InfoTooltip title="Rateio Administrativo Aplicado" content="Valores de receita mapeados do Centro de Custo ADMINISTRAÇÃO com Lançamento correspondente" />}
                        </span>
                        <strong style={{ color: 'var(--success)' }}>{formatCurrency(selectedProject.receitaAdm || 0)}</strong>
                      </div>
                      
                      {incluirRateioAdm && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(16,185,129,0.1)', padding: '0.5rem', borderRadius: '4px' }}>
                          <span style={{ color: 'var(--text-main)', fontSize: '12px' }}>Total Receita (Vinculada)</span>
                          <strong style={{ color: 'var(--success)' }}>{formatCurrency(selectedProject.receitaConsideradaTooltip || 0)}</strong>
                        </div>
                      )}
                      
                      <div style={{ height: '1px', background: 'var(--border-color)', margin: '0.25rem 0' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Pago</span><strong style={{ color: 'var(--danger)' }}>{formatCurrency(selectedProject.pago)}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>A Pagar</span><strong style={{ color: 'var(--danger)', opacity: 0.8 }}>{formatCurrency(selectedProject.aPagar)}</strong></div>
                      <div style={{ height: '1px', background: 'var(--border-color)', margin: '0.25rem 0' }} />
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px' }}>
                        <span style={{ color: 'var(--text-main)' }}>Resultado {incluirRateioAdm ? '(com rateio)' : ''}</span>
                        <strong style={{ color: selectedProject.resultadoCaixa >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                          {formatCurrency(selectedProject.resultadoCaixa)}
                        </strong>
                      </div>
                    </div>
                  </div>
              </div>

              {selectedProject.titulosAdmAssociados && selectedProject.titulosAdmAssociados.length > 0 && (
                  <div style={{ marginBottom: '2rem' }}>
                    <details style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem' }}>
                      <summary style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-main)', cursor: 'pointer', outline: 'none' }}>
                        Títulos Administrativos Associados ({selectedProject.titulosAdmAssociados.length})
                      </summary>
                      <div style={{ marginTop: '1rem', overflowX: 'auto' }}>
                        <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                              <th style={{ padding: '0.5rem' }}>Lançamento</th>
                              <th style={{ padding: '0.5rem' }}>Documento</th>
                              <th style={{ padding: '0.5rem' }}>Nome</th>
                              <th style={{ padding: '0.5rem' }}>Data</th>
                              <th style={{ padding: '0.5rem', textAlign: 'right' }}>Valor Admin</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedProject.titulosAdmAssociados.map((item, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                <td style={{ padding: '0.5rem' }}>{item.lancamento || '-'}</td>
                                <td style={{ padding: '0.5rem' }}>{item.documento}</td>
                                <td style={{ padding: '0.5rem' }}>{item.nome}</td>
                                <td style={{ padding: '0.5rem' }}>{item.data}</td>
                                <td style={{ padding: '0.5rem', textAlign: 'right', color: 'var(--success)' }}>{formatCurrency(item.valor)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  </div>
                )}
              <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '0.75rem', color: 'var(--text-main)' }}>Extrato de Movimentações</h3>
              <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                <DataTable data={selectedProjectMoves} />
              </div>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .spinner { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .fade-in { animation: fadeIn 0.3s ease-in-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        input[type="date"], input[type="text"], input[type="number"], select { color-scheme: dark; }
        input:focus, select:focus { outline: 1px solid var(--primary); }
      `}} />
    </div>
  );
}
