const fs = require('fs');

function replaceOnce(path, from, to, label) {
  const current = fs.readFileSync(path, 'utf8');
  if (!current.includes(from)) throw new Error(`[${label}] trecho nao encontrado em ${path}`);
  const next = current.replace(from, to);
  fs.writeFileSync(path, next);
  console.log(`OK: ${label}`);
}

function insertBeforeOnce(path, marker, text, label) {
  const current = fs.readFileSync(path, 'utf8');
  if (!current.includes(marker)) throw new Error(`[${label}] marcador nao encontrado em ${path}`);
  fs.writeFileSync(path, current.replace(marker, `${text}${marker}`));
  console.log(`OK: ${label}`);
}

const receiptsSheetId = '144w55s4bDTJingPhw1Dm0mxViGmF0G649I23cYEa8Jk';

replaceOnce(
  'src/lib/googleSheets.js',
  "import { google } from 'googleapis';\n",
  `import { google } from 'googleapis';\n\nconst RECEIPTS_SPREADSHEET_ID = process.env.GOOGLE_RECEIPTS_SPREADSHEET_ID || '${receiptsSheetId}';\n`,
  'googleSheets: id da fonte liquida'
);
replaceOnce(
  'src/lib/googleSheets.js',
  "    CR_GERAL: [],\n    DEPARA: []\n",
  "    CR_GERAL: [],\n    DEPARA: [],\n    RECEBIMENTOS_2026: []\n",
  'googleSheets: chave recebimentos'
);
insertBeforeOnce(
  'src/lib/googleSheets.js',
  '    return resultData;\n',
  `    // Fonte auxiliar privada: valores efetivamente creditados por titulo.\n    // Falha nessa leitura nao derruba a base principal; nesse caso o sistema\n    // mantem o valor do CR_GERAL como fallback de caixa.\n    try {\n      const receiptResponse = await sheets.spreadsheets.values.get({\n        spreadsheetId: RECEIPTS_SPREADSHEET_ID,\n        range: 'RECEBIMENTOS_2026!A:G',\n        valueRenderOption: 'UNFORMATTED_VALUE',\n        dateTimeRenderOption: 'FORMATTED_STRING',\n        majorDimension: 'ROWS'\n      });\n\n      const values = receiptResponse.data.values || [];\n      const headers = values.length > 0 ? values[0].map(normalizeHeader) : [];\n      resultData.RECEBIMENTOS_2026 = values.slice(1).map((row) => {\n        const rowData = {};\n        headers.forEach((header, index) => {\n          if (!header) return;\n          rowData[header] = row[index] ?? '';\n        });\n        return rowData;\n      });\n\n      console.log(\`[Google Sheets Diagnostic] RECEBIMENTOS_2026: \${resultData.RECEBIMENTOS_2026.length} titulos\`);\n    } catch (receiptError) {\n      console.warn('[Google Sheets Diagnostic] Fonte de recebimentos liquidos indisponivel:', receiptError?.message || receiptError);\n      resultData.RECEBIMENTOS_2026 = [];\n    }\n\n`,
  'googleSheets: leitura da fonte liquida'
);

