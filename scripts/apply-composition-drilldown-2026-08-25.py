from pathlib import Path
import re


def replace_once(text, old, new, label):
    if old not in text:
        raise RuntimeError(f'Trecho nao encontrado: {label}')
    return text.replace(old, new, 1)


def sub_once(text, pattern, replacement, label, flags=re.S):
    out, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f'Trecho regex nao encontrado: {label} ({count})')
    return out


# -----------------------------------------------------------------------------
# VISAO FINANCEIRA
# -----------------------------------------------------------------------------
file = Path('src/app/visao-financeira/page.js')
src = file.read_text(encoding='utf-8')

src = src.replace(
    'import { RefreshCw, AlertCircle, TrendingUp, TrendingDown, LayoutDashboard, Calendar, DollarSign, Database, ChevronLeft, ChevronRight, Building2, Activity, FilterX, Landmark, FileText, CheckCircle, Target, ArrowDownCircle, ArrowUpCircle, ArrowDown, ArrowUp } from "lucide-react";',
    'import { RefreshCw, AlertCircle, TrendingUp, TrendingDown, LayoutDashboard, Calendar, DollarSign, Database, ChevronLeft, ChevronRight, Building2, Activity, FilterX, Landmark, FileText, CheckCircle, Target, ArrowDownCircle, ArrowUpCircle, ArrowDown, ArrowUp, X } from "lucide-react";'
)

if 'FinancialCompositionBar' not in src:
    src = src.replace(
        'import ProjectFinancialOverviewChart from "@/components/charts/ProjectFinancialOverviewChart";',
        'import ProjectFinancialOverviewChart from "@/components/charts/ProjectFinancialOverviewChart";\nimport FinancialCompositionBar from "@/components/FinancialCompositionBar";'
    )

src = replace_once(
    src,
    '  const [filterContas, setFilterContas] = useState([]);',
    '  const [filterContas, setFilterContas] = useState([]);\n  const [compositionDrilldown, setCompositionDrilldown] = useState(null);',
    'estado drilldown'
)

