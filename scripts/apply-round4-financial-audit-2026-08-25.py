from pathlib import Path


def replace_once(path, old, new, label):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise RuntimeError(f'{label}: trecho nao encontrado em {path}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')
    print(f'OK {label}')


# -----------------------------------------------------------------------------
# 1) DRE ENGINE: contas 1010101/1010107 sao receita de projeto por definicao.
# -----------------------------------------------------------------------------
replace_once(
    'src/lib/dreEngine.js',
    "import { isTeamExpense } from '@/lib/financialClassification';",
    "import { isTeamExpense, normalizeAccountCode } from '@/lib/financialClassification';",
    'dre import normalizeAccountCode'
)

replace_once(
    'src/lib/dreEngine.js',
    "export function mapClasseToDreId(item) {\n  const dreClasse = item.dreClasseLabel || item.dreClasse || '';\n  const dreLinha = item.dreLinhaLabel || item.dreLinha || '';\n  const projeto = String(item.projeto || '').toUpperCase();\n\n  // Equipe vinculada ao centro de custo administrativo é despesa administrativa,",
    "export function mapClasseToDreId(item) {\n  const dreClasse = item.dreClasseLabel || item.dreClasse || '';\n  const dreLinha = item.dreLinhaLabel || item.dreLinha || '';\n  const projeto = String(item.projeto || '').toUpperCase();\n  const accountCode = normalizeAccountCode(item);\n\n  // Fonte de verdade da receita de projetos: CR_GERAL 1010101 + 1010107.\n  // A classificacao da DRE nao pode eliminar receita por nome de obra, status do\n  // catalogo de projetos ou eventual falha textual no DEPARA.\n  if (item.natureza === 'Entrada' && (accountCode === '1010101' || accountCode === '1010107')) return 'RECEITA_BRUTA';\n\n  // Equipe vinculada ao centro de custo administrativo é despesa administrativa,",
    'dre receita fonte CR_GERAL'
)


# -----------------------------------------------------------------------------
# 2) VISAO FINANCEIRA: periodo, receitas, status e layout.
# -----------------------------------------------------------------------------
replace_once(
    'src/app/visao-financeira/page.js',
    "import { classifyFinancialEntry, isPartnerWithdrawal } from \"@/lib/financialClassification\";",
    "import { classifyFinancialEntry, isPartnerWithdrawal, isRevenueTax } from \"@/lib/financialClassification\";",
    'visao import isRevenueTax'
)

replace_once(
    'src/app/visao-financeira/page.js',
    "  const forecastFilteredData = useMemo(() => {\n    const today = new Date();\n    today.setHours(0, 0, 0, 0);\n    const endOf2026 = new Date('2026-12-31T23:59:59').getTime();\n    return openFilteredData.filter((item) => {\n      if (String(item.status || '').trim().toUpperCase() !== 'A REALIZAR') return false;\n      return item.dataTimestamp >= today.getTime() && item.dataTimestamp <= endOf2026;\n    });\n  }, [openFilteredData]);",
    "  const forecastFilteredData = useMemo(() => {\n    const start = filterDataInicial ? new Date(filterDataInicial + 'T00:00:00').getTime() : 0;\n    const end = filterDataFinal ? new Date(filterDataFinal + 'T23:59:59').getTime() : Infinity;\n    return openFilteredData.filter((item) => {\n      if (String(item.status || '').trim().toUpperCase() !== 'A REALIZAR') return false;\n      return item.dataTimestamp >= start && item.dataTimestamp <= end;\n    });\n  }, [openFilteredData, filterDataInicial, filterDataFinal]);",
    'visao previsao respeita periodo'
)

old_flow = """  // Agrupamentos Dinâmicos (Diário vs Mensal)
  const isDaily = useMemo(() => {
    if (!filterDataInicial || !filterDataFinal) return false;
    const diffTime = Math.abs(new Date(filterDataFinal) - new Date(filterDataInicial));
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) <= 60;
  }, [filterDataInicial, filterDataFinal]);

  const flowData = useMemo(() => {
    const map = {};
    filteredData.forEach(item => {
      if (!item.data) return;
      const parts = item.data.split('/');
      if (parts.length !== 3) return;
      
      const label = isDaily ? `${parts[0]}/${parts[1]}` : `${parts[1]}/${parts[2]}`;
      const ts = isDaily ? item.dataTimestamp : new Date(parts[2], parts[1] - 1, 1).getTime();

      if (!map[label]) {
        map[label] = { label, Entradas: 0, Saídas: 0, timestamp: ts };
      }
      if (item.natureza === 'Entrada') map[label].Entradas += item.valor;
      if (item.natureza === 'Saída') map[label].Saídas += item.valor;
    });
    return Object.values(map).sort((a, b) => a.timestamp - b.timestamp);
  }, [filteredData, isDaily]);

  // Status Pie Charts
  const pieRecebimentos = [
    { name: 'Recebido', value: entradasRealizadas },
    { name: 'A receber', value: entradasARealizar }
  ];
  const piePagamentos = [
    { name: 'Pago', value: saidasRealizadas },
    { name: 'A pagar', value: saidasARealizar }
  ];
"""
new_flow = """  // Os graficos mensais mantem Jan-Dez sempre visiveis. O filtro de periodo
  // altera somente os valores; meses fora do intervalo permanecem com zero.
  const flowData = useMemo(() => {
    const monthLabels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const rows = monthLabels.map((label, month) => ({
      label,
      Entradas: 0,
      Saídas: 0,
      timestamp: new Date(2026, month, 1).getTime(),
      month,
    }));

    filteredData.forEach((item) => {
      const parts = String(item.data || '').split('/');
      if (parts.length !== 3 || parts[2] !== '2026') return;
      const month = Number(parts[1]) - 1;
      if (month < 0 || month > 11) return;
      if (item.natureza === 'Entrada') rows[month].Entradas += Number(item.valor) || 0;
      if (item.natureza === 'Saída') rows[month].Saídas += Number(item.valor) || 0;
    });

    return rows;
  }, [filteredData]);

  const piePagamentos = [
    { name: 'Pago', value: saidasRealizadas },
    { name: 'A pagar', value: saidasARealizar }
  ];
"""
replace_once('src/app/visao-financeira/page.js', old_flow, new_flow, 'visao 12 meses fixos')

