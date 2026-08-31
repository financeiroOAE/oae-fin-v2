const fs = require('fs');

function replaceOnce(content, before, after, label) {
  if (!content.includes(before)) throw new Error(`Trecho nao encontrado: ${label}`);
  return content.replace(before, after);
}

const syncPath = 'src/lib/financialSync.js';
let sync = fs.readFileSync(syncPath, 'utf8');

const helperMarker = `function isRealizedEntry(row) {\n  if (String(row?.natureza || '').toUpperCase() !== 'ENTRADA') return false;\n  const status = String(row?.status || '').toUpperCase();\n  return status.includes('REALIZADO') || status.includes('RECEBIDO') || status.includes('EFETIVADO');\n}\n`;

const helperBlock = `${helperMarker}\nfunction isForecastRevenueEntry(row) {\n  if (String(row?.natureza || '').toUpperCase() !== 'ENTRADA') return false;\n  const code = String(row?.contaCodigo || '').replace(/\\D/g, '');\n  if (code !== '1010101' && code !== '1010107') return false;\n  const status = String(row?.status || '').toUpperCase();\n  const isRealized = status.includes('REALIZADO') || status.includes('RECEBIDO') || status.includes('EFETIVADO');\n  if (isRealized) return false;\n  return status.includes('A REALIZAR')\n    || status.includes('A RECEBER')\n    || status.includes('A PAGAR')\n    || status.includes('PREVISTO');\n}\n\nfunction forecastTitleKey(row, index) {\n  const lancamento = String(row?.lancamento || '').trim();\n  const status = String(row?.status || '').trim().toUpperCase();\n  const data = String(row?.data || '').trim();\n  if (lancamento) return `${lancamento}|${status}|${data}`;\n  const documento = String(row?.documento || '').trim();\n  const nome = String(row?.nome || '').trim();\n  if (documento) return `DOC:${documento}|${nome}|${status}|${data}`;\n  return `ROW:${index}`;\n}\n\nfunction distributeAmount(rows, total) {\n  if (!rows.length) return [];\n  const weights = rows.map((row) => Math.abs(Number(row.valorFaturamentoOriginal ?? row.valorFaturamento) || 0));\n  const weightTotal = weights.reduce((sum, value) => sum + value, 0);\n  let allocated = 0;\n  return rows.map((row, index) => {\n    const value = index === rows.length - 1\n      ? Math.round((total - allocated) * 100) / 100\n      : Math.round((total * (weightTotal > 0 ? weights[index] / weightTotal : 1 / rows.length)) * 100) / 100;\n    allocated += value;\n    return { ...row, valorFaturamento: value, valorTotalTitulo: value, valorBruto: value };\n  });\n}\n\nfunction normalizeForecastRevenueBilling(rows) {\n  const result = [...rows];\n  const groups = new Map();\n\n  rows.forEach((row, index) => {\n    if (!isForecastRevenueEntry(row)) return;\n    const key = forecastTitleKey(row, index);\n    if (!groups.has(key)) groups.set(key, []);\n    groups.get(key).push(index);\n  });\n\n  groups.forEach((indexes) => {\n    const groupRows = indexes.map((index) => ({ ...result[index], __index: index }));\n    const originals = groupRows.map((row) => Math.abs(Number(row.valorFaturamentoOriginal ?? row.valorFaturamento) || 0)).filter((value) => value > 0);\n    const titleValue = originals.length ? Math.max(...originals) : 0;\n    if (titleValue <= 0) return;\n\n    const direct = groupRows.filter((row) => String(row.contaCodigo || '').replace(/\\D/g, '') === '1010101');\n    const admin = groupRows.filter((row) => String(row.contaCodigo || '').replace(/\\D/g, '') === '1010107');\n\n    if (direct.length && admin.length) {\n      const directTotal = Math.round(titleValue * 0.8 * 100) / 100;\n      const adminTotal = Math.round((titleValue - directTotal) * 100) / 100;\n      distributeAmount(direct, directTotal).forEach((row) => {\n        result[row.__index] = { ...row, valorFaturamentoOriginal: Number(result[row.__index].valorFaturamentoOriginal ?? result[row.__index].valorFaturamento) || 0, previsaoFaturamentoFonte: 'TITULO_UNICO_80_20' };\n        delete result[row.__index].__index;\n      });\n      distributeAmount(admin, adminTotal).forEach((row) => {\n        result[row.__index] = { ...row, valorFaturamentoOriginal: Number(result[row.__index].valorFaturamentoOriginal ?? result[row.__index].valorFaturamento) || 0, previsaoFaturamentoFonte: 'TITULO_UNICO_80_20' };\n        delete result[row.__index].__index;\n      });\n      return;\n    }\n\n    const normalized = distributeAmount(groupRows, titleValue);\n    normalized.forEach((row) => {\n      result[row.__index] = { ...row, valorFaturamentoOriginal: Number(result[row.__index].valorFaturamentoOriginal ?? result[row.__index].valorFaturamento) || 0, previsaoFaturamentoFonte: 'TITULO_UNICO' };\n      delete result[row.__index].__index;\n    });\n  });\n\n  return result;\n}\n`;

