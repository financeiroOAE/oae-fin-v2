"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, X } from "lucide-react";
import { isTeamExpense } from "@/lib/financialClassification";
import styles from "./ProjectViabilityReport.module.css";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const percent = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const normalize = (value) => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toUpperCase();

const asNumber = (value) => Number(value) || 0;
const currency = (value) => money.format(asNumber(value));
const percentage = (value) => `${percent.format(asNumber(value) * 100)}%`;
const share = (amount, base) => asNumber(base) > 0 ? percentage(asNumber(amount) / asNumber(base)) : "—";

const isRealized = (status) => {
  const value = normalize(status);
  return value.includes("REALIZADO") || value.includes("RECEBIDO") || value.includes("PAGO") || value.includes("EFETIVADO");
};

const isScheduled = (status) => {
  const value = normalize(status);
  return value.includes("A REALIZAR") || value.includes("A RECEBER") || value.includes("A PAGAR") || value.includes("PREVISTO");
};

const parseDate = (value) => {
  const match = String(value || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  return Number.isNaN(date.getTime()) ? null : date;
};

const costCategory = (item) => {
  if (isTeamExpense(item)) return "Equipe técnica";

  const text = normalize([
    item?.contaNome,
    item?.contaDescricao,
    item?.planoFinanceiro,
    item?.dreClasse,
    item?.dreLinha,
    item?.dreDescricao,
  ].filter(Boolean).join(" "));

  if (/\b(ISS|INSS|PIS|COFINS|CSLL|IRRF|IMPOST|TRIBUTO|RETENCAO|RETENCOES)\b/.test(text)) {
    return "Tributos e retenções";
  }
  if (/(ADMINISTRA|RATEIO|C\.D\.A|CUSTO ADMIN)/.test(text)) return "Custos administrativos";
  if (/(FORNECEDOR|SERVICO|MATERIAL|DESLOCAMENTO|VIAGEM|HOSPEDAGEM|ALIMENTACAO)/.test(text)) {
    return "Custos diretos diversos";
  }
  return "Outros custos";
};

function CostTable({ rows, total }) {
  return (
    <div className={styles.costTable}>
      <div className={`${styles.costRow} ${styles.costHeader}`}>
        <span>Categoria</span><span>Pago</span><span>A pagar</span><span>Total</span><span>% dos custos</span>
      </div>
      {rows.map((row) => (
        <div className={`${styles.costRow} project-viability-cost-row`} key={row.name}>
          <span className={styles.costName}>{row.name}</span>
          <span>{currency(row.paid)}</span>
          <span>{currency(row.scheduled)}</span>
          <strong>{currency(row.total)}</strong>
          <span>{share(row.total, total)}</span>
        </div>
      ))}
      <div className={`${styles.costRow} ${styles.costTotal}`}>
        <strong>Total conhecido</strong><span /><span /><strong>{currency(total)}</strong><strong>{asNumber(total) > 0 ? "100,0%" : "—"}</strong>
      </div>
    </div>
  );
}

export default function ProjectViabilityReport({
  project,
  movements = [],
  periodLabel,
  includeAdminAllocation,
  onClose,
}) {
  const [portalTarget, setPortalTarget] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const reportRef = useRef(null);

  const handleExport = async () => {
    if (isExporting || !reportRef.current) return;
    setIsExporting(true);
    setExportError("");
    try {
      const { exportProjectViabilityPdf } = await import("@/lib/projectViabilityPdf");
      await exportProjectViabilityPdf({ project, analysis, periodLabel, includeAdminAllocation });
    } catch (error) {
      setExportError(error?.message || "Não foi possível gerar o PDF.");
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    setPortalTarget(document.body);
    document.body.classList.add("project-viability-report-open");
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.classList.remove("project-viability-report-open");
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const analysis = useMemo(() => {
    const contract = asNumber(project?.contratado);
    const billed = asNumber(project?.faturado);
    const received = asNumber(project?.recebido);
    const receivable = asNumber(project?.aReceber);
    const paid = asNumber(project?.pago);
    const payable = asNumber(project?.aPagar);
    const knownRevenue = received + receivable;
    const knownCost = paid + payable;
    const realizedResult = received - paid;
    const projectedResult = knownRevenue - knownCost;
    const ceilingResult = contract - knownCost;
    const realizedMargin = received ? realizedResult / received : 0;
    const projectedMargin = knownRevenue ? projectedResult / knownRevenue : 0;
    const ceilingMargin = contract ? ceilingResult / contract : 0;
    const unscheduledContract = Math.max(contract - knownRevenue, 0);
    const overContract = Math.max(knownRevenue - contract, 0);

    const categories = new Map();
    const monthly = new Map();

    movements.forEach((item) => {
      const nature = normalize(item?.natureza);
      // Preserva estornos de receita e utiliza custos absolutos como no painel.
      const rawValue = asNumber(item?.valor);
      const value = Math.abs(rawValue);
      if (!value) return;

      if (nature === "SAIDA" && (isRealized(item?.status) || isScheduled(item?.status))) {
        const name = costCategory(item);
        const current = categories.get(name) || { name, paid: 0, scheduled: 0, total: 0 };
        if (isRealized(item?.status)) current.paid += value;
        else current.scheduled += value;
        current.total += value;
        categories.set(name, current);
      }

      if (!isRealized(item?.status)) return;
      const date = parseDate(item?.data);
      if (!date) return;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const current = monthly.get(key) || { key, date, received: 0, paid: 0 };
      if (nature === "ENTRADA") current.received += rawValue;
      if (nature === "SAIDA") current.paid += value;
      monthly.set(key, current);
    });

    const costRows = [...categories.values()].sort((a, b) => b.total - a.total);
    const classifiedCost = costRows.reduce((sum, row) => sum + row.total, 0);
    const reconciliation = knownCost - classifiedCost;
    if (Math.abs(reconciliation) >= 0.01) {
      costRows.push({
        name: "Ajuste de conciliação",
        paid: 0,
        scheduled: reconciliation,
        total: reconciliation,
      });
    }

    const monthRows = [...monthly.values()].sort((a, b) => a.key.localeCompare(b.key));
    const maxMonthly = Math.max(1, ...monthRows.flatMap((row) => [Math.max(0, row.received), row.paid]));

    const viable = projectedResult >= 0 && knownRevenue > 0;
    const inconclusive = knownRevenue === 0;

    return {
      contract,
      billed,
      received,
      receivable,
      paid,
      payable,
      knownRevenue,
      knownCost,
      realizedResult,
      projectedResult,
      ceilingResult,
      realizedMargin,
      projectedMargin,
      ceilingMargin,
      unscheduledContract,
      overContract,
      costRows,
      monthRows,
      maxMonthly,
      viable,
      inconclusive,
    };
  }, [project, movements]);

  const reportDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date());
  const range = periodLabel || "Posição acumulada da base";
  const contractBase = Math.max(analysis.contract, analysis.knownRevenue, 1);
  const receivedWidth = Math.min((analysis.received / contractBase) * 100, 100);
  const receivableWidth = Math.min((analysis.receivable / contractBase) * 100, Math.max(100 - receivedWidth, 0));
  const pendingWidth = Math.max(100 - receivedWidth - receivableWidth, 0);

  const verdictTitle = analysis.inconclusive
    ? "Viabilidade ainda inconclusiva"
    : analysis.viable
      ? "Projeto viável nos registros atuais"
      : "Projeto exige revisão financeira";

  if (!portalTarget) return null;

  return createPortal(
    <div className={`${styles.overlay} project-viability-overlay`} role="dialog" aria-modal="true" aria-label={`Relatório de viabilidade de ${project?.nome || "projeto"}`}>
      <div className={styles.toolbar}>
        <div>
          <strong>Relatório de resultado financeiro e viabilidade</strong>
          <span>Prévia com dados atuais do painel</span>
        </div>
        <div className={styles.toolbarActions}>
          <button type="button" className={styles.secondaryButton} onClick={onClose}>
            <X size={16} /> Fechar
          </button>
          <button type="button" className={styles.primaryButton} disabled={isExporting} onClick={handleExport}>
            <Download size={16} /> {isExporting ? "Gerando PDF..." : "Exportar análise (PDF)"}
          </button>
        </div>
      </div>

      {exportError && <p role="alert" className={styles.exportError}>{exportError}</p>}
      <div className={styles.viewport}>
        <article ref={reportRef} className={styles.report}>
          <header className={styles.reportHeader}>
            <div className={styles.headerIdentity}>
              <span className={styles.eyebrow}>Resultado financeiro e viabilidade</span>
              <h1>{project?.nome}</h1>
              <p>{project?.empresa || "Empresa não informada"} · {project?.tipo || "Tipo não informado"}</p>
              <div className={styles.meta}>
                <span><b>Período financeiro:</b> {range}</span>
                <span><b>Rateio administrativo:</b> {includeAdminAllocation ? "incluído" : "não incluído"}</span>
              </div>
            </div>
            <div className={`${styles.status} ${analysis.viable ? styles.positive : styles.attention}`}>
              <span>Parecer preliminar</span>
              <strong>{verdictTitle}</strong>
              <p>Conclusão baseada exclusivamente nos registros financeiros atualmente disponíveis.</p>
            </div>
          </header>

          <div className={styles.content}>
            <section className={styles.section}>
              <div className={styles.sectionHeading}>
                <div><span>01</span><h2>Leitura executiva</h2></div>
                <p>Valores integrais, com centavos, conforme a posição atual do projeto.</p>
              </div>
              <div className={styles.kpis}>
                <div className={styles.kpi}><span>Valor contratado</span><strong>{currency(analysis.contract)}</strong><small>Base contratual · {analysis.contract > 0 ? "100% do contrato" : "sem contrato informado"}</small></div>
                <div className={styles.kpi}><span>Faturado</span><strong>{currency(analysis.billed)}</strong><small>{share(analysis.billed, analysis.contract)} do contrato</small></div>
                <div className={styles.kpi}><span>Recebido</span><strong>{currency(analysis.received)}</strong><small>{share(analysis.received, analysis.billed)} do valor faturado</small></div>
                <div className={styles.kpi}><span>Custos pagos</span><strong>{currency(analysis.paid)}</strong><small>{share(analysis.paid, analysis.received)} da receita recebida</small></div>
                <div className={`${styles.kpi} ${analysis.realizedResult >= 0 ? styles.kpiPositive : styles.kpiNegative}`}><span>Resultado realizado</span><strong>{currency(analysis.realizedResult)}</strong><small>Margem de {percentage(analysis.realizedMargin)}</small></div>
                <div className={`${styles.kpi} ${analysis.projectedResult >= 0 ? styles.kpiPositive : styles.kpiNegative}`}><span>Resultado projetado</span><strong>{currency(analysis.projectedResult)}</strong><small>Margem de {percentage(analysis.projectedMargin)}</small></div>
              </div>
            </section>

            <section className={`${styles.section} ${styles.twoColumns}`}>
              <div className={styles.panel}>
                <div className={styles.panelHeading}><h3>Composição do contrato</h3><p>Receita recebida, programada e saldo ainda sem previsão financeira.</p></div>
                <div className={styles.contractBar} aria-label="Composição do contrato">
                  <span className={styles.receivedBar} style={{ width: `${receivedWidth}%` }} />
                  <span className={styles.receivableBar} style={{ width: `${receivableWidth}%` }} />
                  <span className={styles.pendingBar} style={{ width: `${pendingWidth}%` }} />
                </div>
                <div className={styles.legend}>
                  <div><i className={styles.dotReceived} /><span>Recebido · {share(analysis.received, analysis.contract)}</span><strong>{currency(analysis.received)}</strong></div>
                  <div><i className={styles.dotReceivable} /><span>A receber · {share(analysis.receivable, analysis.contract)}</span><strong>{currency(analysis.receivable)}</strong></div>
                  <div><i className={styles.dotPending} /><span>Sem previsão · {share(analysis.unscheduledContract, analysis.contract)}</span><strong>{currency(analysis.unscheduledContract)}</strong></div>
                </div>
                {analysis.overContract > 0 && <p className={styles.inlineAlert}>Os registros financeiros conhecidos superam o contrato em {currency(analysis.overContract)}.</p>}
              </div>

              <div className={styles.panel}>
                <div className={styles.panelHeading}><h3>Resultado realizado</h3><p>Receita recebida menos os custos efetivamente pagos.</p></div>
                <div className={styles.resultRows}>
                  <div><span>Receita recebida</span><strong>{currency(analysis.received)}</strong></div>
                  <div><span>(–) Custos pagos ({share(analysis.paid, analysis.received)} da receita)</span><strong>{currency(analysis.paid)}</strong></div>
                  <div className={styles.resultTotal}><span>(=) Resultado realizado · {share(analysis.realizedResult, analysis.received)} de margem</span><strong>{currency(analysis.realizedResult)}</strong></div>
                </div>
              </div>
            </section>

            <section className={`${styles.section} ${styles.viabilityGrid}`}>
              <div className={`${styles.verdict} ${analysis.viable ? styles.verdictPositive : styles.verdictAttention}`}>
                <span>Parecer financeiro preliminar</span>
                <h2>{verdictTitle}</h2>
                <p>
                  {analysis.inconclusive
                    ? "Não há receita registrada suficiente para formar um parecer de viabilidade."
                    : `O resultado realizado é de ${currency(analysis.realizedResult)}, com margem de ${percentage(analysis.realizedMargin)}. Considerando as receitas programadas e os compromissos cadastrados, o resultado estimado é ${currency(analysis.projectedResult)}.`}
                </p>
                <p>A conclusão definitiva depende da validação do avanço físico e do custo necessário para concluir o escopo.</p>
              </div>

              <div className={styles.scenarioWrap}>
                <table className={styles.scenarioTable}>
                  <thead><tr><th>Cenário</th><th>Receita</th><th>Custo</th><th>Resultado</th><th>Margem</th></tr></thead>
                  <tbody>
                    <tr className="project-viability-scenario-row"><td>Realizado</td><td>{currency(analysis.received)}</td><td>{currency(analysis.paid)}</td><td>{currency(analysis.realizedResult)}</td><td>{percentage(analysis.realizedMargin)}</td></tr>
                    <tr className="project-viability-scenario-row"><td>Realizado + programado</td><td>{currency(analysis.knownRevenue)}</td><td>{currency(analysis.knownCost)}</td><td>{currency(analysis.projectedResult)}</td><td>{percentage(analysis.projectedMargin)}</td></tr>
                    <tr className="project-viability-scenario-row"><td>Teto contratual*</td><td>{currency(analysis.contract)}</td><td>{currency(analysis.knownCost)}</td><td>{currency(analysis.ceilingResult)}</td><td>{percentage(analysis.ceilingMargin)}</td></tr>
                  </tbody>
                </table>
                <p className={styles.assumption}>* O teto contratual presume o recebimento integral do contrato e nenhum custo adicional além dos compromissos já cadastrados. Não representa projeção definitiva de lucro.</p>
              </div>
            </section>

            <section className={`${styles.section} ${styles.detailGrid}`}>
              <div>
                <div className={styles.sectionHeading}><div><span>02</span><h2>Composição dos custos</h2></div><p>Pagos e compromissos conhecidos.</p></div>
                <CostTable rows={analysis.costRows} total={analysis.knownCost} />
                <p className={styles.costNote}>Custos administrativos: saídas classificadas por conta ou plano financeiro como administração ou rateio. Não representam automaticamente o rateio de receita do faturamento.</p>
              </div>
              <div>
                <div className={styles.sectionHeading}><div><span>03</span><h2>Pontos de atenção</h2></div><p>Itens que podem alterar o parecer.</p></div>
                <div className={styles.risks}>
                  <div><i /><p><strong>{currency(analysis.unscheduledContract)} sem previsão financeira ({share(analysis.unscheduledContract, analysis.contract)} do contrato)</strong><span>Parcela contratual ainda não registrada como recebida ou programada.</span></p></div>
                  <div><i /><p><strong>{currency(analysis.payable)} em compromissos a pagar ({share(analysis.payable, analysis.knownCost)} dos custos conhecidos)</strong><span>Valor já conhecido que integra o cenário projetado.</span></p></div>
                  <div className={styles.riskHigh}><i /><p><strong>Custo para concluir não informado</strong><span>Sem avanço físico e orçamento remanescente, o teto contratual é apenas um limite superior.</span></p></div>
                </div>
              </div>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeading}>
                <div><span>04</span><h2>Evolução do caixa realizado</h2></div>
                <p>Recebimentos e pagamentos por mês, com resultado e margem.</p>
              </div>
              {analysis.monthRows.length ? (
                <div className={styles.cashEvolution}>
                  <div className={styles.cashOverview}>
                    <div><span>Recebimentos no histórico</span><strong>{currency(analysis.monthRows.reduce((sum, row) => sum + row.received, 0))}</strong></div>
                    <div><span>Pagamentos no histórico</span><strong>{currency(analysis.monthRows.reduce((sum, row) => sum + row.paid, 0))}</strong></div>
                    <div><span>Resultado acumulado</span><strong>{currency(analysis.monthRows.reduce((sum, row) => sum + row.received - row.paid, 0))}</strong></div>
                    <div><span>Margem acumulada</span><strong>{share(
                      analysis.monthRows.reduce((sum, row) => sum + row.received - row.paid, 0),
                      analysis.monthRows.reduce((sum, row) => sum + row.received, 0)
                    )}</strong></div>
                  </div>
                  <div className={styles.cashTable} role="table" aria-label="Evolução financeira mensal do projeto">
                    <div className={[styles.cashRow, styles.cashHeader].join(" ")} role="row">
                      <span role="columnheader">Mês</span>
                      <span role="columnheader">Comparativo do caixa</span>
                      <span role="columnheader">Recebido</span>
                      <span role="columnheader">Pago</span>
                      <span role="columnheader">Resultado</span>
                      <span role="columnheader">Margem</span>
                    </div>
                    {analysis.monthRows.map((row) => {
                      const result = row.received - row.paid;
                      const marginLabel = row.received > 0 ? percentage(result / row.received) : "—";
                      const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric" })
                        .format(row.date).replace(" de ", "/").replace(".", "");
                      return (
                        <div className={[styles.cashRow, "project-viability-month-row"].join(" ")} role="row" key={row.key}>
                          <strong className={styles.cashMonth} role="cell">{monthLabel}</strong>
                          <div className={styles.cashTracks} role="cell" aria-label={"Recebido " + currency(row.received) + "; pago " + currency(row.paid)}>
                            <div className={styles.cashTrack}><i className={styles.cashBarRevenue} style={{ width: String(Math.max(0, Math.min(100, (row.received / analysis.maxMonthly) * 100))) + "%" }} /></div>
                            <div className={styles.cashTrack}><i className={styles.cashBarCost} style={{ width: String(Math.max(0, Math.min(100, (row.paid / analysis.maxMonthly) * 100))) + "%" }} /></div>
                          </div>
                          <span className={styles.cashAmount} role="cell">{currency(row.received)}</span>
                          <span className={styles.cashAmount} role="cell">{currency(row.paid)}</span>
                          <strong className={[styles.cashResult, result < 0 ? styles.cashNegative : ""].join(" ")} role="cell">{currency(result)}</strong>
                          <span className={[styles.cashMargin, result < 0 ? styles.cashNegative : ""].join(" ")} role="cell">{marginLabel}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className={styles.cashFoot}>
                    <div className={styles.cashLegend}><span><i className={styles.cashBarRevenue} />Receita recebida</span><span><i className={styles.cashBarCost} />Custos pagos</span></div>
                    <p>Barras na mesma escala para todos os meses. Margem = resultado ÷ receita recebida; sem recebimento, não se aplica.</p>
                  </div>
                </div>
              ) : <div className={styles.emptyState}>Não há movimentações realizadas com data válida na base do projeto.</div>}
            </section>
          </div>

          <footer className={styles.footer}>
            <span>OAE_FIN · Relatório interno de resultado financeiro por projeto</span>
            <span>Emitido em {reportDate} · Dados sujeitos à conciliação da base</span>
          </footer>
        </article>
      </div>
    </div>,
    portalTarget
  );
}