old_top = """  const topProjetosEntradas = useMemo(() => {
    const map = {};
    filteredData.forEach((item) => {
      if (item.natureza !== 'Entrada') return;
      const projectName = String(item.projeto || '').trim();
      const projectUpper = projectName.toUpperCase();
      if (!projectName || projectUpper.includes('ADMINISTRA') || projectUpper === 'GRUPO OAE' || projectUpper === 'SEM PROJETO') return;
      if (!activeProjectKeys.has(getProjectKey(projectName))) return;

      const rows = item.linhasOriginais?.length ? item.linhasOriginais : [item];
      const projectRevenue = rows.reduce((sum, row) => {
        const classification = classifyFinancialEntry(row);
        if (classification.type !== 'receita_projeto' && classification.type !== 'receita_administrativa') return sum;
        return sum + (Number(row.valor) || 0);
      }, 0);
      if (projectRevenue <= 0) return;
      map[projectName] = (map[projectName] || 0) + projectRevenue;
    });
    return Object.entries(map).map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor).slice(0, 10);
  }, [filteredData, activeProjectKeys]);
"""
new_top = """  const topProjetosEntradas = useMemo(() => {
    const map = {};
    realizedFilteredData.forEach((item) => {
      if (item.natureza !== 'Entrada') return;
      const projectName = String(item.projeto || '').trim();
      const projectUpper = projectName.toUpperCase();
      if (!projectName || projectUpper.includes('ADMINISTRA') || projectUpper === 'GRUPO OAE' || projectUpper === 'SEM PROJETO') return;

      const rows = item.linhasOriginais?.length ? item.linhasOriginais : [item];
      const projectRevenue = rows.reduce((sum, row) => {
        const code = String(row.contaCodigo || '').replace(/\\D/g, '');
        if (code !== '1010101' && code !== '1010107') return sum;
        return sum + (Number(row.valor) || 0);
      }, 0);
      if (projectRevenue <= 0) return;
      map[projectName] = (map[projectName] || 0) + projectRevenue;
    });
    return Object.entries(map).map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor).slice(0, 10);
  }, [realizedFilteredData]);
"""
replace_once('src/app/visao-financeira/page.js', old_top, new_top, 'visao ranking receita por conta')

