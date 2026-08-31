const fs = require('fs');

function replaceOnce(content, before, after, label) {
  if (!content.includes(before)) throw new Error(`Trecho nao encontrado: ${label}`);
  return content.replace(before, after);
}

// 1) Regra central da sincronizacao: toda receita prevista usa a coluna K.
const syncPath = 'src/lib/financialSync.js';
let sync = fs.readFileSync(syncPath, 'utf8');

const normalizeStart = sync.indexOf('function normalizeForecastRevenueBilling(rows) {');
const normalizeEnd = sync.indexOf('\nasync function performFullSync', normalizeStart);
if (normalizeStart < 0 || normalizeEnd < 0) throw new Error('Funcao de normalizacao da previsao nao encontrada.');

const normalizeFn = `function normalizeForecastRevenueBilling(rows) {\n  return (rows || []).map((row) => {\n    if (!isForecastRevenueEntry(row)) return row;\n\n    // Regra oficial: A RECEBER / A REALIZAR / PREVISTO usa sempre a coluna K.\n    // Mantemos o J original apenas para auditoria, mas todos os aliases de valor\n    // da previsao passam a apontar para K para impedir uso acidental de J.\n    const forecastValue = Number(row.valorCaixa ?? row.valor) || 0;\n    return {\n      ...row,\n      valorFaturamentoOriginal: Number(row.valorFaturamentoOriginal ?? row.valorFaturamento) || 0,\n      valorFaturamento: forecastValue,\n      valorTotalTitulo: forecastValue,\n      valorBruto: forecastValue,\n      previsaoFaturamentoFonte: 'CR_GERAL_K_VALOR',\n    };\n  });\n}\n`;

sync = sync.slice(0, normalizeStart) + normalizeFn + sync.slice(normalizeEnd);

sync = replaceOnce(
  sync,
  `  // Regra global da receita prevista: J do titulo entra uma unica vez.\n  // Quando existem 1010101 + 1010107, o titulo e distribuido 80/20.\n  // Realizados nao passam por esta normalizacao: J ja vem rateado na origem.\n  const crProcessed = normalizeForecastRevenueBilling(crBase);`,
  `  // Regra global da receita prevista: A RECEBER / A REALIZAR / PREVISTO usa K.\n  // J fica preservado somente em valorFaturamentoOriginal para auditoria.\n  const crProcessed = normalizeForecastRevenueBilling(crBase);`,
  'comentario da normalizacao global'
);

sync = replaceOnce(sync, 'const CASH_LOGIC_VERSION = 6;', 'const CASH_LOGIC_VERSION = 7;', 'versao financeira V7');
sync = replaceOnce(
  sync,
  "rule: 'REALIZADO:J_SOMA_RATEIO;PREVISAO:J_TITULO_UNICO_80_20;K=LIQUIDO_RECEBIDO',",
  "rule: 'REALIZADO:J_FATURAMENTO_K_CAIXA;PREVISAO:K_VALOR;A_RECEBER:K_VALOR',",
  'descricao da regra financeira'
);
fs.writeFileSync(syncPath, sync, 'utf8');

// 2) DRE: realizado pode usar J; previsao obrigatoriamente usa K.
const drePath = 'src/lib/dreEngine.js';
let dre = fs.readFileSync(drePath, 'utf8');

const dreBefore = `    // Receita Bruta da DRE = coluna J da CR_GERAL (Valor total titulo).\n    // Receita/Recebido operacional fora da DRE continua pela coluna K.\n    const valorBase = dreId === 'RECEITA_BRUTA' && item.natureza === 'Entrada'\n      ? (item.valorFaturamento ?? item.valorTotalTitulo ?? item.valor)\n      : item.valor;`;

const dreAfter = `    // Receita da DRE segue a mesma regra global do sistema:\n    // - REALIZADO/RECEBIDO: J representa o faturamento do realizado;\n    // - A RECEBER/A REALIZAR/PREVISTO: K e a fonte obrigatoria da previsao.\n    const statusUpper = String(item.status || '').toUpperCase();\n    const isRealizado = statusUpper.includes('REALIZADO')\n      || statusUpper.includes('RECEBIDO')\n      || statusUpper.includes('EFETIVADO');\n    const isPrevisto = !isRealizado && (\n      statusUpper.includes('A REALIZAR')\n      || statusUpper.includes('A RECEBER')\n      || statusUpper.includes('PREVISTO')\n    );\n    const valorBase = dreId === 'RECEITA_BRUTA' && item.natureza === 'Entrada'\n      ? (isPrevisto\n        ? (item.valorCaixa ?? item.valor)\n        : (item.valorFaturamentoOriginal ?? item.valorFaturamento ?? item.valorTotalTitulo ?? item.valor))\n      : item.valor;`;

dre = replaceOnce(dre, dreBefore, dreAfter, 'valor base da receita na DRE');
fs.writeFileSync(drePath, dre, 'utf8');

// 3) Forcar renovacao de snapshots para a nova regra.
const routePath = 'src/app/api/sync/route.js';
let route = fs.readFileSync(routePath, 'utf8');
route = replaceOnce(route, 'const CASH_LOGIC_VERSION = 6;', 'const CASH_LOGIC_VERSION = 7;', 'versao da rota V7');
route = replaceOnce(route, "'AUTO_REPAIR_CASH_V6'", "'AUTO_REPAIR_CASH_V7'", 'gatilho de reparo V7');
fs.writeFileSync(routePath, route, 'utf8');

// 4) Documentar a fonte oficial no processamento da CR_GERAL.
const businessPath = 'src/lib/businessRules.js';
let business = fs.readFileSync(businessPath, 'utf8');
const businessBefore = ` * Regra CR_GERAL (2026-08-31):\n * - REALIZADO/RECEBIDO: coluna J já vem rateada por linha e deve ser somada;\n * - A RECEBER/A REALIZAR/PREVISTO: o valor integral de J pode repetir nas contas\n *   1010101/1010107; a sincronização normaliza o título uma única vez e distribui 80/20;\n * - coluna K / \"Valor\" = valor líquido efetivamente recebido/caixa e não é alterada por essa regra.`;
const businessAfter = ` * Regra CR_GERAL (2026-08-31):\n * - REALIZADO/RECEBIDO: J permanece como referência de faturamento e K como caixa líquido;\n * - A RECEBER/A REALIZAR/PREVISTO: usar SEMPRE a coluna K / \"Valor\" em todo o sistema;\n * - a coluna J da previsão fica preservada apenas para auditoria e nunca compõe o valor previsto.`;
business = replaceOnce(business, businessBefore, businessAfter, 'documentacao CR_GERAL');
fs.writeFileSync(businessPath, business, 'utf8');

console.log('Regra V7 aplicada: toda receita A Receber/A Realizar/Prevista usa coluna K em todo o sistema.');
