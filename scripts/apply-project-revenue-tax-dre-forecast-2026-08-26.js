const fs = require('fs');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content, 'utf8');
}

function replaceOnce(content, before, after, label) {
  if (content.includes(after)) {
    console.log(`${label}: ja aplicado.`);
    return content;
  }
  if (!content.includes(before)) {
    throw new Error(`Trecho nao encontrado: ${label}`);
  }
  return content.replace(before, after);
}

function replaceAll(content, before, after, expectedMin, label) {
  const count = content.split(before).length - 1;
  if (count === 0) {
    if (content.includes(after)) {
      console.log(`${label}: ja aplicado.`);
      return content;
    }
    throw new Error(`Trecho nao encontrado: ${label}`);
  }
  if (count < expectedMin) throw new Error(`Ocorrencias insuficientes em ${label}: ${count}`);
  return content.split(before).join(after);
}

// PROJETOS: Receita volta a ser a referencia da composicao e responde ao rateio ADM.
// Tributos de projetos passam a ter uma unica fonte oficial (taxesData.total).
{
  const path = 'src/app/projetos/page.js';
  let content = read(path);

  content = replaceOnce(
    content,
    `  const totalRecebido = filteredProjetos.reduce((acc, p) => acc + p.recebido, 0);\n  const totalAReceber = filteredProjetos.reduce((acc, p) => acc + p.aReceber, 0);\n  const totalPago = filteredProjetos.reduce((acc, p) => acc + p.pago, 0);\n  const receitaLiquidaProjetos = totalRecebido;`,
    `  const totalRecebido = filteredProjetos.reduce((acc, p) => acc + p.recebido, 0);\n  const totalAReceber = filteredProjetos.reduce((acc, p) => acc + p.aReceber, 0);\n  const totalPago = filteredProjetos.reduce((acc, p) => acc + p.pago, 0);\n  // Receita oficial dos projetos no painel: somente receita de projeto + parcela ADM quando o rateio estiver ligado.\n  // Os dois componentes usam o valor liquido efetivamente recebido da CR_GERAL (coluna K).\n  const receitaLiquidaProjetos = filteredProjetos.reduce((acc, p) => {\n    const direta = Number(p.receitaDireta) || 0;\n    const adm = incluirRateioAdm ? (Number(p.receitaAdm) || 0) : 0;\n    return acc + direta + adm;\n  }, 0);`,
    'receita dos projetos sensivel ao rateio'
  );

  content = replaceOnce(
    content,
    `  const margemFinanceira = receitaLiquidaProjetos > 0 ? ((receitaLiquidaProjetos - dreStats.custo - dreStats.despesa - dreStats.tributos) / receitaLiquidaProjetos) * 100 : null;\n  const resultadoGerencial = receitaLiquidaProjetos - dreStats.custo - dreStats.despesa - dreStats.tributos;\n  // Base unica para o peso tributario: Recebido Liquido do mesmo periodo e dos mesmos filtros.\n  // Isso evita comparar tributos do periodo com um faturamento contratual acumulado de outra base temporal.\n  const taxPercentage = receitaLiquidaProjetos > 0 ? (taxesData.total / receitaLiquidaProjetos) * 100 : 0;`,
    `  // Fonte unica para todo o painel de Projetos: tributos realizados e efetivamente alocados aos projetos filtrados.\n  const tributosProjetos = taxesData.total;\n  const margemFinanceira = receitaLiquidaProjetos > 0 ? ((receitaLiquidaProjetos - dreStats.custo - dreStats.despesa - tributosProjetos) / receitaLiquidaProjetos) * 100 : null;\n  const resultadoGerencial = receitaLiquidaProjetos - dreStats.custo - dreStats.despesa - tributosProjetos;\n  // Base unica para o peso tributario: Receita liquida do mesmo periodo e dos mesmos filtros.\n  const taxPercentage = receitaLiquidaProjetos > 0 ? (tributosProjetos / receitaLiquidaProjetos) * 100 : 0;`,
    'fonte unica de tributos dos projetos'
  );

  content = replaceOnce(
    content,
    `<p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Faturamento, custos, despesas e tributos em 2026</p>`,
    `<p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Receita, custos, despesas e tributos no período selecionado</p>`,
    'subtitulo da composicao financeira'
  );

  content = replaceOnce(
    content,
    `<ReportAdder sectionKey="projetos:composicao" title="Composição Financeira" componentName="Composição Financeira - Projetos" page="Projetos" type="SUMMARY" data={[{ "Faturado": totalFaturado2026, "Receita Líquida Realizada": receitaLiquidaProjetos, "Custos Diretos": dreStats.custo, "Despesas": dreStats.despesa, "Tributos": dreStats.tributos, "Não Classificado": dreStats.naoClassificado }]} filters={reportFilters} presetTags={["project-executive"]} explanation="Composição gerencial baseada no faturamento da carteira, mantendo a receita líquida realizada como informação complementar." />`,
    `<ReportAdder sectionKey="projetos:composicao" title="Composição Financeira" componentName="Composição Financeira - Projetos" page="Projetos" type="SUMMARY" data={[{ "Receita Líquida Realizada": receitaLiquidaProjetos, "Custos Diretos": dreStats.custo, "Despesas": dreStats.despesa, "Tributos": tributosProjetos, "Não Classificado": dreStats.naoClassificado }]} filters={reportFilters} presetTags={["project-executive"]} explanation="Composição gerencial baseada na receita líquida realizada dos projetos no período. O rateio administrativo acompanha o botão do painel." />`,
    'relatorio da composicao financeira'
  );

  content = replaceOnce(
    content,
    `<InfoTooltip title="Composição Financeira" content={\`Faturado: \${formatCurrency(totalFaturado2026)}. Receita líquida realizada: \${formatCurrency(receitaLiquidaProjetos)}. Custos, despesas e tributos são comparados ao faturamento neste card.\`} />`,
    `<InfoTooltip title="Composição Financeira" content={\`Receita líquida realizada: \${formatCurrency(receitaLiquidaProjetos)}. O valor acompanha o período, os filtros e o botão de rateio administrativo. Custos, despesas e tributos usam a mesma base visual de Receita.\`} />`,
    'tooltip da composicao financeira'
  );

  content = replaceOnce(
    content,
    `                FATURADO 2026\n                <InfoTooltip\n                  title="Faturado"\n                  content={\`Faturado: \${formatCurrency(totalFaturado2026)}. Receita líquida realizada: \${formatCurrency(receitaLiquidaProjetos)}. A receita líquida é o valor efetivamente creditado após descontos e retenções.\`}\n                />`,
    `                RECEITA\n                <InfoTooltip\n                  title="Receita Líquida Realizada"\n                  content={\`Receita líquida realizada: \${formatCurrency(receitaLiquidaProjetos)}. Usa o valor efetivamente recebido e inclui a parcela administrativa somente quando o botão de rateio estiver ligado.\`}\n                />`,
    'rotulo receita da composicao'
  );

  content = replaceOnce(
    content,
    `<p title={\`Faturado em 2026: \${formatCurrency(totalFaturado2026)}\`} style={{ fontSize: 'clamp(11px, 1vw, 15px)', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'visible', minWidth: 0, maxWidth: '100%', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.035em', color: 'var(--success)', cursor: 'help' }}>{formatCurrency(totalFaturado2026)}</p>`,
    `<p title={\`Receita Líquida Realizada: \${formatCurrency(receitaLiquidaProjetos)}\`} style={{ fontSize: 'clamp(11px, 1vw, 15px)', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'visible', minWidth: 0, maxWidth: '100%', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.035em', color: 'var(--success)', cursor: 'help' }}>{formatCurrency(receitaLiquidaProjetos)}</p>`,
    'valor receita da composicao'
  );

  content = replaceAll(content, `totalFaturado2026 > 0 && <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{((dreStats.custo / totalFaturado2026) * 100).toFixed(1)}% do Faturado</span>`, `receitaLiquidaProjetos > 0 && <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{((dreStats.custo / receitaLiquidaProjetos) * 100).toFixed(1)}% da Receita</span>`, 1, 'percentual custos sobre receita');
  content = replaceAll(content, `totalFaturado2026 > 0 && <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{((dreStats.despesa / totalFaturado2026) * 100).toFixed(1)}% do Faturado</span>`, `receitaLiquidaProjetos > 0 && <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{((dreStats.despesa / receitaLiquidaProjetos) * 100).toFixed(1)}% da Receita</span>`, 1, 'percentual despesas sobre receita');
  content = replaceOnce(content, `{formatCurrency(dreStats.tributos)}`, `{formatCurrency(tributosProjetos)}`, 'valor tributario da composicao');
  content = replaceOnce(content, `{totalFaturado2026 > 0 && <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{((dreStats.tributos / totalFaturado2026) * 100).toFixed(1)}% do Faturado</span>}`, `{receitaLiquidaProjetos > 0 && <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{((tributosProjetos / receitaLiquidaProjetos) * 100).toFixed(1)}% da Receita</span>}`, 'percentual tributos sobre receita');

  content = replaceOnce(
    content,
    `{totalFaturado2026 > 0 && (\n            <div style={{ width: '100%', height: '12px', background: 'var(--bg-main)', borderRadius: '6px', display: 'flex', overflow: 'hidden' }}>\n              <div style={{ width: \`${Math.max(0, 100 - ((dreStats.custo + dreStats.despesa + dreStats.tributos) / totalFaturado2026) * 100)}%\`, background: 'var(--success)', transition: 'width 0.3s ease' }} />\n              <div style={{ width: \`${(dreStats.custo / totalFaturado2026) * 100}%\`, background: 'var(--warning)', transition: 'width 0.3s ease' }} />\n              <div style={{ width: \`${(dreStats.despesa / totalFaturado2026) * 100}%\`, background: 'var(--danger)', transition: 'width 0.3s ease' }} />\n              <div style={{ width: \`${(dreStats.tributos / totalFaturado2026) * 100}%\`, background: 'var(--primary)', transition: 'width 0.3s ease' }} />\n            </div>\n          )}`,
    `{receitaLiquidaProjetos > 0 && (\n            <div style={{ width: '100%', height: '12px', background: 'var(--bg-main)', borderRadius: '6px', display: 'flex', overflow: 'hidden' }}>\n              <div style={{ width: \`${Math.max(0, 100 - ((dreStats.custo + dreStats.despesa + tributosProjetos) / receitaLiquidaProjetos) * 100)}%\`, background: 'var(--success)', transition: 'width 0.3s ease' }} />\n              <div style={{ width: \`${(dreStats.custo / receitaLiquidaProjetos) * 100}%\`, background: 'var(--warning)', transition: 'width 0.3s ease' }} />\n              <div style={{ width: \`${(dreStats.despesa / receitaLiquidaProjetos) * 100}%\`, background: 'var(--danger)', transition: 'width 0.3s ease' }} />\n              <div style={{ width: \`${(tributosProjetos / receitaLiquidaProjetos) * 100}%\`, background: 'var(--primary)', transition: 'width 0.3s ease' }} />\n            </div>\n          )}`,
    'barra da composicao baseada em receita'
  );

  write(path, content);
}

