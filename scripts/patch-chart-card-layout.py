from pathlib import Path

page = Path('src/app/visao-financeira/page.js')
text = page.read_text(encoding='utf-8')

old_grid = "<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: '1.5rem', alignItems: 'start' }}>"
new_grid = "<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: '1.5rem', alignItems: 'stretch' }}>"
if old_grid not in text:
    raise SystemExit('grid de Status/ABC nao encontrado')
text = text.replace(old_grid, new_grid, 1)

old_status = "<div id=\"report-visao-status\" data-report-section className=\"card\" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', minWidth: 0 }}>"
new_status = "<div id=\"report-visao-status\" data-report-section className=\"card\" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%' }}>"
if old_status not in text:
    raise SystemExit('card Status nao encontrado')
text = text.replace(old_status, new_status, 1)

old_abc = "<div id=\"report-visao-abc\" data-report-section className=\"card\" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>"
new_abc = "<div id=\"report-visao-abc\" data-report-section className=\"card\" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', minWidth: 0, maxWidth: '100%', overflow: 'hidden', height: '100%' }}>"
if old_abc not in text:
    raise SystemExit('card ABC nao encontrado')
text = text.replace(old_abc, new_abc, 1)

page.write_text(text, encoding='utf-8')
print('Layout de Status/ABC ajustado sem alterar dados.')
