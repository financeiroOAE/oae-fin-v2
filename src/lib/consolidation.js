export function consolidateFinancialData(baseData, options = {}) {
  const { 
    filterProjetos = [], 
    isProjetosPage = false, 
    incluirRateioAdm = false 
  } = options;

  const isFiltroSomenteAdm = filterProjetos.length === 1 && filterProjetos[0].toUpperCase() === 'ADMINISTRAÇÃO';
  const isFiltroAdmPresente = filterProjetos.some(p => p.toUpperCase() === 'ADMINISTRAÇÃO');

  const consolidatedMap = new Map();
  const nonConsolidatable = [];

  baseData.forEach(item => {
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

  return [...nonConsolidatable, ...processedConsolidated];
}
