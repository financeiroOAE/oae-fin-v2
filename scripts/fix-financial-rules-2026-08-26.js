const fs = require('fs');

function replaceOnce(content, oldText, newText, label) {
  if (!content.includes(oldText)) {
    throw new Error(`Trecho nao encontrado: ${label}`);
  }
  return content.replace(oldText, newText);
}

function replaceRegexOnce(content, regex, replacement, label) {
  if (!regex.test(content)) {
    throw new Error(`Trecho regex nao encontrado: ${label}`);
  }
  return content.replace(regex, replacement);
}

// 1) PROJETOS: manter a regra de consolidacao/rateio que ja existia,
// usando K (valorCaixa) apenas como valor realizado.
const projectsPath = 'src/app/projetos/page.js';
let projects = fs.readFileSync(projectsPath, 'utf8');

projects = replaceOnce(
  projects,
`  const projectCashData = useMemo(() => consolidateFinancialData(data, {
    isProjetosPage: true,
    incluirRateioAdm: true,
    usarValorCaixa: true
  }), [data]);

  const baseData = useMemo(() => consolidateFinancialData(data, {
    isProjetosPage: true,
    incluirRateioAdm,
    usarValorCaixa: true
  }), [data, incluirRateioAdm]);`,
`  // Regra de Projetos: receita/recebido realizado usa a coluna K da CR_GERAL,
  // preservando a consolidacao por titulo e o toggle de rateio administrativo.
  const baseData = useMemo(() => consolidateFinancialData(data, {
    isProjetosPage: true,
    incluirRateioAdm,
    usarValorCaixa: true
  }), [data, incluirRateioAdm]);`,
  'projectCashData/baseData'
);

projects = replaceOnce(
  projects,
  '    projectCashData.forEach((item) => {',
  '    baseData.forEach((item) => {',
  'projetosCruzados fonte'
);

projects = replaceOnce(
  projects,
  '      receitaConsideradaTooltip: p.receitaDireta + p.receitaAdm',
  '      receitaConsideradaTooltip: p.receitaDireta + (incluirRateioAdm ? p.receitaAdm : 0)',
  'tooltip rateio adm'
);

projects = replaceOnce(
  projects,
  '  }, [projetosBrutos, projectCashData, realizadoIni, realizadoFim]);',
  '  }, [projetosBrutos, baseData, realizadoIni, realizadoFim, incluirRateioAdm]);',
  'dependencias projetosCruzados'
);

// Remove a soma bruta por linhas da CR_GERAL e o atalho sourceNet, que ignoravam
// a consolidacao por titulo e inflavam a receita ao misturar Projeto + ADM.
projects = replaceRegexOnce(
  projects,
  /  const rawProjectRevenueStats = useMemo\(\(\) => \{[\s\S]*?  const totalPago = filteredProjetos\.reduce\(\(acc, p\) => acc \+ p\.pago, 0\);/,
`  // KPIs financeiros seguem exatamente os projetos ja consolidados acima.
  // Sem rateio: somente receita direta. Com rateio: a parcela ADM do titulo entra uma vez.
  const totalRecebido = filteredProjetos.reduce((acc, p) => acc + p.recebido, 0);
  const totalAReceber = filteredProjetos.reduce((acc, p) => acc + p.aReceber, 0);
  const totalPago = filteredProjetos.reduce((acc, p) => acc + p.pago, 0);
  const receitaLiquidaProjetos = totalRecebido;`,
  'rawProjectRevenueStats/sourceNet'
);

// Se ainda houver a leitura da fonte auxiliar no estado, ela deixa de ser usada.
projects = projects.replace('  const [recebimentosLiquidosStats, setRecebimentosLiquidosStats] = useState(null);\n', '');
projects = projects.replace('      setRecebimentosLiquidosStats(result.recebimentosLiquidosStats || null);\n', '');

// A informacao ADM global deve respeitar a carteira filtrada e nunca uma soma paralela.
projects = replaceOnce(
  projects,
  '  const totalRecebidoAdmGlobal = usarCarteiraCompleta ? rawProjectRevenueStats.recebidoAdm : filteredProjetos.reduce((acc, p) => acc + (p.receitaAdm || 0), 0);',
  '  const totalRecebidoAdmGlobal = filteredProjetos.reduce((acc, p) => acc + (p.receitaAdm || 0), 0);',
  'totalRecebidoAdmGlobal'
);

fs.writeFileSync(projectsPath, projects);

// 2) DRE: Receita Bruta deve usar J (valorFaturamento / Valor total titulo).
// Demais linhas continuam usando o valor operacional normal.
const dreEnginePath = 'src/lib/dreEngine.js';
let dreEngine = fs.readFileSync(dreEnginePath, 'utf8');

dreEngine = replaceOnce(
  dreEngine,
`    const dreId = mapClasseToDreId(item);
    const mesKey = item.mesKey;
    const valorCru = Math.abs(item.valor || 0); // Sempre absoluto — o sinal vem de group.sign`,
`    const dreId = mapClasseToDreId(item);
    const mesKey = item.mesKey;
    // Receita Bruta da DRE = coluna J da CR_GERAL (Valor total titulo).
    // Receita/Recebido operacional fora da DRE continua pela coluna K.
    const valorBase = dreId === 'RECEITA_BRUTA' && item.natureza === 'Entrada'
      ? (item.valorFaturamento ?? item.valorTotalTitulo ?? item.valor)
      : item.valor;
    const valorCru = Math.abs(Number(valorBase) || 0); // Sempre absoluto — o sinal vem de group.sign`,
  'DRE Receita Bruta coluna J'
);

fs.writeFileSync(dreEnginePath, dreEngine);

console.log('Correcoes aplicadas: Projetos K + rateio condicional; DRE Receita Bruta J.');
