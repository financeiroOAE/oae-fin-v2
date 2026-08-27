"use client";

import { useState, useEffect, useMemo } from "react";
import { RefreshCw, AlertCircle, TrendingUp, TrendingDown, LayoutDashboard, Calendar, DollarSign, Database, ChevronLeft, ChevronRight, Building2, Activity, FilterX, Landmark, FileText, CheckCircle, Target, ArrowDownCircle, ArrowUpCircle, ArrowDown, ArrowUp, X } from "lucide-react";
import IncomeExpenseChart from "@/components/charts/IncomeExpenseChart";
import MonthlyResultChart from "@/components/charts/MonthlyResultChart";
import TopBarChart from "@/components/charts/TopBarChart";
import AccountBarChart from "@/components/charts/AccountBarChart";
import PieStatusChart from "@/components/charts/PieStatusChart";
import ABCClassDonut from "@/components/charts/ABCClassDonut";
import ProjectFinancialOverviewChart from "@/components/charts/ProjectFinancialOverviewChart";
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

// Visao Geral: tributos da empresa inteira. Mantem as regras tributarias existentes
// e inclui INSS quando a propria conta/classificacao identifica o tributo.
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

  // Global Filters - Inicializando para Últimos 30 Dias no mount, mas o useState não roda window aqui diretamente no SSR
  // Usaremos um useEffect para setar as datas padrão.
  const [filterDataInicial, setFilterDataInicial] = useState(() => getYearToDateRange().start);
  const [filterDataFinal, setFilterDataFinal] = useState(() => getYearToDateRange().end);
  // filtros multi-select (array vazio = Todos)
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

  useEffect(() => {
    // Seta 30 dias padrão se vazio
    fetchDados();
  }, []);

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const rawBaseData = useMemo(() => {
    return data.map(item => {
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
    });
  }, [data]);

  const baseData = useMemo(() => {
    return consolidateFinancialData(rawBaseData, {
      filterProjetos,
      isProjetosPage: false,
      usarValorCaixa: true
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

  // KPIs
  const totalBancario = saldosBancarios.reduce((acc, row) => acc + (Number(row.Saldo) || 0), 0);
  
  const entradasRealizadas = realizedFilteredData.filter(r => r.natureza === 'Entrada').reduce((acc, r) => acc + r.valor, 0);
  const entradasARealizar = forecastFilteredData.filter(r => r.natureza === 'Entrada').reduce((acc, r) => acc + r.valor, 0);
  const saidasRealizadas = realizedFilteredData.filter(r => r.natureza === 'Saída').reduce((acc, r) => acc + r.valor, 0);
  const saidasARealizar = forecastFilteredData.filter(r => r.natureza === 'Saída').reduce((acc, r) => acc + r.valor, 0);

  const resultadoRealizado = entradasRealizadas - saidasRealizadas;
  const resultadoPrevisto = entradasARealizar - saidasARealizar;
  
  // Os graficos mensais mantem Jan-Dez sempre visiveis. O filtro de periodo
  // altera somente os valores; meses fora do intervalo permanecem com zero.
  const flowData = useMemo(() => {
    const monthLabels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const rows = monthLabels.map((label, month) => ({
      label,
      Entradas: 0,
      Saídas: 0,
      timestamp: new Date(2026, month, 1).getTime(),
      month,
    }));

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

  // Top Projetos Entradas / Saídas
  const topProjetosEntradas = useMemo(() => {
    const map = {};
    realizedFilteredData.forEach((item) => {
      if (item.natureza !== 'Entrada') return;
      const projectName = String(item.projeto || '').trim();
      const projectUpper = projectName.toUpperCase();
      if (!projectName || projectUpper.includes('ADMINISTRA') || projectUpper === 'GRUPO OAE' || projectUpper === 'SEM PROJETO') return;

      const rows = item.linhasOriginais?.length ? item.linhasOriginais : [item];
      const projectRevenue = rows.reduce((sum, row) => {
        const code = String(row.contaCodigo || '').replace(/\D/g, '');
        if (code !== '1010101' && code !== '1010107') return sum;
        return sum + (Number(row.valor) || 0);
      }, 0);
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

  // Receita de projetos: a fonte de verdade e a conta da CR_GERAL.
  // 1010101 = faturamento e 1010107 = administrativo. Nao dependemos do
  // cadastro de projetos ativos para decidir se uma receita existe.
  const projectRevenueStatus = useMemo(() => {
    const accumulate = (items) => {
      let obra = 0;
      let adm = 0;
      items.forEach((item) => {
        if (item.natureza !== 'Entrada') return;
        const rows = item.linhasOriginais?.length ? item.linhasOriginais : [item];
        rows.forEach((row) => {
          const code = String(row.contaCodigo || '').replace(/\D/g, '');
          const value = Number(row.valor) || 0;
          if (code === '1010101') obra += value;
          if (code === '1010107') adm += value;
        });
      });
      return { obra, adm, total: obra + adm };
    };

    return {
      realizado: accumulate(realizedFilteredData),
      pendente: accumulate(forecastFilteredData),
    };
  }, [realizedFilteredData, forecastFilteredData]);


  const entryBreakdown = useMemo(() => {
    const totals = { obra: 0, adm: 0, emprestimos: 0, aportes: 0, outras: 0 };
    const detailMaps = {
      projetos: new Map(),
      capital: new Map(),
      outras: new Map(),
    };

    const accountLabel = (row, fallback) => {
      const code = String(row?.contaCodigo || '').trim();
      const name = String(row?.contaNome || row?.contaDescricao || row?.planoFinanceiro || fallback || 'Conta não identificada').trim();
      return code ? `${code} - ${name}` : name;
    };

    const addDetail = (bucket, row, value, fallback) => {
      const label = accountLabel(row, fallback);
      detailMaps[bucket].set(label, (detailMaps[bucket].get(label) || 0) + value);
    };

    realizedFilteredData.forEach((item) => {
      if (item.natureza !== 'Entrada') return;
      const rows = item.linhasOriginais?.length ? item.linhasOriginais : [item];
      rows.forEach((row) => {
        const value = Number(row.valor) || 0;
        const classification = classifyFinancialEntry(row);
        if (classification.type === 'receita_projeto') {
          totals.obra += value;
          addDetail('projetos', row, value, classification.label);
        } else if (classification.type === 'receita_administrativa') {
          totals.adm += value;
          addDetail('projetos', row, value, classification.label);
        } else if (classification.type === 'emprestimo') {
          totals.emprestimos += value;
          addDetail('capital', row, value, classification.label);
        } else if (classification.type === 'aporte') {
          totals.aportes += value;
          addDetail('capital', row, value, classification.label);
        } else {
          totals.outras += value;
          addDetail('outras', row, value, classification.label);
        }
      });
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
    realizado: realizedFilteredData
      .filter((item) => item.natureza === 'Saída' && isGeneralTax(item))
      .reduce((sum, item) => sum + Math.abs(Number(item.valor) || 0), 0),
    pendente: forecastFilteredData
      .filter((item) => item.natureza === 'Saída' && isGeneralTax(item))
      .reduce((sum, item) => sum + Math.abs(Number(item.valor) || 0), 0),
  }), [realizedFilteredData, forecastFilteredData]);

  const projectFinancialOverview = useMemo(() => {
    // Esta visao e exclusivamente de OBRAS: usa somente valores alocados a
    // centro de custo real. Administracao e buckets genericos ficam fora.
    // Para realizados, valorDireto ja carrega a regra de caixa da CR_GERAL coluna K.
    const receitaObra = realizedFilteredData
      .filter((item) => item.natureza === 'Entrada' && hasAllocatedProject(item))
      .reduce((sum, item) => {
        if (item?.valorDireto !== undefined && item?.valorDireto !== null) {
          return sum + (Number(item.valorDireto) || 0);
        }
        const classification = classifyFinancialEntry(item);
        return classification.type === 'receita_projeto'
          ? sum + (Number(item.valor) || 0)
          : sum;
      }, 0);

    const receitaAdm = 0;
    const receita = receitaObra;
    const saidasProjeto = realizedFilteredData
      .filter((item) => item.natureza === 'Saída')
      .filter((item) => hasAllocatedProject(item));
    const tributos = saidasProjeto
      .filter((item) => isGeneralTax(item))
      .reduce((sum, item) => sum + Math.abs(Number(item.valor) || 0), 0);
    const saidas = saidasProjeto
      .filter((item) => !isGeneralTax(item))
      .reduce((sum, item) => sum + Math.abs(Number(item.valor) || 0), 0);
    const resultado = receita - saidas - tributos;
    const margem = receita > 0 ? (resultado / receita) * 100 : 0;
    return { receita, receitaObra, receitaAdm, saidas, tributos, resultado, margem };
  }, [realizedFilteredData]);

  const abcDonutData = useMemo(() => {
    const aggregated = new Map();
    activeProjects.forEach((project) => {
      const key = getProjectKey(project.ID || project.OBRA);
      const name = String(project.OBRA || '').trim().replace(/[.\s]+$/g, '');
      if (!key || !name) return;
      if (!aggregated.has(key)) aggregated.set(key, { nome: name, contratado: 0, faturado: 0 });
      const current = aggregated.get(key);
      current.contratado += Number(project.CONTRATO) || 0;
      current.faturado += Number(project['NF FATURADAS']) || 0;
    });

    const projects = [...aggregated.values()]
      .filter(project => project.contratado > 0)
      .sort((a, b) => b.contratado - a.contratado);

    const classes = [
      { name: 'Classe A', color: 'var(--success)', rule: 'Contratos acima de R$ 500 mil', test: (value) => value > 500000 },
      { name: 'Classe B', color: 'var(--warning)', rule: 'Contratos de R$ 100 mil a R$ 500 mil', test: (value) => value >= 100000 && value <= 500000 },
      { name: 'Classe C', color: 'var(--danger)', rule: 'Contratos abaixo de R$ 100 mil', test: (value) => value < 100000 },
    ];

    return classes.map((definition) => {
      const classProjects = projects.filter((project) => definition.test(project.contratado));
      return {
        ...definition,
        value: classProjects.reduce((sum, project) => sum + project.contratado, 0),
        count: classProjects.length,
        projects: classProjects,
      };
    }).filter((item) => item.count > 0);
  }, [activeProjects]);

  const topContasSaidas = useMemo(() => {
    const map = {};
    filteredData.filter(i => i.natureza === 'Saída' && i.contaDescricao && !isPartnerWithdrawal(i)).forEach(i => {
      map[i.contaDescricao] = (map[i.contaDescricao] || 0) + (Number(i.valor) || 0);
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
          const forecastOnly = item.natureza === 'Entrada' && isForecastOnlyReceivableDocument(item);
          const isRealizado = status === 'REALIZADO' && !forecastOnly;
          const isPrevisto = status === 'A REALIZAR' || forecastOnly;
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
    "Classificação Financeira": item.natureza === 'Entrada' ? classifyFinancialEntry(item).label : 'Saída / Pagamento',
    Valor: item.valor,
  }));

  const resetDefaultPeriod = () => {
    const range = getYearToDateRange();
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
          <button onClick={resetDefaultPeriod} className="btn" style={{ fontSize: '11px', padding: '0.25rem 0.5rem', background: 'var(--bg-elevated)' }}>01/01 até hoje</button>
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
            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}><Building2 size={12}/> Projeto / Obra</label>
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
              onClick={() => { resetDefaultPeriod(); setFilterProjetos([]); setFilterStatus([]); setFilterNomes([]); setFilterContas([]); }}
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
          <ReportAdder sectionKey="visao:kpis" title="Resumo Executivo Financeiro" componentName="Indicadores Financeiros" page="Visão Financeira" type="SUMMARY" data={[{ "Saldo Bancário": totalBancario, "Saldo Contratos": somaProjetos, "Resultado Realizado": resultadoRealizado, "Resultado Previsto": resultadoPrevisto, "Entradas Realizadas": entradasRealizadas, "A Receber": entradasARealizar, Pago: saidasRealizadas, "A Pagar": saidasARealizar }]} columnFormats={{ "Saldo Bancário": "currency", "Saldo Contratos": "currency", "Resultado Realizado": "currency", "Resultado Previsto": "currency", "Entradas Realizadas": "currency", "A Receber": "currency", Pago: "currency", "A Pagar": "currency" }} filters={reportFilters} presetTags={["executive-financial"]} explanation="Consolidação dos principais saldos e resultados conforme os filtros ativos." style={{ float: 'right' }} />
          <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem', fontWeight: '600' }}><Landmark size={16} color="var(--primary)"/> Saldo Bancário Total</p>
          <p style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-main)' }}>{formatCurrency(totalBancario)}</p>
        </div>
        <div className="card" style={{ padding: '1.5rem' }}>
          <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem', fontWeight: '600' }}><FileText size={16} color="var(--purple)"/> Saldo Contratos</p>
          <p style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-main)' }}>{formatCurrency(somaProjetos)}</p>
        </div>
        <div className="card" style={{ padding: '1.5rem' }}>
          <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem', fontWeight: '600' }}><CheckCircle size={16} color="var(--primary)"/> Resultado Realizado <InfoTooltip title="Resultado Realizado" content="Resultado do caixa efetivo: entradas líquidas realmente creditadas menos pagamentos realizados no período selecionado." /></p>
          <p style={{ fontSize: '24px', fontWeight: '700', color: resultadoRealizado >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {formatCurrency(resultadoRealizado)}
          </p>
        </div>
        <div className="card" style={{ padding: '1.5rem' }}>
          <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem', fontWeight: '600' }}><Target size={16} color="var(--primary)"/> Resultado Previsto — Visão do Dia <InfoTooltip title="Resultado Previsto — Visão do Dia" content="Posição consultada hoje dos valores ainda em aberto: A Receber menos A Pagar dentro do período selecionado. PRV e PCT permanecem somente na previsão." /></p>
          <p style={{ fontSize: '24px', fontWeight: '700', color: resultadoPrevisto >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {formatCurrency(resultadoPrevisto)}
          </p>
        </div>
      </div>

      {/* KPIs Secundários */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--success)' }}>
          <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}><ArrowDownCircle size={14} color="var(--success)"/> Entradas Realizadas <InfoTooltip title="Entradas Realizadas" content="Valor líquido efetivamente creditado nas contas. Para CR_GERAL, usa a coluna K (Valor). Documentos PRV e PCT não entram como recebidos." /></p>
          <p style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-main)' }}>{formatCurrency(entradasRealizadas)}</p>
        </div>
        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid rgba(16, 185, 129, 0.4)' }}>
          <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}><ArrowUpCircle size={14} color="var(--success)"/> A Receber <InfoTooltip title="A Receber" content="Valores ainda previstos ou em aberto. Documentos PRV e PCT são tratados exclusivamente como previsão de recebimento." /></p>
          <p style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-main)' }}>{formatCurrency(entradasARealizar)}</p>
        </div>
        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--danger)' }}>
          <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}><ArrowUp size={14} color="var(--danger)"/> Pago <InfoTooltip title="Pago" content="Saídas efetivamente realizadas no período selecionado." /></p>
          <p style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-main)' }}>{formatCurrency(saidasRealizadas)}</p>
        </div>
        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid rgba(239, 68, 68, 0.4)' }}>
          <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}><ArrowDown size={14} color="var(--danger)"/> A Pagar <InfoTooltip title="A Pagar" content="Compromissos financeiros ainda em aberto ou previstos dentro do período selecionado." /></p>
          <p style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-main)' }}>{formatCurrency(saidasARealizar)}</p>
        </div>
      </div>


      {/* Grid Principal dos Gráficos (Dashboard) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '1.5rem' }}>
        
        {/* ROW 1: Evolução Operacional e Resultado Financeiro */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: '1.5rem', alignItems: 'stretch' }}>
          <div id="report-visao-fluxo" data-report-section className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
            <ReportAdder sectionKey="visao:fluxo-operacional" title="Fluxo Operacional de Entradas e Saídas" componentName="Gráfico de Fluxo Operacional" page="Visão Financeira" type="CHART" data={flowData} columns={[{ key: "label", label: "Período" }, { key: "Entradas", label: "Entradas", format: "currency" }, { key: "Saídas", label: "Saídas", format: "currency" }]} filters={reportFilters} captureId="report-visao-fluxo" presetTags={["executive-financial"]} explanation="Evolução das entradas e saídas no período selecionado." style={{ alignSelf: 'flex-end' }} />
            <h2 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.5rem' }}>Fluxo Operacional de Entradas e Saídas (R$)</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Evolução do período selecionado</p>
            <div style={{ flex: 1, minHeight: '320px', minWidth: 0 }}>
              <IncomeExpenseChart data={flowData} />
            </div>
          </div>
          <div id="report-visao-resultado" data-report-section className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
            <ReportAdder sectionKey="visao:resultado" title="Resultado Financeiro Consolidado" componentName="Gráfico de Resultado Financeiro" page="Visão Financeira" type="CHART" data={flowData.map(row => ({ Período: row.label, Resultado: row.Entradas - row.Saídas }))} filters={reportFilters} captureId="report-visao-resultado" presetTags={["executive-financial"]} explanation="Resultado líquido obtido pela diferença entre entradas e saídas." style={{ alignSelf: 'flex-end' }} />
            <h2 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.5rem' }}>Resultado Financeiro Consolidado (R$)</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Evolução do saldo (Entradas - Saídas) no período selecionado</p>
            <div style={{ flex: 1, minHeight: '320px', minWidth: 0 }}>
              <MonthlyResultChart data={flowData} />
            </div>
          </div>
        </div>



        {/* ROW 1.5: Composição das movimentações realizadas */}
        <div id="report-visao-composicao-entradas" data-report-section className="card" style={{ padding: '1.25rem', minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                Composição das Movimentações Realizadas
                <InfoTooltip title="Composição das Movimentações Realizadas" content="Distribuição das entradas e saídas realizadas por natureza no período selecionado." />
              </h2>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Clique em uma faixa ou categoria para ver as contas que compõem o valor.</p>
            </div>
            <ReportAdder
              sectionKey="visao:composicao-movimentacoes"
              title="Composição das Movimentações Realizadas"
              componentName="Composição de Entradas e Saídas"
              page="Visão Financeira"
              type="TABLE"
              data={[
                ...entryBreakdown.items.map((item) => ({ Natureza: 'Entrada', Grupo: item.label, Valor: item.value })),
                ...outputBreakdown.items.map((item) => ({ Natureza: 'Saída', Grupo: item.label, Valor: item.value })),
              ]}
              filters={reportFilters}
              captureId="report-visao-composicao-entradas"
              presetTags={["executive-financial"]}
              explanation="Distribuição das entradas e saídas realizadas por natureza no período selecionado."
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: '1.25rem' }}>
            <div style={{ padding: '0.9rem 1rem', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--bg-elevated)', minWidth: 0 }}>
              <FinancialCompositionBar
                title="Entradas realizadas"
                total={entradasRealizadas}
                items={entryBreakdown.items}
                onSelect={(item) => setCompositionDrilldown({ nature: 'Entrada', ...item })}
              />
            </div>
            <div style={{ padding: '0.9rem 1rem', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--bg-elevated)', minWidth: 0 }}>
              <FinancialCompositionBar
                title="Saídas realizadas"
                total={saidasRealizadas}
                items={outputBreakdown.items}
                onSelect={(item) => setCompositionDrilldown({ nature: 'Saída', ...item })}
              />
            </div>
          </div>

          {Math.abs(entryBreakdown.diferenca) > 0.01 && (
            <p style={{ marginTop: '0.65rem', fontSize: '10.5px', color: 'var(--warning)' }}>
              Diferença de conciliação das entradas: {formatCurrency(entryBreakdown.diferenca)}.
            </p>
          )}
        </div>

        {/* ROW 2: Status Financeiro e Curva ABC */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: '1.5rem', alignItems: 'stretch' }}>
          <div id="report-visao-status" data-report-section className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%' }}>
            <ReportAdder sectionKey="visao:status" title="Status Financeiro Consolidado" componentName="Tributos, Receitas e Pagamentos" page="Visão Financeira" type="CHART" data={[
              { name: 'Receitas Recebidas', value: projectRevenueStatus.realizado.total },
              { name: 'Receitas A Receber', value: projectRevenueStatus.pendente.total },
              { name: 'Pagamentos Realizados', value: saidasRealizadas },
              { name: 'Pagamentos A Realizar', value: saidasARealizar },
              { name: 'Tributos Pagos', value: taxStatusBreakdown.realizado },
              { name: 'Tributos A Pagar', value: taxStatusBreakdown.pendente },
            ]} filters={reportFilters} captureId="report-visao-status" presetTags={["executive-financial"]} explanation="Receitas de projetos (1010101 + 1010107), pagamentos e tributos dentro do período selecionado." style={{ alignSelf: 'flex-end' }} />
            <h2 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>Status Financeiro Consolidado <InfoTooltip title="Tributos consolidados" content="Tributos incluem PIS, COFINS, ISS, INSS incidente sobre o faturamento, IRPJ, CSLL e demais contas tributárias classificadas como tributo." /></h2>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Tributos, receitas de projetos e pagamentos no período selecionado.</p>
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.85rem', alignItems: 'stretch' }}>
              <PieStatusChart realizado={taxStatusBreakdown.realizado} pendente={taxStatusBreakdown.pendente} colorRealizado="var(--primary)" colorPendente="rgba(57, 198, 198, 0.25)" titulo="Tributos" labelRealizado="Pago" labelPendente="A pagar" />
              <PieStatusChart realizado={projectRevenueStatus.realizado.total} pendente={projectRevenueStatus.pendente.total} colorRealizado="var(--success)" colorPendente="rgba(16, 185, 129, 0.3)" titulo="Receitas" labelRealizado="Recebido" labelPendente="A receber" />
              <PieStatusChart realizado={saidasRealizadas} pendente={saidasARealizar} colorRealizado="var(--danger)" colorPendente="rgba(239, 68, 68, 0.3)" titulo="Pagamentos" labelRealizado="Pago" labelPendente="A pagar" />
            </div>
          </div>
          <div id="report-visao-abc" data-report-section className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', minWidth: 0, maxWidth: '100%', overflow: 'hidden', height: '100%' }}>
            <ReportAdder sectionKey="visao:abc" title="Curva ABC dos Projetos" componentName="Curva ABC" page="Visão Financeira" type="TABLE" data={abcDonutData.map(item => ({ Classe: item.name, Projetos: item.count, Valor: item.value, Regra: item.rule }))} filters={reportFilters} captureId="report-visao-abc" presetTags={["executive-financial", "project-executive"]} style={{ alignSelf: 'flex-end' }} />
            <h2 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.25rem' }}>Curva ABC dos Projetos</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Projetos ativos classificados pelo valor contratado.</p>
            <ABCClassDonut data={abcDonutData} />
          </div>
        </div>

        {/* ROW 3: Centro de Custo */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: '1rem' }}>
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

        {/* ROW 4: Visão Financeira dos Projetos e Despesas */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: '1rem' }}>
          <div id="report-visao-projetos-financeiro" data-report-section className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
            <ReportAdder sectionKey="visao:projetos-financeiro" title="Visão Financeira Geral dos Projetos" componentName="Resultado e Margem dos Projetos" page="Visão Financeira" type="CHART" data={[{ "Recebido Líquido": projectFinancialOverview.receita, "Custos + Despesas": projectFinancialOverview.saidas, Tributos: projectFinancialOverview.tributos, Resultado: projectFinancialOverview.resultado, Margem: projectFinancialOverview.margem }]} filters={reportFilters} captureId="report-visao-projetos-financeiro" presetTags={["executive-financial", "project-executive"]} style={{ alignSelf: 'flex-end' }} />
            <h2 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.25rem' }}>Visão Financeira Geral dos Projetos</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Margem = Resultado ÷ Recebido Líquido × 100. Somente valores alocados às obras entram neste gráfico; Administração não é considerada. O Resultado corresponde ao Recebido Líquido menos Custos + Despesas e Tributos realizados.</p>
            <div className="finance-kpi-grid" style={{ marginBottom: '0.75rem' }}>
              <div><span style={{fontSize:'10px',color:'var(--text-secondary)',textTransform:'uppercase'}}>Recebido Líquido</span><strong style={{display:'block',fontSize:'14px',color:'var(--success)',overflowWrap:'anywhere'}}>{formatCurrency(projectFinancialOverview.receita)}</strong></div>
              <div><span style={{fontSize:'10px',color:'var(--text-secondary)',textTransform:'uppercase'}}>Custos + Despesas</span><strong style={{display:'block',fontSize:'14px',color:'var(--danger)',overflowWrap:'anywhere'}}>{formatCurrency(projectFinancialOverview.saidas)}</strong></div>
              <div><span style={{fontSize:'10px',color:'var(--text-secondary)',textTransform:'uppercase'}}>Tributos</span><strong style={{display:'block',fontSize:'14px',color:'var(--primary)',overflowWrap:'anywhere'}}>{formatCurrency(projectFinancialOverview.tributos)}</strong></div>
              <div><span style={{fontSize:'10px',color:'var(--text-secondary)',textTransform:'uppercase'}}>Resultado</span><strong style={{display:'block',fontSize:'14px',color:projectFinancialOverview.resultado >= 0 ? 'var(--success)' : 'var(--danger)',overflowWrap:'anywhere'}}>{formatCurrency(projectFinancialOverview.resultado)}</strong></div>
              <div><span style={{fontSize:'10px',color:'var(--text-secondary)',textTransform:'uppercase'}}>Margem</span><strong style={{display:'block',fontSize:'14px',color:projectFinancialOverview.margem >= 0 ? 'var(--success)' : 'var(--danger)'}}>{projectFinancialOverview.margem.toFixed(2).replace('.', ',')}%</strong></div>
            </div>
            <div className="finance-chart-frame"><ProjectFinancialOverviewChart recebido={projectFinancialOverview.receita} saidas={projectFinancialOverview.saidas} tributos={projectFinancialOverview.tributos} resultado={projectFinancialOverview.resultado} /></div>
          </div>
          <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
            <AccountBarChart data={topContasSaidas} title="Despesas por Plano de Conta" infoContent="Saídas agrupadas por plano de conta no período selecionado, sem retiradas dos sócios." color="var(--danger)" />
          </div>
        </div>

      </div>


      {compositionDrilldown && (
        <div
          onClick={() => setCompositionDrilldown(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 2147482500, background: 'rgba(2, 8, 23, 0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
        >
          <div
            className="card"
            onClick={(event) => event.stopPropagation()}
            style={{ width: 'min(720px, 100%)', maxHeight: '82vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 0 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', padding: '1rem 1.1rem', borderBottom: '1px solid var(--border-color)' }}>
              <div>
                <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{compositionDrilldown.nature}</span>
                <h3 style={{ fontSize: '15px', color: 'var(--text-main)', marginTop: '0.15rem' }}>{compositionDrilldown.label}</h3>
                <strong style={{ display: 'block', marginTop: '0.3rem', color: 'var(--primary)', fontSize: '16px' }}>{formatCurrency(compositionDrilldown.value)}</strong>
              </div>
              <button type="button" onClick={() => setCompositionDrilldown(null)} aria-label="Fechar detalhamento" className="btn" style={{ padding: '0.35rem', minWidth: 'auto' }}><X size={16} /></button>
            </div>
            <div style={{ overflow: 'auto', padding: '0.6rem 1.1rem 1rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: '10px', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ textAlign: 'left', padding: '0.6rem 0.4rem' }}>Conta / Plano Financeiro</th>
                    <th style={{ textAlign: 'right', padding: '0.6rem 0.4rem' }}>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {(compositionDrilldown.details || []).map((row) => (
                    <tr key={row.conta} style={{ borderBottom: '1px solid rgba(148,163,184,0.08)' }}>
                      <td style={{ padding: '0.65rem 0.4rem', color: 'var(--text-main)' }}>{row.conta}</td>
                      <td style={{ padding: '0.65rem 0.4rem', textAlign: 'right', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>{formatCurrency(row.valor)}</td>
                    </tr>
                  ))}
                  {(!compositionDrilldown.details || compositionDrilldown.details.length === 0) && (
                    <tr><td colSpan={2} style={{ padding: '1.2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Sem contas detalhadas para esta categoria.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}


      <style dangerouslySetInnerHTML={{__html: `
        .spinner { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .fade-in { animation: fadeIn 0.3s ease-in-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
        
        @media (max-width: 1050px) {
          #report-visao-status > div[style*="grid-template-columns"] { grid-template-columns: 1fr !important; }
        }

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
