const fs = require('fs');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content, 'utf8');
}

function replaceOnce(content, before, after, label) {
  if (!content.includes(before)) throw new Error(`Trecho nao encontrado: ${label}`);
  return content.replace(before, after);
}

// 1) O contexto passa a remover blocos que deixaram de existir na pagina.
{
  const path = 'src/contexts/ReportContext.js';
  let content = read(path);

  content = replaceOnce(
    content,
    `  const addReportItem = useCallback((section) => {`,
    `  const unregisterSection = useCallback((sectionKey) => {\n    if (!sectionKey) return;\n    setAvailableSections((current) => {\n      if (!current[sectionKey]) return current;\n      const next = { ...current };\n      delete next[sectionKey];\n      return next;\n    });\n  }, []);\n\n  const addReportItem = useCallback((section) => {`,
    'unregisterSection'
  );

  content = replaceOnce(
    content,
    `        registerSection,\n        availableSections,`,
    `        registerSection,\n        unregisterSection,\n        availableSections,`,
    'provider unregisterSection'
  );

  write(path, content);
}

// 2) Todo ReportAdder se desregistra ao sair da arvore, evitando opcoes fantasma no construtor.
{
  const path = 'src/components/report/ReportAdder.jsx';
  let content = read(path);

  content = replaceOnce(
    content,
    `  const { isReportMode, activeReportPage, addReportItem, reportItems, registerSection } = useReport();`,
    `  const { isReportMode, activeReportPage, addReportItem, reportItems, registerSection, unregisterSection } = useReport();`,
    'desestruturacao unregisterSection'
  );

  content = replaceOnce(
    content,
    `  useEffect(() => {\n    registerSection(section);\n  }, [registerSection, section]);`,
    `  useEffect(() => {\n    registerSection(section);\n  }, [registerSection, section]);\n\n  // O registro de uma secao deve existir somente enquanto o bloco correspondente\n  // estiver montado. O cleanup usa apenas a chave, para nao apagar/recriar a secao\n  // a cada atualizacao de dados do mesmo bloco.\n  useEffect(() => {\n    return () => unregisterSection?.(normalizedKey);\n  }, [normalizedKey, unregisterSection]);`,
    'cleanup ReportAdder'
  );

  write(path, content);
}

