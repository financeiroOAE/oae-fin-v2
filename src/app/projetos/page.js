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
import ProjectMonthlyFinancialLineChart from "@/components/charts/ProjectMonthlyFinancialLineChart";
import MultiSelect from "@/components/MultiSelect";
import InfoTooltip from "@/components/InfoTooltip";
import { consolidateFinancialData } from "@/lib/consolidation";
import { useReport } from "@/contexts/ReportContext";
import ReportAdder from "@/components/report/ReportAdder";
import { isRevenueTax, getRevenueTaxLabel, classifyFinancialEntry, isTeamExpense } from "@/lib/financialClassification";
import { getProjectKey, isProjectOngoing, getActiveProjectNames, isGeneralProjectsBucket } from "@/lib/projectRules";

const TABLE_PAGE_SIZE = 15;

const getYearToDateRange = () => {
  const today = new Date();
  const localDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return { start: '2026-01-01', end: localDate(today) };
};

export default function Projetos() {
  const { isReportMode, openReportBuilder, exitReportMode } = useReport();
  const [isSyncing, setIsSyncing] = useState(false);
  const [data, setData] = useState([]);
  const [projetosBrutos, setProjetosBrutos] = useState([]);
  const [error, setError] = useState(null);
  const [lastSync, setLastSync] = useState(null);

  // Filtros Globais (multi-select arrays — array vazio = Todos)
  const [filterDataInicial, setFilterDataInicial] = useState(() => getYearToDateRange().start);
  const [filterDataFinal, setFilterDataFinal] = useState(() => getYearToDateRange().end);
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
  const [incluirRateioAdm, setIncluirRateioAdm] = useState(true);

  const fetchDados = async (force = false) => {
    setIsSyncing(true);
    setError(null);
    try {
      const response = await fetch(force ? '/api/sync?force=1' : '/api/sync', { method: 'GET', cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || result.details?.message || 'Erro desconhecido');
      setData(result.data || []);
      setProjetosBrutos(result.projetos || []);
      const syncDate = result.syncedAt || result.snapshotAt;
      setLastSync(syncDate ? new Date(syncDate).toLocaleString('pt-BR') : null);
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
  // O mesmo período selecionado passa a reger realizado e previsto.
  const realizadoIni = dIni;
  const realizadoFim = dFim;

  const projectCashData = useMemo(() => consolidateFinancialData(data, {
    isProjetosPage: true,
    incluirRateioAdm: true
  }), [data]);

  const baseData = useMemo(() => consolidateFinancialData(data, {
    isProjetosPage: true,
    incluirRateioAdm
  }), [data, incluirRateioAdm]);

  const projetosCruzados = useMemo(() => {
    const mapaProjetos = {};

    projetosBrutos.forEach((p) => {
      const nomeObra = String(p.OBRA || '').trim();
      if (!nomeObra || nomeObra.toUpperCase().includes('ADMINISTRATIVO') || !isProjectOngoing(p)) return;
      const projectKey = getProjectKey(p.ID || nomeObra);
      if (!projectKey) return;

      if (!mapaProjetos[projectKey]) {
        mapaProjetos[projectKey] = {
          projectKey,
          nome: nomeObra.replace(/[.\s]+$/g, ''),
          empresas: [],
          tipos: [],
          contratado: 0,
          faturado: 0,
          saldoContratual: 0,
          recebido: 0,
          aReceber: 0,
          pago: 0,
          aPagar: 0,
          receitaDireta: 0,
          receitaAdm: 0,
          titulosAdmAssociados: []
        };
      }

      const projeto = mapaProjetos[projectKey];
      const empresa = String(p.EMPRESA || 'N/A').trim();
      const tipo = String(p.TIPO || 'N/A').trim();
      if (empresa && !projeto.empresas.includes(empresa)) projeto.empresas.push(empresa);
      if (tipo && !projeto.tipos.includes(tipo)) projeto.tipos.push(tipo);
      projeto.contratado += Number(p.CONTRATO) || 0;
      projeto.faturado += Number(p['NF FATURADAS']) || 0;
      projeto.saldoContratual += Number(p['SALDO CONTRATUAL']) || 0;
    });

    projectCashData.forEach((item) => {
      const projectKey = getProjectKey(item.projeto);
      const projeto = mapaProjetos[projectKey];
      if (!projeto) return;

      let ts = 0;
      if (item.data) {
        const parts = String(item.data).split('/');
        if (parts.length === 3) ts = new Date(parts[2], parts[1] - 1, parts[0]).getTime();
      }

      const status = String(item.status || '').toUpperCase();
      const isRealizado = status.includes('REALIZADO') || status.includes('RECEBIDO') || status.includes('PAGO') || status.includes('EFETIVADO');
      const isPrevisto = !isRealizado && (status.includes('A REALIZAR') || status.includes('A RECEBER') || status.includes('A PAGAR') || status.includes('PREVISTO'));
      if (!isRealizado && !isPrevisto) return;

      // Realizados seguem o período; títulos em aberto são posição atual e não
      // desaparecem só porque vencem depois da Data Final.
      if (isRealizado && (ts < realizadoIni || ts > realizadoFim)) return;

      if (item.natureza === 'Entrada') {
        if (isRealizado) {
          projeto.recebido += Number(item.valor) || 0;
          projeto.receitaDireta += Number(item.valorDireto) || 0;
          projeto.receitaAdm += Number(item.valorAdministrativo) || 0;
        } else {
          projeto.aReceber += Number(item.valor) || 0;
        }
      } else if (item.natureza === 'Saída') {
        if (isRealizado) projeto.pago += Math.abs(Number(item.valor) || 0);
        else projeto.aPagar += Math.abs(Number(item.valor) || 0);
      }
    });

    return Object.values(mapaProjetos).map((p) => ({
      ...p,
      empresa: p.empresas.join(' / ') || 'N/A',
      tipo: p.tipos.join(' / ') || 'N/A',
      percentFaturado: p.contratado > 0 ? p.faturado / p.contratado : 0,
      resultadoCaixa: p.recebido - p.pago,
      receitaConsideradaTooltip: p.receitaDireta + p.receitaAdm
    }));
  }, [projetosBrutos, projectCashData, realizadoIni, realizadoFim]);

  const filteredProjetos = useMemo(() => {
    return projetosCruzados.filter(p => {
      if (filterProjetos.length > 0 && !filterProjetos.includes(p.nome)) return false;
      if (filterEmpresas.length > 0 && !p.empresas.some((empresa) => filterEmpresas.includes(empresa))) return false;
      if (filterTipos.length > 0 && !p.tipos.some((tipo) => filterTipos.includes(tipo))) return false;
      if (colFilterProjeto && !p.nome.toLowerCase().includes(colFilterProjeto.toLowerCase())) return false;
      if (colFilterEmpresa && !p.empresa.toLowerCase().includes(colFilterEmpresa.toLowerCase())) return false;
      if (colFilterMinFaturadoPerc && (p.percentFaturado * 100) < Number(colFilterMinFaturadoPerc)) return false;
      return true;
    });
  }, [projetosCruzados, filterProjetos, filterEmpresas, filterTipos, colFilterProjeto, colFilterEmpresa, colFilterMinFaturadoPerc]);

  const listaProjetos = Array.from(new Set([...projetosCruzados.map(p => p.nome), 'ADMINISTRAÇÃO'])).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const listaEmpresas = Array.from(new Set(projetosCruzados.flatMap(p => p.empresas))).sort();
  const listaTipos = Array.from(new Set(projetosCruzados.flatMap(p => p.tipos))).sort();

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
  const [showUnclassified, setShowUnclassified] = useState(false);

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

  const rawProjectRevenueStats = useMemo(() => {
    let recebidoDireto = 0;
    let recebidoAdm = 0;
    let aReceberDireto = 0;
    let aReceberAdm = 0;

    data.forEach((item) => {
      if (item.natureza !== 'Entrada') return;
      const classification = classifyFinancialEntry(item);
      if (classification.type !== 'receita_projeto' && classification.type !== 'receita_administrativa') return;

      const status = String(item.status || '').toUpperCase();
      const isRealizado = status.includes('REALIZADO') || status.includes('RECEBIDO') || status.includes('EFETIVADO');
      const isPrevisto = !isRealizado && (status.includes('A REALIZAR') || status.includes('A RECEBER') || status.includes('PREVISTO'));
      const value = Number(item.valor) || 0;

      let ts = 0;
      if (item.dataTimestamp) ts = Number(item.dataTimestamp) || 0;
      if (!ts && item.data) {
        const parts = String(item.data).split('/');
        if (parts.length === 3) ts = new Date(parts[2], Number(parts[1]) - 1, parts[0]).getTime();
      }

      if (isRealizado && ts >= realizadoIni && ts <= realizadoFim) {
        if (classification.type === 'receita_projeto') recebidoDireto += value;
        if (classification.type === 'receita_administrativa') recebidoAdm += value;
      }
      if (isPrevisto) {
        if (classification.type === 'receita_projeto') aReceberDireto += value;
        if (classification.type === 'receita_administrativa') aReceberAdm += value;
      }
    });

    return {
      recebidoDireto,
      recebidoAdm,
      recebido: recebidoDireto + (incluirRateioAdm ? recebidoAdm : 0),
      aReceberDireto,
      aReceberAdm,
      aReceber: aReceberDireto + (incluirRateioAdm ? aReceberAdm : 0),
    };
  }, [data, realizadoIni, realizadoFim, incluirRateioAdm]);

  const usarCarteiraCompleta = filterProjetos.length === 0 && filterEmpresas.length === 0 && filterTipos.length === 0;
  const totalRecebido = usarCarteiraCompleta
    ? rawProjectRevenueStats.recebido
    : filteredProjetos.reduce((acc, p) => acc + p.recebido, 0);
  const totalAReceber = usarCarteiraCompleta
    ? rawProjectRevenueStats.aReceber
    : filteredProjetos.reduce((acc, p) => acc + p.aReceber, 0);
  const totalPago = filteredProjetos.reduce((acc, p) => acc + p.pago, 0);

  const previsaoProjetosGeral = useMemo(() => data
    .filter((item) => {
      const status = String(item.status || '').toUpperCase();
      return item.natureza === 'Saída'
        && (status.includes('A REALIZAR') || status.includes('A PAGAR') || status.includes('PREVISTO'))
        && isGeneralProjectsBucket(item.projeto);
    })
    .reduce((sum, item) => sum + Math.abs(Number(item.valor) || 0), 0), [data]);

  const incluirPrevisaoGeral = usarCarteiraCompleta;
  const totalAPagar = filteredProjetos.reduce((acc, p) => acc + p.aPagar, 0) + (incluirPrevisaoGeral ? previsaoProjetosGeral : 0);
  const totalResultado = totalRecebido - totalPago;
  
  const totalRecebidoAdmGlobal = usarCarteiraCompleta ? rawProjectRevenueStats.recebidoAdm : filteredProjetos.reduce((acc, p) => acc + (p.receitaAdm || 0), 0);

  function isCDP(planoFinanceiro) {
    const raw = String(planoFinanceiro || '');
    const dashIdx = raw.indexOf(' - ');
    const descricao = dashIdx >= 0 ? raw.slice(dashIdx + 3) : raw;
    return descricao.trim().toUpperCase().startsWith('C.D.P');
  }

  const dreStats = useMemo(() => {
    const allowedProjects = new Set(filteredProjetos.map((p) => p.projectKey));
    const receitaConsolidada = consolidateFinancialData(data, { isProjetosPage: true, incluirRateioAdm });

    let recReceita = 0;
    let recAReceber = 0;
    receitaConsolidada.forEach((item) => {
      if (item.natureza !== 'Entrada' || !allowedProjects.has(getProjectKey(item.projeto))) return;
      const status = String(item.status || '').toUpperCase();
      const isRealizado = status.includes('REALIZADO') || status.includes('RECEBIDO') || status.includes('EFETIVADO');
      const isPrevisto = !isRealizado && (status.includes('A REALIZAR') || status.includes('A RECEBER') || status.includes('PREVISTO'));

      let ts = 0;
      if (item.data) {
        const parts = String(item.data).split('/');
        if (parts.length === 3) ts = new Date(parts[2], parts[1] - 1, parts[0]).getTime();
      }
      if (isRealizado && ts >= realizadoIni && ts <= realizadoFim) recReceita += Number(item.valor) || 0;
      if (isPrevisto) recAReceber += Number(item.valor) || 0;
    });

    let cPago = 0;
    let cAPagar = 0;
    let dPago = 0;
    let dAPagar = 0;
    let tributos = 0;
    let tributosAPagar = 0;
    let nc = 0;
    const naoClassificados = [];

    data.forEach((item) => {
      if (item.natureza !== 'Saída' || !allowedProjects.has(getProjectKey(item.projeto))) return;
      const projetoNome = String(item.projeto || '').toUpperCase();
      if (projetoNome.includes('ADMINISTRA')) return;

      let ts = 0;
      if (item.data) {
        const parts = String(item.data).split('/');
        if (parts.length === 3) ts = new Date(parts[2], parts[1] - 1, parts[0]).getTime();
      }

      const status = String(item.status || '').toUpperCase();
      const isRealizado = status.includes('REALIZADO') || status.includes('PAGO') || status.includes('EFETIVADO');
      const isPrevisto = !isRealizado && (status.includes('A REALIZAR') || status.includes('A PAGAR') || status.includes('PREVISTO'));
      if (!isRealizado && !isPrevisto) return;
      if (isRealizado && (ts < realizadoIni || ts > realizadoFim)) return;

      const valor = Math.abs(Number(item.valor) || 0);
      const dreInfo = [item.dreClasse, item.dreLinha, item.dreDescricao].filter(Boolean).join(' ').toUpperCase();
      const isPendingDre = !dreInfo.trim() || dreInfo.includes('PENDENTE DE CLASSIFICAÇÃO');

      if (isRevenueTax(item)) {
        if (isRealizado) tributos += valor;
        else tributosAPagar += valor;
      } else if (isPendingDre) {
        if (isRealizado) {
          nc += valor;
          naoClassificados.push(item);
        }
      } else if (dreInfo.includes('CUSTO')) {
        if (isRealizado) cPago += valor;
        else cAPagar += valor;
      } else {
        if (isRealizado) dPago += valor;
        else dAPagar += valor;
      }
    });

    if (usarCarteiraCompleta) {
      recReceita = rawProjectRevenueStats.recebido;
      recAReceber = rawProjectRevenueStats.aReceber;
    }

    return {
      receita: recReceita,
      receitaAReceber: recAReceber,
      custo: cPago,
      custoAPagar: cAPagar,
      despesa: dPago,
      despesaAPagar: dAPagar,
      tributos,
      tributosAPagar,
      naoClassificado: nc,
      naoClassificados
    };
  }, [data, filteredProjetos, realizadoIni, realizadoFim, incluirRateioAdm, usarCarteiraCompleta, rawProjectRevenueStats]);

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

      if (!isRevenueTax(item)) return;
      const taxCategory = getRevenueTaxLabel(item);
      const val = Math.abs(item.valor || 0);
      taxesMap[taxCategory] = (taxesMap[taxCategory] || 0) + val;
      totalTaxes += val;
    });

    const arr = Object.entries(taxesMap).map(([name, Valor]) => ({ name, Valor })).sort((a, b) => b.Valor - a.Valor);
    return { list: arr, total: totalTaxes };
  }, [data, filteredProjetos, realizadoIni, realizadoFim]);

  const margemFinanceira = dreStats.receita > 0 ? ((dreStats.receita - dreStats.custo - dreStats.despesa - dreStats.tributos) / dreStats.receita) * 100 : null;
  const resultadoGerencial = dreStats.receita - dreStats.custo - dreStats.despesa - dreStats.tributos;
  const taxPercentage = dreStats.receita > 0 ? (taxesData.total / dreStats.receita) * 100 : 0;

  const abcDonutData = useMemo(() => {
    const projects = [...filteredProjetos].filter(p => p.contratado > 0).sort((a, b) => b.contratado - a.contratado);
    const classes = [
      { name: 'Classe A', color: 'var(--success)', rule: 'Contratos acima de R$ 500 mil', test: (v) => v > 500000 },
      { name: 'Classe B', color: 'var(--warning)', rule: 'Contratos de R$ 100 mil a R$ 500 mil', test: (v) => v >= 100000 && v <= 500000 },
      { name: 'Classe C', color: 'var(--danger)', rule: 'Contratos abaixo de R$ 100 mil', test: (v) => v < 100000 },
    ];
    return classes.map(def => {
      const classProjects = projects.filter(p => def.test(p.contratado));
      return { ...def, value: classProjects.reduce((sum, p) => sum + p.contratado, 0), count: classProjects.length, projects: classProjects };
    }).filter(item => item.count > 0);
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

  const teamCostsChartData = useMemo(() => {
    const allowedProjects = new Set(filteredProjetos.map(p => p.projectKey));
    const map = {};

    data.forEach(item => {
      if (item.natureza !== 'Saída' || !isTeamExpense(item)) return;
      if (!allowedProjects.has(getProjectKey(item.projeto))) return;

      let ts = 0;
      if (item.data) {
        const parts = String(item.data).split('/');
        if (parts.length === 3) ts = new Date(parts[2], parts[1] - 1, parts[0]).getTime();
      }
      if (ts < dIni || ts > dFim) return;

      const status = String(item.status || '').toUpperCase();
      const validStatus = status.includes('REALIZADO') || status.includes('PAGO') || status.includes('EFETIVADO') || status.includes('A REALIZAR') || status.includes('A PAGAR') || status.includes('PREVISTO');
      if (!validStatus) return;

      const account = item.contaNome || item.contaDescricao || item.contaCodigo || 'Equipe não identificada';
      map[account] = (map[account] || 0) + Math.abs(Number(item.valor) || 0);
    });

    return Object.entries(map)
      .map(([nome, Valor]) => ({ nome, Valor }))
      .sort((a, b) => b.Valor - a.Valor);
  }, [data, filteredProjetos, dIni, dFim]);

  const monthlyFinancialData = useMemo(() => {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const rows = months.map((mes, index) => ({ mes, month: index, Receitas: 0, Custos: 0, Despesas: 0 }));
    const allowedProjects = new Set(filteredProjetos.map((project) => project.projectKey));

    projectCashData.forEach((item) => {
      if (item.natureza !== 'Entrada' || !allowedProjects.has(getProjectKey(item.projeto))) return;
      const status = String(item.status || '').toUpperCase();
      if (!(status.includes('REALIZADO') || status.includes('RECEBIDO') || status.includes('EFETIVADO'))) return;
      const parts = String(item.data || '').split('/');
      if (parts.length !== 3 || parts[2] !== '2026') return;
      const month = Number(parts[1]) - 1;
      if (month < 0 || month > 11) return;
      const originalRows = item.linhasOriginais?.length ? item.linhasOriginais : [item];
      const revenue = originalRows.reduce((sum, row) => {
        const classification = classifyFinancialEntry(row);
        return (classification.type === 'receita_projeto' || classification.type === 'receita_administrativa') ? sum + (Number(row.valor) || 0) : sum;
      }, 0);
      rows[month].Receitas += revenue;
    });

    data.forEach((item) => {
      if (item.natureza !== 'Saída' || !allowedProjects.has(getProjectKey(item.projeto))) return;
      if (String(item.projeto || '').toUpperCase().includes('ADMINISTRA')) return;
      const status = String(item.status || '').toUpperCase();
      if (!(status.includes('REALIZADO') || status.includes('PAGO') || status.includes('EFETIVADO'))) return;
      const parts = String(item.data || '').split('/');
      if (parts.length !== 3 || parts[2] !== '2026') return;
      const month = Number(parts[1]) - 1;
      if (month < 0 || month > 11) return;
      if (isRevenueTax(item)) return;

      const dreText = [item.dreClasse, item.dreLinha, item.dreDescricao].filter(Boolean).join(' ').toUpperCase();
      if (!dreText || dreText.includes('PENDENTE DE CLASSIFICAÇÃO')) return;
      const value = Math.abs(Number(item.valor) || 0);
      if (dreText.includes('CUSTO')) rows[month].Custos += value;
      else rows[month].Despesas += value;
    });

    return rows;
  }, [data, filteredProjetos, projectCashData]);

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

  const selectedProjectTeamCosts = useMemo(() => {
    if (!selectedProject) return [];
    const map = {};
    selectedProjectMoves.forEach(item => {
      if (item.natureza !== 'Saída') return;
      if (!isTeamExpense(item)) return;
      const account = item.contaNome || item.contaDescricao || item.contaCodigo || 'Equipe não identificada';
      if (!map[account]) map[account] = { Conta: account, Pago: 0, 'A Pagar': 0, Total: 0 };
      const value = Math.abs(Number(item.valor) || 0);
      const status = String(item.status || '').toUpperCase();
      if (status.includes('REALIZADO') || status.includes('PAGO') || status.includes('EFETIVADO')) map[account].Pago += value;
      else if (status.includes('A REALIZAR') || status.includes('A PAGAR') || status.includes('PREVISTO')) map[account]['A Pagar'] += value;
      map[account].Total += value;
    });
    return Object.values(map).sort((a, b) => b.Total - a.Total);
  }, [selectedProject, selectedProjectMoves]);

  const clearAllFilters = () => {
    setFilterProjetos([]); setFilterEmpresas([]); setFilterTipos([]);
    const range = getYearToDateRange();
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
            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.35rem', display: 'block' }}>Data Inicial</label>
            <input type="date" value={filterDataInicial} onChange={(e) => setFilterDataInicial(e.target.value)}
              style={{ width: '100%', height: '34px', fontSize: '13px', color: 'var(--text-main)', background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0 0.5rem' }} />
          </div>

          <div style={{ flex: '1 1 140px', minWidth: 0 }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.35rem', display: 'block' }}>Data Final</label>
            <input type="date" value={filterDataFinal} onChange={(e) => setFilterDataFinal(e.target.value)}
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
          <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}><ArrowDownCircle size={14} color="var(--success)" /> Recebido no período</p>
          <p style={{ fontSize: '17px', fontWeight: '600', color: 'var(--text-main)' }}>{formatCurrency(totalRecebido)}</p>
        </div>
        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid rgba(16,185,129,0.4)' }}>
          <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}><ArrowUpCircle size={14} color="var(--success)" /> A Receber</p>
          <p style={{ fontSize: '17px', fontWeight: '600', color: 'var(--text-main)' }}>{formatCurrency(totalAReceber)}</p>
        </div>
        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--danger)' }}>
          <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}><ArrowUp size={14} color="var(--danger)" /> Pago no período</p>
          <p style={{ fontSize: '17px', fontWeight: '600', color: 'var(--text-main)' }}>{formatCurrency(totalPago)}</p>
        </div>
        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid rgba(239,68,68,0.4)' }}>
          <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}><ArrowDown size={14} color="var(--danger)" /> A Pagar</p>
          <p style={{ fontSize: '17px', fontWeight: '600', color: 'var(--text-main)' }}>{formatCurrency(totalAPagar)}</p>
        </div>
        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--primary)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
            <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}><Percent size={14} color="var(--primary)" /> Tributos sobre Receita e Lucro</p>
            <ReportAdder sectionKey="projetos:impostos" title="Tributos sobre Receita e Lucro" componentName="Resumo de Impostos" page="Projetos" type="SUMMARY" data={[{ "Total de Impostos": taxesData.total, "% sobre o Faturamento": taxPercentage }]} filters={reportFilters} />
          </div>
          <p style={{ fontSize: '17px', fontWeight: '600', color: 'var(--text-main)' }}>{formatCurrency(taxesData.total)}</p>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '0.2rem' }}><strong style={{ color: 'var(--primary)' }}>{taxPercentage.toFixed(2).replace('.', ',')}%</strong> da receita de projetos</p>
        </div>
      </div>

      {/* 5. Composição Financeira + Resultado */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: '1rem', marginBottom: '2rem', alignItems: 'start' }}>
        <div className="card" style={{ padding: '1.5rem', borderTop: '2px solid var(--primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <PieChart size={16} color="var(--primary)" /> Composição Financeira
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Classificação dos valores realizados em 2026</p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <ReportAdder sectionKey="projetos:composicao" title="Composição Financeira" componentName="Composição Financeira - Projetos" page="Projetos" type="SUMMARY" data={[{ "Receita de Projetos": dreStats.receita, "Custos Diretos": dreStats.custo, "Despesas": dreStats.despesa, "Tributos": dreStats.tributos, "Não Classificado": dreStats.naoClassificado }]} filters={reportFilters} presetTags={["project-executive"]} explanation="Composição gerencial da receita, custos e despesas dos projetos selecionados." />
              <InfoTooltip title="Composição Financeira (DRE)" content={<><p>Receita, Custo, Despesa e Tributos são classificados pelo DEPARA/DRE da conta financeira.</p><ul style={{ paddingLeft: '1rem', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}><li><strong>Receita:</strong> contas classificadas como Receita. Deduções abatem este valor.</li><li><strong>Custo:</strong> contas classificadas como Custos dos Serviços.</li><li><strong>Despesa:</strong> demais saídas com DEPARA válido vinculadas às obras.</li><li><strong>Tributos:</strong> PIS, COFINS, ISS, IRPJ, CSLL e previsões de impostos vinculadas aos projetos.</li></ul><p style={{ marginTop: '0.5rem' }}>Movimentações sem classificação ficam em "Não Classificado".</p></>} />
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
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Outras Despesas</p>
              <p style={{ fontSize: '19px', fontWeight: '700', color: 'var(--danger)' }}>{formatCurrency(dreStats.despesa)}</p>
              {dreStats.receita > 0 && <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{((dreStats.despesa / dreStats.receita) * 100).toFixed(1)}% da Receita</span>}
            </div>
            <div style={{ flex: 1, minWidth: '120px' }}>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Tributos</p>
              <p style={{ fontSize: '19px', fontWeight: '700', color: 'var(--primary)' }}>{formatCurrency(dreStats.tributos)}</p>
              {dreStats.receita > 0 && <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{((dreStats.tributos / dreStats.receita) * 100).toFixed(1)}% da Receita</span>}
            </div>
          </div>
          {dreStats.receita > 0 && (
            <div style={{ width: '100%', height: '12px', background: 'var(--bg-main)', borderRadius: '6px', display: 'flex', overflow: 'hidden' }}>
              <div style={{ width: `${Math.max(0, 100 - ((dreStats.custo + dreStats.despesa + dreStats.tributos) / dreStats.receita) * 100)}%`, background: 'var(--success)', transition: 'width 0.3s ease' }} />
              <div style={{ width: `${(dreStats.custo / dreStats.receita) * 100}%`, background: 'var(--warning)', transition: 'width 0.3s ease' }} />
              <div style={{ width: `${(dreStats.despesa / dreStats.receita) * 100}%`, background: 'var(--danger)', transition: 'width 0.3s ease' }} />
              <div style={{ width: `${(dreStats.tributos / dreStats.receita) * 100}%`, background: 'var(--primary)', transition: 'width 0.3s ease' }} />
            </div>
          )}
          {dreStats.naoClassificado > 0 && (
            <div style={{ marginTop: '1rem', fontSize: '11px', color: 'var(--warning)', padding: '0.5rem', background: 'rgba(245,158,11,0.1)', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Aviso: <strong>{formatCurrency(dreStats.naoClassificado)}</strong> ainda sem classificação DRE válida.</span>
              <button type="button" onClick={() => setShowUnclassified(true)} className="btn" style={{ fontSize: '11px', padding: '0.3rem 0.65rem', background: 'transparent', color: 'var(--warning)', border: '1px solid rgba(245,158,11,0.35)' }}>Ver lançamentos</button>
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
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Receita - Custos - Despesas - Tributos</p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <ReportAdder sectionKey="projetos:resultado" title="Resultado Gerencial" componentName="Cards Resultado Gerencial" page="Projetos" type="SUMMARY" data={[{ "Resultado Gerencial": resultadoGerencial, "Margem de Resultado (%)": margemFinanceira }]} filters={reportFilters} presetTags={["project-executive"]} explanation="Resultado após custos, despesas e tributos dos projetos, com a margem correspondente." />
              <InfoTooltip title="Resultado e Margem" content={<><p><strong>Fórmula do Resultado:</strong><br />Receita de Projetos - Custos Diretos - Despesas - Tributos.</p><p style={{ marginTop: '0.5rem' }}><strong>Fórmula da Margem:</strong><br />(Resultado / Receita Líquida) × 100</p></>} />
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


      <div id="report-projetos-evolucao-anual" data-report-section className="card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.25rem' }}>Evolução Financeira dos Projetos — 2026</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Receitas, custos e despesas realizados por mês. Os filtros de projeto, empresa e tipo continuam válidos.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ReportAdder sectionKey="projetos:evolucao-anual" title="Evolução Financeira dos Projetos — 2026" componentName="Gráfico de Evolução Financeira" page="Projetos" type="CHART" data={monthlyFinancialData} filters={reportFilters} captureId="report-projetos-evolucao-anual" presetTags={["project-executive"]} />
            <InfoTooltip title="Evolução Financeira 2026" content="Linha mensal dos valores realizados: receitas de projetos, custos dos serviços e demais despesas vinculadas às obras. Tributos são exibidos separadamente na composição financeira e não são somados como despesas nesta linha." />
          </div>
        </div>
        <ProjectMonthlyFinancialLineChart data={monthlyFinancialData} />
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
            <InfoTooltip title="Curva ABC" content={<><p>Classifica os projetos pelo <strong>valor individual do contrato</strong>.</p><ul style={{ paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.5rem' }}><li><strong style={{ color: 'var(--success)' }}>Classe A:</strong> acima de R$ 500 mil.</li><li><strong style={{ color: 'var(--warning)' }}>Classe B:</strong> de R$ 100 mil a R$ 500 mil.</li><li><strong style={{ color: 'var(--danger)' }}>Classe C:</strong> abaixo de R$ 100 mil.</li></ul></>} />
          </div>
          <ABCClassDonut data={abcDonutData} />
        </div>

        {/* Maiores Entradas */}
        <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', flex: '1 1 400px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.25rem' }}>5 Maiores Fontes de Receita — Projetos</h2>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Projetos com maior receita recebida no período selecionado</p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <ReportAdder sectionKey="projetos:top-entradas" title="5 Maiores Fontes de Receita — Projetos" componentName="Gráfico Maiores Entradas" page="Projetos" type="TABLE" data={topEntradasData} filters={reportFilters} presetTags={["project-executive"]} />
              <InfoTooltip title="5 Maiores Fontes de Receita — Projetos" content={<><p>Exibe os 5 projetos/obras com maior receita recebida no período. Administração não entra neste ranking.</p><p style={{ marginTop: '0.5rem' }}>Não deduz saídas. Foco exclusivo no volume recebido.</p></>} />
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

        {/* Tributos sobre Receita e Lucro */}
        <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', flex: '1 1 400px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.25rem' }}>Tributos sobre Receita e Lucro</h2>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Total de Impostos: <strong style={{color:'var(--text-main)'}}>{formatCurrency(taxesData.total)}</strong> ({taxPercentage.toFixed(2).replace('.', ',')}% sobre o faturamento)
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <ReportAdder sectionKey="projetos:impostos-chart" title="Tributos sobre Receita e Lucro" componentName="Gráfico Impostos" page="Projetos" type="TABLE" data={taxesData.list} filters={reportFilters} presetTags={["project-executive"]} />
              <InfoTooltip title="Tributos sobre Receita e Lucro" content={<><p>Usa as saídas classificadas como deduções/impostos sobre faturamento e vinculadas aos projetos filtrados.</p><p style={{ marginTop: '0.5rem' }}><strong>Não inclui retenções de fornecedor.</strong></p></>} />
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


      <div className="card" data-report-section style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.25rem' }}>Custo de Equipe por Projeto</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Contas EQUIP. TÉC. somadas nos projetos exibidos. Ao filtrar uma obra, os valores passam a representar somente aquela obra.</p>
          </div>
          <ReportAdder sectionKey="projetos:custo-equipe" title="Custo de Equipe por Projeto" componentName="Gráfico de Custo de Equipe" page="Projetos" type="TABLE" data={teamCostsChartData} filters={reportFilters} presetTags={["project-executive"]} />
        </div>
        <div style={{ minHeight: '280px' }}>
          <RankingBarChart data={teamCostsChartData} dataKey="Valor" color="var(--warning)" emptyMessage="Sem contas de equipe identificadas para os projetos filtrados." />
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


      {showUnclassified && (
        <div onClick={() => setShowUnclassified(false)} style={{ position: 'fixed', inset: 0, zIndex: 10020, background: 'rgba(0,0,0,0.62)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem' }}>
          <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: 'min(1000px, 96vw)', maxHeight: '82vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div><h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)' }}>Movimentações Não Classificadas</h3><p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{dreStats.naoClassificados?.length || 0} lançamento(s)</p></div>
              <button type="button" onClick={() => setShowUnclassified(false)} className="btn" style={{ background: 'transparent', border: 0 }}><X size={18} /></button>
            </div>
            <div style={{ overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-elevated)' }}><tr><th style={{padding:'0.65rem'}}>Data</th><th style={{padding:'0.65rem'}}>Projeto</th><th style={{padding:'0.65rem'}}>Nome</th><th style={{padding:'0.65rem'}}>Conta</th><th style={{padding:'0.65rem'}}>Status</th><th style={{padding:'0.65rem',textAlign:'right'}}>Valor</th></tr></thead>
                <tbody>{(dreStats.naoClassificados || []).map((item, idx) => <tr key={idx} style={{ borderTop:'1px solid var(--border-color)' }}><td style={{padding:'0.65rem'}}>{item.data}</td><td style={{padding:'0.65rem'}}>{item.projeto}</td><td style={{padding:'0.65rem'}}>{item.nome}</td><td style={{padding:'0.65rem'}}>{item.contaNome || item.contaDescricao || item.contaCodigo}</td><td style={{padding:'0.65rem'}}>{item.status}</td><td style={{padding:'0.65rem',textAlign:'right'}}>{formatCurrency(Math.abs(item.valor || 0))}</td></tr>)}</tbody>
              </table>
            </div>
          </div>
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
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button onClick={() => setSelectedProject(null)} className="btn" style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '50%' }}>
                  <X size={20} color="var(--text-secondary)" />
                </button>
              </div>
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
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '0.35rem', color: 'var(--text-main)' }}>Custo de Equipe do Projeto</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Custos classificados em contas de equipe, separados por conta dentro do centro de custo/obra selecionado.</p>
                <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead style={{ background: 'var(--bg-elevated)' }}>
                      <tr><th style={{ padding: '0.65rem', textAlign: 'left' }}>Conta de Equipe</th><th style={{ padding: '0.65rem', textAlign: 'right' }}>Pago</th><th style={{ padding: '0.65rem', textAlign: 'right' }}>A Pagar</th><th style={{ padding: '0.65rem', textAlign: 'right' }}>Total</th></tr>
                    </thead>
                    <tbody>
                      {selectedProjectTeamCosts.length ? selectedProjectTeamCosts.map((row) => (
                        <tr key={row.Conta} style={{ borderTop: '1px solid var(--border-color)' }}><td style={{ padding: '0.65rem' }}>{row.Conta}</td><td style={{ padding: '0.65rem', textAlign: 'right' }}>{formatCurrency(row.Pago)}</td><td style={{ padding: '0.65rem', textAlign: 'right' }}>{formatCurrency(row['A Pagar'])}</td><td style={{ padding: '0.65rem', textAlign: 'right', fontWeight: '700' }}>{formatCurrency(row.Total)}</td></tr>
                      )) : <tr><td colSpan={4} style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Sem custos de equipe identificados para este projeto.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>

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
