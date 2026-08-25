const fs = require('fs');

function mustReplace(src, search, replacement, label) {
  if (!src.includes(search)) throw new Error(`Trecho nao encontrado: ${label}`);
  return src.replace(search, replacement);
}

function mustRegex(src, regex, replacement, label) {
  if (!regex.test(src)) throw new Error(`Padrao nao encontrado: ${label}`);
  return src.replace(regex, replacement);
}

// -----------------------------------------------------------------------------
// PROJETOS
// -----------------------------------------------------------------------------
{
  const file = 'src/app/projetos/page.js';
  let src = fs.readFileSync(file, 'utf8');

  src = mustReplace(
    src,
    'import { isRevenueTax, getRevenueTaxLabel } from "@/lib/financialClassification";',
    'import { isRevenueTax, getRevenueTaxLabel, classifyFinancialEntry, isTeamExpense } from "@/lib/financialClassification";\nimport { getProjectKey, isProjectOngoing, getActiveProjectNames } from "@/lib/projectRules";',
    'imports projetos'
  );

  src = mustRegex(
    src,
    /\/\/ O nome da obra pode estar abreviado[\s\S]*?const getProjectKey = \(value\) => \{[\s\S]*?\n\};\n\n/,
    '',
    'helper local projeto'
  );

  src = mustReplace(
    src,
    "      if (!nomeObra || nomeObra.toUpperCase().includes('ADMINISTRATIVO')) return;",
    "      if (!nomeObra || nomeObra.toUpperCase().includes('ADMINISTRATIVO') || !isProjectOngoing(p)) return;",
    'somente projetos ativos'
  );

  src = mustReplace(
    src,
`        if (item.natureza === 'Entrada') {
          if (isRealizado) {
            projeto.recebido += item.valor;
            projeto.receitaDireta += item.valorDireto || 0;
            projeto.receitaAdm += item.valorAdministrativo || 0;
          } else {
            projeto.aReceber += item.valor;
          }
        } else if (item.natureza === 'Saída') {`,
`        if (item.natureza === 'Entrada') {
          const classification = classifyFinancialEntry(item);
          const receitaDiretaItem = Number(item.valorDireto) || (classification.type === 'receita_projeto' ? (Number(item.valor) || 0) : 0);
          const receitaAdmItem = Number(item.valorAdministrativo) || (classification.type === 'receita_administrativa' ? (Number(item.valor) || 0) : 0);

          if (isRealizado) {
            projeto.recebido += Number(item.valor) || 0;
            projeto.receitaDireta += receitaDiretaItem;
            projeto.receitaAdm += receitaAdmItem;
          } else {
            projeto.aReceber += Number(item.valor) || 0;
          }
        } else if (item.natureza === 'Saída') {`,
    'receitas projetos'
  );

  src = mustReplace(
    src,
    "  const listaProjetos = Array.from(new Set(projetosCruzados.map(p => p.nome))).sort();",
    "  const listaProjetos = getActiveProjectNames(projetosBrutos, true);",
    'lista projetos oficial'
  );

  src = mustReplace(
    src,
    "  const totalRecebidoAdmGlobal = filteredProjetos.reduce((acc, p) => acc + p.recebidoAdm, 0);",
    "  const totalRecebidoAdmGlobal = filteredProjetos.reduce((acc, p) => acc + (p.receitaAdm || 0), 0);",
    'total adm'
  );

  src = mustReplace(
    src,
    "  const [kpiModal, setKpiModal] = useState(null);",
    "  const [kpiModal, setKpiModal] = useState(null);\n  const [showUnclassified, setShowUnclassified] = useState(false);",
    'estado nao classificados'
  );

  src = mustReplace(
    src,
    "    let cPago = 0, cAPagar = 0, dPago = 0, dAPagar = 0, nc = 0;",
    "    let cPago = 0, cAPagar = 0, dPago = 0, dAPagar = 0, nc = 0;\n    const naoClassificados = [];",
    'lista nao classificados'
  );

  src = mustReplace(
    src,
`      } else {
        if (isRealizado) nc += valor;
      }
    });

    return {
      receita: recReceita,
      receitaAReceber: recAReceber,
      custo: cPago,
      custoAPagar: cAPagar,
      despesa: dPago,
      despesaAPagar: dAPagar,
      naoClassificado: nc
    };`,
`      } else {
        if (isRealizado) {
          nc += valor;
          naoClassificados.push(item);
        }
      }
    });

    return {
      receita: recReceita,
      receitaAReceber: recAReceber,
      custo: cPago,
      custoAPagar: cAPagar,
      despesa: dPago,
      despesaAPagar: dAPagar,
      naoClassificado: nc,
      naoClassificados
    };`,
    'retorno nao classificados'
  );

  src = mustReplace(
    src,
    "      const accountText = String(item.contaNome || item.contaDescricao || '').toUpperCase();\n      if (!accountText.includes('EQUIP')) return;",
    "      if (!isTeamExpense(item)) return;",
    'custo equipe detalhe'
  );

  src = mustRegex(
    src,
    /\n  const exportSelectedProjectExcel = async \(mode = 'full'\) => \{[\s\S]*?\n  const clearAllFilters = \(\) => \{/,
    '\n  const clearAllFilters = () => {',
    'export excel direto projeto'
  );

  src = mustReplace(
    src,
`                <button onClick={() => exportSelectedProjectExcel('full')} className="btn" style={{ fontSize: '12px', background: 'var(--primary)', color: '#fff' }}>
                  <FileText size={14} /> Relatório completo
                </button>
                <button onClick={() => exportSelectedProjectExcel('extract')} className="btn" style={{ fontSize: '12px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}>
                  <FileText size={14} /> Somente extrato
                </button>
`,
    '',
    'botoes relatorio direto drawer'
  );

  src = mustReplace(
    src,
    "              <span>Aviso: <strong>{formatCurrency(dreStats.naoClassificado)}</strong> ainda sem classificação DRE válida.</span>",
    "              <span>Aviso: <strong>{formatCurrency(dreStats.naoClassificado)}</strong> ainda sem classificação DRE válida.</span>\n              <button type=\"button\" onClick={() => setShowUnclassified(true)} className=\"btn\" style={{ fontSize: '11px', padding: '0.3rem 0.65rem', background: 'transparent', color: 'var(--warning)', border: '1px solid rgba(245,158,11,0.35)' }}>Ver lançamentos</button>",
    'botao nao classificados'
  );

  const teamCalc = `
  const teamCostsChartData = useMemo(() => {
    const allowedProjects = new Map(filteredProjetos.map(p => [p.projectKey, p.nome]));
    const map = {};

    data.forEach(item => {
      if (item.natureza !== 'Saída' || !isTeamExpense(item)) return;
      const projectKey = getProjectKey(item.projeto);
      const projectName = allowedProjects.get(projectKey);
      if (!projectName) return;

      let ts = 0;
      if (item.data) {
        const parts = String(item.data).split('/');
        if (parts.length === 3) ts = new Date(parts[2], parts[1] - 1, parts[0]).getTime();
      }
      if (ts < dIni || ts > dFim) return;

      const status = String(item.status || '').toUpperCase();
      const validStatus = status.includes('REALIZADO') || status.includes('PAGO') || status.includes('EFETIVADO') || status.includes('A REALIZAR') || status.includes('A PAGAR') || status.includes('PREVISTO');
      if (!validStatus) return;

      map[projectName] = (map[projectName] || 0) + Math.abs(Number(item.valor) || 0);
    });

    return Object.entries(map)
      .map(([nome, Valor]) => ({ nome, Valor }))
      .sort((a, b) => b.Valor - a.Valor);
  }, [data, filteredProjetos, dIni, dFim]);
`;

  src = mustReplace(src, "\n  const reportFilters = {", teamCalc + "\n  const reportFilters = {", 'calculo equipe principal');

  const teamCard = `
      <div className="card" data-report-section style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.25rem' }}>Custo de Equipe por Projeto</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Custos e compromissos de equipe vinculados aos projetos/obras no período selecionado.</p>
          </div>
          <ReportAdder sectionKey="projetos:custo-equipe" title="Custo de Equipe por Projeto" componentName="Gráfico de Custo de Equipe" page="Projetos" type="TABLE" data={teamCostsChartData} filters={reportFilters} presetTags={["project-executive"]} />
        </div>
        <div style={{ minHeight: '280px' }}>
          <RankingBarChart data={teamCostsChartData} dataKey="Valor" color="var(--warning)" emptyMessage="Sem custos de equipe identificados para os projetos filtrados." />
        </div>
      </div>

`;

  src = mustReplace(src, "      {/* 7. Relatório Executivo com Paginação */}", teamCard + "      {/* 7. Relatório Executivo com Paginação */}", 'grafico equipe principal');

  const unclassifiedModal = `
      {showUnclassified && (
        <div onClick={() => setShowUnclassified(false)} style={{ position: 'fixed', inset: 0, zIndex: 10020, background: 'rgba(0,0,0,0.62)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem' }}>
          <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: 'min(1000px, 96vw)', maxHeight: '82vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div><h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)' }}>Movimentações Não Classificadas</h3><p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{dreStats.naoClassificados?.length || 0} lançamento(s)</p></div>
              <button type="button" onClick={() => setShowUnclassified(false)} className="btn" style={{ background: 'transparent', border: 0 }}><X size={18} /></button>
            </div>
            <div style={{ overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-elevated)' }}><tr><th style={{padding:'0.65rem'}}>Data</th><th style={{padding:'0.65rem'}}>Projeto</th><th style={{padding:'0.65rem'}}>Nome</th><th style={{padding:'0.65rem'}}>Conta</th><th style={{padding:'0.65rem'}}>Status</th><th style={{padding:'0.65rem',textAlign:'right'}}>Valor</th></tr></thead>
                <tbody>{(dreStats.naoClassificados || []).map((item, idx) => <tr key={idx} style={{ borderTop:'1px solid var(--border-color)' }}><td style={{padding:'0.65rem'}}>{item.data}</td><td style={{padding:'0.65rem'}}>{item.projeto}</td><td style={{padding:'0.65rem'}}>{item.nome}</td><td style={{padding:'0.65rem'}}>{item.contaNome || item.contaDescricao || item.contaCodigo}</td><td style={{padding:'0.65rem'}}>{item.status}</td><td style={{padding:'0.65rem',textAlign:'right'}}>{formatCurrency(Math.abs(item.valor || 0))}</td></tr>)}</tbody>
              </table>
            </div>
          </div>
        </div>
      )}

`;

  src = mustReplace(src, "      {/* 8. Drawer */}", unclassifiedModal + "      {/* 8. Drawer */}", 'modal nao classificados');

  fs.writeFileSync(file, src);
}

// -----------------------------------------------------------------------------
// VISAO FINANCEIRA
// -----------------------------------------------------------------------------
{
  const file = 'src/app/visao-financeira/page.js';
  let src = fs.readFileSync(file, 'utf8');

  src = mustReplace(
    src,
    'import AnnualFlowChart from "@/components/charts/AnnualFlowChart";',
    'import ABCClassDonut from "@/components/charts/ABCClassDonut";\nimport ProjectComparisonChart from "@/components/charts/ProjectComparisonChart";',
    'imports graficos visao'
  );
  src = mustReplace(src, 'import DataTable from "@/components/DataTable";\n', '', 'remove DataTable visao');
  src = mustReplace(src, 'import { getRolling30DayRange } from "@/lib/dateRange";\n', '', 'remove rolling visao');
  src = mustReplace(
    src,
    'import { classifyFinancialEntry } from "@/lib/financialClassification";',
    'import { classifyFinancialEntry, isPartnerWithdrawal } from "@/lib/financialClassification";\nimport { getActiveProjects, getActiveProjectNames, getProjectKey } from "@/lib/projectRules";',
    'imports regras visao'
  );

  src = mustReplace(
    src,
    'export default function VisaoFinanceira() {',
`const getYearToDateRange = () => {
  const today = new Date();
  const localDate = (date) => \`${'${date.getFullYear()}'}-${'${String(date.getMonth() + 1).padStart(2, \'0\')}'}-${'${String(date.getDate()).padStart(2, \'0\')}'}\`;
  return { start: \`${'${today.getFullYear()}'}-01-01\`, end: localDate(today) };
};

export default function VisaoFinanceira() {`,
    'helper periodo visao'
  );

  src = mustReplace(src, '  const [data, setData] = useState([]);', '  const [data, setData] = useState([]);\n  const [projetosBrutos, setProjetosBrutos] = useState([]);', 'estado projetos visao');
  src = mustReplace(src, '  const [filterDataInicial, setFilterDataInicial] = useState(() => getRolling30DayRange().start);\n  const [filterDataFinal, setFilterDataFinal] = useState(() => getRolling30DayRange().end);', '  const [filterDataInicial, setFilterDataInicial] = useState(() => getYearToDateRange().start);\n  const [filterDataFinal, setFilterDataFinal] = useState(() => getYearToDateRange().end);', 'datas padrao visao');
  src = mustReplace(src, '      setData(result.data || []);\n      setSaldosBancarios(result.saldosBancarios || []);', '      setData(result.data || []);\n      setProjetosBrutos(result.projetos || []);\n      setSaldosBancarios(result.saldosBancarios || []);', 'set projetos visao');

  src = mustReplace(
    src,
    '  const projetosDisponiveis = Array.from(new Set(baseData.map(d => d.projeto).filter(Boolean))).sort();',
    '  const projetosDisponiveis = useMemo(() => getActiveProjectNames(projetosBrutos, true), [projetosBrutos]);\n  const activeProjects = useMemo(() => getActiveProjects(projetosBrutos), [projetosBrutos]);\n  const activeProjectKeys = useMemo(() => new Set(activeProjects.map(project => getProjectKey(project.ID || project.OBRA))), [activeProjects]);',
    'projetos ativos visao'
  );

  src = mustReplace(
    src,
`  const topContasSaidas = useMemo(() => {
    const map = {};
    filteredData.filter(i => i.natureza === 'Saída' && i.contaDescricao).forEach(i => {
      map[i.contaDescricao] = (map[i.contaDescricao] || 0) + i.valor;
    });
    return Object.entries(map).map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor).slice(0, 10);
  }, [filteredData]);`,
`  const topContasSaidas = useMemo(() => {
    const map = {};
    filteredData.filter(i => i.natureza === 'Saída' && i.contaDescricao && !isPartnerWithdrawal(i)).forEach(i => {
      map[i.contaDescricao] = (map[i.contaDescricao] || 0) + (Number(i.valor) || 0);
    });
    return Object.entries(map).map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor).slice(0, 10);
  }, [filteredData]);`,
    'despesas sem retirada socios'
  );

  src = mustRegex(
    src,
    /  const entryCategoryData = useMemo\(\(\) => \{[\s\S]*?\n  \}, \[filteredData\]\);\n\n/,
`  const entryStatusBreakdown = useMemo(() => {
    const result = {
      projetos: { realizado: 0, pendente: 0 },
      capital: { realizado: 0, pendente: 0 },
    };

    filteredData.filter(item => item.natureza === 'Entrada').forEach(item => {
      const rows = item.linhasOriginais?.length ? item.linhasOriginais : [item];
      rows.forEach(row => {
        const classification = classifyFinancialEntry(row);
        const status = String(row.status || item.status || '').trim().toUpperCase();
        const bucket = status === 'REALIZADO' ? 'realizado' : status === 'A REALIZAR' ? 'pendente' : null;
        if (!bucket) return;
        const value = Number(row.valor) || 0;
        if (classification.type === 'receita_projeto' || classification.type === 'receita_administrativa') result.projetos[bucket] += value;
        if (classification.type === 'emprestimo' || classification.type === 'aporte') result.capital[bucket] += value;
      });
    });
    return result;
  }, [filteredData]);

  const projectFinancialOverview = useMemo(() => {
    let receita = 0;
    let saidas = 0;

    filteredData.forEach(item => {
      const key = getProjectKey(item.projeto);
      if (!activeProjectKeys.has(key)) return;
      const status = String(item.status || '').trim().toUpperCase();
      if (status !== 'REALIZADO') return;

      if (item.natureza === 'Entrada') {
        const rows = item.linhasOriginais?.length ? item.linhasOriginais : [item];
        rows.forEach(row => {
          const classification = classifyFinancialEntry(row);
          if (classification.type === 'receita_projeto' || classification.type === 'receita_administrativa') receita += Number(row.valor) || 0;
        });
      } else if (item.natureza === 'Saída') {
        saidas += Math.abs(Number(item.valor) || 0);
      }
    });

    const resultado = receita - saidas;
    const margem = receita > 0 ? (resultado / receita) * 100 : 0;
    return {
      receita,
      saidas,
      resultado,
      margem,
      chart: [{ nome: 'Projetos da Empresa', Receita: receita, 'Custos e Despesas': saidas, Resultado: resultado }]
    };
  }, [filteredData, activeProjectKeys]);

  const abcDonutData = useMemo(() => {
    const projects = activeProjects
      .map(project => ({
        nome: String(project.OBRA || '').trim(),
        contratado: Number(project.CONTRATO) || 0,
        faturado: Number(project['NF FATURADAS']) || 0,
      }))
      .filter(project => project.nome && project.contratado > 0)
      .sort((a, b) => b.contratado - a.contratado);

    const classes = [
      { name: 'Classe A', color: 'var(--success)', rule: 'Contratos acima de R$ 500 mil', test: (value) => value > 500000 },
      { name: 'Classe B', color: 'var(--warning)', rule: 'Contratos de R$ 100 mil a R$ 500 mil', test: (value) => value >= 100000 && value <= 500000 },
      { name: 'Classe C', color: 'var(--danger)', rule: 'Contratos abaixo de R$ 100 mil', test: (value) => value < 100000 },
    ];

    return classes.map(def => {
      const classProjects = projects.filter(project => def.test(project.contratado));
      return { ...def, value: classProjects.reduce((sum, project) => sum + project.contratado, 0), count: classProjects.length, projects: classProjects };
    }).filter(item => item.count > 0);
  }, [activeProjects]);

`,
    'substituir composicao entrada'
  );

  src = mustReplace(
    src,
`  // O período financeiro padrão permanece fixo entre hoje e os próximos 30 dias.
  const setFilter30Dias = () => {
    const range = getRolling30DayRange();
    setFilterDataInicial(range.start);
    setFilterDataFinal(range.end);
  };`,
`  const resetDefaultPeriod = () => {
    const range = getYearToDateRange();
    setFilterDataInicial(range.start);
    setFilterDataFinal(range.end);
  };`,
    'reset periodo visao'
  );

  src = mustReplace(src, '<button onClick={setFilter30Dias} className="btn" style={{ fontSize: \'11px\', padding: \'0.25rem 0.5rem\', background: \'var(--bg-elevated)\' }}>Hoje + próximos 30 dias</button>', '<button onClick={resetDefaultPeriod} className="btn" style={{ fontSize: \'11px\', padding: \'0.25rem 0.5rem\', background: \'var(--bg-elevated)\' }}>01/01 até hoje</button>', 'botao periodo visao');
  src = mustReplace(src, 'onClick={() => { setFilter30Dias(); setFilterProjetos([]); setFilterStatus([]); setFilterNomes([]); setFilterContas([]); }}', 'onClick={() => { resetDefaultPeriod(); setFilterProjetos([]); setFilterStatus([]); setFilterNomes([]); setFilterContas([]); }}', 'limpar filtros visao');

  src = mustRegex(
    src,
    /        \{\/\* ROW 2: Status Financeiro e Fluxo Anual \*\/\}[\s\S]*?        \{\/\* ROW 3: Centro de Custo \*\/\}/,
`        {/* ROW 2: Status Financeiro e Curva ABC */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '1.5rem' }}>
          <div id="report-visao-status" data-report-section className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
            <ReportAdder sectionKey="visao:status" title="Status Financeiro Consolidado" componentName="Gráficos de Status" page="Visão Financeira" type="CHART" data={[
              { name: 'Projetos Recebido', value: entryStatusBreakdown.projetos.realizado },
              { name: 'Projetos A Receber', value: entryStatusBreakdown.projetos.pendente },
              { name: 'Empréstimos/Aportes Realizado', value: entryStatusBreakdown.capital.realizado },
              { name: 'Empréstimos/Aportes A Realizar', value: entryStatusBreakdown.capital.pendente },
              ...piePagamentos
            ]} filters={reportFilters} captureId="report-visao-status" presetTags={["executive-financial"]} style={{ alignSelf: 'flex-end' }} />
            <h2 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '1.5rem' }}>Status Financeiro Consolidado</h2>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem', justifyContent: 'center' }}>
              <PieStatusChart realizado={entryStatusBreakdown.projetos.realizado} pendente={entryStatusBreakdown.projetos.pendente} colorRealizado="var(--success)" colorPendente="rgba(16, 185, 129, 0.3)" titulo="Receitas de Projetos" labelRealizado="Recebido" labelPendente="A Receber" />
              <PieStatusChart realizado={entryStatusBreakdown.capital.realizado} pendente={entryStatusBreakdown.capital.pendente} colorRealizado="var(--info)" colorPendente="rgba(59,130,246,0.3)" titulo="Empréstimos / Aportes" labelRealizado="Entrada Realizada" labelPendente="A Realizar" />
              <PieStatusChart realizado={saidasRealizadas} pendente={saidasARealizar} colorRealizado="var(--danger)" colorPendente="rgba(239, 68, 68, 0.3)" titulo="Pagamentos" labelRealizado="Pago" labelPendente="A Pagar" />
            </div>
          </div>
          <div id="report-visao-abc" data-report-section className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
            <ReportAdder sectionKey="visao:abc" title="Curva ABC dos Projetos" componentName="Curva ABC" page="Visão Financeira" type="TABLE" data={abcDonutData.map(item => ({ Classe: item.name, Projetos: item.count, Valor: item.value, Regra: item.rule }))} filters={reportFilters} captureId="report-visao-abc" presetTags={["executive-financial", "project-executive"]} style={{ alignSelf: 'flex-end' }} />
            <h2 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.25rem' }}>Curva ABC dos Projetos</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Projetos ativos classificados pelo valor contratado.</p>
            <ABCClassDonut data={abcDonutData} />
          </div>
        </div>

        {/* ROW 3: Centro de Custo */}`,
    'status e abc visao'
  );

  src = mustRegex(
    src,
    /        \{\/\* ROW 4: Plano de Contas \*\/\}[\s\S]*?        <\/div>\n\n      <\/div>/,
`        {/* ROW 4: Visão Financeira dos Projetos e Despesas */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '3rem' }}>
          <div id="report-visao-projetos-financeiro" data-report-section className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
            <ReportAdder sectionKey="visao:projetos-financeiro" title="Visão Financeira Geral dos Projetos" componentName="Resultado e Margem dos Projetos" page="Visão Financeira" type="CHART" data={projectFinancialOverview.chart} filters={reportFilters} captureId="report-visao-projetos-financeiro" presetTags={["executive-financial", "project-executive"]} style={{ alignSelf: 'flex-end' }} />
            <h2 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.25rem' }}>Visão Financeira Geral dos Projetos</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Receitas de projetos versus custos e despesas realizados no período.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(120px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
              <div><span style={{fontSize:'10px',color:'var(--text-secondary)',textTransform:'uppercase'}}>Receita</span><strong style={{display:'block',fontSize:'14px',color:'var(--success)'}}>{formatCurrency(projectFinancialOverview.receita)}</strong></div>
              <div><span style={{fontSize:'10px',color:'var(--text-secondary)',textTransform:'uppercase'}}>Custos + Despesas</span><strong style={{display:'block',fontSize:'14px',color:'var(--danger)'}}>{formatCurrency(projectFinancialOverview.saidas)}</strong></div>
              <div><span style={{fontSize:'10px',color:'var(--text-secondary)',textTransform:'uppercase'}}>Resultado</span><strong style={{display:'block',fontSize:'14px',color:projectFinancialOverview.resultado >= 0 ? 'var(--success)' : 'var(--danger)'}}>{formatCurrency(projectFinancialOverview.resultado)}</strong></div>
              <div><span style={{fontSize:'10px',color:'var(--text-secondary)',textTransform:'uppercase'}}>Margem</span><strong style={{display:'block',fontSize:'14px',color:projectFinancialOverview.margem >= 0 ? 'var(--success)' : 'var(--danger)'}}>{projectFinancialOverview.margem.toFixed(2).replace('.', ',')}%</strong></div>
            </div>
            <div style={{ minHeight: '260px' }}><ProjectComparisonChart data={projectFinancialOverview.chart} keys={['Receita', 'Custos e Despesas', 'Resultado']} names={['Receita', 'Custos e Despesas', 'Resultado']} colors={['var(--success)', 'var(--danger)', 'var(--primary)']} /></div>
          </div>
          <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
            <AccountBarChart data={topContasSaidas} title="Despesas por Plano de Conta" infoContent="Concentração das saídas por plano de conta. Retiradas dos sócios não entram nesta visão." color="var(--danger)" />
          </div>
        </div>

      </div>`,
    'visao projetos financeiro'
  );

  src = mustRegex(
    src,
    /\n      \{\/\* Tabela Interativa de Movimentações \*\/\}[\s\S]*?\n      <style dangerouslySetInnerHTML/,
    '\n      <style dangerouslySetInnerHTML',
    'remover movimentacoes visao'
  );

  fs.writeFileSync(file, src);
}

// -----------------------------------------------------------------------------
// DRE ENGINE
// -----------------------------------------------------------------------------
{
  const file = 'src/lib/dreEngine.js';
  let src = fs.readFileSync(file, 'utf8');
  src = "import { isTeamExpense } from '@/lib/financialClassification';\n\n" + src;
  src = mustReplace(
    src,
`export function mapClasseToDreId(item) {
  const dreClasse = item.dreClasseLabel || item.dreClasse || '';
  const dreLinha = item.dreLinhaLabel || item.dreLinha || '';

  if (dreClasse.includes('PENDENTE') || dreLinha.includes('PENDENTE')) return null;`,
`export function mapClasseToDreId(item) {
  const dreClasse = item.dreClasseLabel || item.dreClasse || '';
  const dreLinha = item.dreLinhaLabel || item.dreLinha || '';
  const projeto = String(item.projeto || '').toUpperCase();

  // Equipe vinculada ao centro de custo administrativo é despesa administrativa,
  // nunca custo direto de projeto.
  if (item.natureza === 'Saída' && projeto.includes('ADMINISTRA') && isTeamExpense(item)) return 'DESP_ADM';

  if (dreClasse.includes('PENDENTE') || dreLinha.includes('PENDENTE')) return null;`,
    'equipe adm como despesa'
  );
  fs.writeFileSync(file, src);
}

// -----------------------------------------------------------------------------
// DRE PAGE
// -----------------------------------------------------------------------------
{
  const file = 'src/app/dre/page.js';
  let src = fs.readFileSync(file, 'utf8');

  src = mustReplace(src, 'import InfoTooltip from "@/components/InfoTooltip";', 'import InfoTooltip from "@/components/InfoTooltip";\nimport { getActiveProjectNames } from "@/lib/projectRules";', 'import projetos dre');
  src = mustReplace(src, '  const [data, setData] = useState([]);', '  const [data, setData] = useState([]);\n  const [projetosBrutos, setProjetosBrutos] = useState([]);', 'estado projetos dre');
  src = mustReplace(src, '  const [filterProjetos, setFilterProjetos] = useState([]);\n  const [filterCCs, setFilterCCs] = useState([]);', '  const [filterProjetos, setFilterProjetos] = useState([]);', 'remove estado cc dre');
  src = mustReplace(src, '      setData(result.data || []);\n      setLastSync', '      setData(result.data || []);\n      setProjetosBrutos(result.projetos || []);\n      setLastSync', 'set projetos dre');
  src = mustReplace(src, '  const projetosDisponiveis = useMemo(() =>\n    Array.from(new Set(baseData.map(d => d.projeto).filter(Boolean))).sort(), [baseData]);', '  const projetosDisponiveis = useMemo(() => getActiveProjectNames(projetosBrutos, true), [projetosBrutos]);', 'lista projetos dre');

  src = mustReplace(
    src,
`    let items = filterDreItems(baseData, {
      filterDataInicial: effectiveDataInicial, filterDataFinal: effectiveDataFinal,
      filterProjetos, filterEmpresas: [],
      filterCCs,
      visao
    });

    const hasFiltroCC = filterCCs.length > 0;
    const hasFiltroProj = filterProjetos.length > 0;
    const isAdmCC = hasFiltroCC && filterCCs.every(cc => cc.toUpperCase().includes("ADMINISTRA"));

    if (hasFiltroProj || hasFiltroCC) {
      // Entradas: regra administrativa
      const entradas = items.filter(i => i.natureza === "Entrada");
      const saidas = items.filter(i => i.natureza === "Saída");

      const projetosAlvo = hasFiltroProj ? filterProjetos : filterCCs;
      const consolidated = consolidateFinancialData(entradas, {
        filterProjetos: projetosAlvo,
        isProjetosPage: false,
        incluirRateioAdm: true,
      });

      const entradasFiltradas = consolidated.filter(item => {
        const proj = item.projeto || "";
        if (isAdmCC) return projetosAlvo.some(cc => proj.toUpperCase().includes("ADMINISTRA"));
        return projetosAlvo.some(p => proj === p || proj.toUpperCase().includes(p.toUpperCase()));
      });

      // Saídas: apenas pelo projeto direto
      const saidasFiltradas = saidas.filter(item => {
        const proj = item.projeto || "";
        const alvo = hasFiltroCC ? filterCCs : filterProjetos;
        return alvo.some(p => proj === p || proj.toUpperCase().includes(p.toUpperCase()));
      });

      items = [...entradasFiltradas, ...saidasFiltradas];
    }

    return items;
  }, [baseData, effectiveDataInicial, effectiveDataFinal, filterProjetos, filterCCs, visao]);`,
`    let items = filterDreItems(baseData, {
      filterDataInicial: effectiveDataInicial, filterDataFinal: effectiveDataFinal,
      filterProjetos: [], filterEmpresas: [],
      filterCCs: [],
      visao
    });

    if (filterProjetos.length > 0) {
      const entradas = items.filter(i => i.natureza === "Entrada");
      const saidas = items.filter(i => i.natureza === "Saída");
      const consolidated = consolidateFinancialData(entradas, {
        filterProjetos,
        isProjetosPage: false,
        incluirRateioAdm: true,
      });

      const somenteAdm = filterProjetos.length === 1 && filterProjetos[0].toUpperCase().includes('ADMINISTRA');
      const entradasFiltradas = consolidated.filter(item => {
        const proj = String(item.projeto || '');
        if (somenteAdm) return proj.toUpperCase().includes('ADMINISTRA') && Math.abs(Number(item.valor) || 0) > 0;
        return filterProjetos.some(p => proj === p || proj.toUpperCase().includes(p.toUpperCase()));
      });

      const saidasFiltradas = saidas.filter(item => {
        const proj = String(item.projeto || '');
        return filterProjetos.some(p => proj === p || proj.toUpperCase().includes(p.toUpperCase()));
      });

      items = [...entradasFiltradas, ...saidasFiltradas];
    }

    return items;
  }, [baseData, effectiveDataInicial, effectiveDataFinal, filterProjetos, visao]);`,
    'filtro dre unico'
  );

  src = mustReplace(src, '    setFilterProjetos([]);\n    setFilterCCs([]);', '    setFilterProjetos([]);', 'clear cc dre');
  src = mustReplace(src, '  const hasActiveFilters = filterProjetos.length > 0 || filterCCs.length > 0;', '  const hasActiveFilters = filterProjetos.length > 0;', 'active filter dre');
  src = mustReplace(src, '    "Centros de custo": filterCCs.length ? filterCCs : "Todos",\n', '', 'report cc dre');

  src = mustRegex(
    src,
    /          <div style=\{\{ flex: "1 1 200px", display: "flex", flexDirection: "column", gap: "0.375rem" \}\}>\n            <label[^>]*>Centro de Custo<\/label>[\s\S]*?<\/div>\n/,
    '',
    'ui filtro cc dre'
  );

  src = mustReplace(
    src,
    '  const totalCustos = (dreData.groups["CUSTOS_SERVICOS"]?.total || 0);\n  const margem = receitaBruta > 0 ? (resLiquido / receitaBruta) * 100 : 0;',
    '  const totalCustos = (dreData.groups["CUSTOS_SERVICOS"]?.total || 0);\n  const totalDespesas = (dreData.groups["DESP_ADM"]?.total || 0) + (dreData.groups["DESP_COMERCIAL"]?.total || 0) + (dreData.groups["DESP_FINANCEIRA"]?.total || 0);\n  const margem = receitaBruta > 0 ? (resLiquido / receitaBruta) * 100 : 0;',
    'kpi despesas dre'
  );

  const summaryCards = `
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          ['Receita Bruta', receitaBruta, 'var(--success)'],
          ['Custos dos Serviços', totalCustos, 'var(--warning)'],
          ['Despesas', totalDespesas, 'var(--danger)'],
          ['Resultado Operacional', resOperacional, resOperacional >= 0 ? 'var(--success)' : 'var(--danger)'],
          ['Resultado Líquido', resLiquido, resLiquido >= 0 ? 'var(--success)' : 'var(--danger)'],
        ].map(([label, value, color]) => (
          <div key={label} className="card" style={{ padding: '1rem', borderTop: \`3px solid ${'${color}'}\` }}>
            <p style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.35rem', fontWeight: '700' }}>{label}</p>
            <p style={{ fontSize: '17px', fontWeight: '700', color }}>{fmt(value)}</p>
          </div>
        ))}
        <div className="card" style={{ padding: '1rem', borderTop: '3px solid var(--primary)' }}>
          <p style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.35rem', fontWeight: '700' }}>Margem Líquida</p>
          <p style={{ fontSize: '17px', fontWeight: '700', color: margem >= 0 ? 'var(--success)' : 'var(--danger)' }}>{margem.toFixed(2).replace('.', ',')}%</p>
        </div>
      </div>

`;
  src = mustReplace(src, '      {/* ── Tabela DRE ── */}', summaryCards + '      {/* ── Tabela DRE ── */}', 'cards resumo dre');

  // Separador visual somente entre C.D.P. e EQUIPE.
  src = mustReplace(
    src,
`const sortAccounts = (accounts) => Object.values(accounts || {}).sort((a, b) =>
  a.label.localeCompare(b.label, 'pt-BR', { sensitivity: 'base', numeric: true })
);`,
`const accountSection = (label) => {
  const text = String(label || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toUpperCase();
  if (text.includes('C.D.P') || text.includes('CDP')) return 'CDP';
  if (text.includes('EQUIPE')) return 'EQUIPE';
  return 'OUTRO';
};

const sortAccounts = (accounts) => Object.values(accounts || {}).sort((a, b) => {
  const order = { CDP: 0, EQUIPE: 1, OUTRO: 2 };
  const sectionDiff = order[accountSection(a.label)] - order[accountSection(b.label)];
  if (sectionDiff !== 0) return sectionDiff;
  return a.label.localeCompare(b.label, 'pt-BR', { sensitivity: 'base', numeric: true });
});`,
    'sort dre cdp equipe'
  );

  src = mustReplace(
    src,
`                paddingLeft="4.5rem"
              />`,
`                paddingLeft="4.5rem"
                showSeparator={idx > 0 && accountSection(subAccounts[idx - 1].label) === 'CDP' && accountSection(account.label) === 'EQUIPE'}
              />`,
    'separator subgroup dre'
  );
  src = mustReplace(
    src,
`              onAccountClick={onAccountClick}
            />`,
`              onAccountClick={onAccountClick}
              showSeparator={idx > 0 && accountSection(accounts[idx - 1].label) === 'CDP' && accountSection(account.label) === 'EQUIPE'}
            />`,
    'separator group dre'
  );
  src = mustReplace(src, 'function DreAccountRow({ account, meses, showMonths, onAccountClick, paddingLeft = "3rem" }) {', 'function DreAccountRow({ account, meses, showMonths, onAccountClick, paddingLeft = "3rem", showSeparator = false }) {', 'prop separator dre');
  src = mustReplace(src, '      style={{ background: "rgba(255,255,255,0.01)", cursor: "pointer", transition: "background 0.1s" }}', '      style={{ background: "rgba(255,255,255,0.01)", cursor: "pointer", transition: "background 0.1s", borderTop: showSeparator ? "2px solid var(--border-color)" : "none" }}', 'style separator dre');

  fs.writeFileSync(file, src);
}

// -----------------------------------------------------------------------------
// FLUXO / NFES
// -----------------------------------------------------------------------------
{
  const file = 'src/app/fluxo-caixa/page.js';
  let src = fs.readFileSync(file, 'utf8');

  src = mustReplace(src, 'import { getRolling30DayRange } from "@/lib/dateRange";', 'import { getRolling30DayRange } from "@/lib/dateRange";\nimport { getActiveProjectNames } from "@/lib/projectRules";', 'import projetos fluxo');
  src = mustReplace(src, '  const [data, setData] = useState([]);', '  const [data, setData] = useState([]);\n  const [projetosBrutos, setProjetosBrutos] = useState([]);', 'estado projetos fluxo');
  src = mustReplace(src, '      setData(result.data || []);\n      setSaldosBancarios', '      setData(result.data || []);\n      setProjetosBrutos(result.projetos || []);\n      setSaldosBancarios', 'set projetos fluxo');
  src = mustReplace(src, '  const projetosDisponiveis = Array.from(new Set(baseData.map(d => d.projeto).filter(Boolean))).sort();', '  const projetosDisponiveis = useMemo(() => getActiveProjectNames(projetosBrutos, true), [projetosBrutos]);', 'lista projetos fluxo');

  src = src.replace(/\n\s*const dataEmissao = String\(item\.dataEmissao \|\| ''\)\.trim\(\);/g, '');
  src = src.replace(/\n\s*dataEmissao,/g, '');
  src = src.replace(/\n\s*if \(!map\[key\]\.dataEmissao && dataEmissao\) map\[key\]\.dataEmissao = dataEmissao;/g, '');

  src = mustReplace(
    src,
`            <ReportAdder sectionKey="fluxo:faturamento-nfes" title="Painel de Faturamento (NFES)" componentName="Tabela de Faturamentos" page="Fluxo de Caixa" type="TABLE" data={faturamentosNfesFiltrados.map(row => ({ Documento: row.documento, Projeto: row.projeto, Data: row.data, Valor: row.valor, "Data de Emissão": row.dataEmissao || '', "Valor Real da Nota Fiscal": row.valorRealNota }))} filters={{ Tipo: "NFES", Situação: "A receber" }} style={{ float: 'right' }} />`,
`            <ReportAdder sectionKey="fluxo:faturamento-nfes" title="Painel de Faturamento (NFES)" componentName="Tabela de Faturamentos" page="Fluxo de Caixa" type="TABLE" data={faturamentosNfesFiltrados.map(row => ({ Documento: row.documento, Projeto: row.projeto, Vencimento: row.data, "Valor Bruto": row.valorRealNota, "Valor Líquido": row.valor }))} filters={{ Tipo: "NFES", Situação: "A receber" }} style={{ float: 'right' }} />`,
    'report nfes colunas'
  );

  src = mustRegex(
    src,
    /infoContent="Lista receitas da CR_GERAL[^\"]*"/,
    'infoContent="Relação de notas faturadas — A receber."',
    'descricao nfes'
  );

  src = mustReplace(
    src,
`                    <th>Data</th>
                    <th style={{ textAlign: 'right' }}>Valor</th>
                    <th>Data de Emissão</th>
                    <th style={{ textAlign: 'right' }}>Valor Real da Nota Fiscal</th>`,
`                    <th>Vencimento</th>
                    <th style={{ textAlign: 'right' }}>Valor Bruto</th>
                    <th style={{ textAlign: 'right' }}>Valor Líquido</th>`,
    'cabecalho nfes'
  );

  src = mustReplace(
    src,
`                      <td>{row.data}</td>
                      <td style={{ textAlign: 'right', color: 'var(--success)' }}>{formatCurrency(row.valor)}</td>
                      <td>{row.dataEmissao || '—'}</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-main)', fontWeight: '600' }}>{formatCurrency(row.valorRealNota)}</td>`,
`                      <td>{row.data}</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-main)', fontWeight: '600' }}>{formatCurrency(row.valorRealNota)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--success)' }}>{formatCurrency(row.valor)}</td>`,
    'linhas nfes'
  );

  src = src.replace('colSpan="6"', 'colSpan="5"');
  src = mustReplace(
    src,
`                      <td colSpan="3" style={{ fontWeight: '600', textAlign: 'right', borderTop: '2px solid var(--border-color)', padding: '0.5rem' }}>Total:</td>
                      <td style={{ fontWeight: '700', color: 'var(--success)', textAlign: 'right', borderTop: '2px solid var(--border-color)', padding: '0.5rem' }}>{formatCurrency(totalFaturamentosNfes)}</td>
                      <td style={{ borderTop: '2px solid var(--border-color)', padding: '0.5rem' }}></td>
                      <td style={{ fontWeight: '700', color: 'var(--text-main)', textAlign: 'right', borderTop: '2px solid var(--border-color)', padding: '0.5rem' }}>{formatCurrency(totalValorRealNfes)}</td>`,
`                      <td colSpan="3" style={{ fontWeight: '600', textAlign: 'right', borderTop: '2px solid var(--border-color)', padding: '0.5rem' }}>Total:</td>
                      <td style={{ fontWeight: '700', color: 'var(--text-main)', textAlign: 'right', borderTop: '2px solid var(--border-color)', padding: '0.5rem' }}>{formatCurrency(totalValorRealNfes)}</td>
                      <td style={{ fontWeight: '700', color: 'var(--success)', textAlign: 'right', borderTop: '2px solid var(--border-color)', padding: '0.5rem' }}>{formatCurrency(totalFaturamentosNfes)}</td>`,
    'footer nfes'
  );

  fs.writeFileSync(file, src);
}

console.log('Revisao funcional financeira aplicada.');
