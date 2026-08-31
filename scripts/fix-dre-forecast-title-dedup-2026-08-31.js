const fs = require('fs');

const file = 'src/lib/dreEngine.js';
let src = fs.readFileSync(file, 'utf8');

if (src.includes('function normalizeDreForecastRevenue')) {
  console.log('Regra de previsao da DRE ja aplicada.');
  process.exit(0);
}

const motorMarker = '// ─── Motor principal ──────────────────────────────────────────────────────────';
if (!src.includes(motorMarker)) {
  throw new Error('Marcador do motor principal da DRE nao encontrado.');
}

const helper = `// ─── Receita prevista da DRE ──────────────────────────────────────────────────\n// Regra exclusiva da DRE:\n// - realizado/recebido: J ja vem rateado por conta e deve ser somado linha a linha;\n// - a receber/a realizar/previsto: J ainda pode repetir o valor integral do titulo\n//   nas contas 1010101 e 1010107, portanto o titulo entra uma unica vez;\n// - quando as duas contas existem na previsao, mantemos a leitura gerencial\n//   80% Faturamento / 20% Administrativo sem duplicar a Receita Bruta.\nfunction dreStatusFlags(item) {\n  const status = String(item?.status || '').trim().toUpperCase();\n  const isRealizado = status.includes('REALIZADO')\n    || status.includes('RECEBIDO')\n    || status.includes('PAGO')\n    || status === 'EFETIVADO';\n  const isPrevisto = !isRealizado && (\n    status.includes('A REALIZAR')\n    || status.includes('A RECEBER')\n    || status.includes('A PAGAR')\n    || status.includes('PREVISTO')\n  );\n  return { status, isRealizado, isPrevisto };\n}\n\nfunction isForecastProjectRevenue(item) {\n  if (String(item?.natureza || '').toUpperCase() !== 'ENTRADA') return false;\n  const code = normalizeAccountCode(item);\n  if (code !== '1010101' && code !== '1010107') return false;\n  return dreStatusFlags(item).isPrevisto;\n}\n\nfunction forecastBillingValue(item) {\n  return Math.abs(Number(item?.valorFaturamento ?? item?.valorTotalTitulo ?? item?.valor) || 0);\n}\n\nfunction forecastTitleKey(item, fallbackKey) {\n  const lancamento = String(item?.lancamento || '').trim();\n  const status = String(item?.status || '').trim().toUpperCase();\n  const data = String(item?.data || '').trim();\n  if (lancamento) return \\`\\${lancamento}|\\${status}|\\${data}\\`;\n\n  const documento = String(item?.documento || '').trim();\n  const nome = String(item?.nome || '').trim();\n  if (documento) return \\`DOC:|\\${documento}|\\${nome}|\\${status}|\\${data}\\`;\n\n  return \\`ROW:|\\${fallbackKey}\\`;\n}\n\nfunction withDreForecastBilling(item, value, rule) {\n  const rounded = Math.round((Number(value) || 0) * 100) / 100;\n  return {\n    ...item,\n    valorFaturamento: rounded,\n    valorTotalTitulo: rounded,\n    dreForecastBillingRule: rule,\n  };\n}\n\nfunction normalizeDreForecastRevenue(items) {\n  const passthrough = [];\n  const forecastRows = [];\n\n  (items || []).forEach((item, itemIndex) => {\n    if (!isForecastProjectRevenue(item)) {\n      passthrough.push(item);\n      return;\n    }\n\n    const originalRows = Array.isArray(item?.linhasOriginais)\n      ? item.linhasOriginais.filter(isForecastProjectRevenue)\n      : [];\n    const sourceRows = originalRows.length > 0 ? originalRows : [item];\n\n    sourceRows.forEach((row, rowIndex) => {\n      forecastRows.push({\n        ...row,\n        projeto: item.projeto || row.projeto,\n        data: item.data || row.data,\n        status: item.status || row.status,\n        lancamento: row.lancamento || item.lancamento,\n        documento: row.documento || item.documento,\n        nome: row.nome || item.nome,\n        mesKey: item.mesKey || row.mesKey,\n        __dreForecastFallbackKey: \\`\\${itemIndex}:\\${rowIndex}\\`,\n      });\n    });\n  });\n\n  const byTitle = new Map();\n  forecastRows.forEach((row) => {\n    const key = forecastTitleKey(row, row.__dreForecastFallbackKey);\n    if (!byTitle.has(key)) byTitle.set(key, []);\n    byTitle.get(key).push(row);\n  });\n\n  const normalizedForecast = [];\n  byTitle.forEach((rows) => {\n    const directRows = rows.filter((row) => normalizeAccountCode(row) === '1010101');\n    const adminRows = rows.filter((row) => normalizeAccountCode(row) === '1010107');\n    const values = rows.map(forecastBillingValue).filter((value) => value > 0);\n    const titleValue = values.length > 0 ? Math.max(...values) : 0;\n\n    if (directRows.length > 0 && adminRows.length > 0) {\n      const directValue = Math.round(titleValue * 0.8 * 100) / 100;\n      const adminValue = Math.round((titleValue - directValue) * 100) / 100;\n      normalizedForecast.push(withDreForecastBilling(directRows[0], directValue, 'PREVISAO_TITULO_UNICO_80_20'));\n      normalizedForecast.push(withDreForecastBilling(adminRows[0], adminValue, 'PREVISAO_TITULO_UNICO_80_20'));\n      return;\n    }\n\n    const representative = directRows[0] || adminRows[0] || rows[0];\n    if (representative) {\n      normalizedForecast.push(withDreForecastBilling(representative, titleValue, 'PREVISAO_TITULO_UNICO'));\n    }\n  });\n\n  return [...passthrough, ...normalizedForecast];\n}\n\n`;

src = src.replace(motorMarker, helper + motorMarker);

const functionStart = 'export function buildDreStructure(items, meses) {\n';
if (!src.includes(functionStart)) {
  throw new Error('Inicio de buildDreStructure nao encontrado.');
}
src = src.replace(
  functionStart,
  functionStart + '  const dreItems = normalizeDreForecastRevenue(items);\n'
);

const loop = '  items.forEach(item => {\n';
if (!src.includes(loop)) {
  throw new Error('Loop principal de itens da DRE nao encontrado.');
}
src = src.replace(loop, '  dreItems.forEach(item => {\n');

fs.writeFileSync(file, src, 'utf8');
console.log('DRE corrigida: realizado soma J rateado; previsao deduplica titulo e preserva 80/20.');
