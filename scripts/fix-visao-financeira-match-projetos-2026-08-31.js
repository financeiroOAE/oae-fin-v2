const fs = require('fs');

const path = 'src/app/visao-financeira/page.js';
let content = fs.readFileSync(path, 'utf8');

function replaceOnce(before, after, label) {
  if (!content.includes(before)) {
    throw new Error(`Trecho nao encontrado: ${label}`);
  }
  content = content.replace(before, after);
}

replaceOnce(
`  const projectFinancialOverview = useMemo(() => {
    // Esta visao e exclusivamente de OBRAS: usa somente valores alocados a
    // centro de custo real. Administracao e buckets genericos ficam fora.
    // Para realizados, valorDireto ja carrega a regra de caixa da CR_GERAL coluna K.
    const receitaObra = realizedFilteredData
      .filter((item) => item.natureza === 'Entrada' && hasAllocatedProject(item))
      .reduce((sum, item) => {
        if (item?.valorDireto !== undefined && item?.valorDireto !== null) {
          return sum + (Number(item.valorDireto) || 0);
        }
        const classification = classifyFinancialEntry(item);
        return classification.type === 'receita_projeto'
          ? sum + (Number(item.valor) || 0)
          : sum;
      }, 0);

    const receitaAdm = 0;
    const receita = receitaObra;
    const saidasProjeto = realizedFilteredData
      .filter((item) => item.natureza === 'Saída')
      .filter((item) => hasAllocatedProject(item));
    const tributos = saidasProjeto
      .filter((item) => isGeneralTax(item))
      .reduce((sum, item) => sum + Math.abs(Number(item.valor) || 0), 0);
    const saidas = saidasProjeto
      .filter((item) => !isGeneralTax(item))
      .reduce((sum, item) => sum + Math.abs(Number(item.valor) || 0), 0);
    const resultado = receita - saidas - tributos;
    const margem = receita > 0 ? (resultado / receita) * 100 : 0;
    return { receita, receitaObra, receitaAdm, saidas, tributos, resultado, margem };
  }, [realizedFilteredData]);`,
`  const projectFinancialOverview = useMemo(() => {
    // Mesma regra da aba Projetos / Composicao Financeira:
    // - receita realizada usa CR_GERAL coluna K;
    // - inclui receita direta (1010101) + administrativa (1010107);
    // - custos, despesas e tributos sao realizados no mesmo periodo;
    // - custos/despesas ficam restritos as obras ativas (ou obras selecionadas);
    // - administracao entra na RECEITA, mas nao transforma despesas administrativas
    //   gerais em custo de obra.
    const start = filterDataInicial ? new Date(filterDataInicial + 'T00:00:00').getTime() : 0;
    const selectedEnd = filterDataFinal ? new Date(filterDataFinal + 'T23:59:59').getTime() : Infinity;
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const end = Math.min(selectedEnd, todayEnd.getTime());

    const selectedProjectKeys = new Set(
      filterProjetos
        .filter((name) => !String(name || '').toUpperCase().includes('ADMINISTRA'))
        .map((name) => getProjectKey(name))
        .filter(Boolean)
    );
    const hasProjectFilter = selectedProjectKeys.size > 0;
    const allowedCostProjectKeys = hasProjectFilter ? selectedProjectKeys : activeProjectKeys;

    const projectRevenueData = consolidateFinancialData(rawBaseData, {
      isProjetosPage: true,
      incluirRateioAdm: true,
      usarValorCaixa: true,
    });

    let receita = 0;
    let receitaObra = 0;
    let receitaAdm = 0;

    projectRevenueData.forEach((item) => {
      if (String(item?.natureza || '').toUpperCase() !== 'ENTRADA') return;
      const status = String(item?.status || '').toUpperCase();
      const isRealizado = status.includes('REALIZADO') || status.includes('RECEBIDO') || status.includes('EFETIVADO');
      if (!isRealizado) return;
      const ts = Number(item.dataTimestamp) || 0;
      if (ts < start || ts > end) return;

      const itemProjectKey = getProjectKey(item.projeto);
      if (hasProjectFilter && !selectedProjectKeys.has(itemProjectKey)) return;

      const direta = Number(item.valorDireto) || 0;
      const adm = Number(item.valorAdministrativo) || 0;
      receitaObra += direta;
      receitaAdm += adm;
      receita += Number(item.valor) || 0;
    });

    let custos = 0;
    let despesas = 0;
    let tributos = 0;

    rawBaseData.forEach((item) => {
      if (item.natureza !== 'Saída') return;
      const status = String(item.status || '').toUpperCase();
      const isRealizado = status.includes('REALIZADO') || status.includes('PAGO') || status.includes('EFETIVADO');
      if (!isRealizado) return;
      const ts = Number(item.dataTimestamp) || 0;
      if (ts < start || ts > end) return;

      const itemProjectKey = getProjectKey(item.projeto);
      const projectName = String(item.projeto || '');
      const value = Math.abs(Number(item.valor) || 0);

      if (isGeneralTax(item)) {
        if (!hasAllocatedProject(item)) return;
        if (hasProjectFilter && !selectedProjectKeys.has(itemProjectKey)) return;
        tributos += value;
        return;
      }

      if (normalizeTaxScopeText(projectName).includes('ADMINISTRA')) return;
      if (!allowedCostProjectKeys.has(itemProjectKey)) return;

      const dreInfo = [item.dreClasse, item.dreLinha, item.dreDescricao]
        .filter(Boolean)
        .join(' ')
        .toUpperCase();
      const isPendingDre = !dreInfo.trim() || dreInfo.includes('PENDENTE DE CLASSIFICAÇÃO');
      if (isPendingDre) return;

      if (dreInfo.includes('CUSTO')) custos += value;
      else despesas += value;
    });

    const resultado = receita - custos - despesas - tributos;
    const margem = receita > 0 ? (resultado / receita) * 100 : 0;

    return {
      receita,
      receitaObra,
      receitaAdm,
      custos,
      despesas,
      tributos,
      resultado,
      margem,
    };
  }, [rawBaseData, filterDataInicial, filterDataFinal, filterProjetos, activeProjectKeys]);`,
'calculo Visao Financeira Geral dos Projetos'
);