insertBeforeOnce(
  'src/lib/financialSync.js',
  'async function performFullSync(triggeredBy) {\n',
  `function normalizeReceiptTitle(value) {\n  const raw = String(value ?? '').trim();\n  if (!raw) return '';\n  const direct = raw.match(/^(\\d+)(?:\\/\\d+)?$/);\n  if (direct) return direct[1];\n  const leading = raw.match(/^(\\d+)/);\n  return leading?.[1] || '';\n}\n\nfunction normalizeReceiptDocument(value) {\n  return String(value || '')\n    .normalize('NFD')\n    .replace(/[\\u0300-\\u036f]/g, '')\n    .toUpperCase()\n    .replace(/[^A-Z0-9]/g, '');\n}\n\nfunction parseReceiptValue(value) {\n  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;\n  const raw = String(value ?? '').trim();\n  if (!raw) return 0;\n  const cleaned = raw.replace(/R\\$/gi, '').replace(/\\s/g, '');\n  if (cleaned.includes(',')) {\n    const parsed = Number(cleaned.replace(/\\./g, '').replace(',', '.'));\n    return Number.isFinite(parsed) ? parsed : 0;\n  }\n  const parsed = Number(cleaned);\n  return Number.isFinite(parsed) ? parsed : 0;\n}\n\nfunction isRealized2026Entry(row) {\n  if (String(row?.natureza || '').toUpperCase() !== 'ENTRADA') return false;\n  if (!String(row?.status || '').toUpperCase().includes('REALIZADO')) return false;\n  const date = String(row?.data || '').trim();\n  return /(?:^|\\/)2026$/.test(date);\n}\n\nfunction enrichCashReceived(crRows, receiptRows) {\n  const receipts = [];\n  const byTitle = new Map();\n  const byDocument = new Map();\n\n  (receiptRows || []).forEach((row, index) => {\n    const title = normalizeReceiptTitle(row['Título'] ?? row.Titulo);\n    const document = normalizeReceiptDocument(row.Documento);\n    const net = parseReceiptValue(row['Vl Recebido']);\n    if (!title && !document) return;\n    const receipt = {\n      id: title ? \`T:\${title}\` : \`D:\${document}:\${index}\`,\n      title,\n      document,\n      net,\n      gross: parseReceiptValue(row['Vl. baixa'] ?? row['Vl, baixa']),\n      discount: parseReceiptValue(row.Desconto),\n    };\n    receipts.push(receipt);\n    if (title) byTitle.set(title, receipt);\n    if (document) byDocument.set(document, receipt);\n  });\n\n  const groups = new Map();\n  crRows.forEach((row) => {\n    if (!isRealized2026Entry(row)) return;\n    const title = normalizeReceiptTitle(row.lancamento);\n    const document = normalizeReceiptDocument(row.documento);\n    const receipt = (title && byTitle.get(title)) || (document && byDocument.get(document));\n    if (!receipt) return;\n    if (!groups.has(receipt.id)) groups.set(receipt.id, { receipt, rows: [] });\n    groups.get(receipt.id).rows.push(row);\n  });\n\n  const cashByRow = new Map();\n  let matchedNet = 0;\n  let matchedGross = 0;\n  let matchedRows = 0;\n\n  groups.forEach(({ receipt, rows }) => {\n    const totalGroup = rows.reduce((sum, row) => sum + Math.max(0, Number(row.valor) || 0), 0);\n    if (totalGroup <= 0) return;\n    let remaining = Math.round(receipt.net * 100) / 100;\n    rows.forEach((row, index) => {\n      let allocated;\n      if (index === rows.length - 1) {\n        allocated = remaining;\n      } else {\n        allocated = Math.round((receipt.net * ((Number(row.valor) || 0) / totalGroup)) * 100) / 100;\n        remaining = Math.round((remaining - allocated) * 100) / 100;\n      }\n      cashByRow.set(row, allocated);\n      matchedRows += 1;\n    });\n    matchedNet += receipt.net;\n    matchedGross += receipt.gross;\n  });\n\n  const rows = crRows.map((row) => {\n    const gross = Number(row.valor) || 0;\n    const matched = cashByRow.has(row);\n    return {\n      ...row,\n      valorBruto: gross,\n      valorCaixa: matched ? cashByRow.get(row) : gross,\n      recebimentoLiquidoFonte: matched ? 'RECEBIMENTOS_2026' : 'CR_GERAL',\n    };\n  });\n\n  return {\n    rows,\n    stats: {\n      sourceTitles: receipts.length,\n      matchedTitles: groups.size,\n      matchedRows,\n      matchedGross: Math.round(matchedGross * 100) / 100,\n      matchedNet: Math.round(matchedNet * 100) / 100,\n      sourceNet: Math.round(receipts.reduce((sum, item) => sum + item.net, 0) * 100) / 100,\n      sourceDiscount: Math.round(receipts.reduce((sum, item) => sum + item.discount, 0) * 100) / 100,\n    },\n  };\n}\n\n`,
  'financialSync: funcoes de valor liquido'
);
replaceOnce(
  'src/lib/financialSync.js',
  "  const crGeralRaw = sheetsData.CR_GERAL || [];\n  const depara = sheetsData.DEPARA || [];\n",
  "  const crGeralRaw = sheetsData.CR_GERAL || [];\n  const recebimentosRaw = sheetsData.RECEBIMENTOS_2026 || [];\n  const depara = sheetsData.DEPARA || [];\n",
  'financialSync: captura recebimentos'
);
replaceOnce(
  'src/lib/financialSync.js',
  "  const cpProcessed = processSiengeData(cpGeralRaw, 'CP_GERAL', deparaMap, projetos, planosMap);\n  const crProcessed = processSiengeData(crGeralRaw, 'CR_GERAL', deparaMap, projetos, planosMap);\n",
  "  const cpProcessed = processSiengeData(cpGeralRaw, 'CP_GERAL', deparaMap, projetos, planosMap);\n  const crProcessedBase = processSiengeData(crGeralRaw, 'CR_GERAL', deparaMap, projetos, planosMap);\n  const { rows: crProcessed, stats: recebimentosLiquidosStats } = enrichCashReceived(crProcessedBase, recebimentosRaw);\n",
  'financialSync: enriquece CR com caixa liquido'
);
replaceOnce(
  'src/lib/financialSync.js',
  "    CR_GERAL: crProcessed.length,\n    DEPARA: depara.length,\n",
  "    CR_GERAL: crProcessed.length,\n    DEPARA: depara.length,\n    RECEBIMENTOS_2026: recebimentosRaw.length,\n",
  'financialSync: estatistica da fonte liquida'
);
replaceOnce(
  'src/lib/financialSync.js',
  "  const somaCR = crProcessed.reduce((acc, row) => acc + row.valor, 0);\n",
  "  const somaCR = crProcessed.reduce((acc, row) => acc + row.valor, 0);\n  const somaCRCaixa = crProcessed.reduce((acc, row) => acc + (Number(row.valorCaixa) || 0), 0);\n",
  'financialSync: soma caixa'
);
replaceOnce(
  'src/lib/financialSync.js',
  "  console.log(`Soma de CR_GERAL.Valor (Entradas): ${somaCR}`);\n",
  "  console.log(`Soma de CR_GERAL.Valor (Entradas brutas): ${somaCR}`);\n  console.log(`Soma de CR_GERAL.valorCaixa (Entradas liquidas/fallback): ${somaCRCaixa}`);\n  console.log(`Recebimentos liquidos conciliados: ${JSON.stringify(recebimentosLiquidosStats)}`);\n",
  'financialSync: diagnostico liquido'
);
replaceOnce(
  'src/lib/financialSync.js',
  "    somaProjetosSaldo,\n    recordsCount: totalRecords,\n",
  "    somaProjetosSaldo,\n    recebimentosLiquidosStats,\n    recordsCount: totalRecords,\n",
  'financialSync: payload da conciliacao'
);

