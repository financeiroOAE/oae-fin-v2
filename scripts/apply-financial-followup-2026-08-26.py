from pathlib import Path


def replace_once(text, before, after, label):
    if before not in text:
        raise RuntimeError(f"Trecho nao encontrado: {label}")
    return text.replace(before, after, 1)


def update(path, transform):
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    text = transform(text)
    file.write_text(text, encoding="utf-8")


# 1) Regras compartilhadas: PRV/PCT sao documentos de previsao e INSS entra como tributo sobre faturamento.
def patch_financial_classification(text):
    anchor = """function combinedText(item) {
  return normalizeText([
    accountText(item),
    item?.documento,
    item?.nome,
  ].filter(Boolean).join(' '));
}
"""
    addition = anchor + """
// PRV e PCT representam documentos de previsao de recebimento. Mesmo que a
// origem traga um status inconsistente, eles nao podem ser tratados como caixa recebido.
export function isForecastOnlyReceivableDocument(item) {
  const document = normalizeText(item?.documento);
  if (!document) return false;
  return /^(PRV|PCT)(?:$|[.\\s_/-]|\\d)/.test(document);
}
"""
    text = replace_once(text, anchor, addition, "helper PRV/PCT")

    old_tax = """export function isRevenueTax(item) {
  const code = normalizeAccountCode(item);

  // Quando há código de conta, ele é a fonte de verdade. Isto impede que palavras
  // presentes em cliente/documento/nome façam uma conta de equipe virar "tributo".
  if (code) return REVENUE_TAX_CODES.has(code);

  // Fallback apenas para snapshots antigos sem contaCodigo, olhando SOMENTE a conta/DRE.
  const text = accountText(item);
  if (text.includes('RETENCOES FORNECEDORES')) return false;
  return /(^|\\s)(PIS|COFINS|ISS|IRPJ|CSLL)(\\s|$)/.test(text) ||
    text.includes('IMPOSTOS RETIDOS NO FAT');
}
"""
    new_tax = """export function isRevenueTax(item) {
  const code = normalizeAccountCode(item);
  const text = accountText(item);

  if (text.includes('RETENCOES FORNECEDORES')) return false;

  // INSS da OAE e recolhido/retido sobre o faturamento e, por isso, pertence ao
  // mesmo grupo gerencial dos tributos sobre receita. A identificacao textual e
  // necessaria porque a conta pode variar na base sem usar os codigos 20301xx.
  if (/\\bINSS\\b/.test(text)) return true;

  // Para os demais tributos, o codigo financeiro segue como fonte primaria.
  if (code) return REVENUE_TAX_CODES.has(code);

  // Fallback para snapshots antigos sem contaCodigo, olhando somente conta/DRE.
  return /(^|\\s)(PIS|COFINS|ISS|IRPJ|CSLL)(\\s|$)/.test(text) ||
    text.includes('IMPOSTOS RETIDOS NO FAT');
}
"""
    text = replace_once(text, old_tax, new_tax, "isRevenueTax com INSS")

    old_label = """export function getRevenueTaxLabel(item) {
  const code = normalizeAccountCode(item);
  if (code === '2030101') return 'PIS';
  if (code === '2030102') return 'COFINS';
  if (code === '2030103') return 'ISS';
  if (code === '2030104') return 'IRPJ';
  if (code === '2030105') return 'CSLL';
  if (code === '2030107') return 'Impostos retidos / previsão';

  const text = accountText(item);
  if (/\\bPIS\\b/.test(text)) return 'PIS';
  if (/\\bCOFINS\\b/.test(text)) return 'COFINS';
  if (/\\bISS\\b/.test(text)) return 'ISS';
  if (/\\bIRPJ\\b/.test(text)) return 'IRPJ';
  if (/\\bCSLL\\b/.test(text)) return 'CSLL';
  return item?.contaNome || item?.contaDescricao || 'Tributos';
}
"""
    new_label = """export function getRevenueTaxLabel(item) {
  const code = normalizeAccountCode(item);
  if (code === '2030101') return 'PIS';
  if (code === '2030102') return 'COFINS';
  if (code === '2030103') return 'ISS';
  if (code === '2030104') return 'IRPJ';
  if (code === '2030105') return 'CSLL';
  if (code === '2030107') return 'Impostos retidos / previsão';

  const text = accountText(item);
  if (/\\bINSS\\b/.test(text)) return 'INSS';
  if (/\\bPIS\\b/.test(text)) return 'PIS';
  if (/\\bCOFINS\\b/.test(text)) return 'COFINS';
  if (/\\bISS\\b/.test(text)) return 'ISS';
  if (/\\bIRPJ\\b/.test(text)) return 'IRPJ';
  if (/\\bCSLL\\b/.test(text)) return 'CSLL';
  return item?.contaNome || item?.contaDescricao || 'Tributos';
}
"""
    return replace_once(text, old_label, new_label, "rotulo INSS")


