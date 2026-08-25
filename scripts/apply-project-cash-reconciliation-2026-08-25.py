from pathlib import Path

file = Path('src/app/projetos/page.js')
src = file.read_text(encoding='utf-8')

old = '''  const percentTotalFaturado = totalContratado > 0 ? totalFaturado / totalContratado : 0;
  
  const totalRecebido = filteredProjetos.reduce((acc, p) => acc + p.recebido, 0);
  const totalAReceber = filteredProjetos.reduce((acc, p) => acc + p.aReceber, 0);
  const totalPago = filteredProjetos.reduce((acc, p) => acc + p.pago, 0);
'''
new = '''  const percentTotalFaturado = totalContratado > 0 ? totalFaturado / totalContratado : 0;

  const rawProjectRevenueStats = useMemo(() => {
    let recebidoDireto = 0;
    let recebidoAdm = 0;
    let aReceberDireto = 0;
    let aReceberAdm = 0;

    data.forEach((item) => {
      if (item.natureza !== 'Entrada') return;
      const classification = classifyFinancialEntry(item);
      if (classification.type !== 'receita_projeto' && classification.type !== 'receita_administrativa') return;

      const status = String(item.status || '').toUpperCase();
      const isRealizado = status.includes('REALIZADO') || status.includes('RECEBIDO') || status.includes('EFETIVADO');
      const isPrevisto = !isRealizado && (status.includes('A REALIZAR') || status.includes('A RECEBER') || status.includes('PREVISTO'));
      const value = Number(item.valor) || 0;

      let ts = 0;
      if (item.dataTimestamp) ts = Number(item.dataTimestamp) || 0;
      if (!ts && item.data) {
        const parts = String(item.data).split('/');
        if (parts.length === 3) ts = new Date(parts[2], Number(parts[1]) - 1, parts[0]).getTime();
      }

      if (isRealizado && ts >= realizadoIni && ts <= realizadoFim) {
        if (classification.type === 'receita_projeto') recebidoDireto += value;
        if (classification.type === 'receita_administrativa') recebidoAdm += value;
      }
      if (isPrevisto) {
        if (classification.type === 'receita_projeto') aReceberDireto += value;
        if (classification.type === 'receita_administrativa') aReceberAdm += value;
      }
    });

    return {
      recebidoDireto,
      recebidoAdm,
      recebido: recebidoDireto + (incluirRateioAdm ? recebidoAdm : 0),
      aReceberDireto,
      aReceberAdm,
      aReceber: aReceberDireto + (incluirRateioAdm ? aReceberAdm : 0),
    };
  }, [data, realizadoIni, realizadoFim, incluirRateioAdm]);

  const usarCarteiraCompleta = filterProjetos.length === 0 && filterEmpresas.length === 0 && filterTipos.length === 0;
  const totalRecebido = usarCarteiraCompleta
    ? rawProjectRevenueStats.recebido
    : filteredProjetos.reduce((acc, p) => acc + p.recebido, 0);
  const totalAReceber = usarCarteiraCompleta
    ? rawProjectRevenueStats.aReceber
    : filteredProjetos.reduce((acc, p) => acc + p.aReceber, 0);
  const totalPago = filteredProjetos.reduce((acc, p) => acc + p.pago, 0);
'''
if old not in src:
    raise RuntimeError('bloco de totais nao encontrado')
src = src.replace(old, new, 1)

src = src.replace(
    "  const incluirPrevisaoGeral = filterProjetos.length === 0 && filterEmpresas.length === 0 && filterTipos.length === 0;",
    "  const incluirPrevisaoGeral = usarCarteiraCompleta;",
    1,
)
src = src.replace(
    "  const totalRecebidoAdmGlobal = filteredProjetos.reduce((acc, p) => acc + (p.receitaAdm || 0), 0);",
    "  const totalRecebidoAdmGlobal = usarCarteiraCompleta ? rawProjectRevenueStats.recebidoAdm : filteredProjetos.reduce((acc, p) => acc + (p.receitaAdm || 0), 0);",
    1,
)

old_dre = '''    return {
      receita: recReceita,
      receitaAReceber: recAReceber,
      custo: cPago,'''
new_dre = '''    if (usarCarteiraCompleta) {
      recReceita = rawProjectRevenueStats.recebido;
      recAReceber = rawProjectRevenueStats.aReceber;
    }

    return {
      receita: recReceita,
      receitaAReceber: recAReceber,
      custo: cPago,'''
if old_dre not in src:
    raise RuntimeError('retorno dreStats nao encontrado')
src = src.replace(old_dre, new_dre, 1)
src = src.replace(
    "  }, [data, filteredProjetos, realizadoIni, realizadoFim, incluirRateioAdm]);",
    "  }, [data, filteredProjetos, realizadoIni, realizadoFim, incluirRateioAdm, usarCarteiraCompleta, rawProjectRevenueStats]);",
    1,
)

file.write_text(src, encoding='utf-8')
print('Consolidado de caixa reconciliado com CR_GERAL.')