replaceOnce(
  'src/lib/consolidation.js',
  `function projectRevenueValue(item, incluirRateioAdm) {\n  const classification = classifyFinancialEntry(item);\n  if (classification.type === 'receita_projeto') return Number(item.valor) || 0;\n  if (classification.type === 'receita_administrativa' && incluirRateioAdm) return Number(item.valor) || 0;\n  return 0;\n}\n`,
  `function projectRevenueValue(item, incluirRateioAdm, valueOverride = null) {\n  const classification = classifyFinancialEntry(item);\n  const value = valueOverride === null ? (Number(item.valor) || 0) : valueOverride;\n  if (classification.type === 'receita_projeto') return value;\n  if (classification.type === 'receita_administrativa' && incluirRateioAdm) return value;\n  return 0;\n}\n`,
  'consolidation: project revenue efetivo'
);
replaceOnce(
  'src/lib/consolidation.js',
  "    isProjetosPage = false,\n    incluirRateioAdm = false\n",
  "    isProjetosPage = false,\n    incluirRateioAdm = false,\n    usarValorCaixa = false\n",
  'consolidation: opcao valor caixa'
);
replaceOnce(
  'src/lib/consolidation.js',
  "  const normalizedBaseData = (baseData || []).map(normalizeDateTimestamp);\n",
  `  const normalizedBaseData = (baseData || []).map(normalizeDateTimestamp);\n  const effectiveValue = (item) => {\n    const status = String(item?.status || '').trim().toUpperCase();\n    const realizedEntry = String(item?.natureza || '').toUpperCase() === 'ENTRADA'\n      && (status.includes('REALIZADO') || status.includes('RECEBIDO') || status.includes('EFETIVADO'));\n    if (usarValorCaixa && realizedEntry && item?.valorCaixa !== undefined && item?.valorCaixa !== null) {\n      const cash = Number(item.valorCaixa);\n      if (Number.isFinite(cash)) return cash;\n    }\n    return Number(item?.valor) || 0;\n  };\n`,
  'consolidation: helper caixa'
);
replaceOnce(
  'src/lib/consolidation.js',
  "        const value = projectRevenueValue(item, incluirRateioAdm);\n",
  "        const value = projectRevenueValue(item, incluirRateioAdm, effectiveValue(item));\n",
  'consolidation: nao consolidavel projeto'
);
replaceOnce(
  'src/lib/consolidation.js',
  "      nonConsolidatable.push(item);\n      return;\n",
  "      nonConsolidatable.push(usarValorCaixa ? { ...item, valorBruto: item.valorBruto ?? item.valor, valor: effectiveValue(item) } : item);\n      return;\n",
  'consolidation: nao consolidavel caixa'
);
replaceOnce(
  'src/lib/consolidation.js',
  "    consItem.linhasOriginais.push(item);\n",
  "    consItem.linhasOriginais.push(usarValorCaixa ? { ...item, valorBruto: item.valorBruto ?? item.valor, valor: effectiveValue(item) } : item);\n",
  'consolidation: linhas originais caixa'
);
replaceOnce(
  'src/lib/consolidation.js',
  "    const value = Number(item.valor) || 0;\n",
  "    const value = effectiveValue(item);\n",
  'consolidation: acumulacao caixa'
);

