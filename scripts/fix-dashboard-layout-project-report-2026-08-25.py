from pathlib import Path


def replace_once(path, old, new, label):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: esperado 1 trecho, encontrado {count} em {path}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')
    print(f'OK {label}')


def replace_count(path, old, new, expected, label):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    count = text.count(old)
    if count != expected:
        raise RuntimeError(f'{label}: esperado {expected} trechos, encontrado {count} em {path}')
    p.write_text(text.replace(old, new), encoding='utf-8')
    print(f'OK {label} ({count})')


# Visao Financeira
visao = 'src/app/visao-financeira/page.js'
replace_once(
    visao,
    "        {/* ROW 1: Evolução Operacional e Resultado Financeiro */}\n        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: '1.5rem' }}>",
    "        {/* ROW 1: Evolução Operacional e Resultado Financeiro */}\n        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: '1.5rem', alignItems: 'stretch' }}>",
    'visao row 1 stretch',
)
replace_once(
    visao,
    "          <div id=\"report-visao-fluxo\" data-report-section className=\"card\" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>",
    "          <div id=\"report-visao-fluxo\" data-report-section className=\"card\" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>",
    'visao card fluxo',
)
replace_once(
    visao,
    "          <div id=\"report-visao-resultado\" data-report-section className=\"card\" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>",
    "          <div id=\"report-visao-resultado\" data-report-section className=\"card\" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>",
    'visao card resultado',
)
replace_count(
    visao,
    "            <div style={{ flex: 1, minHeight: '260px' }}>",
    "            <div style={{ flex: 1, minHeight: '320px', minWidth: 0 }}>",
    2,
    'visao areas graficos row 1',
)
replace_once(
    visao,
    "        {/* ROW 2: Status Financeiro e Curva ABC */}\n        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: '1.5rem' }}>",
    "        {/* ROW 2: Status Financeiro e Curva ABC */}\n        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: '1.5rem', alignItems: 'start' }}>",
    'visao row 2 start',
)
replace_once(
    visao,
    "          <div id=\"report-visao-status\" data-report-section className=\"card\" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>",
    "          <div id=\"report-visao-status\" data-report-section className=\"card\" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', minWidth: 0 }}>",
    'visao card status',
)
replace_once(
    visao,
    "            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '1rem', alignItems: 'start' }}>",
    "            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1.25rem', alignItems: 'start' }}>",
    'visao status grid responsivo',
)
replace_once(
    visao,
    "          <div id=\"report-visao-abc\" data-report-section className=\"card\" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>",
    "          <div id=\"report-visao-abc\" data-report-section className=\"card\" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>",
    'visao card abc',
)


# Projetos
projects = 'src/app/projetos/page.js'
replace_once(
    projects,
    "      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: '1rem', marginBottom: '2rem', alignItems: 'start' }}>",
    "      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: '1rem', marginBottom: '2rem', alignItems: 'stretch' }}>",
    'projetos composicao resultado stretch',
)
replace_once(
    projects,
    "        <div className=\"card\" style={{ padding: '1.5rem', borderTop: '2px solid var(--primary)' }}>",
    "        <div className=\"card\" style={{ padding: '1.5rem', borderTop: '2px solid var(--primary)', height: '100%' }}>",
    'projetos card composicao altura',
)
replace_once(
    projects,
    "        <div className=\"card\" style={{ padding: '1.5rem', borderTop: '2px solid var(--primary)', display: 'flex', flexDirection: 'column' }}>",
    "        <div className=\"card\" style={{ padding: '1.5rem', borderTop: '2px solid var(--primary)', display: 'flex', flexDirection: 'column', height: '100%' }}>",
    'projetos card resultado altura',
)
replace_once(
    projects,
    "      <div className=\"card\" style={{ padding: '1.5rem', marginBottom: '2rem' }}>\n        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>\n          <div>\n            <h2 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.25rem' }}>Custo de Equipe por Projeto</h2>",
    "      <div data-report-control data-report-exclude className=\"card\" style={{ padding: '1.5rem', marginBottom: '2rem', display: isReportMode ? 'none' : 'block' }}>\n        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>\n          <div>\n            <h2 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.25rem' }}>Custo de Equipe por Projeto</h2>",
    'projetos ocultar equipe no relatorio',
)
replace_once(
    projects,
    "            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Contas EQUIP. TÉC. somadas nos projetos exibidos. Ao filtrar uma obra, os valores passam a representar somente aquela obra. Este painel fica somente em Projetos e não é oferecido no Relatório Executivo.</p>",
    "            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Custos de equipe técnica somados por projeto no período e filtros selecionados.</p>",
    'projetos legenda equipe',
)
replace_once(
    projects,
    "          <RankingBarChart data={teamCostsChartData} dataKey=\"Valor\" color=\"var(--warning)\" emptyMessage=\"Sem contas de equipe identificadas para os projetos filtrados.\" />",
    "          <RankingBarChart data={teamCostsChartData} dataKey=\"Valor\" color=\"var(--warning)\" emptyMessage=\"Sem dados de equipe no período.\" />",
    'projetos mensagem vazia equipe',
)


