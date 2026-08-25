from pathlib import Path
import re


def sub_once(text, pattern, replacement, label, flags=re.S):
    new_text, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"Trecho nao encontrado: {label} ({count})")
    return new_text


# Canonicalizar pontuacao residual dos nomes oficiais no processador.
business = Path('src/lib/businessRules.js')
src = business.read_text(encoding='utf-8')
src = src.replace("const label = String(project.OBRA || '').trim();", "const label = String(project.OBRA || '').trim().replace(/[.\\s]+$/g, '');")
business.write_text(src, encoding='utf-8')

# Projetos: lista do filtro usa os nomes ja agregados/canonicos exibidos na tela.
projects = Path('src/app/projetos/page.js')
src = projects.read_text(encoding='utf-8')
src = src.replace(
    '  const listaProjetos = getActiveProjectNames(projetosBrutos, true);',
    "  const listaProjetos = Array.from(new Set([...projetosCruzados.map(p => p.nome), 'ADMINISTRAÇÃO'])).sort((a, b) => a.localeCompare(b, 'pt-BR'));"
)
projects.write_text(src, encoding='utf-8')

# Visao Financeira: ranking de receitas usa obra + ADM e ABC agrega IDs duplicados.
view = Path('src/app/visao-financeira/page.js')
src = view.read_text(encoding='utf-8')

ranking_pattern = r'''  const topProjetosEntradas = useMemo\(\(\) => \{.*?\n  \}, \[filteredData, activeProjectKeys\]\);'''
ranking_new = '''  const topProjetosEntradas = useMemo(() => {
    const map = {};
    filteredData.forEach((item) => {
      if (item.natureza !== 'Entrada') return;
      const projectName = String(item.projeto || '').trim();
      const projectUpper = projectName.toUpperCase();
      if (!projectName || projectUpper.includes('ADMINISTRA') || projectUpper === 'GRUPO OAE' || projectUpper === 'SEM PROJETO') return;
      if (!activeProjectKeys.has(getProjectKey(projectName))) return;

      const rows = item.linhasOriginais?.length ? item.linhasOriginais : [item];
      const projectRevenue = rows.reduce((sum, row) => {
        const classification = classifyFinancialEntry(row);
        if (classification.type !== 'receita_projeto' && classification.type !== 'receita_administrativa') return sum;
        return sum + (Number(row.valor) || 0);
      }, 0);
      if (projectRevenue <= 0) return;
      map[projectName] = (map[projectName] || 0) + projectRevenue;
    });
    return Object.entries(map).map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor).slice(0, 10);
  }, [filteredData, activeProjectKeys]);'''
src = sub_once(src, ranking_pattern, lambda _: ranking_new, 'ranking receitas')

abc_pattern = r'''  const abcDonutData = useMemo\(\(\) => \{.*?\n  \}, \[activeProjects\]\);'''
abc_new = '''  const abcDonutData = useMemo(() => {
    const aggregated = new Map();
    activeProjects.forEach((project) => {
      const key = getProjectKey(project.ID || project.OBRA);
      const name = String(project.OBRA || '').trim().replace(/[.\\s]+$/g, '');
      if (!key || !name) return;
      if (!aggregated.has(key)) aggregated.set(key, { nome: name, contratado: 0, faturado: 0 });
      const current = aggregated.get(key);
      current.contratado += Number(project.CONTRATO) || 0;
      current.faturado += Number(project['NF FATURADAS']) || 0;
    });

    const projects = [...aggregated.values()]
      .filter(project => project.contratado > 0)
      .sort((a, b) => b.contratado - a.contratado);

    const classes = [
      { name: 'Classe A', color: 'var(--success)', rule: 'Contratos acima de R$ 500 mil', test: (value) => value > 500000 },
      { name: 'Classe B', color: 'var(--warning)', rule: 'Contratos de R$ 100 mil a R$ 500 mil', test: (value) => value >= 100000 && value <= 500000 },
      { name: 'Classe C', color: 'var(--danger)', rule: 'Contratos abaixo de R$ 100 mil', test: (value) => value < 100000 },
    ];

    return classes.map((definition) => {
      const classProjects = projects.filter((project) => definition.test(project.contratado));
      return {
        ...definition,
        value: classProjects.reduce((sum, project) => sum + project.contratado, 0),
        count: classProjects.length,
        projects: classProjects,
      };
    }).filter((item) => item.count > 0);
  }, [activeProjects]);'''
src = sub_once(src, abc_pattern, lambda _: abc_new, 'abc agregada')
view.write_text(src, encoding='utf-8')

# Fluxo: a tabela do Resumo de Hoje precisa rolar horizontalmente sem quebrar o modal.
flow = Path('src/app/fluxo-caixa/page.js')
src = flow.read_text(encoding='utf-8')
marker = '{/* Modal Drawer para Resumo de Hoje */}'
if marker not in src:
    raise RuntimeError('Marcador do modal Resumo de Hoje nao encontrado')
head, tail = src.split(marker, 1)
tail = tail.replace("<table style={{ fontSize: '12px' }}>", "<table style={{ fontSize: '12px', minWidth: '760px', width: '100%' }}>", 1)
tail = tail.replace("<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-elevated)' }}>", "<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', padding: '1.5rem', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-elevated)' }}>", 1)
src = head + marker + tail
flow.write_text(src, encoding='utf-8')

print('Refinamentos finais aplicados.')
