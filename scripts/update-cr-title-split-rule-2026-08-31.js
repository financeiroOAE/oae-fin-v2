const fs = require('fs');

function replaceOnce(content, before, after, label) {
  if (!content.includes(before)) throw new Error(`Trecho nao encontrado: ${label}`);
  return content.replace(before, after);
}

// 1) Documentar a nova fonte: J e K ja chegam rateados por conta.
const businessPath = 'src/lib/businessRules.js';
let business = fs.readFileSync(businessPath, 'utf8');
business = replaceOnce(
  business,
  ` * Regra CR_GERAL (2026-08-26):\n * - coluna J / \"Valor total título\" = faturamento;\n * - coluna K / \"Valor\" = valor líquido efetivamente recebido/caixa.`,
  ` * Regra CR_GERAL (2026-08-31):\n * - coluna J / \"Valor total título\" = parcela faturada da linha; as linhas do mesmo título\n *   (ex.: 1010101 Faturamento + 1010107 Administrativo) devem ser SOMADAS para formar a nota/título;\n * - coluna K / \"Valor\" = parcela líquida efetivamente recebida/caixa da linha;\n * - J e K não devem ser deduplicados por MAX: a origem já separa Faturamento e Administrativo.`,
  'documentacao CR_GERAL'
);
fs.writeFileSync(businessPath, business, 'utf8');

// 2) Consolidar também o faturamento J por título, preservando o rateio por conta.
const consolidationPath = 'src/lib/consolidation.js';
let consolidation = fs.readFileSync(consolidationPath, 'utf8');

consolidation = replaceOnce(
  consolidation,
  `        valorDireto: 0,\n        valorAdministrativo: 0,\n        valorOutrasEntradas: 0,\n        linhasOriginais: [],`,
  `        valorDireto: 0,\n        valorAdministrativo: 0,\n        valorOutrasEntradas: 0,\n        valorFaturamentoDireto: 0,\n        valorFaturamentoAdministrativo: 0,\n        valorFaturamentoOutrasEntradas: 0,\n        valorFaturamentoTitulo: 0,\n        linhasOriginais: [],`,
  'campos de faturamento consolidado'
);

consolidation = replaceOnce(
  consolidation,
  `    const classification = classifyFinancialEntry(item);\n    const value = effectiveValue(item);\n\n    if (classification.type === 'receita_administrativa') {\n      consItem.valorAdministrativo += value;`,
  `    const classification = classifyFinancialEntry(item);\n    const value = effectiveValue(item);\n    const faturamentoLinha = Number(item.valorFaturamento ?? item.valorTotalTitulo) || 0;\n    consItem.valorFaturamentoTitulo += faturamentoLinha;\n\n    if (classification.type === 'receita_administrativa') {\n      consItem.valorAdministrativo += value;\n      consItem.valorFaturamentoAdministrativo += faturamentoLinha;`,
  'faturamento administrativo'
);

consolidation = replaceOnce(
  consolidation,
  `    } else if (classification.type === 'receita_projeto') {\n      consItem.valorDireto += value;`,
  `    } else if (classification.type === 'receita_projeto') {\n      consItem.valorDireto += value;\n      consItem.valorFaturamentoDireto += faturamentoLinha;`,
  'faturamento direto'
);

consolidation = replaceOnce(
  consolidation,
  `    } else {\n      consItem.valorOutrasEntradas += value;\n    }\n  });\n\n  const processedConsolidated = Array.from(consolidatedMap.values()).map(cons => {`,
  `    } else {\n      consItem.valorOutrasEntradas += value;\n      consItem.valorFaturamentoOutrasEntradas += faturamentoLinha;\n    }\n  });\n\n  const processedConsolidated = Array.from(consolidatedMap.values()).map(cons => {\n    // J agora e uma parcela por linha. O valor bruto do titulo e a soma das linhas\n    // consolidadas, mantendo os subtotais Faturamento/Administrativo disponiveis.\n    cons.valorFaturamento = cons.valorFaturamentoTitulo;\n    cons.valorTotalTitulo = cons.valorFaturamentoTitulo;`,
  'total J por titulo'
);