entry_pattern = r'''  const entryBreakdown = useMemo\(\(\) => \{.*?\n  \}, \[realizedFilteredData, entradasRealizadas\]\);'''
entry_new = '''  const entryBreakdown = useMemo(() => {
    const totals = { obra: 0, adm: 0, emprestimos: 0, aportes: 0, outras: 0 };
    const detailMaps = {
      projetos: new Map(),
      capital: new Map(),
      outras: new Map(),
    };

    const accountLabel = (row, fallback) => {
      const code = String(row?.contaCodigo || '').trim();
      const name = String(row?.contaNome || row?.contaDescricao || row?.planoFinanceiro || fallback || 'Conta não identificada').trim();
      return code ? `${code} - ${name}` : name;
    };

    const addDetail = (bucket, row, value, fallback) => {
      const label = accountLabel(row, fallback);
      detailMaps[bucket].set(label, (detailMaps[bucket].get(label) || 0) + value);
    };

    realizedFilteredData.forEach((item) => {
      if (item.natureza !== 'Entrada') return;
      const rows = item.linhasOriginais?.length ? item.linhasOriginais : [item];
      rows.forEach((row) => {
        const value = Number(row.valor) || 0;
        const classification = classifyFinancialEntry(row);
        if (classification.type === 'receita_projeto') {
          totals.obra += value;
          addDetail('projetos', row, value, classification.label);
        } else if (classification.type === 'receita_administrativa') {
          totals.adm += value;
          addDetail('projetos', row, value, classification.label);
        } else if (classification.type === 'emprestimo') {
          totals.emprestimos += value;
          addDetail('capital', row, value, classification.label);
        } else if (classification.type === 'aporte') {
          totals.aportes += value;
          addDetail('capital', row, value, classification.label);
        } else {
          totals.outras += value;
          addDetail('outras', row, value, classification.label);
        }
      });
    });

    const toRows = (map) => [...map.entries()]
      .map(([conta, valor]) => ({ conta, valor }))
      .filter((row) => Math.abs(row.valor) > 0.005)
      .sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor));

    const projetos = totals.obra + totals.adm;
    const capital = totals.emprestimos + totals.aportes;
    const total = projetos + capital + totals.outras;

    return {
      ...totals,
      projetos,
      capital,
      total,
      diferenca: entradasRealizadas - total,
      items: [
        { key: 'projetos', label: 'Receitas de Projetos', value: projetos, color: 'var(--success)', details: toRows(detailMaps.projetos) },
        { key: 'capital', label: 'Empréstimos e Aportes', value: capital, color: 'var(--info)', details: toRows(detailMaps.capital) },
        { key: 'outras', label: 'Outras Entradas', value: totals.outras, color: 'var(--primary)', details: toRows(detailMaps.outras) },
      ],
    };
  }, [realizedFilteredData, entradasRealizadas]);

  const outputBreakdown = useMemo(() => {
    const buckets = {
      custos: { value: 0, details: new Map() },
      despesas: { value: 0, details: new Map() },
      investimentos: { value: 0, details: new Map() },
      tributos: { value: 0, details: new Map() },
      outras: { value: 0, details: new Map() },
    };

    const accountLabel = (row) => {
      const code = String(row?.contaCodigo || '').trim();
      const name = String(row?.contaNome || row?.contaDescricao || 'Conta não identificada').trim();
      return code ? `${code} - ${name}` : name;
    };

    const add = (bucket, row, value) => {
      buckets[bucket].value += value;
      const label = accountLabel(row);
      buckets[bucket].details.set(label, (buckets[bucket].details.get(label) || 0) + value);
    };

    realizedFilteredData.forEach((item) => {
      if (item.natureza !== 'Saída') return;
      const value = Math.abs(Number(item.valor) || 0);
      const dreText = [item.dreClasse, item.dreLinha, item.dreDescricao, item.contaDescricao]
        .filter(Boolean).join(' ').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toUpperCase();

      if (isRevenueTax(item)) add('tributos', item, value);
      else if (/(INVEST|CAPEX|IMOBILIZ|ATIVO FIXO|ATIVO IMOB)/.test(dreText)) add('investimentos', item, value);
      else if (dreText.includes('CUSTO')) add('custos', item, value);
      else if (dreText.includes('DESPESA') || dreText.includes('ADMINISTRAT')) add('despesas', item, value);
      else add('outras', item, value);
    });

    const toRows = (map) => [...map.entries()]
      .map(([conta, valor]) => ({ conta, valor }))
      .filter((row) => Math.abs(row.valor) > 0.005)
      .sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor));

    const items = [
      { key: 'custos', label: 'Custos', value: buckets.custos.value, color: 'var(--warning)', details: toRows(buckets.custos.details) },
      { key: 'despesas', label: 'Despesas', value: buckets.despesas.value, color: 'var(--danger)', details: toRows(buckets.despesas.details) },
      { key: 'investimentos', label: 'Investimentos', value: buckets.investimentos.value, color: '#8b5cf6', details: toRows(buckets.investimentos.details) },
      { key: 'tributos', label: 'Tributos', value: buckets.tributos.value, color: 'var(--primary)', details: toRows(buckets.tributos.details) },
      { key: 'outras', label: 'Outras Saídas', value: buckets.outras.value, color: 'var(--text-secondary)', details: toRows(buckets.outras.details) },
    ];

    return { total: items.reduce((sum, item) => sum + item.value, 0), items };
  }, [realizedFilteredData]);'''
src = sub_once(src, entry_pattern, lambda _: entry_new, 'entry/output breakdown')

# Remove o bloco antigo de composicao, que ficava antes dos dois graficos principais.
old_comp_pattern = r'''\n\n      <div id="report-visao-composicao-entradas"[\s\S]*?\n      \{\/\* Grid Principal dos Gráficos \(Dashboard\) \*\/\}'''
src = sub_once(src, old_comp_pattern, '\n\n      {/* Grid Principal dos Gráficos (Dashboard) */}', 'remover composicao antiga')