update("src/lib/financialClassification.js", patch_financial_classification)


# 2) DRE: tributos sobre faturamento ficam nas deducoes da receita; IRPJ/CSLL continuam apos resultado antes de IR.
def patch_dre_engine(text):
    text = replace_once(
        text,
        "import { isTeamExpense, normalizeAccountCode } from '@/lib/financialClassification';",
        "import { getRevenueTaxLabel, isRevenueTax, isTeamExpense, normalizeAccountCode } from '@/lib/financialClassification';",
        "imports DRE tributarios",
    )
    anchor = """  if (item.natureza === 'Entrada' && (accountCode === '1010101' || accountCode === '1010107')) return 'RECEITA_BRUTA';
"""
    addition = anchor + """
  // Tributos incidentes sobre o faturamento reduzem a receita bruta. INSS da OAE
  // segue aqui junto de PIS/COFINS/ISS. IRPJ e CSLL permanecem na deducao fiscal.
  if (item.natureza === 'Saída' && isRevenueTax(item)) {
    const taxLabel = getRevenueTaxLabel(item);
    if (taxLabel === 'IRPJ' || taxLabel === 'CSLL') return 'DED_FISCAL';
    return 'DED_RECEITA';
  }
"""
    return replace_once(text, anchor, addition, "mapeamento DRE tributos/INSS")


update("src/lib/dreEngine.js", patch_dre_engine)


# 3) Fluxo de Caixa: PRV/PCT ficam exclusivamente em previsao e nunca em recebido realizado.
def patch_fluxo(text):
    text = replace_once(
        text,
        'import { consolidateFinancialData } from "@/lib/consolidation";',
        'import { consolidateFinancialData } from "@/lib/consolidation";\nimport { isForecastOnlyReceivableDocument } from "@/lib/financialClassification";',
        "import PRV/PCT fluxo",
    )

    old_status = """      if (item.natureza === 'Entrada') {
        if (item.status === 'Realizado') statusAmigavel = 'Recebido';
        if (item.status === 'A realizar') statusAmigavel = 'A receber';
      } else if (item.natureza === 'Saída') {
"""
    new_status = """      if (item.natureza === 'Entrada') {
        const forecastOnly = isForecastOnlyReceivableDocument(item);
        if (forecastOnly) statusAmigavel = 'A receber';
        else if (item.status === 'Realizado') statusAmigavel = 'Recebido';
        else if (item.status === 'A realizar') statusAmigavel = 'A receber';
      } else if (item.natureza === 'Saída') {
"""
    text = replace_once(text, old_status, new_status, "status PRV/PCT fluxo")

    old_annual = """          const status = String(item.status || '').trim().toUpperCase();
          const isRealizado = status === 'REALIZADO';
          const isPrevisto = status === 'A REALIZAR';
          if (!isRealizado && !isPrevisto) return;
"""
    new_annual = """          const status = String(item.status || '').trim().toUpperCase();
          const forecastOnly = item.natureza === 'Entrada' && isForecastOnlyReceivableDocument(item);
          const isRealizado = status === 'REALIZADO' && !forecastOnly;
          const isPrevisto = status === 'A REALIZAR' || forecastOnly;
          if (!isRealizado && !isPrevisto) return;
"""
    text = replace_once(text, old_annual, new_annual, "anual PRV/PCT fluxo")

    old_week = """    baseData.forEach(item => {
      const status = String(item.status || '').trim().toUpperCase();
      if(status === 'A REALIZAR' && map[item.dataTimestamp]) {
"""
    new_week = """    baseData.forEach(item => {
      const status = String(item.status || '').trim().toUpperCase();
      const forecastOnly = item.natureza === 'Entrada' && isForecastOnlyReceivableDocument(item);
      const isForecast = status === 'A REALIZAR' || forecastOnly;
      if(isForecast && map[item.dataTimestamp]) {
"""
    return replace_once(text, old_week, new_week, "previsao semanal PRV/PCT")


