from pathlib import Path

path = Path('src/app/visao-financeira/page.js')
text = path.read_text(encoding='utf-8')


def replace_once(old, new, label):
    global text
    if old not in text:
        raise RuntimeError(f'{label}: trecho nao encontrado')
    text = text.replace(old, new, 1)
    print(f'OK {label}')


replace_once(
    'content="Entradas realizadas menos saídas realizadas entre a Data Inicial e a menor entre Data Final e hoje. No período padrão: 01/01/2026 até hoje."',
    'content="Resultado das entradas realizadas menos as saídas realizadas no período selecionado."',
    'tooltip resultado realizado',
)

replace_once(
    'content="A receber menos A pagar dos lançamentos ainda A realizar dentro do período selecionado. Os filtros de projeto, nome e conta também são aplicados."',
    'content="Resultado das entradas a receber menos as saídas a pagar no período selecionado."',
    'tooltip resultado previsto',
)

entry_breakdown = r'''
  const entryBreakdown = useMemo(() => {
    const totals = {
      obra: 0,
      adm: 0,
      emprestimos: 0,
      aportes: 0,
      outras: 0,
    };
    const outrasMap = new Map();

    const addOther = (row, value, fallbackLabel) => {
      totals.outras += value;
      const label = String(
        row.contaDescricao || row.contaNome || row.planoFinanceiro || fallbackLabel || 'Outras entradas'
      ).trim() || 'Outras entradas';
      outrasMap.set(label, (outrasMap.get(label) || 0) + value);
    };

    realizedFilteredData.forEach((item) => {
      if (item.natureza !== 'Entrada') return;

      const itemValue = Number(item.valor) || 0;
      const isAdmOnly = item.isConsolidated &&
        String(item.projeto || '').toUpperCase().includes('ADMINISTRA') &&
        Math.abs(itemValue - (Number(item.valorAdministrativo) || 0)) < 0.01;

      if (isAdmOnly) {
        totals.adm += itemValue;
        return;
      }

      const rows = item.linhasOriginais?.length ? item.linhasOriginais : [item];
      rows.forEach((row) => {
        const value = Number(row.valor) || 0;
        const classification = classifyFinancialEntry(row);

        if (classification.type === 'receita_projeto') totals.obra += value;
        else if (classification.type === 'receita_administrativa') totals.adm += value;
        else if (classification.type === 'emprestimo') totals.emprestimos += value;
        else if (classification.type === 'aporte') totals.aportes += value;
        else addOther(row, value, classification.label);
      });
    });

    const projetos = totals.obra + totals.adm;
    const capital = totals.emprestimos + totals.aportes;
    const total = projetos + capital + totals.outras;
    const outrasDetalhes = [...outrasMap.entries()]
      .map(([nome, valor]) => ({ nome, valor }))
      .filter((row) => Math.abs(row.valor) > 0.005)
      .sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor));

    return {
      ...totals,
      projetos,
      capital,
      total,
      outrasDetalhes,
      diferenca: entradasRealizadas - total,
    };
  }, [realizedFilteredData, entradasRealizadas]);

'''

replace_once(
    '  const taxStatusBreakdown = useMemo(() => ({',
    entry_breakdown + '  const taxStatusBreakdown = useMemo(() => ({',
    'calculo composicao entradas',
)

