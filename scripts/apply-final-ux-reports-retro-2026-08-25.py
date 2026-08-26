from pathlib import Path
import re


def replace_once(text, old, new, label):
    if old not in text:
        raise RuntimeError(f'Trecho nao encontrado: {label}')
    return text.replace(old, new, 1)


# -----------------------------------------------------------------------------
# PROJETOS: PDF padronizado com o mesmo motor de relatórios do sistema.
# -----------------------------------------------------------------------------
project_file = Path('src/app/projetos/page.js')
src = project_file.read_text(encoding='utf-8')

if 'exportReportToPdf' not in src:
    src = src.replace(
        'import ReportAdder from "@/components/report/ReportAdder";\n',
        'import ReportAdder from "@/components/report/ReportAdder";\nimport { exportReportToPdf } from "@/lib/reportExport";\n',
        1,
    )

pattern = re.compile(
    r"  const exportSelectedProjectPdf = useCallback\(async \(\) => \{.*?\n  \}, \[selectedProject, selectedProjectReportMoves, filterDataInicial, filterDataFinal, projectReportFileName\]\);",
    re.S,
)
replacement = '''  const exportSelectedProjectPdf = useCallback(async () => {
    if (!selectedProject) return;

    const filters = {
      Projeto: selectedProject.nome,
      Empresa: selectedProject.empresa || 'Todas',
      Tipo: selectedProject.tipo || 'Todos',
      'Data inicial': filterDataInicial || 'Todas',
      'Data final': filterDataFinal || 'Todas',
    };

    const movementRows = selectedProjectReportMoves.map((item) => ({
      Data: item.data || '',
      Natureza: item.natureza || '',
      Situação: item.status || '',
      'Nome / Fornecedor': item.nome || '',
      Conta: item.contaNome || item.contaDescricao || item.contaCodigo || '',
      Documento: item.documento || '',
      Lançamento: item.lancamento || '',
      Valor: Number(item.valor) || 0,
    }));

    const reportItems = [
      {
        id: 'projeto-resumo-contratual',
        sectionKey: 'projeto:resumo-contratual',
        title: 'Resumo Contratual',
        page: 'Projetos',
        type: 'TABLE',
        data: [{
          Projeto: selectedProject.nome,
          Empresa: selectedProject.empresa || '',
          Tipo: selectedProject.tipo || '',
          Contratado: Number(selectedProject.contratado) || 0,
          Faturado: Number(selectedProject.faturado) || 0,
          '% Faturado': Number(selectedProject.percentFaturado) || 0,
          'Saldo Contratual': Number(selectedProject.saldoContratual) || 0,
        }],
        columns: [
          { key: 'Projeto', label: 'Projeto' },
          { key: 'Empresa', label: 'Empresa' },
          { key: 'Tipo', label: 'Tipo' },
          { key: 'Contratado', label: 'Contratado', format: 'currency' },
          { key: 'Faturado', label: 'Faturado', format: 'currency' },
          { key: '% Faturado', label: '% Faturado', format: 'percent' },
          { key: 'Saldo Contratual', label: 'Saldo Contratual', format: 'currency' },
        ],
        filters,
        explanation: 'Posição contratual do projeto selecionado.',
      },
      {
        id: 'projeto-resumo-financeiro',
        sectionKey: 'projeto:resumo-financeiro',
        title: 'Resumo Financeiro',
        page: 'Projetos',
        type: 'TABLE',
        data: [{
          Recebido: Number(selectedProject.recebido) || 0,
          'A Receber': Number(selectedProject.aReceber) || 0,
          Pago: Number(selectedProject.pago) || 0,
          'A Pagar': Number(selectedProject.aPagar) || 0,
          Resultado: Number(selectedProject.resultadoCaixa) || 0,
        }],
        columns: [
          { key: 'Recebido', label: 'Recebido', format: 'currency' },
          { key: 'A Receber', label: 'A Receber', format: 'currency' },
          { key: 'Pago', label: 'Pago', format: 'currency' },
          { key: 'A Pagar', label: 'A Pagar', format: 'currency' },
          { key: 'Resultado', label: 'Resultado', format: 'currency' },
        ],
        filters,
        explanation: 'Movimentação financeira do projeto no período selecionado.',
      },
      {
        id: 'projeto-movimentacoes',
        sectionKey: 'projeto:movimentacoes',
        title: 'Movimentações do Período',
        page: 'Projetos',
        type: 'TABLE',
        data: movementRows,
        columns: [
          { key: 'Data', label: 'Data', format: 'date' },
          { key: 'Natureza', label: 'Natureza' },
          { key: 'Situação', label: 'Situação' },
          { key: 'Nome / Fornecedor', label: 'Nome / Fornecedor' },
          { key: 'Conta', label: 'Conta' },
          { key: 'Documento', label: 'Documento' },
          { key: 'Lançamento', label: 'Lançamento' },
          { key: 'Valor', label: 'Valor', format: 'currency' },
        ],
        filters,
        explanation: 'Extrato das movimentações que compõem a posição financeira do projeto no período.',
      },
    ];

    await exportReportToPdf(reportItems, {
      title: `Relatório Executivo — ${selectedProject.nome}`,
      orientation: 'auto',
      includeExplanations: true,
    });
  }, [selectedProject, selectedProjectReportMoves, filterDataInicial, filterDataFinal]);'''

