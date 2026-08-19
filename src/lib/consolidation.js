function parseDateToLocalMidnight(value, fallbackTimestamp) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0).getTime();
  }

  const raw = String(value ?? '').trim();

  if (raw) {
    // DD/MM/YYYY, inclusive quando o valor vier acompanhado de horário.
    let match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match) {
      const [, day, month, year] = match;
      return new Date(Number(year), Number(month) - 1, Number(day), 0, 0, 0, 0).getTime();
    }

    // YYYY-MM-DD / ISO.
    match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (match) {
      const [, year, month, day] = match;
      return new Date(Number(year), Number(month) - 1, Number(day), 0, 0, 0, 0).getTime();
    }

    // Serial de data do Google Sheets/Excel (base 1899-12-30).
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

export function consolidateFinancialData(baseData, options = {}) {
  const {
    filterProjetos = [],
    isProjetosPage = false,
    incluirRateioAdm = false
  } = options;

  const normalizedBaseData = (baseData || []).map(normalizeDateTimestamp);
  const isFiltroSomenteAdm = filterProjetos.length === 1 && filterProjetos[0].toUpperCase() === 'ADMINISTRAÇÃO';
  const isFiltroAdmPresente = filterProjetos.some(p => p.toUpperCase() === 'ADMINISTRAÇÃO');

  const consolidatedMap = new Map();
  const nonConsolidatable = [];

  normalizedBaseData.forEach(item => {
    if (item.natureza !== 'Entrada' || !item.lancamento) {
      nonConsolidatable.push(item);
      return;
    }

    // Group by both lancamento and status to preserve the distinction between Realizado and A Realizar
    const statusKey = String(item.status || '').trim().toUpperCase();
    const key = `${item.lancamento}|${statusKey}`;

    if (!consolidatedMap.has(key)) {
      consolidatedMap.set(key, {
        ...item,
        valorDireto: 0,
        valorAdministrativo: 0,
        linhasOriginais: [],
        centroCustoObra: null
      });
    }

    const consItem = consolidatedMap.get(key);
    consItem.linhasOriginais.push(item);

    const isAdm = item.projeto && item.projeto.toUpperCase().includes('ADMINISTRA');

    if (isAdm) {
      consItem.valorAdministrativo += item.valor;
    } else {
      consItem.valorDireto += item.valor;
      if (!consItem.centroCustoObra) {
        consItem.centroCustoObra = item.projeto;
      }
    }
  });

  const processedConsolidated = Array.from(consolidatedMap.values()).map(cons => {
    const ccFinal = cons.centroCustoObra || 'ADMINISTRAÇÃO';

    if (isProjetosPage) {
      return {
        ...cons,
        valor: cons.valorDireto + (incluirRateioAdm ? cons.valorAdministrativo : 0),
        projeto: ccFinal,
        isConsolidated: true
      };
    } else {
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
        valor: cons.valorDireto + cons.valorAdministrativo,
        projeto: ccFinal,
        isConsolidated: true
      };
    }
  });

  return [...nonConsolidatable, ...processedConsolidated].map(normalizeDateTimestamp);
}
