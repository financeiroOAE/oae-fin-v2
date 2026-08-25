from pathlib import Path
import re


def replace_once(text, old, new, label):
    if old not in text:
        raise RuntimeError(f"Trecho nao encontrado: {label}")
    return text.replace(old, new, 1)


def sub_once(text, pattern, replacement, label, flags=re.S):
    new_text, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"Trecho regex nao encontrado: {label} ({count})")
    return new_text


# -----------------------------------------------------------------------------
# PROJETOS
# -----------------------------------------------------------------------------
project_file = Path('src/app/projetos/page.js')
src = project_file.read_text(encoding='utf-8')

src = src.replace('import { getRolling30DayRange } from "@/lib/dateRange";\n', '')
src = src.replace(
    'import { getProjectKey, isProjectOngoing, getActiveProjectNames } from "@/lib/projectRules";',
    'import { getProjectKey, isProjectOngoing, getActiveProjectNames, isGeneralProjectsBucket } from "@/lib/projectRules";'
)

if 'const getYearToDateRange = () =>' not in src:
    src = replace_once(
        src,
        'const TABLE_PAGE_SIZE = 15;\n',
        '''const TABLE_PAGE_SIZE = 15;

const getYearToDateRange = () => {
  const today = new Date();
  const localDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return { start: `${today.getFullYear()}-01-01`, end: localDate(today) };
};
''',
        'range ytd projetos'
    )

src = src.replace('useState(() => getRolling30DayRange().start)', 'useState(() => getYearToDateRange().start)')
src = src.replace('useState(() => getRolling30DayRange().end)', 'useState(() => getYearToDateRange().end)')
src = src.replace('const [incluirRateioAdm, setIncluirRateioAdm] = useState(false);', 'const [incluirRateioAdm, setIncluirRateioAdm] = useState(true);')

src = replace_once(
    src,
    '''  const baseData = useMemo(() => {
    return consolidateFinancialData(data, {
      isProjetosPage: true,
      incluirRateioAdm
    });
  }, [data, incluirRateioAdm]);''',
    '''  const projectCashData = useMemo(() => consolidateFinancialData(data, {
    isProjetosPage: true,
    incluirRateioAdm: true
  }), [data]);

  const baseData = useMemo(() => consolidateFinancialData(data, {
    isProjetosPage: true,
    incluirRateioAdm
  }), [data, incluirRateioAdm]);''',
    'project cash data'
)

