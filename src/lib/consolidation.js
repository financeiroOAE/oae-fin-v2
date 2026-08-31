import { classifyFinancialEntry } from '@/lib/financialClassification';

export const PROJECT_ADMIN_RATE = 0.20;

const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;

/**
 * Regra oficial de recebimento/faturamento dos projetos:
 * - o plano financeiro NAO define mais a divisao Projeto x Administrativo;
 * - 100% do titulo e primeiro vinculado ao projeto;
 * - o sistema calcula o rateio: 80% Projeto + 20% Administrativo;
 * - a soma das parcelas sempre preserva exatamente o total do titulo.
 */
export function splitProjectReceipt(totalValue) {
  const total = roundMoney(totalValue);
  const administrative = roundMoney(total * PROJECT_ADMIN_RATE);
  const project = roundMoney(total - administrative);
  return { total, project, administrative };
}

function parseDateToLocalMidnight(value, fallbackTimestamp) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0).getTime();
  }

  const raw = String(value ?? '').trim();

  if (raw) {
    let match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match) {
      const [, day, month, year] = match;
      return new Date(Number(year), Number(month) - 1, Number(day), 0, 0, 0, 0).getTime();
    }

    match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (match) {
      const [, year, month, day] = match;
      return new Date(Number(year), Number(month) - 1, Number(day), 0, 0, 0, 0).getTime();
    }

    if (/^\d+(?:\.\d+)?$/.test(raw)) {
      const serial = Number(raw);
      if (Number.isFinite(serial) && serial > 20000 && serial < 80000) {
        const utcDate = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000);
        return new Date(
          utcDate.getUTCFullYear(),
          utcDate.getUTCMonth(),
          utcDate.getUTCDate(),
          0, 0, 0, 0
        ).getTime();
      }
    }

    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 0, 0, 0, 0).getTime();
    }
  }

  if (Number.isFinite(fallbackTimestamp) && fallbackTimestamp > 0) {
    const fallbackDate = new Date(fallbackTimestamp);
    if (!Number.isNaN(fallbackDate.getTime())) {
      return new Date(
        fallbackDate.getFullYear(),
        fallbackDate.getMonth(),
        fallbackDate.getDate(),
        0, 0, 0, 0
      ).getTime();
    }
  }

  return 0;
}

function normalizeDateTimestamp(item) {
  if (!item) return item;
  return {
    ...item,
    dataTimestamp: parseDateToLocalMidnight(item.data, item.dataTimestamp),
  };
}

function normalizeProjectAllocationText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

function isUsableAllocationProject(value) {
  const normalized = normalizeProjectAllocationText(value);
  if (!normalized) return false;
  if (normalized.includes('ADMINISTRA')) return false;
  return ![
    'GRUPO OAE',
    'SEM PROJETO',
    'PROJETOS',
    'PROJETO',
    'PROJETOS GERAL',
    'PROJETOS GERAIS',
  ].includes(normalized);
}

function isProjectRevenueClassification(classification) {
  return classification?.type === 'receita_projeto' || classification?.type === 'receita_administrativa';
}

function enrichWithSystemAllocation(item, value) {
  const classification = classifyFinancialEntry(item);
  if (!isProjectRevenueClassification(classification)) return null;

  const allocation = splitProjectReceipt(value);
  return {
    ...item,
    valorReceitaProjetoTotal: allocation.total,
    valorDireto: allocation.project,
    valorAdministrativo: allocation.administrative,
    rateioAdministrativoPercentual: PROJECT_ADMIN_RATE * 100,
    rateioAdministrativoFonte: 'SISTEMA_20_PERCENT',
  };
}