// DRE: o filtro de datas passa a funcionar tambem nas visoes com previsao.
{
  const path = 'src/app/dre/page.js';
  let content = read(path);

  content = replaceOnce(
    content,
    `  const annualView = visao !== 'REALIZADO';\n  const annualRange = getDreDateRange(visao);\n  const effectiveDataInicial = annualView ? annualRange.start : filterDataInicial;\n  const effectiveDataFinal = annualView ? annualRange.end : filterDataFinal;`,
    `  // Todas as visoes respeitam o periodo escolhido pelo usuario, inclusive previsoes.\n  const effectiveDataInicial = filterDataInicial;\n  const effectiveDataFinal = filterDataFinal;`,
    'datas editaveis nas visoes com previsao'
  );

  content = replaceAll(
    content,
    `value={effectiveDataInicial} disabled={annualView} onChange={e => setFilterDataInicial(e.target.value)} title={annualView ? "A visão anual usa o ano completo" : undefined} style={{ height: "38px", padding: "0 0.75rem", background: "var(--bg-elevated)", border: "1px solid var(--border-color)", borderRadius: "6px", color: "var(--text-main)", fontSize: "13px", opacity: annualView ? 0.7 : 1 }}`,
    `value={effectiveDataInicial} onChange={e => setFilterDataInicial(e.target.value)} style={{ height: "38px", padding: "0 0.75rem", background: "var(--bg-elevated)", border: "1px solid var(--border-color)", borderRadius: "6px", color: "var(--text-main)", fontSize: "13px", opacity: 1 }}`,
    1,
    'input data inicial DRE'
  );

  content = replaceAll(
    content,
    `value={effectiveDataFinal} disabled={annualView} onChange={e => setFilterDataFinal(e.target.value)} title={annualView ? "A visão anual usa o ano completo" : undefined} style={{ height: "38px", padding: "0 0.75rem", background: "var(--bg-elevated)", border: "1px solid var(--border-color)", borderRadius: "6px", color: "var(--text-main)", fontSize: "13px", opacity: annualView ? 0.7 : 1 }}`,
    `value={effectiveDataFinal} onChange={e => setFilterDataFinal(e.target.value)} style={{ height: "38px", padding: "0 0.75rem", background: "var(--bg-elevated)", border: "1px solid var(--border-color)", borderRadius: "6px", color: "var(--text-main)", fontSize: "13px", opacity: 1 }}`,
    1,
    'input data final DRE'
  );

  write(path, content);
}