projects_crossed = r'''  const projetosCruzados = useMemo\(\(\) => \{.*?\n  \}, \[projetosBrutos, baseData, dIni, dFim, realizadoIni, realizadoFim, incluirRateioAdm\]\);'''
projects_crossed_new = '''  const projetosCruzados = useMemo(() => {
    const mapaProjetos = {};

    projetosBrutos.forEach((p) => {
      const nomeObra = String(p.OBRA || '').trim();
      if (!nomeObra || nomeObra.toUpperCase().includes('ADMINISTRATIVO') || !isProjectOngoing(p)) return;
      const projectKey = getProjectKey(p.ID || nomeObra);
      if (!projectKey) return;

      if (!mapaProjetos[projectKey]) {
        mapaProjetos[projectKey] = {
          projectKey,
          nome: nomeObra.replace(/[.\\s]+$/g, ''),
          empresas: [],
          tipos: [],
          contratado: 0,
          faturado: 0,
          saldoContratual: 0,
          recebido: 0,
          aReceber: 0,
          pago: 0,
          aPagar: 0,
          receitaDireta: 0,
          receitaAdm: 0,
          titulosAdmAssociados: []
        };
      }

      const projeto = mapaProjetos[projectKey];
      const empresa = String(p.EMPRESA || 'N/A').trim();
      const tipo = String(p.TIPO || 'N/A').trim();
      if (empresa && !projeto.empresas.includes(empresa)) projeto.empresas.push(empresa);
      if (tipo && !projeto.tipos.includes(tipo)) projeto.tipos.push(tipo);
      projeto.contratado += Number(p.CONTRATO) || 0;
      projeto.faturado += Number(p['NF FATURADAS']) || 0;
      projeto.saldoContratual += Number(p['SALDO CONTRATUAL']) || 0;
    });

    projectCashData.forEach((item) => {
      const projectKey = getProjectKey(item.projeto);
      const projeto = mapaProjetos[projectKey];
      if (!projeto) return;

      let ts = 0;
      if (item.data) {
        const parts = String(item.data).split('/');
        if (parts.length === 3) ts = new Date(parts[2], parts[1] - 1, parts[0]).getTime();
      }

      const status = String(item.status || '').toUpperCase();
      const isRealizado = status.includes('REALIZADO') || status.includes('RECEBIDO') || status.includes('PAGO') || status.includes('EFETIVADO');
      const isPrevisto = !isRealizado && (status.includes('A REALIZAR') || status.includes('A RECEBER') || status.includes('A PAGAR') || status.includes('PREVISTO'));
      if (!isRealizado && !isPrevisto) return;

      // Realizados seguem o período; títulos em aberto são posição atual e não
      // desaparecem só porque vencem depois da Data Final.
      if (isRealizado && (ts < realizadoIni || ts > realizadoFim)) return;

      if (item.natureza === 'Entrada') {
        if (isRealizado) {
          projeto.recebido += Number(item.valor) || 0;
          projeto.receitaDireta += Number(item.valorDireto) || 0;
          projeto.receitaAdm += Number(item.valorAdministrativo) || 0;
        } else {
          projeto.aReceber += Number(item.valor) || 0;
        }
      } else if (item.natureza === 'Saída') {
        if (isRealizado) projeto.pago += Math.abs(Number(item.valor) || 0);
        else projeto.aPagar += Math.abs(Number(item.valor) || 0);
      }
    });

    return Object.values(mapaProjetos).map((p) => ({
      ...p,
      empresa: p.empresas.join(' / ') || 'N/A',
      tipo: p.tipos.join(' / ') || 'N/A',
      percentFaturado: p.contratado > 0 ? p.faturado / p.contratado : 0,
      resultadoCaixa: p.recebido - p.pago,
      receitaConsideradaTooltip: p.receitaDireta + p.receitaAdm
    }));
  }, [projetosBrutos, projectCashData, realizadoIni, realizadoFim]);'''
src = sub_once(src, projects_crossed, lambda _: projects_crossed_new, 'projetos cruzados')

src = src.replace(
    "if (filterEmpresas.length > 0 && !filterEmpresas.includes(p.empresa)) return false;",
    "if (filterEmpresas.length > 0 && !p.empresas.some((empresa) => filterEmpresas.includes(empresa))) return false;"
)
src = src.replace(
    "if (filterTipos.length > 0 && !filterTipos.includes(p.tipo)) return false;",
    "if (filterTipos.length > 0 && !p.tipos.some((tipo) => filterTipos.includes(tipo))) return false;"
)
src = src.replace(
    "const listaEmpresas = Array.from(new Set(projetosCruzados.map(p => p.empresa))).sort();",
    "const listaEmpresas = Array.from(new Set(projetosCruzados.flatMap(p => p.empresas))).sort();"
)
src = src.replace(
    "const listaTipos = Array.from(new Set(projetosCruzados.map(p => p.tipo))).sort();",
    "const listaTipos = Array.from(new Set(projetosCruzados.flatMap(p => p.tipos))).sort();"
)

