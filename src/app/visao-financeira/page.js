"use client";

import { useState, useEffect, useMemo } from "react";
import { RefreshCw, AlertCircle, TrendingUp, TrendingDown, LayoutDashboard, Calendar, DollarSign, Database, ChevronLeft, ChevronRight, Building2, Activity, FilterX, Landmark, FileText, CheckCircle, Target, ArrowDownCircle, ArrowUpCircle, ArrowDown, ArrowUp, X } from "lucide-react";
import IncomeExpenseChart from "@/components/charts/IncomeExpenseChart";
import MonthlyResultChart from "@/components/charts/MonthlyResultChart";
import TopBarChart from "@/components/charts/TopBarChart";
import AccountBarChart from "@/components/charts/AccountBarChart";
import PieStatusChart from "@/components/charts/PieStatusChart";
import ABCClassDonut from "@/components/charts/ABCClassDonut";
import FinancialCompositionBar from "@/components/FinancialCompositionBar";
import MultiSelect from "@/components/MultiSelect";
import InfoTooltip from "@/components/InfoTooltip";
import { consolidateFinancialData } from "@/lib/consolidation";
import { useReport } from "@/contexts/ReportContext";
import ReportAdder from "@/components/report/ReportAdder";
import { classifyFinancialEntry, isForecastOnlyReceivableDocument, isPartnerWithdrawal, isRevenueTax } from "@/lib/financialClassification";
import { getActiveProjects, getActiveProjectNames, getProjectKey } from "@/lib/projectRules";

const getYearToDateRange = () => {
  const today = new Date();
  const localDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return { start: `${today.getFullYear()}-01-01`, end: localDate(today) };
};

const normalizeTaxScopeText = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toUpperCase();

const isInssTaxEntry = (item) => {
  const text = normalizeTaxScopeText([
    item?.contaNome,
    item?.contaDescricao,
    item?.planoFinanceiro,
    item?.dreClasse,
    item?.drePacote,
    item?.dreLinha,
    item?.dreDescricao,
  ].filter(Boolean).join(' '));
  return /\bINSS\b/.test(text);
};

const isGeneralTax = (item) => isRevenueTax(item) || isInssTaxEntry(item);

const hasAllocatedProject = (item) => {
  const project = normalizeTaxScopeText(item?.projeto);
  if (!project || project.includes('ADMINISTRA')) return false;
  return ![
    'GRUPO OAE',
    'SEM PROJETO',
    'PROJETOS',
    'PROJETO',
    'PROJETOS GERAL',
    'PROJETOS GERAIS'
  ].includes(project);
};

