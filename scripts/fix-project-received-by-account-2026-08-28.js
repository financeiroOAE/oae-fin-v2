const fs = require('fs');

const pagePath = 'src/app/projetos/page.js';
let page = fs.readFileSync(pagePath, 'utf8');

const before = `    return baseData.reduce((acc, item) => {\n      if (String(item?.natureza || '').toUpperCase() !== 'ENTRADA') return acc;\n\n      const status = String(item?.status || '').toUpperCase();\n      const isRealizado = status.includes('REALIZADO')\n        || status.includes('RECEBIDO')\n        || status.includes('EFETIVADO');\n      if (!isRealizado) return acc;\n\n      let ts = 0;\n      if (item.data) {\n        const parts = String(item.data).split('/');\n        if (parts.length === 3) ts = new Date(parts[2], parts[1] - 1, parts[0]).getTime();\n      }\n      if (ts < realizadoIni || ts > realizadoFim) return acc;\n\n      return acc + (Number(item.valor) || 0);\n    }, 0);\n  }, [hasProjectScopeFilter, filteredProjetos, incluirRateioAdm, baseData, realizadoIni, realizadoFim]);`;

const after = `    // No consolidado geral, somar diretamente as linhas originais da CR_GERAL.\n    // 1010101 = Rec. Faturamento; 1010107 = Rec. Administrativo.\n    // Para recebidos realizados, a fonte monetaria oficial e valorCaixa (coluna K).\n    return data.reduce((acc, item) => {\n      if (String(item?.natureza || '').toUpperCase() !== 'ENTRADA') return acc;\n\n      const status = String(item?.status || '').toUpperCase();\n      const isRealizado = status.includes('REALIZADO')\n        || status.includes('RECEBIDO')\n        || status.includes('EFETIVADO');\n      if (!isRealizado) return acc;\n\n      let ts = 0;\n      if (item.data) {\n        const parts = String(item.data).split('/');\n        if (parts.length === 3) ts = new Date(parts[2], parts[1] - 1, parts[0]).getTime();\n      }\n      if (ts < realizadoIni || ts > realizadoFim) return acc;\n\n      const classification = classifyFinancialEntry(item);\n      const isDirectRevenue = classification.type === 'receita_projeto';\n      const isAdministrativeRevenue = classification.type === 'receita_administrativa';\n      if (!isDirectRevenue && !(incluirRateioAdm && isAdministrativeRevenue)) return acc;\n\n      const cashValue = item?.valorCaixa !== undefined && item?.valorCaixa !== null\n        ? Number(item.valorCaixa)\n        : Number(item.valor);\n\n      return acc + (Number.isFinite(cashValue) ? cashValue : 0);\n    }, 0);\n  }, [hasProjectScopeFilter, filteredProjetos, incluirRateioAdm, data, realizadoIni, realizadoFim]);`;

if (!page.includes(before)) {
  throw new Error('Trecho do recebido liquido consolidado nao encontrado.');
}

page = page.replace(before, after);
fs.writeFileSync(pagePath, page, 'utf8');
console.log('Recebido de projetos ajustado para somar diretamente 1010101 e 1010107 da CR_GERAL.');
