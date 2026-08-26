from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise RuntimeError(f'Trecho nao encontrado: {label}')
    return text.replace(old, new, 1)


# -----------------------------------------------------------------------------
# Projetos: restaurar PDF executivo + Excel de movimentacoes no detalhamento.
# -----------------------------------------------------------------------------
file = Path('src/app/projetos/page.js')
src = file.read_text(encoding='utf-8')

src = replace_once(
    src,
    '  FilterX, PieChart, Activity, ChevronLeft, ChevronRight\n} from "lucide-react";',
    '  FilterX, PieChart, Activity, ChevronLeft, ChevronRight, Download, FileSpreadsheet\n} from "lucide-react";',
    'imports de exportacao'
)

old_moves = '''  const selectedProjectMoves = useMemo(() => {
    if (!selectedProject) return [];
    return data.filter(item => getProjectKey(item.projeto) === selectedProject.projectKey);
  }, [selectedProject, data]);
'''
new_moves = '''  const selectedProjectMoves = useMemo(() => {
    if (!selectedProject) return [];
    return data.filter(item => getProjectKey(item.projeto) === selectedProject.projectKey);
  }, [selectedProject, data]);

  const selectedProjectReportMoves = useMemo(() => {
    const start = filterDataInicial ? new Date(`${filterDataInicial}T00:00:00`).getTime() : 0;
    const end = filterDataFinal ? new Date(`${filterDataFinal}T23:59:59`).getTime() : Infinity;
    return selectedProjectMoves.filter((item) => {
      const parts = String(item.data || '').split('/');
      if (parts.length !== 3) return true;
      const timestamp = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T12:00:00`).getTime();
      return timestamp >= start && timestamp <= end;
    });
  }, [selectedProjectMoves, filterDataInicial, filterDataFinal]);

  const projectReportFileName = useCallback(() => {
    const base = String(selectedProject?.nome || 'projeto')
      .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 70) || 'projeto';
    return base;
  }, [selectedProject]);

  const exportSelectedProjectExcel = useCallback(async () => {
    if (!selectedProject) return;
    const XLSX = await import('xlsx');
    const rows = selectedProjectReportMoves.map((item) => ({
      Data: item.data || '',
      Natureza: item.natureza || '',
      Status: item.status || '',
      Projeto: item.projeto || selectedProject.nome,
      'Nome / Fornecedor': item.nome || '',
      Conta: item.contaNome || item.contaDescricao || item.contaCodigo || '',
      Documento: item.documento || '',
      Lancamento: item.lancamento || '',
      Valor: Number(item.valor) || 0,
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = [
      { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 30 }, { wch: 34 },
      { wch: 36 }, { wch: 18 }, { wch: 16 }, { wch: 16 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Movimentacoes');
    XLSX.writeFile(workbook, `Movimentacoes_${projectReportFileName()}.xlsx`);
  }, [selectedProject, selectedProjectReportMoves, projectReportFileName]);

  const exportSelectedProjectPdf = useCallback(async () => {
    if (!selectedProject) return;
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    let y = 16;

    const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);
    const addText = (text, size = 9, options = {}) => {
      doc.setFont('helvetica', options.bold ? 'bold' : 'normal');
      doc.setFontSize(size);
      doc.setTextColor(options.muted ? 95 : 30);
      const lines = doc.splitTextToSize(String(text), pageWidth - margin * 2);
      if (y + lines.length * 4.5 > pageHeight - 14) {
        doc.addPage();
        y = 16;
      }
      doc.text(lines, margin, y);
      y += lines.length * 4.5 + (options.gap ?? 1.5);
    };

    addText('Relatorio Executivo de Projeto', 16, { bold: True, gap: 3 });
    addText(selectedProject.nome, 12, { bold: True, gap: 1 });
    addText(`${selectedProject.empresa || ''} • ${selectedProject.tipo || ''}`, 8, { muted: True, gap: 3 });
    addText(`Periodo: ${filterDataInicial || 'inicio'} a ${filterDataFinal || 'atual'}`, 8, { muted: True, gap: 4 });

    addText('Resumo Contratual', 10, { bold: True });
    addText(`Contratado: ${money(selectedProject.contratado)}   |   Faturado: ${money(selectedProject.faturado)}`, 9);
    addText(`Saldo contratual: ${money(selectedProject.saldoContratual)}   |   % faturado: ${(Number(selectedProject.percentFaturado || 0) * 100).toFixed(2).replace('.', ',')}%`, 9, { gap: 3 });

    addText('Resumo Financeiro', 10, { bold: True });
    addText(`Recebido: ${money(selectedProject.recebido)}   |   A receber: ${money(selectedProject.aReceber)}`, 9);
    addText(`Pago: ${money(selectedProject.pago)}   |   A pagar: ${money(selectedProject.aPagar)}`, 9);
    addText(`Resultado de caixa: ${money(selectedProject.resultadoCaixa)}`, 9, { bold: True, gap: 4 });

    addText(`Movimentacoes no periodo (${selectedProjectReportMoves.length})`, 10, { bold: True });
    selectedProjectReportMoves.forEach((item) => {
      const conta = String(item.contaNome || item.contaDescricao || item.contaCodigo || '').slice(0, 62);
      const nature = item.natureza === 'Entrada' ? 'Entrada' : 'Saida';
      addText(`${item.data || '-'} | ${nature} | ${item.status || '-'} | ${conta} | ${money(item.valor)}`, 7.5, { gap: 0.5 });
    });

    doc.save(`Relatorio_Executivo_${projectReportFileName()}.pdf`);
  }, [selectedProject, selectedProjectReportMoves, filterDataInicial, filterDataFinal, projectReportFileName]);
'''
# Python booleans above need to be JavaScript lowercase after string creation.
new_moves = new_moves.replace('{ bold: True', '{ bold: true').replace('{ muted: True', '{ muted: true')
src = replace_once(src, old_moves, new_moves, 'funcoes de relatorio do projeto')

old_header = '''              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button onClick={() => setSelectedProject(null)} className="btn" style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '50%' }}>
                  <X size={20} color="var(--text-secondary)" />
                </button>
              </div>'''
new_header = '''              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button onClick={exportSelectedProjectPdf} className="btn" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.48rem 0.7rem', fontSize: '11px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}>
                  <Download size={14} /> Relatorio PDF
                </button>
                <button onClick={exportSelectedProjectExcel} className="btn" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.48rem 0.7rem', fontSize: '11px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}>
                  <FileSpreadsheet size={14} /> Movimentacoes Excel
                </button>
                <button onClick={() => setSelectedProject(null)} className="btn" style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '50%' }}>
                  <X size={20} color="var(--text-secondary)" />
                </button>
              </div>'''
src = replace_once(src, old_header, new_header, 'botoes do drawer')

src = src.replace('<DataTable data={selectedProjectMoves} />', '<DataTable data={selectedProjectReportMoves} />', 1)
file.write_text(src, encoding='utf-8')


# -----------------------------------------------------------------------------
# Visao Financeira: dar respiro ao Status Consolidado sem quebrar as colunas.
# -----------------------------------------------------------------------------
view_file = Path('src/app/visao-financeira/page.js')
view = view_file.read_text(encoding='utf-8')
view = replace_once(
    view,
    "<div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1.25rem', alignItems: 'start' }}>",
    "<div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.85rem', alignItems: 'stretch' }}>",
    'grid do status consolidado'
)
view_file.write_text(view, encoding='utf-8')

print('Relatorios do projeto e status financeiro corrigidos.')