src = replace_once(
    src,
    '''  const totalRecebido = filteredProjetos.reduce((acc, p) => acc + p.recebido, 0);
  const totalAReceber = filteredProjetos.reduce((acc, p) => acc + p.aReceber, 0);
  const totalPago = filteredProjetos.reduce((acc, p) => acc + p.pago, 0);
  const totalAPagar = filteredProjetos.reduce((acc, p) => acc + p.aPagar, 0);
  const totalResultado = totalRecebido - totalPago;''',
    '''  const totalRecebido = filteredProjetos.reduce((acc, p) => acc + p.recebido, 0);
  const totalAReceber = filteredProjetos.reduce((acc, p) => acc + p.aReceber, 0);
  const totalPago = filteredProjetos.reduce((acc, p) => acc + p.pago, 0);

  const previsaoProjetosGeral = useMemo(() => data
    .filter((item) => {
      const status = String(item.status || '').toUpperCase();
      return item.natureza === 'Saída'
        && (status.includes('A REALIZAR') || status.includes('A PAGAR') || status.includes('PREVISTO'))
        && isGeneralProjectsBucket(item.projeto);
    })
    .reduce((sum, item) => sum + Math.abs(Number(item.valor) || 0), 0), [data]);

  const incluirPrevisaoGeral = filterProjetos.length === 0 && filterEmpresas.length === 0 && filterTipos.length === 0;
  const totalAPagar = filteredProjetos.reduce((acc, p) => acc + p.aPagar, 0) + (incluirPrevisaoGeral ? previsaoProjetosGeral : 0);
  const totalResultado = totalRecebido - totalPago;''',
    'totais caixa projetos'
)

dre_pattern = r'''  const dreStats = useMemo\(\(\) => \{.*?\n  \}, \[data, filteredProjetos, dIni, dFim, realizadoIni, realizadoFim, incluirRateioAdm\]\);'''
dre_new = '''  const dreStats = useMemo(() => {
    const allowedProjects = new Set(filteredProjetos.map((p) => p.projectKey));
    const receitaConsolidada = consolidateFinancialData(data, { isProjetosPage: true, incluirRateioAdm });

    let recReceita = 0;
    let recAReceber = 0;
    receitaConsolidada.forEach((item) => {
      if (item.natureza !== 'Entrada' || !allowedProjects.has(getProjectKey(item.projeto))) return;
      const status = String(item.status || '').toUpperCase();
      const isRealizado = status.includes('REALIZADO') || status.includes('RECEBIDO') || status.includes('EFETIVADO');
      const isPrevisto = !isRealizado && (status.includes('A REALIZAR') || status.includes('A RECEBER') || status.includes('PREVISTO'));

      let ts = 0;
      if (item.data) {
        const parts = String(item.data).split('/');
        if (parts.length === 3) ts = new Date(parts[2], parts[1] - 1, parts[0]).getTime();
      }
      if (isRealizado && ts >= realizadoIni && ts <= realizadoFim) recReceita += Number(item.valor) || 0;
      if (isPrevisto) recAReceber += Number(item.valor) || 0;
    });

    let cPago = 0;
    let cAPagar = 0;
    let dPago = 0;
    let dAPagar = 0;
    let tributos = 0;
    let tributosAPagar = 0;
    let nc = 0;
    const naoClassificados = [];

    data.forEach((item) => {
      if (item.natureza !== 'Saída' || !allowedProjects.has(getProjectKey(item.projeto))) return;
      const projetoNome = String(item.projeto || '').toUpperCase();
      if (projetoNome.includes('ADMINISTRA')) return;

      let ts = 0;
      if (item.data) {
        const parts = String(item.data).split('/');
        if (parts.length === 3) ts = new Date(parts[2], parts[1] - 1, parts[0]).getTime();
      }

      const status = String(item.status || '').toUpperCase();
      const isRealizado = status.includes('REALIZADO') || status.includes('PAGO') || status.includes('EFETIVADO');
      const isPrevisto = !isRealizado && (status.includes('A REALIZAR') || status.includes('A PAGAR') || status.includes('PREVISTO'));
      if (!isRealizado && !isPrevisto) return;
      if (isRealizado && (ts < realizadoIni || ts > realizadoFim)) return;

      const valor = Math.abs(Number(item.valor) || 0);
      const dreInfo = [item.dreClasse, item.dreLinha, item.dreDescricao].filter(Boolean).join(' ').toUpperCase();
      const isPendingDre = !dreInfo.trim() || dreInfo.includes('PENDENTE DE CLASSIFICAÇÃO');

      if (isRevenueTax(item)) {
        if (isRealizado) tributos += valor;
        else tributosAPagar += valor;
      } else if (isPendingDre) {
        if (isRealizado) {
          nc += valor;
          naoClassificados.push(item);
        }
      } else if (dreInfo.includes('CUSTO')) {
        if (isRealizado) cPago += valor;
        else cAPagar += valor;
      } else {
        if (isRealizado) dPago += valor;
        else dAPagar += valor;
      }
    });

    return {
      receita: recReceita,
      receitaAReceber: recAReceber,
      custo: cPago,
      custoAPagar: cAPagar,
      despesa: dPago,
      despesaAPagar: dAPagar,
      tributos,
      tributosAPagar,
      naoClassificado: nc,
      naoClassificados
    };
  }, [data, filteredProjetos, realizadoIni, realizadoFim, incluirRateioAdm]);'''