old_status_overview = """  // Top Contas Entradas / Saídas
  const entryStatusBreakdown = useMemo(() => {
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
    accumulate(forecastFilteredData, 'pendente');
    return result;
  }, [realizedFilteredData, forecastFilteredData]);

  const projectFinancialOverview = useMemo(() => {
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
  }, [filteredData, activeProjectKeys]);
"""
new_status_overview = """  // Receita de projetos: a fonte de verdade e a conta da CR_GERAL.
  // 1010101 = faturamento e 1010107 = administrativo. Nao dependemos do
  // cadastro de projetos ativos para decidir se uma receita existe.
  const projectRevenueStatus = useMemo(() => {
    const accumulate = (items) => {
      let obra = 0;
      let adm = 0;
      items.forEach((item) => {
        if (item.natureza !== 'Entrada') return;
        const rows = item.linhasOriginais?.length ? item.linhasOriginais : [item];
        rows.forEach((row) => {
          const code = String(row.contaCodigo || '').replace(/\\D/g, '');
          const value = Number(row.valor) || 0;
          if (code === '1010101') obra += value;
          if (code === '1010107') adm += value;
        });
      });
      return { obra, adm, total: obra + adm };
    };

    return {
      realizado: accumulate(realizedFilteredData),
      pendente: accumulate(forecastFilteredData),
    };
  }, [realizedFilteredData, forecastFilteredData]);

  const taxStatusBreakdown = useMemo(() => ({
    realizado: realizedFilteredData
      .filter((item) => item.natureza === 'Saída' && isRevenueTax(item))
      .reduce((sum, item) => sum + Math.abs(Number(item.valor) || 0), 0),
    pendente: forecastFilteredData
      .filter((item) => item.natureza === 'Saída' && isRevenueTax(item))
      .reduce((sum, item) => sum + Math.abs(Number(item.valor) || 0), 0),
  }), [realizedFilteredData, forecastFilteredData]);

  const projectFinancialOverview = useMemo(() => {
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
replace_once('src/app/visao-financeira/page.js', old_status_overview, new_status_overview, 'visao receita e status reconciliados')

replace_once(
    'src/app/visao-financeira/page.js',
    "content=\"A receber menos A pagar dos lançamentos ainda A realizar, com vencimento de hoje até 31/12/2026. Os filtros de projeto, nome e conta continuam válidos.\"",
    "content=\"A receber menos A pagar dos lançamentos ainda A realizar dentro do período selecionado. Os filtros de projeto, nome e conta também são aplicados.\"",
    'visao tooltip previsto'
)

old_status_ui = """            <ReportAdder sectionKey=\"visao:status\" title=\"Status Financeiro Consolidado\" componentName=\"Gráficos de Status\" page=\"Visão Financeira\" type=\"CHART\" data={[
              { name: 'Projetos Recebido', value: entryStatusBreakdown.projetos.realizado },
              { name: 'Projetos A Receber', value: entryStatusBreakdown.projetos.pendente },
              { name: 'Empréstimos/Aportes Realizado', value: entryStatusBreakdown.capital.realizado },
              { name: 'Empréstimos/Aportes A Realizar', value: entryStatusBreakdown.capital.pendente },
              ...piePagamentos
            ]} filters={reportFilters} captureId=\"report-visao-status\" presetTags={[\"executive-financial\"]} style={{ alignSelf: 'flex-end' }} />
            <h2 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '1.5rem' }}>Status Financeiro Consolidado</h2>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem', justifyContent: 'center' }}>
              <PieStatusChart realizado={entryStatusBreakdown.projetos.realizado} pendente={entryStatusBreakdown.projetos.pendente} colorRealizado=\"var(--success)\" colorPendente=\"rgba(16, 185, 129, 0.3)\" titulo=\"Projetos\" labelRealizado=\"Recebido\" labelPendente=\"A receber\" />
              <PieStatusChart realizado={entryStatusBreakdown.capital.realizado} pendente={entryStatusBreakdown.capital.pendente} colorRealizado=\"var(--info)\" colorPendente=\"rgba(59,130,246,0.3)\" titulo=\"Capital\" labelRealizado=\"Realizado\" labelPendente=\"A realizar\" />
              <PieStatusChart realizado={saidasRealizadas} pendente={saidasARealizar} colorRealizado=\"var(--danger)\" colorPendente=\"rgba(239, 68, 68, 0.3)\" titulo=\"Pagamentos\" labelRealizado=\"Pago\" labelPendente=\"A pagar\" />
            </div>"""
new_status_ui = """            <ReportAdder sectionKey=\"visao:status\" title=\"Status Financeiro Consolidado\" componentName=\"Tributos, Receitas e Pagamentos\" page=\"Visão Financeira\" type=\"CHART\" data={[
              { name: 'Receitas Recebidas', value: projectRevenueStatus.realizado.total },
              { name: 'Receitas A Receber', value: projectRevenueStatus.pendente.total },
              { name: 'Pagamentos Realizados', value: saidasRealizadas },
              { name: 'Pagamentos A Realizar', value: saidasARealizar },
              { name: 'Tributos Pagos', value: taxStatusBreakdown.realizado },
              { name: 'Tributos A Pagar', value: taxStatusBreakdown.pendente },
            ]} filters={reportFilters} captureId=\"report-visao-status\" presetTags={[\"executive-financial\"]} explanation=\"Receitas de projetos (1010101 + 1010107), pagamentos e tributos dentro do período selecionado.\" style={{ alignSelf: 'flex-end' }} />
            <h2 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.35rem' }}>Status Financeiro Consolidado</h2>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Tributos, receitas de projetos e pagamentos no período selecionado.</p>
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '1rem', alignItems: 'start' }}>
              <PieStatusChart realizado={taxStatusBreakdown.realizado} pendente={taxStatusBreakdown.pendente} colorRealizado=\"var(--primary)\" colorPendente=\"rgba(57, 198, 198, 0.25)\" titulo=\"Tributos\" labelRealizado=\"Pago\" labelPendente=\"A pagar\" />
              <PieStatusChart realizado={projectRevenueStatus.realizado.total} pendente={projectRevenueStatus.pendente.total} colorRealizado=\"var(--success)\" colorPendente=\"rgba(16, 185, 129, 0.3)\" titulo=\"Receitas\" labelRealizado=\"Recebido\" labelPendente=\"A receber\" />
              <PieStatusChart realizado={saidasRealizadas} pendente={saidasARealizar} colorRealizado=\"var(--danger)\" colorPendente=\"rgba(239, 68, 68, 0.3)\" titulo=\"Pagamentos\" labelRealizado=\"Pago\" labelPendente=\"A pagar\" />
            </div>"""
replace_once('src/app/visao-financeira/page.js', old_status_ui, new_status_ui, 'visao status tributos receitas pagamentos')

replace_once(
    'src/app/visao-financeira/page.js',
    "<div id=\"report-visao-abc\" data-report-section className=\"card\" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gridColumn: '1 / -1' }}>",
    "<div id=\"report-visao-abc\" data-report-section className=\"card\" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>",
    'visao abc ao lado do status'
)

# Responsividade do trio de status sem criar espacos vazios em desktop/tablet.
replace_once(
    'src/app/visao-financeira/page.js',
    "        input[type=\"date\"] {\n          background-color: var(--bg-elevated);",
    "        @media (max-width: 1050px) {\n          #report-visao-status > div[style*=\"grid-template-columns\"] { grid-template-columns: 1fr !important; }\n        }\n\n        input[type=\"date\"] {\n          background-color: var(--bg-elevated);",
    'visao status responsivo'
)


# -----------------------------------------------------------------------------
# 3) PROJETOS: receita mensal da CR_GERAL e custo de equipe fora do relatorio.
# -----------------------------------------------------------------------------
old_monthly = """    projectCashData.forEach((item) => {
      if (item.natureza !== 'Entrada' || !allowedProjects.has(getProjectKey(item.projeto))) return;
      const status = String(item.status || '').toUpperCase();
      if (!(status.includes('REALIZADO') || status.includes('RECEBIDO') || status.includes('EFETIVADO'))) return;
      const parts = String(item.data || '').split('/');
      if (parts.length !== 3 || parts[2] !== '2026') return;
      const month = Number(parts[1]) - 1;
      if (month < 0 || month > 11) return;
      const originalRows = item.linhasOriginais?.length ? item.linhasOriginais : [item];
      const revenue = originalRows.reduce((sum, row) => {
        const classification = classifyFinancialEntry(row);
        return (classification.type === 'receita_projeto' || classification.type === 'receita_administrativa') ? sum + (Number(row.valor) || 0) : sum;
      }, 0);
      rows[month].Receitas += revenue;
    });
"""
new_monthly = """    const revenueItems = usarCarteiraCompleta ? data : projectCashData;
    revenueItems.forEach((item) => {
      if (item.natureza !== 'Entrada') return;
      if (!usarCarteiraCompleta && !allowedProjects.has(getProjectKey(item.projeto))) return;
      const status = String(item.status || '').toUpperCase();
      if (!(status.includes('REALIZADO') || status.includes('RECEBIDO') || status.includes('EFETIVADO'))) return;
      const parts = String(item.data || '').split('/');
      if (parts.length !== 3 || parts[2] !== '2026') return;
      const month = Number(parts[1]) - 1;
      if (month < 0 || month > 11) return;
      const originalRows = item.linhasOriginais?.length ? item.linhasOriginais : [item];
      const revenue = originalRows.reduce((sum, row) => {
        const code = String(row.contaCodigo || '').replace(/\\D/g, '');
        return (code === '1010101' || code === '1010107') ? sum + (Number(row.valor) || 0) : sum;
      }, 0);
      rows[month].Receitas += revenue;
    });