// 3) Projetos registra relatorios individuais a partir da lista FILTRADA, nao dos drawers ja visitados.
{
  const path = 'src/app/projetos/page.js';
  let content = read(path);

  content = replaceOnce(
    content,
    `  const { isReportMode, openReportBuilder, exitReportMode } = useReport();`,
    `  const { isReportMode, openReportBuilder, exitReportMode, reportItems, setReportItems } = useReport();`,
    'useReport Projetos'
  );

  const anchor = `  const selectedProjectMoves = useMemo(() => {`;
  const block = `  const projectReportMovesByKey = useMemo(() => {\n    const allowedProjectKeys = new Set(filteredProjetos.map((project) => project.projectKey));\n    const map = new Map(filteredProjetos.map((project) => [project.projectKey, []]));\n    const start = filterDataInicial ? new Date(\`${'${filterDataInicial}'}T00:00:00\`).getTime() : 0;\n    const end = filterDataFinal ? new Date(\`${'${filterDataFinal}'}T23:59:59\`).getTime() : Infinity;\n\n    data.forEach((item) => {\n      const itemProjectKey = item.natureza === 'Entrada' && isProjectRelatedRevenueEntry(item)\n        ? getFinancialRevenueProjectIdentity(item).projectKey\n        : getProjectKey(item.projeto);\n      if (!allowedProjectKeys.has(itemProjectKey)) return;\n\n      const parts = String(item.data || '').split('/');\n      if (parts.length === 3) {\n        const timestamp = new Date(\`${'${parts[2]}'}-${'${parts[1]}'}-${'${parts[0]}'}T12:00:00\`).getTime();\n        if (timestamp < start || timestamp > end) return;\n      }\n\n      map.get(itemProjectKey)?.push(item);\n    });\n\n    return map;\n  }, [data, filteredProjetos, filterDataInicial, filterDataFinal]);\n\n  const individualProjectReportSections = useMemo(() => filteredProjetos.map((project) => {\n    const summary = [{\n      Projeto: project.nome,\n      Empresa: project.empresa || '',\n      Tipo: project.tipo || '',\n      Contratado: Number(project.contratado) || 0,\n      Faturado: Number(project.faturado) || 0,\n      'Faturado em 2026': Number(project.faturado2026) || 0,\n      'Recebido Líquido': Number(project.recebido) || 0,\n      'A Receber': Number(project.aReceber) || 0,\n      Pago: Number(project.pago) || 0,\n      'A Pagar': Number(project.aPagar) || 0,\n      Resultado: Number(project.resultadoCaixa) || 0,\n    }];\n\n    const movements = (projectReportMovesByKey.get(project.projectKey) || []).map((item) => ({\n      Data: item.data || '',\n      Natureza: item.natureza || '',\n      Situação: item.status || '',\n      'Nome / Fornecedor': item.nome || '',\n      Conta: item.contaNome || item.contaDescricao || item.contaCodigo || '',\n      Documento: item.documento || '',\n      Lançamento: item.lancamento || '',\n      Valor: Number(item.valor) || 0,\n    }));\n\n    return {\n      sectionKey: \`projetos:executivo-selecionado:${'${project.projectKey}'}\`,\n      title: \`Relatório Executivo — ${'${project.nome}'}\`,\n      componentName: 'Relatório Executivo do Projeto',\n      page: 'Projetos',\n      type: 'TABLE',\n      data: summary,\n      dataSets: { summary, all: movements },\n      detailMode: 'summary',\n      detailOptions: ['summary', 'all'],\n      filters: {\n        Projeto: project.nome,\n        Empresa: project.empresa || 'Todas',\n        Tipo: project.tipo || 'Todos',\n        'Data inicial': filterDataInicial || 'Todas',\n        'Data final': filterDataFinal || 'Todas',\n      },\n      explanation: 'Relatório executivo do projeto filtrado, com opção de resumo ou todos os lançamentos do período.',\n    };\n  }), [filteredProjetos, projectReportMovesByKey, filterDataInicial, filterDataFinal]);\n\n  const activeIndividualReportKeys = useMemo(\n    () => new Set(individualProjectReportSections.map((section) => section.sectionKey)),\n    [individualProjectReportSections]\n  );\n\n  const activeIndividualReportSignature = useMemo(\n    () => [...activeIndividualReportKeys].sort().join('|'),\n    [activeIndividualReportKeys]\n  );\n\n  // Remove da ordem/exportacao relatorios individuais de projetos que sairam do filtro.\n  // A dependencia de reportItems tambem limpa selecoes antigas restauradas do localStorage.\n  useEffect(() => {\n    setReportItems((current) => {\n      let changed = false;\n      const next = current.filter((item) => {\n        const key = String(item?.sectionKey || '');\n        if (!key.startsWith('projetos:executivo-selecionado:')) return true;\n        const keep = activeIndividualReportKeys.has(key);\n        if (!keep) changed = true;\n        return keep;\n      });\n      return changed ? next : current;\n    });\n  }, [activeIndividualReportSignature, activeIndividualReportKeys, reportItems, setReportItems]);\n\n`;

  content = replaceOnce(content, anchor, block + anchor, 'secoes individuais filtradas');

  // Remove o registrador ligado somente ao drawer selecionado. Agora a fonte e filteredProjetos.
  const drawerReportRegex = /\n\s*<ReportAdder\n\s*sectionKey=\{`projetos:executivo-selecionado:\$\{selectedProject\.projectKey\}`\}[\s\S]*?style=\{\{ display: 'none' \}\}\n\s*\/>/;
  if (!drawerReportRegex.test(content)) throw new Error('ReportAdder antigo do drawer nao encontrado');
  content = content.replace(drawerReportRegex, '');

  // Monta os registradores ocultos dos projetos atuais. Quando o filtro muda, o cleanup do ReportAdder remove os antigos.
  content = replaceOnce(
    content,
    `      {error && (\n        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid var(--danger)', padding: '0.75rem 1rem', borderRadius: '6px', marginBottom: '1rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '13px' }}>\n          <AlertCircle size={18} /> <strong>Erro:</strong> {error}\n        </div>\n      )}\n`,
    `      {error && (\n        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid var(--danger)', padding: '0.75rem 1rem', borderRadius: '6px', marginBottom: '1rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '13px' }}>\n          <AlertCircle size={18} /> <strong>Erro:</strong> {error}\n        </div>\n      )}\n\n      <div style={{ display: 'none' }} aria-hidden=\"true\">\n        {individualProjectReportSections.map((section) => (\n          <ReportAdder\n            key={section.sectionKey}\n            {...section}\n            style={{ display: 'none' }}\n          />\n        ))}\n      </div>\n`,
    'registradores ocultos filtrados'
  );

  write(path, content);
}

console.log('Sincronizacao dos relatorios individuais com os filtros de Projetos aplicada.');