src = sub_once(src, dre_pattern, lambda _: dre_new, 'dre stats projetos')

src = src.replace(
    'const margemFinanceira = dreStats.receita > 0 ? ((dreStats.receita - dreStats.custo - dreStats.despesa) / dreStats.receita) * 100 : null;\n  const resultadoGerencial = dreStats.receita - dreStats.custo - dreStats.despesa;',
    'const margemFinanceira = dreStats.receita > 0 ? ((dreStats.receita - dreStats.custo - dreStats.despesa - dreStats.tributos) / dreStats.receita) * 100 : null;\n  const resultadoGerencial = dreStats.receita - dreStats.custo - dreStats.despesa - dreStats.tributos;'
)
src = src.replace(
    '''  const topEntradasData = useMemo(() =>
    [...filteredProjetos].filter(p => p.receitaDireta > 0).sort((a, b) => b.receitaDireta - a.receitaDireta).slice(0, 5)
      .map(p => ({ nome: p.nome, Valor: p.receitaDireta })),
    [filteredProjetos]);''',
    '''  const topEntradasData = useMemo(() =>
    [...filteredProjetos].filter(p => p.recebido > 0).sort((a, b) => b.recebido - a.recebido).slice(0, 5)
      .map(p => ({ nome: p.nome, Valor: p.recebido })),
    [filteredProjetos]);'''
)

src = src.replace('Caixa: Data Inicial', 'Data Inicial').replace('Caixa: Data Final', 'Data Final')
src = src.replace('Impostos sobre Faturamento', 'Tributos sobre Receita e Lucro')
src = src.replace('do faturamento total', 'da receita de projetos')
src = src.replace('Recebido no período', 'Recebido no período (Obra + ADM)')
src = src.replace('Receita - Custos - Despesas</p>', 'Receita - Custos - Despesas - Tributos</p>')
src = src.replace('Resultado após custos diretos e despesas administrativas, com a margem correspondente.', 'Resultado após custos, despesas e tributos dos projetos, com a margem correspondente.')
src = src.replace('Receita Líquida - Custos Diretos - Despesas Administrativas.', 'Receita de Projetos - Custos Diretos - Despesas - Tributos.')
src = src.replace(
    'data={[{ "Receita Líquida": dreStats.receita, "Custos Diretos": dreStats.custo, "Despesas Admin.": dreStats.despesa, "Não Classificado": dreStats.naoClassificado }]}',
    'data={[{ "Receita de Projetos": dreStats.receita, "Custos Diretos": dreStats.custo, "Despesas": dreStats.despesa, "Tributos": dreStats.tributos, "Não Classificado": dreStats.naoClassificado }]}'
)
src = src.replace('Receita, Custo e Despesa são classificados através do DEPARA/DRE da conta financeira.', 'Receita, Custo, Despesa e Tributos são classificados pelo DEPARA/DRE da conta financeira.')
src = src.replace('<strong>Despesa:</strong> despesas administrativas/operacionais.</li>', '<strong>Despesa:</strong> demais saídas com DEPARA válido vinculadas às obras.</li><li><strong>Tributos:</strong> PIS, COFINS, ISS, IRPJ, CSLL e previsões de impostos vinculadas aos projetos.</li>')