"""
replace_once('src/app/projetos/page.js', old_monthly, new_monthly, 'projetos grafico receita CR_GERAL')

replace_once(
    'src/app/projetos/page.js',
    "  }, [data, filteredProjetos, projectCashData]);",
    "  }, [data, filteredProjetos, projectCashData, usarCarteiraCompleta]);",
    'projetos deps grafico mensal'
)

old_team_report = """      <div className=\"card\" data-report-section style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.25rem' }}>Custo de Equipe por Projeto</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Contas EQUIP. TÉC. somadas nos projetos exibidos. Ao filtrar uma obra, os valores passam a representar somente aquela obra.</p>
          </div>
          <ReportAdder sectionKey=\"projetos:custo-equipe\" title=\"Custo de Equipe por Projeto\" componentName=\"Gráfico de Custo de Equipe\" page=\"Projetos\" type=\"TABLE\" data={teamCostsChartData} filters={reportFilters} presetTags={[\"project-executive\"]} />
        </div>"""
new_team_report = """      <div className=\"card\" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.25rem' }}>Custo de Equipe por Projeto</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Contas EQUIP. TÉC. somadas nos projetos exibidos. Ao filtrar uma obra, os valores passam a representar somente aquela obra. Este painel fica somente em Projetos e não é oferecido no Relatório Executivo.</p>
          </div>
        </div>"""
replace_once('src/app/projetos/page.js', old_team_report, new_team_report, 'projetos equipe fora relatorio executivo')


# -----------------------------------------------------------------------------
# 4) GRAFICO DE PROJETOS: ocupa melhor a area e melhora leitura.
# -----------------------------------------------------------------------------
replace_once(
    'src/components/charts/ProjectFinancialOverviewChart.js',
    "import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, LabelList } from 'recharts';",
    "import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ReferenceLine } from 'recharts';",
    'overview chart import'
)

old_chart_labels = """  const ValueLabel = ({ x, y, width, height, value }) => {
    const positive = Number(value) >= 0;
    return (
      <text
        x={positive ? x + width + 8 : x - 8}
        y={y + height / 2 + 4}
        textAnchor={positive ? 'start' : 'end'}
        fill=\"var(--text-secondary)\"
        fontSize={10}
        fontWeight={600}
      >
        {formatCurrency(value)}
      </text>
    );
  };

  return (
    <div style={{ width: '100%', height: '220px', minHeight: 0 }}>
      <ResponsiveContainer width=\"100%\" height=\"100%\">
        <BarChart data={data} layout=\"vertical\" margin={{ top: 8, right: 135, left: 12, bottom: 8 }}>
          <CartesianGrid strokeDasharray=\"3 3\" horizontal={false} stroke=\"var(--border-color)\" opacity={0.35} />
          <XAxis type=\"number\" hide />
          <YAxis type=\"category\" dataKey=\"name\" axisLine={false} tickLine={false} width={115} tick={{ fill: 'var(--text-main)', fontSize: 11, fontWeight: 600 }} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.025)' }} />
          <Bar dataKey=\"value\" radius={[5, 5, 5, 5]} maxBarSize={30}>
            {data.map((row) => <Cell key={row.name} fill={COLORS[row.name] || 'var(--primary)'} />)}
            <LabelList dataKey=\"value\" content={<ValueLabel />} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
"""
new_chart_labels = """  const formatAxis = (value) => {
    const abs = Math.abs(Number(value) || 0);
    if (abs >= 1_000_000) return `${(Number(value) / 1_000_000).toFixed(1).replace('.', ',')} mi`;
    if (abs >= 1_000) return `${(Number(value) / 1_000).toFixed(0)} mil`;
    return String(Math.round(Number(value) || 0));
  };

  return (
    <div style={{ width: '100%', height: '250px', minHeight: 0 }}>
      <ResponsiveContainer width=\"100%\" height=\"100%\">
        <BarChart data={data} layout=\"vertical\" margin={{ top: 10, right: 18, left: 8, bottom: 24 }} barCategoryGap=\"28%\">
          <CartesianGrid strokeDasharray=\"3 3\" horizontal={false} stroke=\"var(--border-color)\" opacity={0.3} />
          <XAxis type=\"number\" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} tickFormatter={formatAxis} />
          <YAxis type=\"category\" dataKey=\"name\" axisLine={false} tickLine={false} width={118} tick={{ fill: 'var(--text-main)', fontSize: 11, fontWeight: 650 }} />
          <ReferenceLine x={0} stroke=\"var(--border-color)\" strokeWidth={1} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.025)' }} />
          <Bar dataKey=\"value\" radius={[6, 6, 6, 6]} maxBarSize={34}>
            {data.map((row) => <Cell key={row.name} fill={COLORS[row.name] || 'var(--primary)'} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
"""
replace_once('src/components/charts/ProjectFinancialOverviewChart.js', old_chart_labels, new_chart_labels, 'overview chart compacto')


# -----------------------------------------------------------------------------
# 5) DRE PAGE: Retroativo 2026 + itens fora da DRE classificados.
# -----------------------------------------------------------------------------
replace_once(
    'src/app/dre/page.js',
    "import InfoTooltip from \"@/components/InfoTooltip\";\nimport { getActiveProjectNames } from \"@/lib/projectRules\";",
    "import InfoTooltip from \"@/components/InfoTooltip\";\nimport { classifyFinancialEntry, normalizeAccountCode } from \"@/lib/financialClassification\";\nimport { getActiveProjectNames } from \"@/lib/projectRules\";",
    'dre page import classificacao'
)

old_pending_reason = """function getPendingReason(item) {
  const classe = String(item.dreClasse || '').toUpperCase();
  const linha = String(item.dreLinha || '').toUpperCase();
  if (!item.contaCodigo) return 'Conta financeira não identificada no lançamento.';
  if (!item.planoFinanceiro) return 'Conta não encontrada na relação PLANOS_FINANCEIROS.';
  if (classe.includes('PENDENTE') || linha.includes('PENDENTE')) return 'O plano financeiro existe, mas não possui DEPARA válido para a DRE.';
  return 'O DEPARA existe, mas a classe/linha informada não corresponde a uma linha reconhecida da DRE.';
}
"""
new_pending_reason = """function getPendingReason(item) {
  const classe = String(item.dreClasse || '').toUpperCase();
  const linha = String(item.dreLinha || '').toUpperCase();
  if (!item.contaCodigo) return 'Conta financeira não identificada no lançamento.';
  if (!item.planoFinanceiro) return 'Conta não encontrada na relação PLANOS_FINANCEIROS.';
  if (classe.includes('PENDENTE') || linha.includes('PENDENTE')) return 'O plano financeiro existe, mas não possui DEPARA válido para a DRE.';
  return 'O DEPARA existe, mas a classe/linha informada não corresponde a uma linha reconhecida da DRE.';
}

function classifyOutsideDre(item) {
  const code = normalizeAccountCode(item);
  const financialType = classifyFinancialEntry(item).type;
  const text = [item.contaNome, item.contaDescricao, item.dreClasse, item.drePacote, item.dreLinha, item.planoFinanceiro]
    .filter(Boolean).join(' ').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toUpperCase();

  if (financialType === 'emprestimo' || ['2020402', '2020104'].includes(code) || text.includes('EMPREST') || text.includes('FINANCIAMENTO')) {
    return { category: 'Empréstimos / Financiamentos', reason: code === '2020104' ? 'Principal de empréstimo é patrimonial; somente os juros segregados pertencem ao resultado financeiro.' : 'Captação ou amortização de principal altera caixa e passivo, mas não representa receita/despesa operacional da DRE.', intentional: true };
  }
  if (financialType === 'aporte' || code === '1020101' || text.includes('APORTE DE SOCIO')) {
    return { category: 'Aportes de Sócios', reason: 'Aporte é movimentação de patrimônio líquido, não receita operacional.', intentional: true };
  }
  if (code === '2020304' || text.includes('ADIANTAMENTO CREDOR')) {
    return { category: 'Adiantamentos', reason: 'Adiantamento é movimentação patrimonial/financeira até sua apropriação definitiva.', intentional: true };
  }
  if (code === '2090105' || text.includes('IRRF')) {
    return { category: 'Retenções Tributárias', reason: 'Retenção compensável é tratada como ativo/crédito tributário e não como despesa da DRE neste momento.', intentional: true };
  }
  if (code === '2020202' || code.startsWith('20107') || code === '2010802' || text.includes('CAPEX') || text.includes('IMOBILIZADO') || text.includes('INVESTIMENTO EM')) {
    return { category: 'Investimentos / CAPEX', reason: 'Aquisição de ativo ou intangível é investimento patrimonial; o efeito na DRE ocorre por depreciação/amortização quando aplicável.', intentional: true };
  }
  if (financialType === 'movimentacao_financeira' || text.includes('TRANSFERENCIA ENTRE CONTAS') || text.includes('RESGATE DE APLIC')) {
    return { category: 'Movimentações Financeiras', reason: 'Transferência ou movimentação entre contas não gera receita nem despesa econômica.', intentional: true };
  }

  const classe = String(item.dreClasse || '').toUpperCase();
  const linha = String(item.dreLinha || '').toUpperCase();
  const intentionalByDepara = classe.includes('FORA DA DRE') || linha.includes('FORA DA DRE') || classe.includes('PATRIMONIAL') || linha.includes('PATRIMONIAL');
  if (intentionalByDepara) {
    return { category: 'Fora da DRE — regra contábil', reason: 'O DEPARA marcou esta conta deliberadamente como patrimonial/fora da DRE.', intentional: true };
  }

  return { category: 'Pendente de Classificação', reason: getPendingReason(item), intentional: false };
}

function isIntentionalOutsideDre(item) {
  return classifyOutsideDre(item).intentional;
}
"""
replace_once('src/app/dre/page.js', old_pending_reason, new_pending_reason, 'dre classificar fora da DRE')

old_pending_summary = """  const summary = Object.values((items || []).reduce((map, item) => {
    const code = String(item.contaCodigo || '').trim() || 'SEM-CODIGO';
    const plan = String(item.planoFinanceiro || '').trim() || `${code} - ${item.contaNome || item.contaDescricao || 'Plano não identificado'}`;
    const nomenclature = item.contaNome || item.contaDescricao || 'Sem nomenclatura';
    const reason = getPendingReason(item);
    const key = `${code}|${plan}|${reason}`;
    if (!map[key]) map[key] = { code, plan, nomenclature, reason, total: 0, count: 0 };
    map[key].total += Math.abs(Number(item.valor) || 0);
    map[key].count += 1;
    return map;
  }, {})).sort((a, b) => a.total - b.total || a.plan.localeCompare(b.plan, 'pt-BR'));
"""
new_pending_summary = """  const summary = Object.values((items || []).reduce((map, item) => {
    const code = String(item.contaCodigo || '').trim() || 'SEM-CODIGO';
    const plan = String(item.planoFinanceiro || '').trim() || `${code} - ${item.contaNome || item.contaDescricao || 'Plano não identificado'}`;
    const nomenclature = item.contaNome || item.contaDescricao || 'Sem nomenclatura';
    const classification = classifyOutsideDre(item);
    const key = `${classification.category}|${code}|${plan}|${classification.reason}`;
    if (!map[key]) map[key] = { code, plan, nomenclature, category: classification.category, reason: classification.reason, intentional: classification.intentional, total: 0, count: 0 };
    map[key].total += Math.abs(Number(item.valor) || 0);
    map[key].count += 1;
    return map;
  }, {})).sort((a, b) => a.total - b.total || a.category.localeCompare(b.category, 'pt-BR') || a.plan.localeCompare(b.plan, 'pt-BR'));
"""
replace_once('src/app/dre/page.js', old_pending_summary, new_pending_summary, 'dre resumo fora DRE')

replace_once(
    'src/app/dre/page.js',
    "<h2 style={{ fontSize: '16px', color: 'var(--text-main)', marginBottom: '0.25rem' }}>Pendências de Classificação</h2>\n            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Resumo por plano financeiro, do menor para o maior valor. Total fora da DRE: <strong style={{ color: 'var(--warning)' }}>{fmt(total)}</strong>.</p>",
    "<h2 style={{ fontSize: '16px', color: 'var(--text-main)', marginBottom: '0.25rem' }}>Itens fora da DRE</h2>\n            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Classificação dos itens que não entram no resultado — incluindo investimentos, empréstimos, aportes e pendências reais. Total fora da DRE: <strong style={{ color: 'var(--warning)' }}>{fmt(total)}</strong>.</p>",
    'dre drawer titulo'
)

replace_once(
    'src/app/dre/page.js',
    "<thead><tr><th>Plano Financeiro</th><th>Nomenclatura</th><th>Por que não entra na DRE</th><th style={{ textAlign: 'center' }}>Lanç.</th><th style={{ textAlign: 'right' }}>Valor</th></tr></thead>",
    "<thead><tr><th>Classificação</th><th>Plano Financeiro</th><th>Nomenclatura</th><th>Por que não entra na DRE</th><th style={{ textAlign: 'center' }}>Lanç.</th><th style={{ textAlign: 'right' }}>Valor</th></tr></thead>",
    'dre drawer cabecalho resumo'
)

replace_once(
    'src/app/dre/page.js',
    "                    <tr key={`${row.code}-${row.plan}`}>\n                      <td style={{ fontWeight: 600, color: 'var(--text-main)', maxWidth: '300px' }}>{row.plan}</td>",
    "                    <tr key={`${row.category}-${row.code}-${row.plan}`}>\n                      <td style={{ fontWeight: 700, color: row.intentional ? 'var(--primary)' : 'var(--warning)', minWidth: '180px' }}>{row.category}</td>\n                      <td style={{ fontWeight: 600, color: 'var(--text-main)', maxWidth: '300px' }}>{row.plan}</td>",
    'dre drawer linha classificacao'
)

replace_once(
    'src/app/dre/page.js',
    "<thead style={{ position: 'sticky', top: 0, zIndex: 2 }}><tr><th>Data</th><th>Projeto</th><th>Plano Financeiro</th><th>Nomenclatura</th><th>Nome</th><th>Status</th><th style={{ textAlign: 'right' }}>Valor</th></tr></thead>",
    "<thead style={{ position: 'sticky', top: 0, zIndex: 2 }}><tr><th>Classificação</th><th>Data</th><th>Projeto</th><th>Plano Financeiro</th><th>Nomenclatura</th><th>Nome</th><th>Status</th><th style={{ textAlign: 'right' }}>Valor</th></tr></thead>",
    'dre drawer detalhe cabecalho'
)

replace_once(
    'src/app/dre/page.js',
    "                    <tr key={idx}>\n                      <td>{item.data || '—'}</td>",
    "                    <tr key={idx}>\n                      <td style={{ fontWeight: 700, color: classifyOutsideDre(item).intentional ? 'var(--primary)' : 'var(--warning)' }}>{classifyOutsideDre(item).category}</td>\n                      <td>{item.data || '—'}</td>",
    'dre drawer detalhe classificacao'
)

replace_once(
    'src/app/dre/page.js',
    "  const [pendingDrawerOpen, setPendingDrawerOpen] = useState(false);",
    "  const [pendingDrawerOpen, setPendingDrawerOpen] = useState(false);\n  const [includeRetroactive, setIncludeRetroactive] = useState(false);",
    'dre estado retroativo'
)

old_dre_calc = """  const meses = useMemo(() => buildMeses(effectiveDataInicial, effectiveDataFinal), [effectiveDataInicial, effectiveDataFinal]);
  const showMonths = meses.length > 1;

  const taggedItems = useMemo(() => tagItemsWithMesKey(filteredItems), [filteredItems]);
  const dreData = useMemo(() => buildDreStructure(taggedItems, meses), [taggedItems, meses]);
"""
new_dre_calc = """  // Projetos com movimentacao realizada em 2025 podem trazer esse historico em
  // uma unica coluna chamada Retroativo 2026. O retroativo so aparece quando ha
  // projeto selecionado e nunca entra automaticamente no resultado.
  const retroactiveItems = useMemo(() => {
    if (filterProjetos.length === 0) return [];
    const { filterDreItems } = require(\"@/lib/dreEngine\");
    let items = filterDreItems(baseData, {
      filterDataInicial: '2025-01-01', filterDataFinal: '2025-12-31',
      filterProjetos: [], filterEmpresas: [], filterCCs: [], visao: 'REALIZADO'
    });

    const entradas = items.filter((item) => item.natureza === 'Entrada');
    const saidas = items.filter((item) => item.natureza === 'Saída');
    const consolidated = consolidateFinancialData(entradas, {
      filterProjetos,
      isProjetosPage: false,
      incluirRateioAdm: true,
    });
    const somenteAdm = filterProjetos.length === 1 && filterProjetos[0].toUpperCase().includes('ADMINISTRA');
    const entradasFiltradas = consolidated.filter((item) => {
      const proj = String(item.projeto || '');
      if (somenteAdm) return proj.toUpperCase().includes('ADMINISTRA') && Math.abs(Number(item.valor) || 0) > 0;
      return filterProjetos.some((project) => proj === project || proj.toUpperCase().includes(project.toUpperCase()));
    });
    const saidasFiltradas = saidas.filter((item) => {
      const proj = String(item.projeto || '');
      return filterProjetos.some((project) => proj === project || proj.toUpperCase().includes(project.toUpperCase()));
    });
    return [...entradasFiltradas, ...saidasFiltradas];
  }, [baseData, filterProjetos]);

  useEffect(() => {
    if (includeRetroactive && retroactiveItems.length === 0) setIncludeRetroactive(false);
  }, [includeRetroactive, retroactiveItems.length]);

  const baseMeses = useMemo(() => buildMeses(effectiveDataInicial, effectiveDataFinal), [effectiveDataInicial, effectiveDataFinal]);
  const meses = useMemo(() => includeRetroactive && retroactiveItems.length > 0
    ? [{ key: 'RETRO-2026', label: 'Retroativo 2026', retroactive: true }, ...baseMeses]
    : baseMeses, [baseMeses, includeRetroactive, retroactiveItems.length]);
  const showMonths = meses.length > 1;

  const taggedItems = useMemo(() => {
    const current = tagItemsWithMesKey(filteredItems);
    if (!includeRetroactive || retroactiveItems.length === 0) return current;
    const retroactive = retroactiveItems.map((item) => ({ ...item, mesKey: 'RETRO-2026', isRetroactive2026: true }));
    return [...retroactive, ...current];
  }, [filteredItems, retroactiveItems, includeRetroactive]);
  const dreData = useMemo(() => buildDreStructure(taggedItems, meses), [taggedItems, meses]);

  const intentionalOutsideItems = useMemo(() => {
    const start = effectiveDataInicial ? new Date(effectiveDataInicial + 'T00:00:00').getTime() : 0;
    const end = effectiveDataFinal ? new Date(effectiveDataFinal + 'T23:59:59').getTime() : Infinity;
    return baseData.filter((item) => {
      if (!isIntentionalOutsideDre(item)) return false;
      const status = String(item.status || '').toUpperCase();
      const isRealizado = status.includes('REALIZADO') || status.includes('PAGO') || status.includes('RECEBIDO') || status === 'EFETIVADO';
      const isPrevisto = !isRealizado && (status.includes('A REALIZAR') || status.includes('A RECEBER') || status.includes('A PAGAR') || status.includes('PREVISTO'));
      if (visao === 'REALIZADO' && !isRealizado) return false;
      if (visao === 'SOMENTE_PREVISAO' && !isPrevisto) return false;
      if (visao === 'REALIZADO_PREVISAO' && !isRealizado && !isPrevisto) return false;
      if ((item.dataTimestamp || 0) < start || (item.dataTimestamp || 0) > end) return false;
      if (filterProjetos.length > 0) {
        const proj = String(item.projeto || '');
        if (!filterProjetos.some((project) => proj === project || proj.toUpperCase().includes(project.toUpperCase()))) return false;
      }
      return true;
    });
  }, [baseData, effectiveDataInicial, effectiveDataFinal, filterProjetos, visao]);

  const outsideDreItems = useMemo(() => {
    const map = new Map();
    [...dreData.naoClassificados.items, ...intentionalOutsideItems].forEach((item, index) => {
      const key = [item.data, item.documento, item.lancamento, item.contaCodigo, item.projeto, item.valor, index < dreData.naoClassificados.items.length ? 'pending' : 'outside'].join('|');
      if (!map.has(key)) map.set(key, item);
    });
    return [...map.values()];
  }, [dreData.naoClassificados.items, intentionalOutsideItems]);

  const outsideDreTotal = useMemo(() => outsideDreItems.reduce((sum, item) => sum + Math.abs(Number(item.valor) || 0), 0), [outsideDreItems]);
  const pendingCount = useMemo(() => outsideDreItems.filter((item) => !classifyOutsideDre(item).intentional).length, [outsideDreItems]);
  const intentionalCount = outsideDreItems.length - pendingCount;
"""
replace_once('src/app/dre/page.js', old_dre_calc, new_dre_calc, 'dre retroativo e itens fora')

replace_once(
    'src/app/dre/page.js',
    "    setFilterProjetos([]);\n  };\n\n  const hasActiveFilters = filterProjetos.length > 0;",
    "    setFilterProjetos([]);\n    setIncludeRetroactive(false);\n  };\n\n  const hasActiveFilters = filterProjetos.length > 0 || includeRetroactive;",
    'dre limpar retroativo'
)

replace_once(
    'src/app/dre/page.js',
    "    Projetos: filterProjetos.length ? filterProjetos : \"Todos\",\n  };",
    "    Projetos: filterProjetos.length ? filterProjetos : \"Todos\",\n    \"Retroativo 2026\": includeRetroactive ? \"Incluído\" : \"Não incluído\",\n  };",
    'dre filtro relatorio retroativo'
)

old_pending_rows = """  const drePendingRows = useMemo(() => dreData.naoClassificados.items.map((item) => ({
    Data: item.data,
    Projeto: item.projeto,
    \"Plano Financeiro\": item.planoFinanceiro || item.contaCodigo || 'Não identificado',
    Nomenclatura: item.contaNome || item.contaDescricao,
    Motivo: getPendingReason(item),
    Nome: item.nome,
    Situação: item.status,
    Valor: Math.abs(item.valor || 0),
  })).sort((a, b) => a.Valor - b.Valor), [dreData.naoClassificados.items]);
"""
new_pending_rows = """  const drePendingRows = useMemo(() => outsideDreItems.map((item) => {
    const classification = classifyOutsideDre(item);
    return {
      Classificação: classification.category,
      Data: item.data,
      Projeto: item.projeto,
      \"Plano Financeiro\": item.planoFinanceiro || item.contaCodigo || 'Não identificado',
      Nomenclatura: item.contaNome || item.contaDescricao,
      Motivo: classification.reason,
      Nome: item.nome,
      Situação: item.status,
      Valor: Math.abs(item.valor || 0),
    };
  }).sort((a, b) => a.Valor - b.Valor), [outsideDreItems]);
"""
replace_once('src/app/dre/page.js', old_pending_rows, new_pending_rows, 'dre relatorio itens fora')

old_project_filter = """          <div style={{ flex: \"1 1 200px\", display: \"flex\", flexDirection: \"column\", gap: \"0.375rem\" }}>
            <label style={{ fontSize: \"11px\", fontWeight: \"600\", color: \"var(--text-secondary)\", textTransform: \"uppercase\" }}>Projeto / Obra</label>
            <MultiSelect options={projetosDisponiveis} selected={filterProjetos} onChange={setFilterProjetos} placeholder=\"Todos os projetos\" />
          </div>
"""
new_project_filter = """          <div style={{ flex: \"1 1 200px\", display: \"flex\", flexDirection: \"column\", gap: \"0.375rem\" }}>
            <label style={{ fontSize: \"11px\", fontWeight: \"600\", color: \"var(--text-secondary)\", textTransform: \"uppercase\" }}>Projeto / Obra</label>
            <MultiSelect options={projetosDisponiveis} selected={filterProjetos} onChange={setFilterProjetos} placeholder=\"Todos os projetos\" />
          </div>
          {retroactiveItems.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', minWidth: '190px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                Retroativo 2026
                <InfoTooltip title=\"Retroativo 2026\" content={`Existem ${retroactiveItems.length} movimentações realizadas em 2025 para o(s) projeto(s) selecionado(s). Ao ativar, elas aparecem consolidadas em uma coluna “Retroativo 2026” e passam a compor os resultados da DRE.`} />
              </label>
              <button type=\"button\" onClick={() => setIncludeRetroactive((value) => !value)} style={{ height: '38px', padding: '0 0.8rem', borderRadius: '6px', border: `1px solid ${includeRetroactive ? 'var(--primary)' : 'var(--border-color)'}`, background: includeRetroactive ? 'rgba(57,198,198,0.15)' : 'var(--bg-elevated)', color: includeRetroactive ? 'var(--primary)' : 'var(--text-main)', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                {includeRetroactive ? '✓ Incluído no resultado' : '+ Incluir retroativo'}
              </button>
            </div>
          )}
"""
replace_once('src/app/dre/page.js', old_project_filter, new_project_filter, 'dre botao retroativo')

old_pending_card = """      {/* ── Pendências de Classificação ── */}
      {dreData.naoClassificados.items.length > 0 && (
        <div className=\"card\" style={{ padding: \"1.25rem\", borderLeft: \"3px solid var(--warning)\", background: \"rgba(245,158,11,0.03)\" }}>
          <div style={{ display: \"flex\", justifyContent: \"space-between\", alignItems: \"center\" }}>
            <div style={{ display: \"flex\", alignItems: \"center\", gap: \"0.75rem\" }}>
              <AlertCircle size={20} color=\"var(--warning)\" />
              <div>
                <h3 style={{ fontSize: \"14px\", fontWeight: \"700\", color: \"var(--text-main)\", marginBottom: \"0.25rem\" }}>Pendências de Classificação</h3>
                <p style={{ fontSize: \"12px\", color: \"var(--text-secondary)\" }}>
                  Existem {dreData.naoClassificados.items.length} lançamentos sem DEPARA válido ou sem linha DRE reconhecida. Eles <strong>NÃO</strong> estão somando no resultado acima.
                </p>
              </div>
            </div>
            <div style={{ display: \"flex\", alignItems: \"center\", gap: \"1rem\" }}>
              <span style={{ fontSize: \"16px\", fontWeight: \"800\", color: \"var(--warning)\" }}>{fmt(dreData.naoClassificados.total)}</span>
              <button
                onClick={() => setPendingDrawerOpen(true)}
                style={{ background: \"rgba(245,158,11,0.15)\", color: \"var(--warning)\", border: \"none\", padding: \"0.5rem 1rem\", borderRadius: \"6px\", fontSize: \"12px\", fontWeight: \"700\", cursor: \"pointer\" }}
              >
                Revisar contas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Drawers de Auditoria ── */}
      {pendingDrawerOpen && <PendingClassificationDrawer items={dreData.naoClassificados.items} onClose={() => setPendingDrawerOpen(false)} />}
"""
new_pending_card = """      {/* ── Itens fora da DRE ── */}
      {outsideDreItems.length > 0 && (
        <div className=\"card\" style={{ padding: \"1.25rem\", borderLeft: \"3px solid var(--warning)\", background: \"rgba(245,158,11,0.03)\" }}>
          <div style={{ display: \"flex\", justifyContent: \"space-between\", alignItems: \"center\", gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: \"flex\", alignItems: \"center\", gap: \"0.75rem\" }}>
              <AlertCircle size={20} color=\"var(--warning)\" />
              <div>
                <h3 style={{ fontSize: \"14px\", fontWeight: \"700\", color: \"var(--text-main)\", marginBottom: \"0.25rem\" }}>Itens fora da DRE</h3>
                <p style={{ fontSize: \"12px\", color: \"var(--text-secondary)\" }}>
                  {intentionalCount} exclusão(ões) intencional(is) (investimentos, empréstimos, aportes, retenções etc.) e {pendingCount} pendência(s) real(is) de classificação. Nenhum desses itens soma no resultado acima.
                </p>
              </div>
            </div>
            <div style={{ display: \"flex\", alignItems: \"center\", gap: \"1rem\" }}>
              <span style={{ fontSize: \"16px\", fontWeight: \"800\", color: \"var(--warning)\" }}>{fmt(outsideDreTotal)}</span>
              <button
                onClick={() => setPendingDrawerOpen(true)}
                style={{ background: \"rgba(245,158,11,0.15)\", color: \"var(--warning)\", border: \"none\", padding: \"0.5rem 1rem\", borderRadius: \"6px\", fontSize: \"12px\", fontWeight: \"700\", cursor: \"pointer\" }}
              >
                Ver classificação e motivo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Drawers de Auditoria ── */}
      {pendingDrawerOpen && <PendingClassificationDrawer items={outsideDreItems} onClose={() => setPendingDrawerOpen(false)} />}
"""
replace_once('src/app/dre/page.js', old_pending_card, new_pending_card, 'dre card itens fora')

print('Rodada 4 aplicada com sucesso.')