if (!sync.includes('function normalizeForecastRevenueBilling')) {
  sync = replaceOnce(sync, helperMarker, helperBlock, 'helpers de previsao global');
}

const crBefore = `  const crProcessed = processSiengeData(crGeralRaw, 'CR_GERAL', deparaMap, projetos, planosMap).map((row) => ({\n    ...row,\n    valorCaixa: Number(row.valor) || 0,\n    recebimentoLiquidoFonte: 'CR_GERAL_K_VALOR',\n  }));`;

const crAfter = `  const crBase = processSiengeData(crGeralRaw, 'CR_GERAL', deparaMap, projetos, planosMap).map((row) => ({\n    ...row,\n    valorCaixa: Number(row.valor) || 0,\n    valorFaturamentoOriginal: Number(row.valorFaturamento) || 0,\n    recebimentoLiquidoFonte: 'CR_GERAL_K_VALOR',\n  }));\n  // Regra global da receita prevista: J do titulo entra uma unica vez.\n  // Quando existem 1010101 + 1010107, o titulo e distribuido 80/20.\n  // Realizados nao passam por esta normalizacao: J ja vem rateado na origem.\n  const crProcessed = normalizeForecastRevenueBilling(crBase);`;

sync = replaceOnce(sync, crBefore, crAfter, 'normalizacao global CR_GERAL');

sync = sync.replace('const CASH_LOGIC_VERSION = 5;', 'const CASH_LOGIC_VERSION = 6;');
sync = sync.replace(
  "rule: 'J=SOMA_FATURAMENTO_POR_TITULO;K=SOMA_LIQUIDO_RECEBIDO_POR_TITULO',",
  "rule: 'REALIZADO:J_SOMA_RATEIO;PREVISAO:J_TITULO_UNICO_80_20;K=LIQUIDO_RECEBIDO',"
);

fs.writeFileSync(syncPath, sync, 'utf8');

const routePath = 'src/app/api/sync/route.js';
let route = fs.readFileSync(routePath, 'utf8');
route = route.replace('const CASH_LOGIC_VERSION = 5;', 'const CASH_LOGIC_VERSION = 6;');
route = route.replace("'AUTO_REPAIR_CASH_V5'", "'AUTO_REPAIR_CASH_V6'");
fs.writeFileSync(routePath, route, 'utf8');

const businessPath = 'src/lib/businessRules.js';
let business = fs.readFileSync(businessPath, 'utf8');
business = business.replace(
  ` * Regra CR_GERAL (2026-08-31):\n * - coluna J / \"Valor total título\" = parcela faturada da linha; as linhas do mesmo título\n *   (ex.: 1010101 Faturamento + 1010107 Administrativo) devem ser SOMADAS para formar a nota/título;\n * - coluna K / \"Valor\" = parcela líquida efetivamente recebida/caixa da linha;\n * - J e K não devem ser deduplicados por MAX: a origem já separa Faturamento e Administrativo.`,
  ` * Regra CR_GERAL (2026-08-31):\n * - REALIZADO/RECEBIDO: coluna J já vem rateada por linha e deve ser somada;\n * - A RECEBER/A REALIZAR/PREVISTO: o valor integral de J pode repetir nas contas\n *   1010101/1010107; a sincronização normaliza o título uma única vez e distribui 80/20;\n * - coluna K / \"Valor\" = valor líquido efetivamente recebido/caixa e não é alterada por essa regra.`
);
fs.writeFileSync(businessPath, business, 'utf8');

console.log('Regra global aplicada: previsao de receita por titulo unico 80/20; realizado J somado; K preservado.');
