from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise RuntimeError(f'Trecho nao encontrado: {label}')
    return text.replace(old, new, 1)

# Fluxo de Caixa: apenas nomenclatura/alinhamento visual dos KPIs.
flow_path = Path('src/app/fluxo-caixa/page.js')
flow = flow_path.read_text(encoding='utf-8')
flow = replace_once(
    flow,
    "<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>",
    "<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem', alignItems: 'stretch' }}>",
    'grid KPIs fluxo'
)
flow = replace_once(flow, '>Entradas de Caixa</p>', '>Entradas</p>', 'titulo Entradas')

marker_start = flow.index('{/* Linha Executiva Compacta de KPIs */}')
marker_end = flow.index("<div style={{ display: 'flex', gap: '1.5rem'", marker_start)
kpi_block = flow[marker_start:marker_end]
kpi_block = kpi_block.replace(
    "className=\"card\" style={{ padding: '1.25rem',",
    "className=\"card\" style={{ padding: '1.25rem', height: '100%', minWidth: 0,",
)
flow = flow[:marker_start] + kpi_block + flow[marker_end:]
flow_path.write_text(flow, encoding='utf-8')

# Projetos: padronizar os botoes de exportacao do detalhe com o mesmo visual de acoes do sistema.
projects_path = Path('src/app/projetos/page.js')
projects = projects_path.read_text(encoding='utf-8')
projects = projects.replace('ChevronLeft, ChevronRight, Download, FileSpreadsheet', 'ChevronLeft, ChevronRight, FileSpreadsheet')

old_pdf = '''<button onClick={exportSelectedProjectPdf} className="btn" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.48rem 0.7rem', fontSize: '11px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}>
                  <Download size={14} /> Relatório Executivo PDF
                </button>'''
new_pdf = '''<button onClick={exportSelectedProjectPdf} className="btn" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', minHeight: '38px', padding: '0 0.85rem', fontSize: '13px', fontWeight: '600', background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '6px', whiteSpace: 'nowrap' }}>
                  <FileText size={14} /> Gerar PDF
                </button>'''
projects = replace_once(projects, old_pdf, new_pdf, 'botao PDF projeto')

old_excel = '''<button onClick={exportSelectedProjectExcel} className="btn" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.48rem 0.7rem', fontSize: '11px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}>
                  <FileSpreadsheet size={14} /> Movimentações Excel
                </button>'''
new_excel = '''<button onClick={exportSelectedProjectExcel} className="btn" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', minHeight: '38px', padding: '0 0.85rem', fontSize: '13px', fontWeight: '600', background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '6px', whiteSpace: 'nowrap' }}>
                  <FileSpreadsheet size={14} /> Exportar Excel
                </button>'''
projects = replace_once(projects, old_excel, new_excel, 'botao Excel projeto')

projects_path.write_text(projects, encoding='utf-8')
print('Fechamento visual aplicado sem alterar calculos ou valores.')