replaceOnce(
  'src/app/visao-financeira/page.js',
  `    return consolidateFinancialData(rawBaseData, {\n      filterProjetos,\n      isProjetosPage: false\n    });\n`,
  `    return consolidateFinancialData(rawBaseData, {\n      filterProjetos,\n      isProjetosPage: false,\n      usarValorCaixa: true\n    });\n`,
  'visao financeira: recebido liquido'
);
replaceOnce(
  'src/app/fluxo-caixa/page.js',
  `    return consolidateFinancialData(rawBaseData, {\n      filterProjetos,\n      isProjetosPage: false\n    });\n`,
  `    return consolidateFinancialData(rawBaseData, {\n      filterProjetos,\n      isProjetosPage: false,\n      usarValorCaixa: true\n    });\n`,
  'fluxo: recebido liquido'
);

replaceOnce(
  'src/app/projetos/page.js',
  `  const projectCashData = useMemo(() => consolidateFinancialData(data, {\n    isProjetosPage: true,\n    incluirRateioAdm: true\n  }), [data]);\n\n  const baseData = useMemo(() => consolidateFinancialData(data, {\n    isProjetosPage: true,\n    incluirRateioAdm\n  }), [data, incluirRateioAdm]);\n`,
  `  const projectCashData = useMemo(() => consolidateFinancialData(data, {\n    isProjetosPage: true,\n    incluirRateioAdm: true,\n    usarValorCaixa: true\n  }), [data]);\n\n  const baseData = useMemo(() => consolidateFinancialData(data, {\n    isProjetosPage: true,\n    incluirRateioAdm,\n    usarValorCaixa: true\n  }), [data, incluirRateioAdm]);\n`,
  'projetos: bases de caixa liquidas'
);
replaceOnce(
  'src/app/projetos/page.js',
  "      const value = Number(item.valor) || 0;\n\n      let ts = 0;\n",
  "      const value = isRealizado ? (Number(item.valorCaixa ?? item.valor) || 0) : (Number(item.valor) || 0);\n\n      let ts = 0;\n",
  'projetos: raw recebido liquido'
);
replaceOnce(
  'src/app/projetos/page.js',
  "    const receitaConsolidada = consolidateFinancialData(data, { isProjetosPage: true, incluirRateioAdm });\n",
  "    const receitaConsolidada = consolidateFinancialData(data, { isProjetosPage: true, incluirRateioAdm, usarValorCaixa: true });\n",
  'projetos: receita consolidada caixa'
);
replaceOnce(
  'src/app/projetos/page.js',
  "        return (code === '1010101' || code === '1010107') ? sum + (Number(row.valor) || 0) : sum;\n",
  "        return (code === '1010101' || code === '1010107') ? sum + (Number(row.valorCaixa ?? row.valor) || 0) : sum;\n",
  'projetos: serie mensal recebida liquida'
);

insertBeforeOnce(
  'src/app/api/sync/route.js',
  'export async function GET(request) {\n',
  `function snapshotNeedsCashRepair(payload) {\n  if (!Array.isArray(payload?.data)) return false;\n  return payload.data.some((item) => {\n    if (String(item?.natureza || '').toUpperCase() !== 'ENTRADA') return false;\n    if (!String(item?.status || '').toUpperCase().includes('REALIZADO')) return false;\n    if (!String(item?.data || '').endsWith('/2026')) return false;\n    return item?.valorCaixa === undefined || item?.valorCaixa === null || !Number.isFinite(Number(item.valorCaixa));\n  });\n}\n\n`,
  'sync api: detector snapshot sem caixa'
);
replaceOnce(
  'src/app/api/sync/route.js',
  "    const requiresRepair = snapshotNeedsProjectRepair(snapshot?.payload);\n    const scheduledDue = !force && !requiresRepair && isDailySyncDue(snapshot?.updatedAt);\n",
  "    const requiresProjectRepair = snapshotNeedsProjectRepair(snapshot?.payload);\n    const requiresCashRepair = snapshotNeedsCashRepair(snapshot?.payload);\n    const requiresRepair = requiresProjectRepair || requiresCashRepair;\n    const scheduledDue = !force && !requiresRepair && isDailySyncDue(snapshot?.updatedAt);\n",
  'sync api: combina reparos'
);
replaceOnce(
  'src/app/api/sync/route.js',
  "      const triggeredBy = force ? username : requiresRepair ? 'AUTO_REPAIR_PROJECTS' : 'AUTO_16:30';\n",
  "      const triggeredBy = force ? username : requiresCashRepair ? 'AUTO_REPAIR_CASH' : requiresProjectRepair ? 'AUTO_REPAIR_PROJECTS' : 'AUTO_16:30';\n",
  'sync api: origem reparo caixa'
);

console.log('Aplicacao concluida: recebido usa valorCaixa apenas nas telas de caixa/projetos; DRE permanece bruta.');