old_expense_block = '''            <div style={{ flex: 1, minWidth: '120px' }}>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Despesas Admin.</p>
              <p style={{ fontSize: '19px', fontWeight: '700', color: 'var(--danger)' }}>{formatCurrency(dreStats.despesa)}</p>
              {dreStats.receita > 0 && <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{((dreStats.despesa / dreStats.receita) * 100).toFixed(1)}% da Receita</span>}
            </div>'''
new_expense_block = '''            <div style={{ flex: 1, minWidth: '120px' }}>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Outras Despesas</p>
              <p style={{ fontSize: '19px', fontWeight: '700', color: 'var(--danger)' }}>{formatCurrency(dreStats.despesa)}</p>
              {dreStats.receita > 0 && <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{((dreStats.despesa / dreStats.receita) * 100).toFixed(1)}% da Receita</span>}
            </div>
            <div style={{ flex: 1, minWidth: '120px' }}>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Tributos</p>
              <p style={{ fontSize: '19px', fontWeight: '700', color: 'var(--primary)' }}>{formatCurrency(dreStats.tributos)}</p>
              {dreStats.receita > 0 && <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{((dreStats.tributos / dreStats.receita) * 100).toFixed(1)}% da Receita</span>}
            </div>'''
src = replace_once(src, old_expense_block, new_expense_block, 'bloco despesas/tributos')
src = src.replace(
    '100 - ((dreStats.custo + dreStats.despesa) / dreStats.receita) * 100',
    '100 - ((dreStats.custo + dreStats.despesa + dreStats.tributos) / dreStats.receita) * 100'
)
src = src.replace(
    "<div style={{ width: `${(dreStats.despesa / dreStats.receita) * 100}%`, background: 'var(--danger)', transition: 'width 0.3s ease' }} />",
    "<div style={{ width: `${(dreStats.despesa / dreStats.receita) * 100}%`, background: 'var(--danger)', transition: 'width 0.3s ease' }} />\n              <div style={{ width: `${(dreStats.tributos / dreStats.receita) * 100}%`, background: 'var(--primary)', transition: 'width 0.3s ease' }} />"
)
src = src.replace(
    '''    const range = getRolling30DayRange();
    setFilterDataInicial(range.start); setFilterDataFinal(range.end);''',
    '''    const range = getYearToDateRange();
    setFilterDataInicial(range.start); setFilterDataFinal(range.end);'''
)
src = src.replace("gridTemplateColumns: '2fr 1fr'", "gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))'")
project_file.write_text(src, encoding='utf-8')


# -----------------------------------------------------------------------------
# VISAO FINANCEIRA
# -----------------------------------------------------------------------------
view_file = Path('src/app/visao-financeira/page.js')
src = view_file.read_text(encoding='utf-8')
src = src.replace('import ProjectComparisonChart from "@/components/charts/ProjectComparisonChart";', 'import ProjectFinancialOverviewChart from "@/components/charts/ProjectFinancialOverviewChart";')

src = replace_once(
    src,
    '''  const realizedFilteredData = useMemo(() => filteredData.filter(item =>
    String(item.status || '').trim().toUpperCase() === 'REALIZADO'
  ), [filteredData]);''',
    '''  const openFilteredData = useMemo(() => baseData.filter((item) => {
    if (filterStatus.length > 0 && !filterStatus.includes(item.statusExibicao)) return false;
    if (filterProjetos.length > 0 && !filterProjetos.includes(item.projeto)) return false;
    if (filterNomes.length > 0 && !filterNomes.includes(item.nome)) return false;
    if (filterContas.length > 0 && !filterContas.includes(item.contaDescricao)) return false;
    return true;
  }), [baseData, filterProjetos, filterStatus, filterNomes, filterContas]);

  const realizedFilteredData = useMemo(() => filteredData.filter(item =>
    String(item.status || '').trim().toUpperCase() === 'REALIZADO'
  ), [filteredData]);''',
    'open data visao'
)
src = src.replace(
    "const entradasARealizar = filteredData.filter(r => r.natureza === 'Entrada' && r.status === 'A realizar').reduce((acc, r) => acc + r.valor, 0);",
    "const entradasARealizar = openFilteredData.filter(r => r.natureza === 'Entrada' && String(r.status || '').trim().toUpperCase() === 'A REALIZAR').reduce((acc, r) => acc + r.valor, 0);"
)
src = src.replace(
    "const saidasARealizar = filteredData.filter(r => r.natureza === 'Saída' && r.status === 'A realizar').reduce((acc, r) => acc + r.valor, 0);",
    "const saidasARealizar = openFilteredData.filter(r => r.natureza === 'Saída' && String(r.status || '').trim().toUpperCase() === 'A REALIZAR').reduce((acc, r) => acc + r.valor, 0);"
)