# Relatorio Executivo: elimina bloco legado de equipes salvo no navegador/modelos.
context = 'src/contexts/ReportContext.js'
insert_anchor = 'const MAX_PERSISTED_ROWS = 500;\n'
insert_block = '''const MAX_PERSISTED_ROWS = 500;\n\nfunction normalizeReportText(value) {\n  return String(value || \"\")\n    .normalize(\"NFD\")\n    .replace(/[\\u0300-\\u036f]/g, \"\")\n    .toUpperCase();\n}\n\nfunction isExcludedExecutiveSection(section) {\n  const text = normalizeReportText([\n    section?.sectionKey,\n    section?.title,\n    section?.componentName,\n  ].filter(Boolean).join(\" \"));\n  return text.includes(\"EQUIPE\") && text.includes(\"PROJETO\");\n}\n\nfunction sanitizeReportItems(items) {\n  return Array.isArray(items) ? items.filter((item) => !isExcludedExecutiveSection(item)) : [];\n}\n\nfunction sanitizeReportTemplates(templates) {\n  if (!Array.isArray(templates)) return [];\n  return templates.map((template) => ({\n    ...template,\n    sections: Array.isArray(template.sections)\n      ? template.sections.filter((section) => !isExcludedExecutiveSection(section))\n      : [],\n  }));\n}\n'''
replace_once(context, insert_anchor, insert_block, 'report helper exclusao equipe')
replace_once(
    context,
    '      setReportItems(Array.isArray(savedItems) ? savedItems : []);',
    '      setReportItems(sanitizeReportItems(savedItems));',
    'report sanitizar itens salvos',
)
replace_once(
    context,
    '      setTemplates(Array.isArray(savedTemplates) ? savedTemplates : []);',
    '      setTemplates(sanitizeReportTemplates(savedTemplates));',
    'report sanitizar modelos',
)
replace_once(
    context,
    '  const registerSection = useCallback((section) => {\n    if (!section?.sectionKey && (!section?.page || !section?.title)) return;',
    '  const registerSection = useCallback((section) => {\n    if (isExcludedExecutiveSection(section)) return;\n    if (!section?.sectionKey && (!section?.page || !section?.title)) return;',
    'report bloquear registro equipe',
)
replace_once(
    context,
    '  const addReportItem = useCallback((section) => {\n    const normalized = snapshotSection(section);',
    '  const addReportItem = useCallback((section) => {\n    if (isExcludedExecutiveSection(section)) return;\n    const normalized = snapshotSection(section);',
    'report bloquear adicao equipe',
)
replace_once(
    context,
    '      const matches = Object.values(availableSections).filter((section) =>\n        section.presetTags?.includes(presetTag) &&',
    '      const matches = Object.values(availableSections).filter((section) =>\n        !isExcludedExecutiveSection(section) &&\n        section.presetTags?.includes(presetTag) &&',
    'report bloquear equipe preset',
)

print('Todos os ajustes foram aplicados.')