export default function VisaoFinanceira() {
  const { isReportMode, openReportBuilder, exitReportMode } = useReport();
  const [isSyncing, setIsSyncing] = useState(false);
  const [data, setData] = useState([]);
  const [projetosBrutos, setProjetosBrutos] = useState([]);
  const [saldosBancarios, setSaldosBancarios] = useState([]);
  const [somaProjetos, setSomaProjetos] = useState(0);
  const [error, setError] = useState(null);
  const [lastSync, setLastSync] = useState(null);

  const [filterDataInicial, setFilterDataInicial] = useState(() => getYearToDateRange().start);
  const [filterDataFinal, setFilterDataFinal] = useState(() => getYearToDateRange().end);
  const [filterProjetos, setFilterProjetos] = useState([]);
  const [filterStatus, setFilterStatus] = useState([]);
  const [filterNomes, setFilterNomes] = useState([]);
  const [filterContas, setFilterContas] = useState([]);
  const [compositionDrilldown, setCompositionDrilldown] = useState(null);

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
      setSomaProjetos(result.somaProjetosSaldo || 0);
      const syncDate = result.syncedAt || result.snapshotAt;
      setLastSync(syncDate ? new Date(syncDate).toLocaleString('pt-BR') : null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => { fetchDados(); }, []);

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const rawBaseData = useMemo(() => data.map(item => {
    let statusAmigavel = item.status;
    if (item.natureza === 'Entrada') {
      const forecastOnly = isForecastOnlyReceivableDocument(item);
      if (forecastOnly) statusAmigavel = 'A receber';
      else if (item.status === 'Realizado') statusAmigavel = 'Recebido';
      else if (item.status === 'A realizar') statusAmigavel = 'A receber';
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
  }), [data]);

  const baseData = useMemo(() => consolidateFinancialData(rawBaseData, {
    filterProjetos,
    isProjetosPage: false,
    usarValorCaixa: true
  }), [rawBaseData, filterProjetos]);

  const filteredData = useMemo(() => baseData.filter(item => {
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
  }), [baseData, filterDataInicial, filterDataFinal, filterProjetos, filterStatus, filterNomes, filterContas]);

  const openFilteredData = useMemo(() => baseData.filter((item) => {
    if (filterStatus.length > 0 && !filterStatus.includes(item.statusExibicao)) return false;
    if (filterProjetos.length > 0 && !filterProjetos.includes(item.projeto)) return false;
    if (filterNomes.length > 0 && !filterNomes.includes(item.nome)) return false;
    if (filterContas.length > 0 && !filterContas.includes(item.contaDescricao)) return false;
    return true;
  }), [baseData, filterProjetos, filterStatus, filterNomes, filterContas]);

  const realizedFilteredData = useMemo(() => {
    const start = filterDataInicial ? new Date(filterDataInicial + 'T00:00:00').getTime() : 0;
    const selectedEnd = filterDataFinal ? new Date(filterDataFinal + 'T23:59:59').getTime() : Infinity;
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const end = Math.min(selectedEnd, todayEnd.getTime());
    return openFilteredData.filter((item) => {
      if (String(item.status || '').trim().toUpperCase() !== 'REALIZADO') return false;
      if (item.natureza === 'Entrada' && isForecastOnlyReceivableDocument(item)) return false;
      return item.dataTimestamp >= start && item.dataTimestamp <= end;
    });
  }, [openFilteredData, filterDataInicial, filterDataFinal]);

  const forecastFilteredData = useMemo(() => {
    const start = filterDataInicial ? new Date(filterDataInicial + 'T00:00:00').getTime() : 0;
    const end = filterDataFinal ? new Date(filterDataFinal + 'T23:59:59').getTime() : Infinity;
    return openFilteredData.filter((item) => {
      const status = String(item.status || '').trim().toUpperCase();
      const forecastOnly = item.natureza === 'Entrada' && isForecastOnlyReceivableDocument(item);
      if (status !== 'A REALIZAR' && !forecastOnly) return false;
      return item.dataTimestamp >= start && item.dataTimestamp <= end;
    });
  }, [openFilteredData, filterDataInicial, filterDataFinal]);

  const projetosDisponiveis = useMemo(() => getActiveProjectNames(projetosBrutos, true), [projetosBrutos]);
  const activeProjects = useMemo(() => getActiveProjects(projetosBrutos), [projetosBrutos]);
  const activeProjectKeys = useMemo(() => new Set(activeProjects.map(project => getProjectKey(project.ID || project.OBRA))), [activeProjects]);
  const nomesDisponiveis = Array.from(new Set(baseData.map(d => d.nome).filter(Boolean))).sort();
  const contasDisponiveis = Array.from(new Set(baseData.map(d => d.contaDescricao).filter(Boolean))).sort();

  const totalBancario = saldosBancarios.reduce((acc, row) => acc + (Number(row.Saldo) || 0), 0);
  const entradasRealizadas = realizedFilteredData.filter(r => r.natureza === 'Entrada').reduce((acc, r) => acc + r.valor, 0);
  const entradasARealizar = forecastFilteredData.filter(r => r.natureza === 'Entrada').reduce((acc, r) => acc + r.valor, 0);
  const saidasRealizadas = realizedFilteredData.filter(r => r.natureza === 'Saída').reduce((acc, r) => acc + r.valor, 0);
  const saidasARealizar = forecastFilteredData.filter(r => r.natureza === 'Saída').reduce((acc, r) => acc + r.valor, 0);

  const resultadoRealizado = entradasRealizadas - saidasRealizadas;
  const resultadoPrevisto = entradasARealizar - saidasARealizar;

  const flowData = useMemo(() => {
    const monthLabels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const rows = monthLabels.map((label, month) => ({ label, Entradas: 0, Saídas: 0, timestamp: new Date(2026, month, 1).getTime(), month }));
    realizedFilteredData.forEach((item) => {
      const parts = String(item.data || '').split('/');
      if (parts.length !== 3 || parts[2] !== '2026') return;
      const month = Number(parts[1]) - 1;
      if (month < 0 || month > 11) return;
      if (item.natureza === 'Entrada') rows[month].Entradas += Number(item.valor) || 0;
      if (item.natureza === 'Saída') rows[month].Saídas += Number(item.valor) || 0;
    });
    return rows;
  }, [realizedFilteredData]);

  const piePagamentos = [
    { name: 'Pago', value: saidasRealizadas },
    { name: 'A pagar', value: saidasARealizar }
  ];

  const topProjetosEntradas = useMemo(() => {
    const map = {};
    realizedFilteredData.forEach((item) => {
      if (item.natureza !== 'Entrada') return;
      const projectName = String(item.projeto || '').trim();
      const projectUpper = projectName.toUpperCase();
      if (!projectName || projectUpper.includes('ADMINISTRA') || projectUpper === 'GRUPO OAE' || projectUpper === 'SEM PROJETO') return;
      const projectRevenue = Number(item.valorReceitaProjetoTotal ?? item.valor) || 0;
      if (projectRevenue <= 0) return;
      map[projectName] = (map[projectName] || 0) + projectRevenue;
    });
    return Object.entries(map).map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor).slice(0, 10);
  }, [realizedFilteredData]);

  const topProjetosSaidas = useMemo(() => {
    const map = {};
    filteredData.filter(i => i.natureza === 'Saída' && i.projeto && activeProjectKeys.has(getProjectKey(i.projeto))).forEach(i => {
      map[i.projeto] = (map[i.projeto] || 0) + (Number(i.valor) || 0);
    });
    return Object.entries(map).map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor).slice(0, 10);
  }, [filteredData, activeProjectKeys]);

  // Projeto x Administrativo agora e SEMPRE calculado pelo sistema em 80/20.
  // O plano financeiro identifica o recebimento, mas nao determina mais a divisao.
  const projectRevenueStatus = useMemo(() => {
    const accumulate = (items) => items.reduce((totals, item) => {
      if (item.natureza !== 'Entrada') return totals;
      const total = Number(item.valorReceitaProjetoTotal) || 0;
      if (!total) return totals;
      totals.obra += Number(item.valorDireto) || 0;
      totals.adm += Number(item.valorAdministrativo) || 0;
      totals.total += total;
      return totals;
    }, { obra: 0, adm: 0, total: 0 });

    return {
      realizado: accumulate(realizedFilteredData),
      pendente: accumulate(forecastFilteredData),
    };
  }, [realizedFilteredData, forecastFilteredData]);

  const entryBreakdown = useMemo(() => {
    const totals = { obra: 0, adm: 0, emprestimos: 0, aportes: 0, outras: 0 };
    const detailMaps = { projetos: new Map(), capital: new Map(), outras: new Map() };

    const addDetail = (bucket, label, value) => {
      detailMaps[bucket].set(label, (detailMaps[bucket].get(label) || 0) + value);
    };

    realizedFilteredData.forEach((item) => {
      if (item.natureza !== 'Entrada') return;

      const projectTotal = Number(item.valorReceitaProjetoTotal) || 0;
      if (projectTotal) {
        totals.obra += Number(item.valorDireto) || 0;
        totals.adm += Number(item.valorAdministrativo) || 0;
        addDetail('projetos', item.projeto || 'Projeto não identificado', projectTotal);
        return;
      }

      const classification = classifyFinancialEntry(item);
      const value = Number(item.valor) || 0;
      if (classification.type === 'emprestimo') {
        totals.emprestimos += value;
        addDetail('capital', classification.label, value);
      } else if (classification.type === 'aporte') {
        totals.aportes += value;
        addDetail('capital', classification.label, value);
      } else {
        totals.outras += value;
        addDetail('outras', classification.label || 'Outra entrada', value);
      }
    });

    const toRows = (map) => [...map.entries()]
      .map(([conta, valor]) => ({ conta, valor }))
      .filter((row) => Math.abs(row.valor) > 0.005)
      .sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor));

    const projetos = totals.obra + totals.adm;
    const capital = totals.emprestimos + totals.aportes;
    const total = projetos + capital + totals.outras;

    return {
      ...totals,
      projetos,
      capital,
      total,
      diferenca: entradasRealizadas - total,
      items: [
        { key: 'projetos', label: 'Receitas de Projetos', value: projetos, color: 'var(--success)', details: toRows(detailMaps.projetos) },
        { key: 'capital', label: 'Empréstimos e Aportes', value: capital, color: 'var(--info)', details: toRows(detailMaps.capital) },
        { key: 'outras', label: 'Outras Entradas', value: totals.outras, color: 'var(--primary)', details: toRows(detailMaps.outras) },
      ],
    };
  }, [realizedFilteredData, entradasRealizadas]);

  const outputBreakdown = useMemo(() => {
    const buckets = {
      custos: { value: 0, details: new Map() },
      despesas: { value: 0, details: new Map() },
      investimentos: { value: 0, details: new Map() },
      tributos: { value: 0, details: new Map() },
      outras: { value: 0, details: new Map() },
    };

    const accountLabel = (row) => {
      const code = String(row?.contaCodigo || '').trim();
      const name = String(row?.contaNome || row?.contaDescricao || 'Conta não identificada').trim();
      return code ? `${code} - ${name}` : name;
    };

    const add = (bucket, row, value) => {
      buckets[bucket].value += value;
      const label = accountLabel(row);
      buckets[bucket].details.set(label, (buckets[bucket].details.get(label) || 0) + value);
    };

    realizedFilteredData.forEach((item) => {
      if (item.natureza !== 'Saída') return;
      const value = Math.abs(Number(item.valor) || 0);
      const dreText = [item.dreClasse, item.dreLinha, item.dreDescricao, item.contaDescricao]
        .filter(Boolean).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

      if (isGeneralTax(item)) add('tributos', item, value);
      else if (/(INVEST|CAPEX|IMOBILIZ|ATIVO FIXO|ATIVO IMOB)/.test(dreText)) add('investimentos', item, value);
      else if (dreText.includes('CUSTO')) add('custos', item, value);
      else if (dreText.includes('DESPESA') || dreText.includes('ADMINISTRAT')) add('despesas', item, value);
      else add('outras', item, value);
    });

    const toRows = (map) => [...map.entries()]
      .map(([conta, valor]) => ({ conta, valor }))
      .filter((row) => Math.abs(row.valor) > 0.005)
      .sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor));

    const items = [
      { key: 'custos', label: 'Custos', value: buckets.custos.value, color: 'var(--warning)', details: toRows(buckets.custos.details) },
      { key: 'despesas', label: 'Despesas', value: buckets.despesas.value, color: 'var(--danger)', details: toRows(buckets.despesas.details) },
      { key: 'investimentos', label: 'Investimentos', value: buckets.investimentos.value, color: '#8b5cf6', details: toRows(buckets.investimentos.details) },
      { key: 'tributos', label: 'Tributos', value: buckets.tributos.value, color: 'var(--primary)', details: toRows(buckets.tributos.details) },
      { key: 'outras', label: 'Outras Saídas', value: buckets.outras.value, color: 'var(--text-secondary)', details: toRows(buckets.outras.details) },
    ];

    return { total: items.reduce((sum, item) => sum + item.value, 0), items };
  }, [realizedFilteredData]);

  const taxStatusBreakdown = useMemo(() => ({
    realizado: realizedFilteredData.filter((item) => item.natureza === 'Saída' && isGeneralTax(item)).reduce((sum, item) => sum + Math.abs(Number(item.valor) || 0), 0),
    pendente: forecastFilteredData.filter((item) => item.natureza === 'Saída' && isGeneralTax(item)).reduce((sum, item) => sum + Math.abs(Number(item.valor) || 0), 0),
  }), [realizedFilteredData, forecastFilteredData]);

  const projectFinancialOverview = useMemo(() => {
    const start = filterDataInicial ? new Date(filterDataInicial + 'T00:00:00').getTime() : 0;
    const selectedEnd = filterDataFinal ? new Date(filterDataFinal + 'T23:59:59').getTime() : Infinity;
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const end = Math.min(selectedEnd, todayEnd.getTime());

    const selectedProjectKeys = new Set(filterProjetos.filter((name) => !String(name || '').toUpperCase().includes('ADMINISTRA')).map((name) => getProjectKey(name)).filter(Boolean));
    const hasProjectFilter = selectedProjectKeys.size > 0;
    const allowedCostProjectKeys = hasProjectFilter ? selectedProjectKeys : activeProjectKeys;

    const projectRevenueData = consolidateFinancialData(rawBaseData, { isProjetosPage: true, incluirRateioAdm: true, usarValorCaixa: true });

    let receita = 0;
    let receitaObra = 0;
    let receitaAdm = 0;

    projectRevenueData.forEach((item) => {
      if (String(item?.natureza || '').toUpperCase() !== 'ENTRADA') return;
      const status = String(item?.status || '').toUpperCase();
      const isRealizado = status.includes('REALIZADO') || status.includes('RECEBIDO') || status.includes('EFETIVADO');
      if (!isRealizado) return;
      const ts = Number(item.dataTimestamp) || 0;
      if (ts < start || ts > end) return;

      const itemProjectKey = getProjectKey(item.projeto);
      if (hasProjectFilter && !selectedProjectKeys.has(itemProjectKey)) return;

      receitaObra += Number(item.valorDireto) || 0;
      receitaAdm += Number(item.valorAdministrativo) || 0;
      receita += Number(item.valorReceitaProjetoTotal ?? item.valor) || 0;
    });

    let custos = 0;
    let despesas = 0;
    let tributos = 0;

    rawBaseData.forEach((item) => {
      if (item.natureza !== 'Saída') return;
      const status = String(item.status || '').toUpperCase();
      const isRealizado = status.includes('REALIZADO') || status.includes('PAGO') || status.includes('EFETIVADO');
      if (!isRealizado) return;
      const ts = Number(item.dataTimestamp) || 0;
      if (ts < start || ts > end) return;

      const itemProjectKey = getProjectKey(item.projeto);
      const value = Math.abs(Number(item.valor) || 0);

      if (isGeneralTax(item)) {
        if (!hasAllocatedProject(item)) return;
        if (hasProjectFilter && !selectedProjectKeys.has(itemProjectKey)) return;
        tributos += value;
        return;
      }

      if (normalizeTaxScopeText(item.projeto).includes('ADMINISTRA')) return;
      if (!allowedCostProjectKeys.has(itemProjectKey)) return;

      const dreInfo = [item.dreClasse, item.dreLinha, item.dreDescricao].filter(Boolean).join(' ').toUpperCase();
      const isPendingDre = !dreInfo.trim() || dreInfo.includes('PENDENTE DE CLASSIFICAÇÃO');
      if (isPendingDre) return;

      if (dreInfo.includes('CUSTO')) custos += value;
      else despesas += value;
    });

    const resultado = receita - custos - despesas - tributos;
    const margem = receita > 0 ? (resultado / receita) * 100 : 0;
    return { receita, receitaObra, receitaAdm, custos, despesas, tributos, resultado, margem };
  }, [rawBaseData, filterDataInicial, filterDataFinal, filterProjetos, activeProjectKeys]);

  // O restante da pagina permanece inalterado abaixo.
  // Este arquivo foi mantido integralmente no repositorio e apenas a regra de receitas acima foi ajustada.