entry_pattern = r'''  const entryStatusBreakdown = useMemo\(\(\) => \{.*?\n  \}, \[filteredData\]\);'''
entry_new = '''  const entryStatusBreakdown = useMemo(() => {
    const result = {
      projetos: { realizado: 0, pendente: 0 },
      capital: { realizado: 0, pendente: 0 },
    };

    const accumulate = (items, bucket) => {
      items.filter((item) => item.natureza === 'Entrada').forEach((item) => {
        const rows = item.linhasOriginais?.length ? item.linhasOriginais : [item];
        rows.forEach((row) => {
          const classification = classifyFinancialEntry(row);
          const value = Number(row.valor) || 0;
          if (classification.type === 'receita_projeto' || classification.type === 'receita_administrativa') result.projetos[bucket] += value;
          if (classification.type === 'emprestimo' || classification.type === 'aporte') result.capital[bucket] += value;
        });
      });
    };

    accumulate(realizedFilteredData, 'realizado');
    accumulate(openFilteredData.filter((item) => String(item.status || '').trim().toUpperCase() === 'A REALIZAR'), 'pendente');
    return result;
  }, [realizedFilteredData, openFilteredData]);'''
src = sub_once(src, entry_pattern, lambda _: entry_new, 'status entradas visao')

overview_pattern = r'''  const projectFinancialOverview = useMemo\(\(\) => \{.*?\n  \}, \[filteredData, activeProjectKeys\]\);'''
overview_new = '''  const projectFinancialOverview = useMemo(() => {
    let receitaObra = 0;
    let receitaAdm = 0;
    let saidas = 0;

    filteredData.forEach((item) => {
      const status = String(item.status || '').trim().toUpperCase();
      if (status !== 'REALIZADO') return;

      const itemProjectKey = getProjectKey(item.projeto);
      if (!activeProjectKeys.has(itemProjectKey)) return;

      if (item.natureza === 'Entrada') {
        const rows = item.linhasOriginais?.length ? item.linhasOriginais : [item];
        rows.forEach((row) => {
          const classification = classifyFinancialEntry(row);
          if (classification.type === 'receita_projeto') receitaObra += Number(row.valor) || 0;
          if (classification.type === 'receita_administrativa') receitaAdm += Number(row.valor) || 0;
        });
      } else if (item.natureza === 'Saída') {
        saidas += Math.abs(Number(item.valor) || 0);
      }
    });

    const receita = receitaObra + receitaAdm;
    const resultado = receita - saidas;
    const margem = receita > 0 ? (resultado / receita) * 100 : 0;
    return { receita, receitaObra, receitaAdm, saidas, resultado, margem };
  }, [filteredData, activeProjectKeys]);'''
src = sub_once(src, overview_pattern, lambda _: overview_new, 'overview visao')

