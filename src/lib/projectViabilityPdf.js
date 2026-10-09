/**
 * Consolida os mesmos valores já exibidos na prévia de viabilidade.
 * A estrutura segue o exportador vetorial padrão do painel (sem capturas PNG/JPEG).
 * Não recalcula resultados nem altera regras de negócio.
 */
const n = (value) => Number(value) || 0;
const ratio = (part, whole) => n(whole) > 0 ? n(part) / n(whole) : null;
const brl = (value) => n(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const percentage = (value) => value === null || !Number.isFinite(value)
  ? "Não aplicável"
  : (value * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";

const moneyColumn = (key, label = key) => ({ key, label, format: "currency" });
const textColumn = (key, label = key) => ({ key, label, format: "text" });
const reportTable = (sectionKey, title, explanation, data, columns) => ({
  id: sectionKey,
  sectionKey,
  title,
  explanation,
  type: "TABLE",
  page: "Projetos",
  data,
  columns,
});

export function buildProjectViabilityItems(project, analysis, options = {}) {
  if (!project || !analysis) throw new Error("Dados da análise do projeto indisponíveis.");

  const contract = n(analysis.contract);
  const received = n(analysis.received);
  const paid = n(analysis.paid);
  const billed = n(analysis.billed);
  const receivable = n(analysis.receivable);
  const payable = n(analysis.payable);
  const knownRevenue = n(analysis.knownRevenue);
  const knownCost = n(analysis.knownCost);
  const realizedResult = n(analysis.realizedResult);
  const projectedResult = n(analysis.projectedResult);
  const ceilingResult = n(analysis.ceilingResult);
  const costRows = Array.isArray(analysis.costRows) ? analysis.costRows : [];
  const monthRows = Array.isArray(analysis.monthRows) ? analysis.monthRows : [];
  const projectLabel = String(project.nome || "Projeto não identificado").trim();
  const period = options.periodLabel || "Posição acumulada da base";
  const allocation = options.includeAdminAllocation ? "Incluído" : "Não incluído";

  const metrics = [
    ["Valor contratado", contract, contract > 0 ? "100% da base contratual" : "Contrato não informado"],
    ["Faturado", billed, percentage(ratio(billed, contract)) + " do contrato"],
    ["Recebido", received, percentage(ratio(received, billed)) + " do faturado"],
    ["A receber programado", receivable, percentage(ratio(receivable, contract)) + " do contrato"],
    ["Custos pagos", paid, percentage(ratio(paid, received)) + " da receita recebida"],
    ["Compromissos a pagar", payable, percentage(ratio(payable, knownCost)) + " dos custos conhecidos"],
    ["Resultado realizado", realizedResult, percentage(ratio(realizedResult, received)) + " de margem"],
    ["Resultado com programado", projectedResult, percentage(ratio(projectedResult, knownRevenue)) + " de margem"],
  ].map(([Indicador, Valor, Referência]) => ({ Indicador, Valor, Referência }));

  const scenarios = [
    { Cenário: "Realizado", Receita: received, Custo: paid, Resultado: realizedResult, Margem: percentage(ratio(realizedResult, received)) },
    { Cenário: "Realizado + programado", Receita: knownRevenue, Custo: knownCost, Resultado: projectedResult, Margem: percentage(ratio(projectedResult, knownRevenue)) },
    { Cenário: "Teto contratual*", Receita: contract, Custo: knownCost, Resultado: ceilingResult, Margem: percentage(ratio(ceilingResult, contract)) },
  ];

  const costs = costRows.map((row) => ({
    Categoria: row.name || "Sem categoria",
    Pago: n(row.paid),
    "A pagar": n(row.scheduled),
    Total: n(row.total),
    Participação: percentage(ratio(row.total, knownCost)),
  }));
  costs.push({
    Categoria: "TOTAL CONHECIDO",
    Pago: paid,
    "A pagar": payable,
    Total: knownCost,
    Participação: knownCost > 0 ? "100,0%" : "Não aplicável",
  });

  const monthly = monthRows.map((row) => {
    const incoming = n(row.received);
    const outgoing = n(row.paid);
    const month = row.key && /^\d{4}-\d{2}$/.test(row.key)
      ? row.key.slice(5, 7) + "/" + row.key.slice(0, 4)
      : String(row.key || "Sem data");
    return {
      Mês: month,
      Recebido: incoming,
      Pago: outgoing,
      Resultado: incoming - outgoing,
      Margem: percentage(ratio(incoming - outgoing, incoming)),
    };
  });
  const monthlyReceived = monthly.reduce((total, row) => total + row.Recebido, 0);
  const monthlyPaid = monthly.reduce((total, row) => total + row.Pago, 0);
  if (monthly.length) monthly.push({
    Mês: "TOTAL (meses com data)",
    Recebido: monthlyReceived,
    Pago: monthlyPaid,
    Resultado: monthlyReceived - monthlyPaid,
    Margem: percentage(ratio(monthlyReceived - monthlyPaid, monthlyReceived)),
  });

  const verdict = knownRevenue <= 0
    ? "Inconclusivo: receita registrada insuficiente."
    : projectedResult >= 0
      ? "Resultado projetado não negativo nos registros atuais."
      : "Resultado projetado negativo; revisão financeira necessária.";

  const risks = [
    {
      Indicador: "Saldo do contrato sem previsão",
      Valor: n(analysis.unscheduledContract),
      "Base de comparação": percentage(ratio(analysis.unscheduledContract, contract)) + " do contrato",
      Observação: "Diferença ainda não recebida nem programada na base financeira.",
    },
    {
      Indicador: "Compromissos a pagar",
      Valor: payable,
      "Base de comparação": percentage(ratio(payable, knownCost)) + " dos custos conhecidos",
      Observação: "Compromissos já cadastrados que integram o cenário programado.",
    },
  ];

  return [
    reportTable("viabilidade-identificacao", "Identificação e escopo",
      "Relatório acumulado do projeto selecionado, sem limitar o histórico ao filtro de datas do painel.",
      [{ Projeto: projectLabel, Empresa: project.empresa || "Não informada", Tipo: project.tipo || "Não informado", Período: period, "Rateio administrativo": allocation }],
      [textColumn("Projeto"), textColumn("Empresa"), textColumn("Tipo"), textColumn("Período"), textColumn("Rateio administrativo")]
    ),
    reportTable("viabilidade-resumo", "Resumo executivo",
      "Valores completos em reais. Percentuais indicam sua base de cálculo, quando disponível.",
      metrics, [textColumn("Indicador"), moneyColumn("Valor"), textColumn("Referência")]
    ),
    reportTable("viabilidade-contrato", "Composição contratual",
      "Distribuição dos valores recebidos, programados e do saldo sem previsão em relação ao contrato.",
      [
        { Situação: "Recebido", Valor: received, "Participação no contrato": percentage(ratio(received, contract)) },
        { Situação: "A receber programado", Valor: receivable, "Participação no contrato": percentage(ratio(receivable, contract)) },
        { Situação: "Saldo sem previsão", Valor: n(analysis.unscheduledContract), "Participação no contrato": percentage(ratio(analysis.unscheduledContract, contract)) },
      ], [textColumn("Situação"), moneyColumn("Valor"), textColumn("Participação no contrato")]
    ),
    reportTable("viabilidade-cenarios", "Resultado financeiro e cenários",
      "Realizado = recebido − pago. Programado = (recebido + a receber) − (pago + a pagar). *Teto contratual supõe recebimento integral e nenhum custo adicional; não é lucro garantido.",
      scenarios, [textColumn("Cenário"), moneyColumn("Receita"), moneyColumn("Custo"), moneyColumn("Resultado"), textColumn("Margem")]
    ),
    reportTable("viabilidade-custos", "Composição dos custos",
      "Pagamentos e compromissos classificados por conta/plano financeiro. Custos administrativos não equivalem automaticamente ao rateio de receita.",
      costs, [textColumn("Categoria"), moneyColumn("Pago"), moneyColumn("A pagar"), moneyColumn("Total"), textColumn("Participação")]
    ),
    reportTable("viabilidade-riscos", "Pontos de atenção e parecer",
      verdict + " O custo físico para concluir a obra não consta neste relatório; o parecer é preliminar.",
      risks, [textColumn("Indicador"), moneyColumn("Valor"), textColumn("Base de comparação"), textColumn("Observação")]
    ),
    reportTable("viabilidade-mensal", "Evolução do caixa realizado",
      "Movimentos realizados por mês, em ordem cronológica. Margem = resultado / recebido; meses sem receita mostram 'Não aplicável'. A somatória mensal cobre somente movimentos com data válida.",
      monthly, [textColumn("Mês"), moneyColumn("Recebido"), moneyColumn("Pago"), moneyColumn("Resultado"), textColumn("Margem")]
    ),
  ];
}

export async function exportProjectViabilityPdf({ project, analysis, periodLabel, includeAdminAllocation }) {
  // Exportação dedicada: o arquivo baixado segue a composição da prévia do ADMIN,
  // sem recorrer à tabela genérica do construtor de relatórios.
  const { downloadProjectViabilityPdf } = await import("./projectViabilityPdfLayout");
  await downloadProjectViabilityPdf({ project, analysis, periodLabel, includeAdminAllocation });
}