src, count = pattern.subn(replacement, src, count=1)
if count != 1:
    raise RuntimeError(f'Funcao exportSelectedProjectPdf nao substituida ({count})')

src = src.replace('Relatorio PDF', 'Relatório Executivo PDF')
src = src.replace('Movimentacoes Excel', 'Movimentações Excel')
project_file.write_text(src, encoding='utf-8')


# -----------------------------------------------------------------------------
# DRE: deixar o controle Retroativo 2026 sempre visível e autoexplicativo.
# -----------------------------------------------------------------------------
dre_file = Path('src/app/dre/page.js')
src = dre_file.read_text(encoding='utf-8')

old = '''          {retroactiveItems.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', minWidth: '190px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                Retroativo 2026
                <InfoTooltip title="Retroativo 2026" content="Movimentações realizadas em 2025 dos projetos selecionados, exibidas como Retroativo 2026." />
              </label>
              <button type="button" onClick={() => setIncludeRetroactive((value) => !value)} style={{ height: '38px', padding: '0 0.8rem', borderRadius: '6px', border: `1px solid ${includeRetroactive ? 'var(--primary)' : 'var(--border-color)'}`, background: includeRetroactive ? 'rgba(57,198,198,0.15)' : 'var(--bg-elevated)', color: includeRetroactive ? 'var(--primary)' : 'var(--text-main)', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                {includeRetroactive ? '✓ Incluído no resultado' : '+ Incluir retroativo'}
              </button>
            </div>
          )}'''

new = '''          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', minWidth: '205px' }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              Retroativo 2026
              <InfoTooltip title="Retroativo 2026" content="Movimentações realizadas em 2025 dos projetos selecionados, exibidas como Retroativo 2026." />
            </label>
            <button
              type="button"
              disabled={filterProjetos.length === 0 || retroactiveItems.length === 0}
              onClick={() => setIncludeRetroactive((value) => !value)}
              title={filterProjetos.length === 0 ? 'Selecione uma obra para verificar o retroativo.' : retroactiveItems.length === 0 ? 'A obra selecionada não possui movimentação realizada em 2025.' : undefined}
              style={{
                height: '38px', padding: '0 0.8rem', borderRadius: '6px',
                border: `1px solid ${includeRetroactive ? 'var(--primary)' : 'var(--border-color)'}`,
                background: includeRetroactive ? 'rgba(57,198,198,0.15)' : 'var(--bg-elevated)',
                color: includeRetroactive ? 'var(--primary)' : 'var(--text-main)',
                fontSize: '12px', fontWeight: 700,
                cursor: filterProjetos.length === 0 || retroactiveItems.length === 0 ? 'not-allowed' : 'pointer',
                opacity: filterProjetos.length === 0 || retroactiveItems.length === 0 ? 0.58 : 1,
              }}
            >
              {filterProjetos.length === 0
                ? 'Selecione uma obra'
                : retroactiveItems.length === 0
                  ? 'Sem movimento em 2025'
                  : includeRetroactive
                    ? '✓ Incluído no resultado'
                    : '+ Incluir retroativo'}
            </button>
            {filterProjetos.length > 0 && retroactiveItems.length > 0 && (
              <span style={{ fontSize: '9.5px', color: 'var(--text-secondary)', lineHeight: 1.25 }}>
                {retroactiveItems.length} movimentação{retroactiveItems.length !== 1 ? 'ões' : ''} de 2025 disponível{retroactiveItems.length !== 1 ? 'is' : ''}.
              </span>
            )}
          </div>'''

src = replace_once(src, old, new, 'controle retroativo DRE')
dre_file.write_text(src, encoding='utf-8')

print('Ajustes finais de relatorio e retroativo aplicados.')