composition_ui = '''

        {/* ROW 1.5: Composição das movimentações realizadas */}
        <div id="report-visao-composicao-entradas" data-report-section className="card" style={{ padding: '1.25rem', minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                Composição das Movimentações Realizadas
                <InfoTooltip title="Composição das Movimentações Realizadas" content="Distribuição das entradas e saídas realizadas por natureza no período selecionado." />
              </h2>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Clique em uma faixa ou categoria para ver as contas que compõem o valor.</p>
            </div>
            <ReportAdder
              sectionKey="visao:composicao-movimentacoes"
              title="Composição das Movimentações Realizadas"
              componentName="Composição de Entradas e Saídas"
              page="Visão Financeira"
              type="TABLE"
              data={[
                ...entryBreakdown.items.map((item) => ({ Natureza: 'Entrada', Grupo: item.label, Valor: item.value })),
                ...outputBreakdown.items.map((item) => ({ Natureza: 'Saída', Grupo: item.label, Valor: item.value })),
              ]}
              filters={reportFilters}
              captureId="report-visao-composicao-entradas"
              presetTags={["executive-financial"]}
              explanation="Distribuição das entradas e saídas realizadas por natureza no período selecionado."
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: '1.25rem' }}>
            <div style={{ padding: '0.9rem 1rem', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--bg-elevated)', minWidth: 0 }}>
              <FinancialCompositionBar
                title="Entradas realizadas"
                total={entradasRealizadas}
                items={entryBreakdown.items}
                onSelect={(item) => setCompositionDrilldown({ nature: 'Entrada', ...item })}
              />
            </div>
            <div style={{ padding: '0.9rem 1rem', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--bg-elevated)', minWidth: 0 }}>
              <FinancialCompositionBar
                title="Saídas realizadas"
                total={saidasRealizadas}
                items={outputBreakdown.items}
                onSelect={(item) => setCompositionDrilldown({ nature: 'Saída', ...item })}
              />
            </div>
          </div>

          {Math.abs(entryBreakdown.diferenca) > 0.01 && (
            <p style={{ marginTop: '0.65rem', fontSize: '10.5px', color: 'var(--warning)' }}>
              Diferença de conciliação das entradas: {formatCurrency(entryBreakdown.diferenca)}.
            </p>
          )}
        </div>
'''

src = replace_once(
    src,
    '        {/* ROW 2: Status Financeiro e Curva ABC */}',
    composition_ui + '\n        {/* ROW 2: Status Financeiro e Curva ABC */}',
    'inserir composicao apos graficos'
)

modal_ui = '''

      {compositionDrilldown && (
        <div
          onClick={() => setCompositionDrilldown(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 2147482500, background: 'rgba(2, 8, 23, 0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
        >
          <div
            className="card"
            onClick={(event) => event.stopPropagation()}
            style={{ width: 'min(720px, 100%)', maxHeight: '82vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 0 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', padding: '1rem 1.1rem', borderBottom: '1px solid var(--border-color)' }}>
              <div>
                <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{compositionDrilldown.nature}</span>
                <h3 style={{ fontSize: '15px', color: 'var(--text-main)', marginTop: '0.15rem' }}>{compositionDrilldown.label}</h3>
                <strong style={{ display: 'block', marginTop: '0.3rem', color: 'var(--primary)', fontSize: '16px' }}>{formatCurrency(compositionDrilldown.value)}</strong>
              </div>
              <button type="button" onClick={() => setCompositionDrilldown(null)} aria-label="Fechar detalhamento" className="btn" style={{ padding: '0.35rem', minWidth: 'auto' }}><X size={16} /></button>
            </div>
            <div style={{ overflow: 'auto', padding: '0.6rem 1.1rem 1rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: '10px', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ textAlign: 'left', padding: '0.6rem 0.4rem' }}>Conta / Plano Financeiro</th>
                    <th style={{ textAlign: 'right', padding: '0.6rem 0.4rem' }}>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {(compositionDrilldown.details || []).map((row) => (
                    <tr key={row.conta} style={{ borderBottom: '1px solid rgba(148,163,184,0.08)' }}>
                      <td style={{ padding: '0.65rem 0.4rem', color: 'var(--text-main)' }}>{row.conta}</td>
                      <td style={{ padding: '0.65rem 0.4rem', textAlign: 'right', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>{formatCurrency(row.valor)}</td>
                    </tr>
                  ))}
                  {(!compositionDrilldown.details || compositionDrilldown.details.length === 0) && (
                    <tr><td colSpan={2} style={{ padding: '1.2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Sem contas detalhadas para esta categoria.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
'''

src = replace_once(src, '\n      <style dangerouslySetInnerHTML={{__html: `', modal_ui + '\n\n      <style dangerouslySetInnerHTML={{__html: `', 'modal drilldown')

file.write_text(src, encoding='utf-8')


# -----------------------------------------------------------------------------
# PROJETOS: nomenclatura correta da base usada pelo Resultado Gerencial.
# A CR_GERAL soma a receita da nota (1010101 + 1010107); tributos sao subtraidos
# uma unica vez no resultado. Nao alterar a formula, apenas remover o termo
# "Liquida", que sugeria uma deducao tributaria ja realizada.
# -----------------------------------------------------------------------------
project_file = Path('src/app/projetos/page.js')
project_src = project_file.read_text(encoding='utf-8')
project_src = project_src.replace('>Receita Líquida</p>', '>Receita Realizada de Projetos</p>')
project_src = project_src.replace('>Receita - Custos - Despesas - Tributos</p>', '>Receita realizada - Custos - Despesas - Tributos</p>')
project_file.write_text(project_src, encoding='utf-8')

print('Composicao, drilldown e nomenclatura financeira aplicados.')