src = src.replace("gap: '3rem'", "gap: '1rem'")
old_overview_ui = '''            <h2 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.25rem' }}>Visão Financeira Geral dos Projetos</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Receitas de projetos versus custos e despesas realizados no período.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(120px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
              <div><span style={{fontSize:'10px',color:'var(--text-secondary)',textTransform:'uppercase'}}>Receita</span><strong style={{display:'block',fontSize:'14px',color:'var(--success)'}}>{formatCurrency(projectFinancialOverview.receita)}</strong></div>
              <div><span style={{fontSize:'10px',color:'var(--text-secondary)',textTransform:'uppercase'}}>Custos + Despesas</span><strong style={{display:'block',fontSize:'14px',color:'var(--danger)'}}>{formatCurrency(projectFinancialOverview.saidas)}</strong></div>
              <div><span style={{fontSize:'10px',color:'var(--text-secondary)',textTransform:'uppercase'}}>Resultado</span><strong style={{display:'block',fontSize:'14px',color:projectFinancialOverview.resultado >= 0 ? 'var(--success)' : 'var(--danger)'}}>{formatCurrency(projectFinancialOverview.resultado)}</strong></div>
              <div><span style={{fontSize:'10px',color:'var(--text-secondary)',textTransform:'uppercase'}}>Margem</span><strong style={{display:'block',fontSize:'14px',color:projectFinancialOverview.margem >= 0 ? 'var(--success)' : 'var(--danger)'}}>{projectFinancialOverview.margem.toFixed(2).replace('.', ',')}%</strong></div>
            </div>
            <div style={{ minHeight: '260px' }}><ProjectComparisonChart data={projectFinancialOverview.chart} keys={['Receita', 'Custos e Despesas', 'Resultado']} names={['Receita', 'Custos e Despesas', 'Resultado']} colors={['var(--success)', 'var(--danger)', 'var(--primary)']} /></div>'''
new_overview_ui = '''            <h2 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.25rem' }}>Visão Financeira Geral dos Projetos</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Recebido de projetos (obra + administrativo vinculado) versus saídas realizadas das obras.</p>
            <div className="finance-kpi-grid" style={{ marginBottom: '0.75rem' }}>
              <div><span style={{fontSize:'10px',color:'var(--text-secondary)',textTransform:'uppercase'}}>Recebido</span><strong style={{display:'block',fontSize:'14px',color:'var(--success)',overflowWrap:'anywhere'}}>{formatCurrency(projectFinancialOverview.receita)}</strong><small style={{color:'var(--text-secondary)',fontSize:'10px'}}>Obra {formatCurrency(projectFinancialOverview.receitaObra)} + ADM {formatCurrency(projectFinancialOverview.receitaAdm)}</small></div>
              <div><span style={{fontSize:'10px',color:'var(--text-secondary)',textTransform:'uppercase'}}>Custos + Despesas</span><strong style={{display:'block',fontSize:'14px',color:'var(--danger)',overflowWrap:'anywhere'}}>{formatCurrency(projectFinancialOverview.saidas)}</strong></div>
              <div><span style={{fontSize:'10px',color:'var(--text-secondary)',textTransform:'uppercase'}}>Resultado</span><strong style={{display:'block',fontSize:'14px',color:projectFinancialOverview.resultado >= 0 ? 'var(--success)' : 'var(--danger)',overflowWrap:'anywhere'}}>{formatCurrency(projectFinancialOverview.resultado)}</strong></div>
              <div><span style={{fontSize:'10px',color:'var(--text-secondary)',textTransform:'uppercase'}}>Margem</span><strong style={{display:'block',fontSize:'14px',color:projectFinancialOverview.margem >= 0 ? 'var(--success)' : 'var(--danger)'}}>{projectFinancialOverview.margem.toFixed(2).replace('.', ',')}%</strong></div>
            </div>
            <div className="finance-chart-frame"><ProjectFinancialOverviewChart recebido={projectFinancialOverview.receita} saidas={projectFinancialOverview.saidas} resultado={projectFinancialOverview.resultado} /></div>'''