// Motor DRE: previsoes sao definidas pelo status e pelo periodo filtrado, nao pela data de hoje.
{
  const path = 'src/lib/dreEngine.js';
  let content = read(path);

  content = replaceOnce(
    content,
    `  // Data de corte = Início do dia de hoje\n  const hoje = new Date();\n  hoje.setHours(0, 0, 0, 0);\n  const hojeTs = hoje.getTime();\n  const endOf2026 = new Date('2026-12-31T23:59:59').getTime();\n\n`,
    ``,
    'remocao do corte por hoje na previsao'
  );

  content = replaceOnce(
    content,
    `    if (visao === 'REALIZADO') {\n      if (!isRealizado) return false;\n    } else if (visao === 'SOMENTE_PREVISAO') {\n      if (!isPrevisto) return false;\n      if (ts < hojeTs || ts > endOf2026) return false;\n    } else if (visao === 'REALIZADO_PREVISAO') {\n      if (isRealizado) {\n        // Se for realizado, só considera até a data de hoje (para evitar incluir "realizados" com data futura se existir erro na base, embora improvável, o usuário pediu "lançamentos até a data atual")\n        // Na verdade, o seguro é incluir todos os realizados até hoje.\n        if (ts > hojeTs) return false; // Ignora realizados com data no futuro? Apenas por segurança.\n      } else if (isPrevisto) {\n        if (ts < hojeTs || ts > endOf2026) return false;\n      } else {\n        return false; // Status desconhecido\n      }\n    }`,
    `    if (visao === 'REALIZADO') {\n      if (!isRealizado) return false;\n    } else if (visao === 'SOMENTE_PREVISAO') {\n      if (!isPrevisto) return false;\n    } else if (visao === 'REALIZADO_PREVISAO') {\n      if (!isRealizado && !isPrevisto) return false;\n    }`,
    'status da DRE governado pelo periodo filtrado'
  );

  write(path, content);
}

console.log('Receita por rateio, tributos unificados e previsoes da DRE aplicados.');