update("src/app/fluxo-caixa/page.js", patch_fluxo)


# 4) Visao Financeira: caixa liquido realizado, previsoes PRV/PCT, informacoes dos cards e tributos separados nos projetos.
def patch_visao(text):
    text = replace_once(
        text,
        'import { classifyFinancialEntry, isPartnerWithdrawal, isRevenueTax } from "@/lib/financialClassification";',
        'import { classifyFinancialEntry, isForecastOnlyReceivableDocument, isPartnerWithdrawal, isRevenueTax } from "@/lib/financialClassification";',
        "import PRV/PCT visao",
    )

    old_status = """      if (item.natureza === 'Entrada') {
        if (item.status === 'Realizado') statusAmigavel = 'Recebido';
        if (item.status === 'A realizar') statusAmigavel = 'A receber';
      } else if (item.natureza === 'Saída') {
"""
    new_status = """      if (item.natureza === 'Entrada') {
        const forecastOnly = isForecastOnlyReceivableDocument(item);
        if (forecastOnly) statusAmigavel = 'A receber';
        else if (item.status === 'Realizado') statusAmigavel = 'Recebido';
        else if (item.status === 'A realizar') statusAmigavel = 'A receber';
      } else if (item.natureza === 'Saída') {
"""
    text = replace_once(text, old_status, new_status, "status PRV/PCT visao")

    old_realized = """    return openFilteredData.filter((item) => {
      if (String(item.status || '').trim().toUpperCase() !== 'REALIZADO') return false;
      return item.dataTimestamp >= start && item.dataTimestamp <= end;
    });
"""
    new_realized = """    return openFilteredData.filter((item) => {
      if (String(item.status || '').trim().toUpperCase() !== 'REALIZADO') return false;
      if (item.natureza === 'Entrada' && isForecastOnlyReceivableDocument(item)) return false;
      return item.dataTimestamp >= start && item.dataTimestamp <= end;
    });
"""
    text = replace_once(text, old_realized, new_realized, "realizado liquido sem PRV/PCT")

    old_forecast = """    return openFilteredData.filter((item) => {
      if (String(item.status || '').trim().toUpperCase() !== 'A REALIZAR') return false;
      return item.dataTimestamp >= start && item.dataTimestamp <= end;
    });
"""
    new_forecast = """    return openFilteredData.filter((item) => {
      const status = String(item.status || '').trim().toUpperCase();
      const forecastOnly = item.natureza === 'Entrada' && isForecastOnlyReceivableDocument(item);
      if (status !== 'A REALIZAR' && !forecastOnly) return false;
      return item.dataTimestamp >= start && item.dataTimestamp <= end;
    });
"""
    text = replace_once(text, old_forecast, new_forecast, "forecast incluindo PRV/PCT")

    old_annual = """          const status = String(item.status || '').trim().toUpperCase();
          const isRealizado = status === 'REALIZADO';
          const isPrevisto = status === 'A REALIZAR';
          if (!isRealizado && !isPrevisto) return;
"""
    new_annual = """          const status = String(item.status || '').trim().toUpperCase();
          const forecastOnly = item.natureza === 'Entrada' && isForecastOnlyReceivableDocument(item);
          const isRealizado = status === 'REALIZADO' && !forecastOnly;
          const isPrevisto = status === 'A REALIZAR' || forecastOnly;
          if (!isRealizado && !isPrevisto) return;
"""
    text = replace_once(text, old_annual, new_annual, "anual PRV/PCT visao")

    old_overview = """  const projectFinancialOverview = useMemo(() => {
    const receitaObra = projectRevenueStatus.realizado.obra;
    const receitaAdm = projectRevenueStatus.realizado.adm;
    const receita = projectRevenueStatus.realizado.total;
    const saidas = realizedFilteredData
      .filter((item) => item.natureza === 'Saída')
      .filter((item) => filterProjetos.length > 0 || !String(item.projeto || '').toUpperCase().includes('ADMINISTRA'))
      .reduce((sum, item) => sum + Math.abs(Number(item.valor) || 0), 0);
    const resultado = receita - saidas;
    const margem = receita > 0 ? (resultado / receita) * 100 : 0;
    return { receita, receitaObra, receitaAdm, saidas, resultado, margem };
  }, [projectRevenueStatus, realizedFilteredData, filterProjetos]);
"""
    new_overview = """  const projectFinancialOverview = useMemo(() => {
    const receitaObra = projectRevenueStatus.realizado.obra;
    const receitaAdm = projectRevenueStatus.realizado.adm;
    const receita = projectRevenueStatus.realizado.total;
    const saidasProjeto = realizedFilteredData
      .filter((item) => item.natureza === 'Saída')
      .filter((item) => filterProjetos.length > 0 || !String(item.projeto || '').toUpperCase().includes('ADMINISTRA'));
    const tributos = saidasProjeto
      .filter((item) => isRevenueTax(item))
      .reduce((sum, item) => sum + Math.abs(Number(item.valor) || 0), 0);
    const saidas = saidasProjeto
      .filter((item) => !isRevenueTax(item))
      .reduce((sum, item) => sum + Math.abs(Number(item.valor) || 0), 0);
    const resultado = receita - saidas - tributos;
    const margem = receita > 0 ? (resultado / receita) * 100 : 0;
    return { receita, receitaObra, receitaAdm, saidas, tributos, resultado, margem };
  }, [projectRevenueStatus, realizedFilteredData, filterProjetos]);
"""
    text = replace_once(text, old_overview, new_overview, "overview projetos com tributos")

    text = replace_once(
        text,
        '<CheckCircle size={16} color="var(--primary)"/> Resultado Realizado <InfoTooltip title="Resultado Realizado" content="Resultado das entradas realizadas menos as saídas realizadas no período selecionado." />',
        '<CheckCircle size={16} color="var(--primary)"/> Resultado Realizado <InfoTooltip title="Resultado Realizado" content="Resultado do caixa efetivo: entradas líquidas realmente creditadas menos pagamentos realizados no período selecionado." />',
        "info resultado realizado",
    )
    text = replace_once(
        text,
        '<Target size={16} color="var(--primary)"/> Resultado Previsto <InfoTooltip title="Resultado Previsto" content="Resultado das entradas a receber menos as saídas a pagar no período selecionado." />',
        '<Target size={16} color="var(--primary)"/> Resultado Previsto — Visão do Dia <InfoTooltip title="Resultado Previsto — Visão do Dia" content="Posição consultada hoje dos valores ainda em aberto: A Receber menos A Pagar dentro do período selecionado. PRV e PCT permanecem somente na previsão." />',
        "info resultado previsto",
    )
    text = replace_once(
        text,
        '<ArrowDownCircle size={14} color="var(--success)"/> Entradas Realizadas</p>',
        '<ArrowDownCircle size={14} color="var(--success)"/> Entradas Realizadas <InfoTooltip title="Entradas Realizadas" content="Valor líquido efetivamente creditado nas contas. Para CR_GERAL, usa a coluna K (Valor). Documentos PRV e PCT não entram como recebidos." /></p>',
        "info entradas realizadas",
    )
    text = replace_once(
        text,
        '<ArrowUpCircle size={14} color="var(--success)"/> A Receber</p>',
        '<ArrowUpCircle size={14} color="var(--success)"/> A Receber <InfoTooltip title="A Receber" content="Valores ainda previstos ou em aberto. Documentos PRV e PCT são tratados exclusivamente como previsão de recebimento." /></p>',
        "info a receber",
    )
    text = replace_once(
        text,
        '<ArrowUp size={14} color="var(--danger)"/> Pago</p>',
        '<ArrowUp size={14} color="var(--danger)"/> Pago <InfoTooltip title="Pago" content="Saídas efetivamente realizadas no período selecionado." /></p>',
        "info pago",
    )
    text = replace_once(
        text,
        '<ArrowDown size={14} color="var(--danger)"/> A Pagar</p>',
        '<ArrowDown size={14} color="var(--danger)"/> A Pagar <InfoTooltip title="A Pagar" content="Compromissos financeiros ainda em aberto ou previstos dentro do período selecionado." /></p>',
        "info a pagar",
    )

    old_status_title = '<h2 style={{ fontSize: \'15px\', fontWeight: \'600\', color: \'var(--text-main)\', marginBottom: \'0.35rem\' }}>Status Financeiro Consolidado</h2>'
    new_status_title = '<h2 style={{ fontSize: \'15px\', fontWeight: \'600\', color: \'var(--text-main)\', marginBottom: \'0.35rem\', display: \'flex\', alignItems: \'center\', gap: \'0.4rem\' }}>Status Financeiro Consolidado <InfoTooltip title="Tributos consolidados" content="Tributos incluem PIS, COFINS, ISS, INSS incidente sobre o faturamento, IRPJ, CSLL e demais contas tributárias classificadas como tributo." /></h2>'
    text = replace_once(text, old_status_title, new_status_title, "info status tributos")

    old_report = 'data={[{ Recebido: projectFinancialOverview.receita, "Custos + Despesas": projectFinancialOverview.saidas, Resultado: projectFinancialOverview.resultado, Margem: projectFinancialOverview.margem }]}'
    new_report = 'data={[{ Recebido: projectFinancialOverview.receita, "Custos + Despesas": projectFinancialOverview.saidas, Tributos: projectFinancialOverview.tributos, Resultado: projectFinancialOverview.resultado, Margem: projectFinancialOverview.margem }]}'
    text = replace_once(text, old_report, new_report, "report overview tributos")

    old_desc = '<p style={{ fontSize: \'12px\', color: \'var(--text-secondary)\', marginBottom: \'1rem\' }}>Recebido de projetos (obra + administrativo vinculado) versus saídas realizadas das obras.</p>'
    new_desc = '<p style={{ fontSize: \'12px\', color: \'var(--text-secondary)\', marginBottom: \'1rem\' }}>Recebido líquido de projetos versus custos/despesas e tributos realizados, com INSS sobre faturamento separado na leitura.</p>'
    text = replace_once(text, old_desc, new_desc, "descricao overview tributos")

    old_kpi = """              <div><span style={{fontSize:'10px',color:'var(--text-secondary)',textTransform:'uppercase'}}>Custos + Despesas</span><strong style={{display:'block',fontSize:'14px',color:'var(--danger)',overflowWrap:'anywhere'}}>{formatCurrency(projectFinancialOverview.saidas)}</strong></div>
              <div><span style={{fontSize:'10px',color:'var(--text-secondary)',textTransform:'uppercase'}}>Resultado</span><strong style={{display:'block',fontSize:'14px',color:projectFinancialOverview.resultado >= 0 ? 'var(--success)' : 'var(--danger)',overflowWrap:'anywhere'}}>{formatCurrency(projectFinancialOverview.resultado)}</strong></div>
"""
    new_kpi = """              <div><span style={{fontSize:'10px',color:'var(--text-secondary)',textTransform:'uppercase'}}>Custos + Despesas</span><strong style={{display:'block',fontSize:'14px',color:'var(--danger)',overflowWrap:'anywhere'}}>{formatCurrency(projectFinancialOverview.saidas)}</strong></div>
              <div><span style={{fontSize:'10px',color:'var(--text-secondary)',textTransform:'uppercase'}}>Tributos</span><strong style={{display:'block',fontSize:'14px',color:'var(--primary)',overflowWrap:'anywhere'}}>{formatCurrency(projectFinancialOverview.tributos)}</strong></div>
              <div><span style={{fontSize:'10px',color:'var(--text-secondary)',textTransform:'uppercase'}}>Resultado</span><strong style={{display:'block',fontSize:'14px',color:projectFinancialOverview.resultado >= 0 ? 'var(--success)' : 'var(--danger)',overflowWrap:'anywhere'}}>{formatCurrency(projectFinancialOverview.resultado)}</strong></div>
"""
    text = replace_once(text, old_kpi, new_kpi, "kpi tributos overview")
    text = replace_once(
        text,
        '<ProjectFinancialOverviewChart recebido={projectFinancialOverview.receita} saidas={projectFinancialOverview.saidas} resultado={projectFinancialOverview.resultado} />',
        '<ProjectFinancialOverviewChart recebido={projectFinancialOverview.receita} saidas={projectFinancialOverview.saidas} tributos={projectFinancialOverview.tributos} resultado={projectFinancialOverview.resultado} />',
        "grafico overview tributos",
    )
    return text