fs.writeFileSync(consolidationPath, consolidation, 'utf8');

// 3) Painel de NFES: remover a regra antiga MAX(J) e usar SOMA(J) por título.
const flowPath = 'src/app/fluxo-caixa/page.js';
let flow = fs.readFileSync(flowPath, 'utf8');

flow = replaceOnce(
  flow,
  `    // A NF pode vir dividida entre faturamento operacional e administrativo.\n    // O Valor exibido continua seguindo a regra atual; o Valor Real da NF usa\n    // Valor total titulo apenas uma vez, sem somar a divisao ADM/operacional.`,
  `    // A NF vem dividida entre Faturamento (1010101) e Administrativo (1010107).\n    // A coluna J ja traz a parcela de cada linha, portanto o valor faturado da\n    // nota/titulo e a SOMA das linhas, enquanto a coluna K continua sendo caixa.`,
  'comentario NFES'
);

flow = replaceOnce(
  flow,
  `      const valoresReais = [\n        Number(item.valorTotalTitulo) || 0,\n        ...linhas.map(linha => Number(linha.valorTotalTitulo) || 0),\n      ].filter(valor => valor > 0);`,
  `      const faturamentoConsolidado = Number(\n        item.valorFaturamentoTitulo\n        ?? item.valorFaturamento\n        ?? item.valorTotalTitulo\n      ) || 0;\n      const faturamentoPelasLinhas = linhas.reduce((sum, linha) =>\n        sum + (Number(linha.valorFaturamento ?? linha.valorTotalTitulo) || 0), 0\n      );`,
  'leitura J da NFES'
);

flow = replaceOnce(
  flow,
  `      const valorRealNota = valoresReais.length ? Math.max(...valoresReais) : 0;`,
  `      const valorRealNota = faturamentoConsolidado || faturamentoPelasLinhas;`,
  'valor faturado NFES por soma'
);

flow = replaceOnce(
  flow,
  `        map[key].valor += Number(item.valor) || 0;\n        map[key].valorRealNota = Math.max(map[key].valorRealNota || 0, valorRealNota);`,
  `        map[key].valor += Number(item.valor) || 0;\n        map[key].valorRealNota = (Number(map[key].valorRealNota) || 0) + (Number(valorRealNota) || 0);`,
  'acumulacao NFES sem MAX'
);

fs.writeFileSync(flowPath, flow, 'utf8');

// 4) Forcar renovacao do snapshot para a nova versao da regra financeira.
const syncLibPath = 'src/lib/financialSync.js';
let syncLib = fs.readFileSync(syncLibPath, 'utf8');
syncLib = replaceOnce(syncLib, 'const CASH_LOGIC_VERSION = 4;', 'const CASH_LOGIC_VERSION = 5;', 'cash logic financialSync');
syncLib = replaceOnce(
  syncLib,
  `    rule: 'J=FATURAMENTO;K=LIQUIDO_RECEBIDO',`,
  `    rule: 'J=SOMA_FATURAMENTO_POR_TITULO;K=SOMA_LIQUIDO_RECEBIDO_POR_TITULO',`,
  'descricao da regra financeira'
);
fs.writeFileSync(syncLibPath, syncLib, 'utf8');

const syncRoutePath = 'src/app/api/sync/route.js';
let syncRoute = fs.readFileSync(syncRoutePath, 'utf8');
syncRoute = replaceOnce(syncRoute, 'const CASH_LOGIC_VERSION = 4;', 'const CASH_LOGIC_VERSION = 5;', 'cash logic sync route');
syncRoute = syncRoute.replace("'AUTO_REPAIR_CASH_V4'", "'AUTO_REPAIR_CASH_V5'");
fs.writeFileSync(syncRoutePath, syncRoute, 'utf8');

console.log('Nova regra CR_GERAL aplicada: J soma por titulo; K permanece caixa liquido; sem MAX/deduplicacao de J.');
