from pathlib import Path

path = Path('src/app/dre/page.js')
text = path.read_text(encoding='utf-8')

replacements = [
    (
        "    [...dreData.naoClassificados.items, ...intentionalOutsideItems].forEach((item, index) => {\n      const key = [item.data, item.documento, item.lancamento, item.contaCodigo, item.projeto, item.valor, index < dreData.naoClassificados.items.length ? 'pending' : 'outside'].join('|');\n      if (!map.has(key)) map.set(key, item);\n    });",
        "    [...dreData.naoClassificados.items, ...intentionalOutsideItems].forEach((item) => {\n      // A mesma movimentacao pode ter sido capturada como nao classificada pelo\n      // motor e tambem reconhecida pela regra patrimonial. A chave nao inclui a\n      // origem da captura para impedir duplicidade no resumo.\n      const key = [item.data, item.documento, item.lancamento, item.contaCodigo, item.projeto, item.valor].join('|');\n      if (!map.has(key)) map.set(key, item);\n    });"
    ),
    (
        "<strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>Lançamentos que compõem as pendências</strong>",
        "<strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>Lançamentos fora da DRE</strong>"
    ),
    (
        "<p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>Detalhamento abaixo para auditoria e ajuste do DEPARA.</p>",
        "<p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>Detalhamento para auditoria. Somente itens classificados como Pendente de Classificação exigem ajuste do DEPARA.</p>"
    ),
]

for old, new in replacements:
    if old not in text:
        raise RuntimeError('Trecho esperado nao encontrado')
    text = text.replace(old, new, 1)

path.write_text(text, encoding='utf-8')
print('Ajustes finais da DRE aplicados.')