update("src/app/visao-financeira/page.js", patch_visao)


# 5) Grafico da Visao Financeira dos Projetos recebe a serie de Tributos.
def patch_project_chart(text):
    text = replace_once(
        text,
        "  'Custos + Despesas': 'var(--danger)',\n  Resultado: 'var(--primary)',",
        "  'Custos + Despesas': 'var(--danger)',\n  Tributos: 'var(--warning)',\n  Resultado: 'var(--primary)',",
        "cor tributos grafico",
    )
    text = replace_once(
        text,
        "export default function ProjectFinancialOverviewChart({ recebido = 0, saidas = 0, resultado = 0 }) {\n  const data = [\n    { name: 'Recebido', value: recebido },\n    { name: 'Custos + Despesas', value: saidas },\n    { name: 'Resultado', value: resultado },\n  ];",
        "export default function ProjectFinancialOverviewChart({ recebido = 0, saidas = 0, tributos = 0, resultado = 0 }) {\n  const data = [\n    { name: 'Recebido', value: recebido },\n    { name: 'Custos + Despesas', value: saidas },\n    { name: 'Tributos', value: tributos },\n    { name: 'Resultado', value: resultado },\n  ];",
        "serie tributos grafico",
    )
    return text


update("src/components/charts/ProjectFinancialOverviewChart.js", patch_project_chart)