replaceOnce(
`          <div id="report-visao-projetos-financeiro" data-report-section className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
            <ReportAdder sectionKey="visao:projetos-financeiro" title="Visão Financeira Geral dos Projetos" componentName="Resultado e Margem dos Projetos" page="Visão Financeira" type="CHART" data={[{ "Recebido Líquido": projectFinancialOverview.receita, "Custos + Despesas": projectFinancialOverview.saidas, Tributos: projectFinancialOverview.tributos, Resultado: projectFinancialOverview.resultado, Margem: projectFinancialOverview.margem }]} filters={reportFilters} captureId="report-visao-projetos-financeiro" presetTags={["executive-financial", "project-executive"]} style={{ alignSelf: 'flex-end' }} />
            <h2 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.25rem' }}>Visão Financeira Geral dos Projetos</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Margem = Resultado ÷ Recebido Líquido × 100. Somente valores alocados às obras entram neste gráfico; Administração não é considerada. O Resultado corresponde ao Recebido Líquido menos Custos + Despesas e Tributos realizados.</p>
            <div className="finance-kpi-grid" style={{ marginBottom: '0.75rem' }}>
              <div><span style={{fontSize:'10px',color:'var(--text-secondary)',textTransform:'uppercase'}}>Recebido Líquido</span><strong style={{display:'block',fontSize:'14px',color:'var(--success)',overflowWrap:'anywhere'}}>{formatCurrency(projectFinancialOverview.receita)}</strong></div>
              <div><span style={{fontSize:'10px',color:'var(--text-secondary)',textTransform:'uppercase'}}>Custos + Despesas</span><strong style={{display:'block',fontSize:'14px',color:'var(--danger)',overflowWrap:'anywhere'}}>{formatCurrency(projectFinancialOverview.saidas)}</strong></div>
              <div><span style={{fontSize:'10px',color:'var(--text-secondary)',textTransform:'uppercase'}}>Tributos</span><strong style={{display:'block',fontSize:'14px',color:'var(--warning)',overflowWrap:'anywhere'}}>{formatCurrency(projectFinancialOverview.tributos)}</strong></div>
              <div><span style={{fontSize:'10px',color:'var(--text-secondary)',textTransform:'uppercase'}}>Resultado</span><strong style={{display:'block',fontSize:'14px',color:'var(--primary)',overflowWrap:'anywhere'}}>{formatCurrency(projectFinancialOverview.resultado)}</strong></div>
              <div><span style={{fontSize:'10px',color:'var(--text-secondary)',textTransform:'uppercase'}}>Margem</span><strong style={{display:'block',fontSize:'14px',color:projectFinancialOverview.margem >= 0 ? 'var(--success)' : 'var(--danger)'}}>{projectFinancialOverview.margem.toFixed(2).replace('.', ',')}%</strong></div>
            </div>
            <div className="finance-chart-frame"><ProjectFinancialOverviewChart recebido={projectFinancialOverview.receita} saidas={projectFinancialOverview.saidas} tributos={projectFinancialOverview.tributos} resultado={projectFinancialOverview.resultado} /></div>
          </div>`,
`          <div id="report-visao-projetos-financeiro" data-report-section className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
            <ReportAdder
              sectionKey="visao:projetos-financeiro"
              title="Visão Financeira Geral dos Projetos"
              componentName="Composição Financeira dos Projetos"
              page="Visão Financeira"
              type="CHART"
              data={[{
                Receita: projectFinancialOverview.receita,
                "Custos Diretos": projectFinancialOverview.custos,
                "Outras Despesas": projectFinancialOverview.despesas,
                Tributos: projectFinancialOverview.tributos,
                "Resultado Gerencial": projectFinancialOverview.resultado,
                "Margem de Resultado": projectFinancialOverview.margem,
              }]}
              filters={reportFilters}
              captureId="report-visao-projetos-financeiro"
              presetTags={["executive-financial", "project-executive"]}
              style={{ alignSelf: 'flex-end' }}
            />
            <h2 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.25rem' }}>Visão Financeira Geral dos Projetos</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Receita, custos, despesas e tributos no período selecionado</p>

            <div className="finance-kpi-grid" style={{ marginBottom: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
              <div>
                <span style={{fontSize:'10px',color:'var(--text-secondary)',textTransform:'uppercase'}}>Receita</span>
                <strong style={{display:'block',fontSize:'14px',color:'var(--success)',overflowWrap:'anywhere'}}>{formatCurrency(projectFinancialOverview.receita)}</strong>
              </div>
              <div>
                <span style={{fontSize:'10px',color:'var(--text-secondary)',textTransform:'uppercase'}}>Custos Diretos</span>
                <strong style={{display:'block',fontSize:'14px',color:'var(--warning)',overflowWrap:'anywhere'}}>{formatCurrency(projectFinancialOverview.custos)}</strong>
                <small style={{display:'block',fontSize:'9px',color:'var(--text-secondary)',marginTop:'2px'}}>{projectFinancialOverview.receita > 0 ? `${((projectFinancialOverview.custos / projectFinancialOverview.receita) * 100).toFixed(1)}% da Receita` : '0,0% da Receita'}</small>
              </div>
              <div>
                <span style={{fontSize:'10px',color:'var(--text-secondary)',textTransform:'uppercase'}}>Outras Despesas</span>
                <strong style={{display:'block',fontSize:'14px',color:'var(--danger)',overflowWrap:'anywhere'}}>{formatCurrency(projectFinancialOverview.despesas)}</strong>
                <small style={{display:'block',fontSize:'9px',color:'var(--text-secondary)',marginTop:'2px'}}>{projectFinancialOverview.receita > 0 ? `${((projectFinancialOverview.despesas / projectFinancialOverview.receita) * 100).toFixed(1)}% da Receita` : '0,0% da Receita'}</small>
              </div>
              <div>
                <span style={{fontSize:'10px',color:'var(--text-secondary)',textTransform:'uppercase'}}>Tributos</span>
                <strong style={{display:'block',fontSize:'14px',color:'var(--primary)',overflowWrap:'anywhere'}}>{formatCurrency(projectFinancialOverview.tributos)}</strong>
              </div>
              <div>
                <span style={{fontSize:'10px',color:'var(--text-secondary)',textTransform:'uppercase'}}>Resultado Gerencial</span>
                <strong style={{display:'block',fontSize:'14px',color:projectFinancialOverview.resultado >= 0 ? 'var(--success)' : 'var(--danger)',overflowWrap:'anywhere'}}>{formatCurrency(projectFinancialOverview.resultado)}</strong>
              </div>
              <div>
                <span style={{fontSize:'10px',color:'var(--text-secondary)',textTransform:'uppercase'}}>Margem de Resultado</span>
                <strong style={{display:'block',fontSize:'14px',color:projectFinancialOverview.margem >= 0 ? 'var(--success)' : 'var(--danger)'}}>{projectFinancialOverview.margem.toFixed(2).replace('.', ',')}%</strong>
              </div>
            </div>

            <FinancialCompositionBar
              title="Composição Financeira"
              total={projectFinancialOverview.receita}
              items={[
                { key: 'receita', label: 'Receita', value: projectFinancialOverview.receita, color: 'var(--success)' },
                { key: 'custos', label: 'Custos Diretos', value: projectFinancialOverview.custos, color: 'var(--warning)' },
                { key: 'despesas', label: 'Outras Despesas', value: projectFinancialOverview.despesas, color: 'var(--danger)' },
                { key: 'tributos', label: 'Tributos', value: projectFinancialOverview.tributos, color: 'var(--primary)' },
              ]}
            />
          </div>`,
'card Visao Financeira Geral dos Projetos'
);

// O componente antigo deixa de ser necessario apos a composicao passar a usar
// as mesmas informacoes da aba Projetos.
content = content.replace('import ProjectFinancialOverviewChart from "@/components/charts/ProjectFinancialOverviewChart";\n', '');

fs.writeFileSync(path, content, 'utf8');
console.log('Visao Financeira Geral dos Projetos alinhada com a Composicao Financeira da aba Projetos.');
