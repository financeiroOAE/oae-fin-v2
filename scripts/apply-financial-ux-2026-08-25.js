const fs = require('fs');
const path = require('path');

function read(file) {
  return fs.readFileSync(path.join(process.cwd(), file), 'utf8');
}

function write(file, content) {
  fs.writeFileSync(path.join(process.cwd(), file), content);
  console.log(`Atualizado: ${file}`);
}

function replaceRequired(src, search, replacement, label) {
  const next = typeof search === 'string' ? src.replace(search, replacement) : src.replace(search, replacement);
  if (next === src) throw new Error(`Trecho não encontrado: ${label}`);
  return next;
}

function patchProjetos() {
  const file = 'src/app/projetos/page.js';
  let src = read(file);

  src = replaceRequired(
    src,
    'import { getRolling30DayRange } from "@/lib/dateRange";',
    'import { getRolling30DayRange } from "@/lib/dateRange";\nimport { isRevenueTax, getRevenueTaxLabel } from "@/lib/financialClassification";',
    'import financialClassification projetos'
  );

  src = replaceRequired(
    src,
    `  const dIni = filterDataInicial ? new Date(filterDataInicial + 'T00:00:00').getTime() : 0;\n  const dFim = filterDataFinal ? new Date(filterDataFinal + 'T23:59:59').getTime() : Infinity;\n  const currentYear = new Date().getFullYear();\n  const realizadoIni = new Date(currentYear, 0, 1).getTime();\n  const realizadoFim = new Date().setHours(23, 59, 59, 999);`,
    `  const dIni = filterDataInicial ? new Date(filterDataInicial + 'T00:00:00').getTime() : 0;\n  const dFim = filterDataFinal ? new Date(filterDataFinal + 'T23:59:59').getTime() : Infinity;\n  // O mesmo período selecionado passa a reger realizado e previsto.\n  const realizadoIni = dIni;\n  const realizadoFim = dFim;`,
    'periodo projetos'
  );

  src = replaceRequired(
    src,
    /\n  \/\/ Helper para classificar tributos no gráfico de Impostos[\s\S]*?\n  const dreStats = useMemo\(\(\) => \{/,
    '\n  const dreStats = useMemo(() => {',
    'remover classificador antigo de impostos'
  );

  src = replaceRequired(
    src,
    `      const taxCategory = getTaxCategory(item);\n\n      if (taxCategory) {\n        const val = Math.abs(item.valor || 0);\n        taxesMap[taxCategory] = (taxesMap[taxCategory] || 0) + val;\n        totalTaxes += val;\n      }`,
    `      if (!isRevenueTax(item)) return;\n      const taxCategory = getRevenueTaxLabel(item);\n      const val = Math.abs(item.valor || 0);\n      taxesMap[taxCategory] = (taxesMap[taxCategory] || 0) + val;\n      totalTaxes += val;`,
    'impostos sobre faturamento'
  );

  src = replaceRequired(
    src,
    '  }, [data, filteredProjetos, realizadoIni, realizadoFim, getTaxCategory]);',
    '  }, [data, filteredProjetos, realizadoIni, realizadoFim]);',
    'dependencias impostos'
  );

  src = replaceRequired(
    src,
    /  const abcDonutData = useMemo\(\(\) => \{[\s\S]*?\n  \}, \[filteredProjetos\]\);/,
    `  const abcDonutData = useMemo(() => {\n    const projects = [...filteredProjetos].filter(p => p.contratado > 0).sort((a, b) => b.contratado - a.contratado);\n    const classes = [\n      { name: 'Classe A', color: 'var(--success)', rule: 'Contratos acima de R$ 500 mil', test: (v) => v > 500000 },\n      { name: 'Classe B', color: 'var(--warning)', rule: 'Contratos de R$ 100 mil a R$ 500 mil', test: (v) => v >= 100000 && v <= 500000 },\n      { name: 'Classe C', color: 'var(--danger)', rule: 'Contratos abaixo de R$ 100 mil', test: (v) => v < 100000 },\n    ];\n    return classes.map(def => {\n      const classProjects = projects.filter(p => def.test(p.contratado));\n      return { ...def, value: classProjects.reduce((sum, p) => sum + p.contratado, 0), count: classProjects.length, projects: classProjects };\n    }).filter(item => item.count > 0);\n  }, [filteredProjetos]);`,
    'curva abc por faixa'
  );

  src = src.replaceAll('Recebido em 2026', 'Recebido no período');
  src = src.replaceAll('Projetos com maior volume recebido em 2026', 'Projetos com maior receita recebida no período selecionado');
  src = src.replaceAll('5 Maiores Entradas de Caixa', '5 Maiores Fontes de Receita — Projetos');
  src = src.replaceAll('5 Maiores Entradas', '5 Maiores Fontes de Receita — Projetos');
  src = src.replaceAll('Exibe os 5 projetos com maior total de movimentações de <strong>Entrada</strong> realizadas em 2026.', 'Exibe os 5 projetos/obras com maior receita recebida no período. Administração não entra neste ranking.');

  src = replaceRequired(
    src,
    `<input type="date" value={filterDataInicial} readOnly aria-readonly="true" title="Período fixo: hoje"\n              style={{ width: '100%', height: '34px', fontSize: '13px', color: 'var(--text-main)', background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0 0.5rem' }} />`,
    `<input type="date" value={filterDataInicial} onChange={(e) => setFilterDataInicial(e.target.value)}\n              style={{ width: '100%', height: '34px', fontSize: '13px', color: 'var(--text-main)', background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0 0.5rem' }} />`,
    'data inicial projetos'
  );

  src = replaceRequired(
    src,
    `<input type="date" value={filterDataFinal} readOnly aria-readonly="true" title="Período fixo: 30 dias à frente"\n              style={{ width: '100%', height: '34px', fontSize: '13px', color: 'var(--text-main)', background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0 0.5rem' }} />`,
    `<input type="date" value={filterDataFinal} onChange={(e) => setFilterDataFinal(e.target.value)}\n              style={{ width: '100%', height: '34px', fontSize: '13px', color: 'var(--text-main)', background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0 0.5rem' }} />`,
    'data final projetos'
  );

  src = replaceRequired(
    src,
    `<InfoTooltip title="Curva ABC" content={<><p>Classifica a relevância dos projetos filtrados com base em seu Valor Contratado.</p><ul style={{ paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.5rem' }}><li><strong style={{ color: 'var(--success)' }}>Classe A:</strong> Projetos que somam os primeiros 80% do valor total da carteira.</li><li><strong style={{ color: 'var(--warning)' }}>Classe B:</strong> Projetos que somam entre 80% e 95% do valor total.</li><li><strong style={{ color: 'var(--danger)' }}>Classe C:</strong> Projetos que compõem os últimos 5% (cauda).</li></ul><p style={{ marginTop: '0.5rem' }}>A separação é feita ordenando todos os projetos do maior para o menor contrato e calculando o acumulado percentual.</p></>} />`,
    `<InfoTooltip title="Curva ABC" content={<><p>Classifica os projetos pelo <strong>valor individual do contrato</strong>.</p><ul style={{ paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.5rem' }}><li><strong style={{ color: 'var(--success)' }}>Classe A:</strong> acima de R$ 500 mil.</li><li><strong style={{ color: 'var(--warning)' }}>Classe B:</strong> de R$ 100 mil a R$ 500 mil.</li><li><strong style={{ color: 'var(--danger)' }}>Classe C:</strong> abaixo de R$ 100 mil.</li></ul></>} />`,
    'tooltip curva abc'
  );

  src = replaceRequired(
    src,
    `<InfoTooltip title="Impostos sobre Notas Fiscais" content={<><p>Mostra os tributos e retenções associados ao faturamento.</p></>} />`,
    `<InfoTooltip title="Impostos sobre Faturamento" content={<><p>Usa as saídas classificadas como deduções/impostos sobre faturamento e vinculadas aos projetos filtrados.</p><p style={{ marginTop: '0.5rem' }}><strong>Não inclui retenções de fornecedor.</strong></p></>} />`,
    'tooltip impostos'
  );

  src = replaceRequired(
    src,
    `  const selectedProjectMoves = useMemo(() => {\n    if (!selectedProject) return [];\n    return data.filter(item => getProjectKey(item.projeto) === selectedProject.projectKey);\n  }, [selectedProject, data]);`,
    `  const selectedProjectMoves = useMemo(() => {\n    if (!selectedProject) return [];\n    return data.filter(item => getProjectKey(item.projeto) === selectedProject.projectKey);\n  }, [selectedProject, data]);\n\n  const selectedProjectTeamCosts = useMemo(() => {\n    if (!selectedProject) return [];\n    const map = {};\n    selectedProjectMoves.forEach(item => {\n      if (item.natureza !== 'Saída') return;\n      const accountText = String(item.contaNome || item.contaDescricao || '').toUpperCase();\n      if (!accountText.includes('EQUIP')) return;\n      const account = item.contaNome || item.contaDescricao || item.contaCodigo || 'Equipe não identificada';\n      if (!map[account]) map[account] = { Conta: account, Pago: 0, 'A Pagar': 0, Total: 0 };\n      const value = Math.abs(Number(item.valor) || 0);\n      const status = String(item.status || '').toUpperCase();\n      if (status.includes('REALIZADO') || status.includes('PAGO') || status.includes('EFETIVADO')) map[account].Pago += value;\n      else if (status.includes('A REALIZAR') || status.includes('A PAGAR') || status.includes('PREVISTO')) map[account]['A Pagar'] += value;\n      map[account].Total += value;\n    });\n    return Object.values(map).sort((a, b) => b.Total - a.Total);\n  }, [selectedProject, selectedProjectMoves]);`,
    'custos equipe projeto'
  );

  src = replaceRequired(
    src,
    `              <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '0.75rem', color: 'var(--text-main)' }}>Extrato de Movimentações</h3>`,
    `              <div style={{ marginBottom: '2rem' }}>\n                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '0.35rem', color: 'var(--text-main)' }}>Custo de Equipe do Projeto</h3>\n                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Custos classificados em contas de equipe, separados por conta dentro do centro de custo/obra selecionado.</p>\n                <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>\n                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>\n                    <thead style={{ background: 'var(--bg-elevated)' }}>\n                      <tr><th style={{ padding: '0.65rem', textAlign: 'left' }}>Conta de Equipe</th><th style={{ padding: '0.65rem', textAlign: 'right' }}>Pago</th><th style={{ padding: '0.65rem', textAlign: 'right' }}>A Pagar</th><th style={{ padding: '0.65rem', textAlign: 'right' }}>Total</th></tr>\n                    </thead>\n                    <tbody>\n                      {selectedProjectTeamCosts.length ? selectedProjectTeamCosts.map((row) => (\n                        <tr key={row.Conta} style={{ borderTop: '1px solid var(--border-color)' }}><td style={{ padding: '0.65rem' }}>{row.Conta}</td><td style={{ padding: '0.65rem', textAlign: 'right' }}>{formatCurrency(row.Pago)}</td><td style={{ padding: '0.65rem', textAlign: 'right' }}>{formatCurrency(row['A Pagar'])}</td><td style={{ padding: '0.65rem', textAlign: 'right', fontWeight: '700' }}>{formatCurrency(row.Total)}</td></tr>\n                      )) : <tr><td colSpan={4} style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Sem custos de equipe identificados para este projeto.</td></tr>}\n                    </tbody>\n                  </table>\n                </div>\n              </div>\n\n              <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '0.75rem', color: 'var(--text-main)' }}>Extrato de Movimentações</h3>`,
    'tabela custo equipe'
  );

  write(file, src);
}

function patchVisao() {
  const file = 'src/app/visao-financeira/page.js';
  let src = read(file);

  src = replaceRequired(
    src,
    'import { getRolling30DayRange } from "@/lib/dateRange";',
    'import { getRolling30DayRange } from "@/lib/dateRange";\nimport { classifyFinancialEntry } from "@/lib/financialClassification";',
    'import classificacao visao'
  );

  src = replaceRequired(
    src,
    `<input type="date" value={filterDataInicial} readOnly aria-readonly="true" title="Período fixo: hoje" style={{ width: '100%', height: '34px', fontSize: '13px', background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '6px', padding: '0 0.5rem' }} />`,
    `<input type="date" value={filterDataInicial} onChange={(e) => setFilterDataInicial(e.target.value)} style={{ width: '100%', height: '34px', fontSize: '13px', background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '6px', padding: '0 0.5rem' }} />`,
    'data inicial visao'
  );
  src = replaceRequired(
    src,
    `<input type="date" value={filterDataFinal} readOnly aria-readonly="true" title="Período fixo: 30 dias à frente" style={{ width: '100%', height: '34px', fontSize: '13px', background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '6px', padding: '0 0.5rem' }} />`,
    `<input type="date" value={filterDataFinal} onChange={(e) => setFilterDataFinal(e.target.value)} style={{ width: '100%', height: '34px', fontSize: '13px', background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '6px', padding: '0 0.5rem' }} />`,
    'data final visao'
  );

  src = replaceRequired(
    src,
    /  \/\/ Base de conteúdo sem recorte temporal\.[\s\S]*?  const projetosDisponiveis =/,
    `  const realizedFilteredData = useMemo(() => filteredData.filter(item =>\n    String(item.status || '').trim().toUpperCase() === 'REALIZADO'\n  ), [filteredData]);\n\n  const projetosDisponiveis =`,
    'realizado respeitando data'
  );
  src = src.replaceAll('realized2026Data', 'realizedFilteredData');

  src = replaceRequired(
    src,
    `  const topProjetosEntradas = useMemo(() => {\n    const map = {};\n    filteredData.filter(i => i.natureza === 'Entrada' && i.projeto).forEach(i => {\n      map[i.projeto] = (map[i.projeto] || 0) + i.valor;\n    });\n    return Object.entries(map).map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor).slice(0, 10);\n  }, [filteredData]);`,
    `  const topProjetosEntradas = useMemo(() => {\n    const map = {};\n    filteredData.filter(i => {\n      const classification = classifyFinancialEntry(i);\n      return classification.type === 'receita_projeto' && i.projeto && !String(i.projeto).toUpperCase().includes('ADMINISTRA');\n    }).forEach(i => {\n      map[i.projeto] = (map[i.projeto] || 0) + i.valor;\n    });\n    return Object.entries(map).map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor).slice(0, 10);\n  }, [filteredData]);`,
    'ranking projetos entradas'
  );

  src = replaceRequired(
    src,
    `  const topContasEntradas = useMemo(() => {\n    const map = {};\n    filteredData.filter(i => i.natureza === 'Entrada' && i.contaDescricao).forEach(i => {\n      map[i.contaDescricao] = (map[i.contaDescricao] || 0) + i.valor;\n    });\n    return Object.entries(map).map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor).slice(0, 10);\n  }, [filteredData]);`,
    `  const entryCategoryData = useMemo(() => {\n    const map = {};\n    filteredData.filter(i => i.natureza === 'Entrada').forEach(i => {\n      const classification = classifyFinancialEntry(i);\n      map[classification.label] = (map[classification.label] || 0) + (Number(i.valor) || 0);\n    });\n    return Object.entries(map).map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor);\n  }, [filteredData]);`,
    'categorias economicas entradas'
  );

  src = src.replaceAll("map[idx] = { mesNome: m, Entradas: 0, 'Receitas Previstas': 0, Saídas: 0, mesId: idx };", "map[idx] = { mesNome: m, 'Entradas Realizadas': 0, 'Entradas Programadas': 0, Saídas: 0, mesId: idx };");
  src = src.replaceAll("if (isPrevisto) map[mIdx]['Receitas Previstas'] += item.valor;\n            else map[mIdx].Entradas += item.valor;", "if (isPrevisto) map[mIdx]['Entradas Programadas'] += item.valor;\n            else map[mIdx]['Entradas Realizadas'] += item.valor;");

  src = src.replaceAll('Fluxo Financeiro Anual — 2026', 'Movimentações Financeiras Anuais — 2026');
  src = src.replaceAll('Consolidação dos 12 meses — independente do filtro de datas', 'Entradas realizadas, títulos programados a receber e saídas. Entradas programadas não são meta nem orçamento. Visão anual independente do filtro de datas.');
  src = src.replaceAll('10 Centros de Custo por Entradas', '10 Projetos por Receita de Projetos');
  src = src.replaceAll('Maiores volumes recebidos e a receber', 'Projetos com maior volume de receita no período selecionado; Administração, empréstimos e aportes não entram neste ranking.');
  src = src.replaceAll('titulo="Recebimentos"', 'titulo="Entradas"');
  src = src.replaceAll('> Recebido</p>', '> Entradas Realizadas</p>');

  src = replaceRequired(
    src,
    `              data={topContasEntradas} \n              title="Receitas por Plano de Conta" \n              infoContent="Concentração por contas contábeis de Entradas"`,
    `              data={entryCategoryData} \n              title="Composição das Entradas por Natureza" \n              infoContent="Separa Receita de Projetos, Receitas Administrativas, Outras Receitas, Empréstimos/Financiamentos, Aportes, Movimentações Financeiras e Outras Entradas. Empréstimos e aportes são entradas de caixa, mas não são receita."`,
    'grafico composicao entradas'
  );

  write(file, src);
}

function patchFluxo() {
  const file = 'src/app/fluxo-caixa/page.js';
  let src = read(file);

  src = replaceRequired(
    src,
    `<input type="date" value={filterDataInicial} readOnly aria-readonly="true" title="Período fixo: hoje" />`,
    `<input type="date" value={filterDataInicial} onChange={(e) => setFilterDataInicial(e.target.value)} />`,
    'data inicial fluxo'
  );
  src = replaceRequired(
    src,
    `<input type="date" value={filterDataFinal} readOnly aria-readonly="true" title="Período fixo: 30 dias à frente" />`,
    `<input type="date" value={filterDataFinal} onChange={(e) => setFilterDataFinal(e.target.value)} />`,
    'data final fluxo'
  );

  src = src.replaceAll("meses.forEach((m, i) => map[i] = { mesNome: m, Entradas: 0, 'Receitas Previstas': 0, Saídas: 0, Resultado: 0, id: i });", "meses.forEach((m, i) => map[i] = { mesNome: m, 'Entradas Realizadas': 0, 'Entradas Programadas': 0, Saídas: 0, Resultado: 0, id: i });");
  src = src.replaceAll("if (isPrevisto) map[m]['Receitas Previstas'] += item.valor;\n            else map[m].Entradas += item.valor;", "if (isPrevisto) map[m]['Entradas Programadas'] += item.valor;\n            else map[m]['Entradas Realizadas'] += item.valor;");
  src = src.replaceAll('Fluxo Financeiro Anual — 2026', 'Movimentações Financeiras Anuais — 2026');
  src = src.replaceAll('Receitas Previstas', 'Entradas Programadas');

  const filtersEnd = `      </div>\n\n      {/* KPIs */}`;
  if (src.includes(filtersEnd)) {
    src = src.replace(filtersEnd, `      </div>\n\n      <div style={{ margin: '-0.5rem 0 1.25rem', padding: '0.7rem 0.9rem', borderLeft: '3px solid var(--primary)', background: 'var(--bg-elevated)', borderRadius: '6px', color: 'var(--text-secondary)', fontSize: '12px' }}>\n        <strong style={{ color: 'var(--text-main)' }}>Leitura das entradas:</strong> entradas de caixa podem ser Receita, Empréstimo/Financiamento, Aporte ou outras movimentações. Não trate o total de entradas automaticamente como receita operacional.\n      </div>\n\n      {/* KPIs */}`);
  }

  write(file, src);
}

patchProjetos();
patchVisao();
patchFluxo();
console.log('Ajustes financeiros aplicados com sucesso.');