# 6) Projetos: Min% robusto, nomenclatura da composicao e relatorio executivo no construtor padrao.
def patch_projects(text):
    anchor = """const getYearToDateRange = () => {
  const today = new Date();
  const localDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return { start: '2026-01-01', end: localDate(today) };
};
"""
    addition = anchor + """
const parsePercentFilter = (value) => {
  const normalized = String(value ?? '').replace('%', '').replace(',', '.').trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};
"""
    text = replace_once(text, anchor, addition, "helper min percentual")

    text = replace_once(
        text,
        "      if (colFilterMinFaturadoPerc && (p.percentFaturado * 100) < Number(colFilterMinFaturadoPerc)) return false;",
        "      const minFaturadoPerc = parsePercentFilter(colFilterMinFaturadoPerc);\n      if (minFaturadoPerc !== null && (p.percentFaturado * 100) < minFaturadoPerc) return false;",
        "filtro min percentual",
    )
    text = replace_once(
        text,
        '<input type="number" placeholder="Min %" value={colFilterMinFaturadoPerc}',
        '<input type="text" inputMode="decimal" placeholder="Min % (ex.: 50)" value={colFilterMinFaturadoPerc}',
        "input min percentual",
    )
    text = replace_once(text, "Receita Líquida Realizada de Projetos", "RECEITA LÍQUIDA", "label composicao receita liquida")

    old_button = """                <button onClick={exportSelectedProjectPdf} className="btn" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', minHeight: '38px', padding: '0 0.85rem', fontSize: '13px', fontWeight: '600', background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '6px', whiteSpace: 'nowrap' }}>
                  <FileText size={14} /> Gerar PDF
                </button>
"""
    new_button = """                <ReportAdder
                  sectionKey={`projetos:executivo-selecionado:${selectedProject.projectKey}`}
                  title={`Relatório Executivo — ${selectedProject.nome}`}
                  componentName="Relatório Executivo do Projeto"
                  page="Projetos"
                  type="TABLE"
                  data={[{
                    Projeto: selectedProject.nome,
                    Empresa: selectedProject.empresa || '',
                    Tipo: selectedProject.tipo || '',
                    Contratado: Number(selectedProject.contratado) || 0,
                    Faturado: Number(selectedProject.faturado) || 0,
                    'Recebido Líquido': Number(selectedProject.recebido) || 0,
                    'A Receber': Number(selectedProject.aReceber) || 0,
                    Pago: Number(selectedProject.pago) || 0,
                    'A Pagar': Number(selectedProject.aPagar) || 0,
                    Resultado: Number(selectedProject.resultadoCaixa) || 0,
                  }]}
                  dataSets={{
                    summary: [{
                      Projeto: selectedProject.nome,
                      Empresa: selectedProject.empresa || '',
                      Tipo: selectedProject.tipo || '',
                      Contratado: Number(selectedProject.contratado) || 0,
                      Faturado: Number(selectedProject.faturado) || 0,
                      'Recebido Líquido': Number(selectedProject.recebido) || 0,
                      'A Receber': Number(selectedProject.aReceber) || 0,
                      Pago: Number(selectedProject.pago) || 0,
                      'A Pagar': Number(selectedProject.aPagar) || 0,
                      Resultado: Number(selectedProject.resultadoCaixa) || 0,
                    }],
                    all: selectedProjectReportMoves.map((item) => ({
                      Data: item.data || '',
                      Natureza: item.natureza || '',
                      Situação: item.status || '',
                      'Nome / Fornecedor': item.nome || '',
                      Conta: item.contaNome || item.contaDescricao || item.contaCodigo || '',
                      Documento: item.documento || '',
                      Lançamento: item.lancamento || '',
                      Valor: Number(item.valor) || 0,
                    })),
                  }}
                  detailMode="summary"
                  detailOptions={["summary", "all"]}
                  filters={{ Projeto: selectedProject.nome, Empresa: selectedProject.empresa || 'Todas', Tipo: selectedProject.tipo || 'Todos', 'Data inicial': filterDataInicial || 'Todas', 'Data final': filterDataFinal || 'Todas' }}
                  explanation="Relatório executivo do projeto selecionado com opção de resumo ou todos os lançamentos filtrados."
                  style={{ display: 'none' }}
                />
                <button onClick={() => isReportMode ? exitReportMode() : openReportBuilder('Projetos')} className={`btn ${isReportMode ? 'btn-primary' : ''}`} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', minHeight: '38px', padding: '0 0.85rem', fontSize: '13px', fontWeight: '600', background: isReportMode ? 'var(--primary)' : 'var(--bg-elevated)', border: '1px solid var(--border-color)', color: isReportMode ? '#fff' : 'var(--text-main)', borderRadius: '6px', whiteSpace: 'nowrap' }}>
                  <FileText size={14} /> {isReportMode ? 'Sair do Modo Relatório' : 'Gerar Relatório'}
                </button>
"""
    return replace_once(text, old_button, new_button, "relatorio executivo padronizado")


update("src/app/projetos/page.js", patch_projects)

print("Ajustes de Fluxo, Projetos, DRE e Visao Financeira aplicados.")
