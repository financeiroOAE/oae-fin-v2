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
    // O mesmo lançamento pode existir no fechamento de 31/12/2025 e voltar a
    // aparecer na realização de 2026. Sem a data na chave, a linha de 2026
    // herdava a data antiga e desaparecia do período selecionado.
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
      if (!consItem.centroCustoObra && item.projeto && !String(item.projeto).toUpperCase().includes('ADMINISTRA')) {
        consItem.centroCustoObra = item.projeto;
      }
    } else if (classification.type === 'receita_projeto') {
      consItem.valorDireto += value;
      if (item.projeto) consItem.centroCustoObra = item.projeto;
    } else {
      consItem.valorOutrasEntradas += value;
    }
  });

  // Para entradas realizadas, a coluna K representa o liquido do titulo.
  // Quando Projeto e ADM repetem o mesmo K no mesmo titulo, o caixa nao pode
  // ser somado duas vezes. Mantemos um unico liquido e distribuimos entre
  // Projeto/ADM conforme a composicao do titulo (coluna J como peso).
  if (usarValorCaixa) {
    consolidatedMap.forEach((cons) => {
      const status = String(cons.status || '').trim().toUpperCase();
      const isRealizado = status.includes('REALIZADO') || status.includes('RECEBIDO') || status.includes('EFETIVADO');
      if (!isRealizado || !Array.isArray(cons.linhasOriginais) || cons.linhasOriginais.length === 0) return;

      const revenueRows = cons.linhasOriginais
        .map((row) => ({ row, classification: classifyFinancialEntry(row) }))
        .filter(({ classification }) => classification.type === 'receita_projeto' || classification.type === 'receita_administrativa');
      if (revenueRows.length === 0) return;

      const liquidValues = revenueRows.map(({ row }) => Number(row.valorCaixa ?? row.valor) || 0);
      const nonZero = liquidValues.filter((value) => Math.abs(value) > 0.000001);
      if (nonZero.length === 0) return;

      const firstRounded = Math.round(nonZero[0] * 100) / 100;
      const allSame = nonZero.every((value) => Math.round(value * 100) / 100 === firstRounded);
      const titleLiquid = allSame
        ? firstRounded
        : Math.round(nonZero.reduce((sum, value) => sum + value, 0) * 100) / 100;

      const weighted = revenueRows.map(({ row, classification }) => {
        const faturamento = Math.abs(Number(row.valorFaturamento ?? row.valorTotalTitulo) || 0);
        const fallback = Math.abs(Number(row.valorCaixa ?? row.valor) || 0);
        return { classification, weight: faturamento > 0 ? faturamento : fallback };
      });
      const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
      if (totalWeight <= 0) return;

      const directWeight = weighted
        .filter((item) => item.classification.type === 'receita_projeto')
        .reduce((sum, item) => sum + item.weight, 0);
      const admWeight = weighted
        .filter((item) => item.classification.type === 'receita_administrativa')
        .reduce((sum, item) => sum + item.weight, 0);

      const directValue = Math.round((titleLiquid * (directWeight / totalWeight)) * 100) / 100;
      const admValue = Math.round((titleLiquid - directValue) * 100) / 100;

      cons.valorDireto = directValue;
      cons.valorAdministrativo = admWeight > 0 ? admValue : 0;
      cons.valorLiquidoTitulo = titleLiquid;
      cons.liquidoConsolidadoPorTitulo = revenueRows.length > 1;
    });
  }

  const processedConsolidated = Array.from(consolidatedMap.values()).map(cons => {
    const ccFinal = cons.centroCustoObra || cons.projeto || 'ADMINISTRAÇÃO';

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
