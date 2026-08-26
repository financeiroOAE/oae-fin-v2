import { classifyFinancialEntry } from '@/lib/financialClassification';

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

function projectRevenueValue(item, incluirRateioAdm, valueOverride = null) {
  const classification = classifyFinancialEntry(item);
  const value = valueOverride === null ? (Number(item.valor) || 0) : valueOverride;
  if (classification.type === 'receita_projeto') return value;
  if (classification.type === 'receita_administrativa' && incluirRateioAdm) return value;
  return 0;
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
      if (isProjetosPage && item.natureza === 'Entrada') {
        const value = projectRevenueValue(item, incluirRateioAdm, effectiveValue(item));
        if (value === 0) return;
        nonConsolidatable.push({ ...item, valor: value });
        return;
      }
      nonConsolidatable.push(usarValorCaixa ? { ...item, valorBruto: item.valorBruto ?? item.valor, valor: effectiveValue(item) } : item);
      return;
    }

    const statusKey = String(item.status || '').trim().toUpperCase();
    const dateKey = parseDateToLocalMidnight(item.data, item.dataTimestamp);
    const key = `${item.lancamento}|${statusKey}|${dateKey}`;

    if (!consolidatedMap.has(key)) {
      consolidatedMap.set(key, {
        ...item,
        valorDireto: 0,
        valorAdministrativo: 0,
        valorOutrasEntradas: 0,
        linhasOriginais: [],
        centroCustoObra: null
      });
    }

    const consItem = consolidatedMap.get(key);
    consItem.linhasOriginais.push(usarValorCaixa ? { ...item, valorBruto: item.valorBruto ?? item.valor, valor: effectiveValue(item) } : item);

    const classification = classifyFinancialEntry(item);
    const value = effectiveValue(item);

    if (classification.type === 'receita_administrativa') {
      consItem.valorAdministrativo += value;
      // A linha ADM pode carregar o projeto real do titulo. Ela deve servir de
      // vinculo quando a outra linha estiver em GRUPO OAE / SEM PROJETO.
      if (!consItem.centroCustoObra && isUsableAllocationProject(item.projeto)) {
        consItem.centroCustoObra = item.projeto;
      }
    } else if (classification.type === 'receita_projeto') {
      consItem.valorDireto += value;
      // Nunca deixe um centro generico bloquear um projeto valido encontrado
      // em outra linha do mesmo titulo.
      if (isUsableAllocationProject(item.projeto)) {
        consItem.centroCustoObra = item.projeto;
      }
    } else {
      consItem.valorOutrasEntradas += value;
    }
  });

  const processedConsolidated = Array.from(consolidatedMap.values()).map(cons => {
    const projectFromRows = cons.linhasOriginais.find((row) => isUsableAllocationProject(row.projeto))?.projeto;
    const ccFinal = cons.centroCustoObra || projectFromRows || cons.projeto || 'ADMINISTRAÇÃO';

    if (isProjetosPage) {
      const projectValue = cons.valorDireto + (incluirRateioAdm ? cons.valorAdministrativo : 0);
      if (projectValue === 0) return null;
      return {
        ...cons,
        valor: projectValue,
        projeto: ccFinal,
        isConsolidated: true
      };
    }

    if (isFiltroSomenteAdm) {
      return {
        ...cons,
        valor: cons.valorAdministrativo,
        projeto: 'ADMINISTRAÇÃO',
        isConsolidated: true
      };
    }

    if (isFiltroAdmPresente && !filterProjetos.includes(ccFinal)) {
      return {
        ...cons,
        valor: cons.valorAdministrativo,
        projeto: 'ADMINISTRAÇÃO',
        isConsolidated: true
      };
    }

    return {
      ...cons,
      valor: cons.valorDireto + cons.valorAdministrativo + cons.valorOutrasEntradas,
      projeto: ccFinal,
      isConsolidated: true
    };
  }).filter(Boolean);

  return [...nonConsolidatable, ...processedConsolidated].map(normalizeDateTimestamp);
}