panel = r'''
      <div id="report-visao-composicao-entradas" data-report-section className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              Composição das Entradas Realizadas
              <InfoTooltip title="Composição das Entradas Realizadas" content="Classificação das entradas efetivamente realizadas no período selecionado." />
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Detalhamento do valor total de Entradas Realizadas.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ textAlign: 'right' }}>
              <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Total</span>
              <strong style={{ fontSize: '18px', color: 'var(--text-main)' }}>{formatCurrency(entryBreakdown.total)}</strong>
            </div>
            <ReportAdder
              sectionKey="visao:composicao-entradas"
              title="Composição das Entradas Realizadas"
              componentName="Detalhamento das Entradas"
              page="Visão Financeira"
              type="TABLE"
              data={[
                { Grupo: 'Receitas de projetos', Classificação: 'Obra', Valor: entryBreakdown.obra },
                { Grupo: 'Receitas de projetos', Classificação: 'Administrativo', Valor: entryBreakdown.adm },
                { Grupo: 'Empréstimos e aportes', Classificação: 'Empréstimos', Valor: entryBreakdown.emprestimos },
                { Grupo: 'Empréstimos e aportes', Classificação: 'Aportes', Valor: entryBreakdown.aportes },
                ...entryBreakdown.outrasDetalhes.map((row) => ({ Grupo: 'Outras entradas', Classificação: row.nome, Valor: row.valor })),
              ]}
              filters={reportFilters}
              captureId="report-visao-composicao-entradas"
              presetTags={["executive-financial"]}
              explanation="Classificação das entradas realizadas no período selecionado."
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '0.75rem' }}>
          <div style={{ padding: '0.9rem 1rem', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--bg-elevated)' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>Receitas de Projetos</span>
            <strong style={{ display: 'block', marginTop: '0.2rem', fontSize: '17px', color: 'var(--success)' }}>{formatCurrency(entryBreakdown.projetos)}</strong>
            <div style={{ marginTop: '0.65rem', display: 'grid', gap: '0.35rem', fontSize: '11px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}><span style={{ color: 'var(--text-secondary)' }}>Obra</span><strong>{formatCurrency(entryBreakdown.obra)}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}><span style={{ color: 'var(--text-secondary)' }}>Administrativo</span><strong>{formatCurrency(entryBreakdown.adm)}</strong></div>
            </div>
          </div>

          <div style={{ padding: '0.9rem 1rem', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--bg-elevated)' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>Empréstimos e Aportes</span>
            <strong style={{ display: 'block', marginTop: '0.2rem', fontSize: '17px', color: 'var(--info)' }}>{formatCurrency(entryBreakdown.capital)}</strong>
            <div style={{ marginTop: '0.65rem', display: 'grid', gap: '0.35rem', fontSize: '11px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}><span style={{ color: 'var(--text-secondary)' }}>Empréstimos</span><strong>{formatCurrency(entryBreakdown.emprestimos)}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}><span style={{ color: 'var(--text-secondary)' }}>Aportes</span><strong>{formatCurrency(entryBreakdown.aportes)}</strong></div>
            </div>
          </div>

          <div style={{ padding: '0.9rem 1rem', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--bg-elevated)' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>Outras Entradas</span>
            <strong style={{ display: 'block', marginTop: '0.2rem', fontSize: '17px', color: 'var(--primary)' }}>{formatCurrency(entryBreakdown.outras)}</strong>
            <div style={{ marginTop: '0.65rem', display: 'grid', gap: '0.35rem', fontSize: '11px', maxHeight: '92px', overflowY: 'auto', paddingRight: '0.2rem' }}>
              {entryBreakdown.outrasDetalhes.length > 0 ? entryBreakdown.outrasDetalhes.map((row) => (
                <div key={row.nome} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
                  <span style={{ color: 'var(--text-secondary)', overflowWrap: 'anywhere' }}>{row.nome}</span>
                  <strong style={{ whiteSpace: 'nowrap' }}>{formatCurrency(row.valor)}</strong>
                </div>
              )) : <span style={{ color: 'var(--text-secondary)' }}>Sem outras entradas no período.</span>}
            </div>
          </div>
        </div>

        {Math.abs(entryBreakdown.diferenca) > 0.01 && (
          <p style={{ marginTop: '0.75rem', fontSize: '11px', color: 'var(--warning)' }}>
            Diferença de conciliação: {formatCurrency(entryBreakdown.diferenca)}.
          </p>
        )}
      </div>

'''

replace_once(
    '      {/* Grid Principal dos Gráficos (Dashboard) */}',
    panel + '      {/* Grid Principal dos Gráficos (Dashboard) */}',
    'painel composicao entradas',
)

replace_once(
    "<small style={{color:'var(--text-secondary)',fontSize:'10px'}}>Obra {formatCurrency(projectFinancialOverview.receitaObra)} + ADM {formatCurrency(projectFinancialOverview.receitaAdm)}</small>",
    '',
    'remover legenda obra adm da visao projetos',
)

path.write_text(text, encoding='utf-8')