src = replace_once(src, old_overview_ui, new_overview_ui, 'ui overview visao')
src = src.replace('data={projectFinancialOverview.chart}', 'data={[{ Recebido: projectFinancialOverview.receita, "Custos + Despesas": projectFinancialOverview.saidas, Resultado: projectFinancialOverview.resultado, Margem: projectFinancialOverview.margem }]}')
src = src.replace('titulo="Receitas de Projetos" labelRealizado="Recebido" labelPendente="A Receber"', 'titulo="Projetos" labelRealizado="Recebido" labelPendente="A receber"')
src = src.replace('titulo="Empréstimos / Aportes" labelRealizado="Entrada Realizada" labelPendente="A Realizar"', 'titulo="Capital" labelRealizado="Realizado" labelPendente="A realizar"')
src = src.replace('titulo="Pagamentos" labelRealizado="Pago" labelPendente="A Pagar"', 'titulo="Pagamentos" labelRealizado="Pago" labelPendente="A pagar"')
src = src.replace('id="report-visao-abc" data-report-section className="card" style={{ padding: \'1.5rem\', display: \'flex\', flexDirection: \'column\' }}', 'id="report-visao-abc" data-report-section className="card" style={{ padding: \'1.5rem\', display: \'flex\', flexDirection: \'column\', gridColumn: \'1 / -1\' }}')
src = src.replace("gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))'", "gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))'")
view_file.write_text(src, encoding='utf-8')


# -----------------------------------------------------------------------------
# FLUXO DE CAIXA
# -----------------------------------------------------------------------------
flow_file = Path('src/app/fluxo-caixa/page.js')
src = flow_file.read_text(encoding='utf-8')
src = src.replace(
    "meses.forEach((m, i) => map[i] = { mesNome: m, 'Entradas Realizadas': 0, 'Entradas Programadas': 0, Saídas: 0, Resultado: 0, id: i });",
    "meses.forEach((m, i) => map[i] = { mesNome: m, Recebido: 0, 'A receber': 0, Pago: 0, Resultado: 0, id: i });"
)
src = src.replace("if (isPrevisto) map[m]['Entradas Programadas'] += item.valor;\n            else map[m]['Entradas Realizadas'] += item.valor;", "if (isPrevisto) map[m]['A receber'] += item.valor;\n            else map[m].Recebido += item.valor;")
src = src.replace('map[m].Saídas += item.valor;', 'map[m].Pago += item.valor;')
src = src.replace('<Bar dataKey="Entradas" fill="var(--success)" radius={[4, 4, 0, 0]} maxBarSize={50} />', '<Bar dataKey="Recebido" fill="var(--success)" radius={[4, 4, 0, 0]} maxBarSize={50} />')
src = src.replace('<Bar dataKey="Entradas Programadas" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={50} />', '<Bar dataKey="A receber" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={50} />')
src = src.replace('<Bar dataKey="Saídas" fill="var(--danger)" radius={[4, 4, 0, 0]} maxBarSize={50} />', '<Bar dataKey="Pago" fill="var(--danger)" radius={[4, 4, 0, 0]} maxBarSize={50} />')
src = src.replace('Representa o fluxo consolidado dos meses de janeiro a dezembro de 2026. Este gráfico possui um recorte de período independente do filtro padrão de 30 dias utilizado nos outros componentes.', 'Mostra, por mês de 2026, o que já foi recebido, o que ainda está a receber, o que foi pago e o resultado financeiro. Esta visão anual não é cortada pelo filtro de datas da página.')
src = src.replace("width: '100%', maxWidth: '800px', maxHeight: '90vh',", "width: 'min(1100px, 100%)', maxWidth: '1100px', maxHeight: 'calc(100vh - 2rem)',")
src = src.replace("display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,", "display: 'flex', alignItems: 'stretch', justifyContent: 'center', zIndex: 2147482000,")
src = src.replace("<table style={{ fontSize: '12px' }}>", "<table style={{ fontSize: '12px', minWidth: '760px' }}>", 1)
flow_file.write_text(src, encoding='utf-8')


# -----------------------------------------------------------------------------
# REMOVER PREFIXO CAIXA: DOS FILTROS EM TODA APLICACAO
# -----------------------------------------------------------------------------
for file in Path('src').rglob('*'):
    if file.suffix.lower() not in {'.js', '.jsx', '.ts', '.tsx'}:
        continue
    text = file.read_text(encoding='utf-8')
    updated = text.replace('Caixa: Data Inicial', 'Data Inicial').replace('Caixa: Data Final', 'Data Final')
    if updated != text:
        file.write_text(updated, encoding='utf-8')

print('Correcoes de telas aplicadas com sucesso.')