export function consolidateFinancialData(baseData, options = {}) {
  const {
    filterProjetos = [],
    isProjetosPage = false,
    incluirRateioAdm = false,
    usarValorCaixa = false
  } = options;

  const normalizedBaseData = (baseData || []).map(normalizeDateTimestamp);
  const effectiveValue = (item) => {
    const status = String(item?.status || '').trim().toUpperCase();
    const realizedEntry = String(item?.natureza || '').toUpperCase() === 'ENTRADA'
      && (status.includes('REALIZADO') || status.includes('RECEBIDO') || status.includes('EFETIVADO'));
    if (usarValorCaixa && realizedEntry && item?.valorCaixa !== undefined && item?.valorCaixa !== null) {
      const cash = Number(item.valorCaixa);
      if (Number.isFinite(cash)) return cash;
    }
    return Number(item?.valor) || 0;
  };

  const isFiltroSomenteAdm = filterProjetos.length === 1 && filterProjetos[0].toUpperCase() === 'ADMINISTRAÇÃO';
  const isFiltroAdmPresente = filterProjetos.some(p => p.toUpperCase() === 'ADMINISTRAÇÃO');

  const consolidatedMap = new Map();
  const nonConsolidatable = [];

  normalizedBaseData.forEach(item => {
    if (item.natureza !== 'Entrada' || !item.lancamento) {
      const value = effectiveValue(item);
      const allocated = item.natureza === 'Entrada' ? enrichWithSystemAllocation(item, value) : null;

      if (isProjetosPage && item.natureza === 'Entrada') {
        if (!allocated) return;
        nonConsolidatable.push({
          ...allocated,
          valor: incluirRateioAdm ? allocated.valorReceitaProjetoTotal : allocated.valorDireto,
          valorBruto: item.valorBruto ?? item.valor,
        });
        return;
      }

      if (allocated) {
        nonConsolidatable.push({
          ...allocated,
          valor: value,
          valorBruto: item.valorBruto ?? item.valor,
        });
        return;
      }

      nonConsolidatable.push(usarValorCaixa
        ? { ...item, valorBruto: item.valorBruto ?? item.valor, valor: value }
        : item);
      return;
    }

    const statusKey = String(item.status || '').trim().toUpperCase();
    const dateKey = parseDateToLocalMidnight(item.data, item.dataTimestamp);
    const key = `${item.lancamento}|${statusKey}|${dateKey}`;

    if (!consolidatedMap.has(key)) {
      consolidatedMap.set(key, {
        ...item,
        valorReceitaProjetoTotal: 0,
        valorDireto: 0,
        valorAdministrativo: 0,
        valorOutrasEntradas: 0,
        valorFaturamentoReceitaTotal: 0,
        valorFaturamentoDireto: 0,
        valorFaturamentoAdministrativo: 0,
        valorFaturamentoOutrasEntradas: 0,
        valorFaturamentoTitulo: 0,
        linhasOriginais: [],
        centroCustoObra: null,
        temReceitaProjeto: false,
      });
    }

    const consItem = consolidatedMap.get(key);
    const value = effectiveValue(item);
    const rowForAudit = usarValorCaixa
      ? { ...item, valorBruto: item.valorBruto ?? item.valor, valor: value }
      : item;
    consItem.linhasOriginais.push(rowForAudit);

    const classification = classifyFinancialEntry(item);
    const faturamentoLinha = Number(item.valorFaturamento ?? item.valorTotalTitulo) || 0;

    if (isProjectRevenueClassification(classification)) {
      // REC. FATURAMENTO e REC. ADMINISTRATIVO apenas identificam que a linha
      // pertence ao recebimento do projeto. A divisao financeira nao vem mais
      // dessas contas: somamos o titulo e rateamos 20% pelo sistema depois.
      consItem.temReceitaProjeto = true;
      consItem.valorReceitaProjetoTotal += value;
      consItem.valorFaturamentoReceitaTotal += faturamentoLinha;

      if (isUsableAllocationProject(item.projeto)) {
        consItem.centroCustoObra = item.projeto;
      }
    } else {
      consItem.valorOutrasEntradas += value;
      consItem.valorFaturamentoOutrasEntradas += faturamentoLinha;
    }
  });

  const processedConsolidated = Array.from(consolidatedMap.values()).map(cons => {
    const receiptAllocation = splitProjectReceipt(cons.valorReceitaProjetoTotal);
    const billingAllocation = splitProjectReceipt(cons.valorFaturamentoReceitaTotal);

    cons.valorReceitaProjetoTotal = receiptAllocation.total;
    cons.valorDireto = receiptAllocation.project;
    cons.valorAdministrativo = receiptAllocation.administrative;
    cons.valorFaturamentoDireto = billingAllocation.project;
    cons.valorFaturamentoAdministrativo = billingAllocation.administrative;
    cons.valorFaturamentoTitulo = roundMoney(billingAllocation.total + cons.valorFaturamentoOutrasEntradas);
    cons.valorFaturamento = cons.valorFaturamentoTitulo;
    cons.valorTotalTitulo = cons.valorFaturamentoTitulo;
    cons.rateioAdministrativoPercentual = PROJECT_ADMIN_RATE * 100;
    cons.rateioAdministrativoFonte = cons.temReceitaProjeto ? 'SISTEMA_20_PERCENT' : null;

    const projectFromRows = cons.linhasOriginais.find((row) => isUsableAllocationProject(row.projeto))?.projeto;
    const ccFinal = cons.centroCustoObra || projectFromRows || cons.projeto || 'ADMINISTRAÇÃO';

    if (isProjetosPage) {
      if (!cons.temReceitaProjeto || receiptAllocation.total === 0) return null;
      return {
        ...cons,
        valor: incluirRateioAdm ? receiptAllocation.total : receiptAllocation.project,
        projeto: ccFinal,
        isConsolidated: true,
      };
    }

    if (isFiltroSomenteAdm && cons.temReceitaProjeto) {
      return {
        ...cons,
        valor: receiptAllocation.administrative,
        projeto: 'ADMINISTRAÇÃO',
        isConsolidated: true,
      };
    }

    if (isFiltroAdmPresente && cons.temReceitaProjeto && !filterProjetos.includes(ccFinal)) {
      return {
        ...cons,
        valor: receiptAllocation.administrative,
        projeto: 'ADMINISTRAÇÃO',
        isConsolidated: true,
      };
    }

    return {
      ...cons,
      valor: roundMoney(receiptAllocation.total + cons.valorOutrasEntradas),
      projeto: ccFinal,
      isConsolidated: true,
    };
  }).filter(Boolean);

  return [...nonConsolidatable, ...processedConsolidated].map(normalizeDateTimestamp);
}