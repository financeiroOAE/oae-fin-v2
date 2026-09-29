'use client';

import { useState } from 'react';

const currency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);
const date = (value) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(value));
const month = (value) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', month: 'short', year: '2-digit' }).format(new Date(value)).replace('.', '');
const isPaid = (row) => ['PAGO', 'PAGO_DIVERGENTE'].includes(row.reconciliation);
const dayKey = (value) => String(value || '').slice(0, 10);

export default function LoansOverview({ contracts, selectedId, onSelectContract, onShowContracts }) {
  const [activeNumber, setActiveNumber] = useState(null);
  const loans = contracts.filter((item) => item.kind !== 'CONSORCIO');
  const withSchedule = contracts.filter((item) => item.installments.length);
  const current = withSchedule.find((item) => item.id === selectedId) || withSchedule[0];
  const installments = current?.installments || [];
  const paidCurrent = installments.filter(isPaid);
  const chosen = installments.find((item) => item.number === activeNumber) || paidCurrent.at(-1) || installments[0];
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = contracts.flatMap((contract) => contract.installments.map((row) => ({ ...row, contract })))
    .filter((row) => dayKey(row.dueDate) >= today && !isPaid(row))
    .sort((a, b) => dayKey(a.dueDate).localeCompare(dayKey(b.dueDate))).slice(0, 3);
  const all = contracts.flatMap((contract) => contract.installments);
  const paid = all.filter(isPaid);
  const totalPaid = paid.reduce((sum, row) => sum + Number(row.cpMatch?.amount ?? row.total), 0);
  const interestPaid = paid.filter((row) => row.reconciliation === 'PAGO').reduce((sum, row) => sum + Number(row.interest), 0);
  const interestFuture = installments.filter((row) => dayKey(row.dueDate) >= today && !isPaid(row))
    .reduce((sum, row) => sum + Number(row.interest), 0);
  const maxTotal = Math.max(1, ...installments.map((row) => Number(row.total)));
  const summary = [...contracts].sort((a, b) => Number(Boolean(b.cpDocument)) - Number(Boolean(a.cpDocument))).slice(0, 3);

  return <div className="loans-overview">
    <div className="loans-kpis">
      <article className="loans-card loans-kpi-contracts"><span>Contratos cadastrados</span><strong>{contracts.length}</strong><small>{loans.length} empréstimos · {contracts.length - loans.length} consórcios</small></article>
      <article className="loans-card loans-kpi-amount"><span>Empréstimos contratados</span><strong>{currency(loans.reduce((sum, item) => sum + Number(item.amount), 0))}</strong><small>{loans.length} contratos · todos os titulares</small></article>
      <article className="loans-card loans-kpi-paid"><span>Total pago</span><strong>{currency(totalPaid)}</strong><small>{paid.length} parcelas confirmadas em 2026</small></article>
      <article className="loans-card loans-kpi-interest"><span>Juros pagos identificados</span><strong>{currency(interestPaid)}</strong><small>Parcelas com composição conferida</small></article>
    </div>

    <div className="loans-overview-grid">
      <section className="loans-card loans-chart-card" aria-labelledby="loans-chart-title">
        <div className="loans-section-title"><div><h2 id="loans-chart-title">Capital e juros por parcela</h2><p>{current ? `${current.bank} · ${current.contractNumber || current.sourceKey || 'Contrato'}` : 'Nenhum cronograma cadastrado'}</p></div>
          {withSchedule.length > 1 && <label className="loans-chart-select">Contrato<select aria-label="Contrato do gráfico" value={current.id} onChange={(event) => { onSelectContract(event.target.value); setActiveNumber(null); }}>{withSchedule.map((item) => <option key={item.id} value={item.id}>{item.bank} · {item.contractNumber || item.sourceKey || 'Contrato'}</option>)}</select></label>}
        </div>
        {installments.length ? <>
          <div className="loans-chart-legend"><span><i className="loans-legend-dot principal" /> Capital</span><span><i className="loans-legend-dot interest" /> Juros</span>{installments.some((row) => Number(row.other) > 0) && <span><i className="loans-legend-dot other" /> Outros</span>}</div>
          <div className="loans-chart-scroll"><div className="loans-bars" role="group" aria-label="Parcelas do contrato">
            {installments.map((row) => { const total = Number(row.total); const fraction = Math.max(0, Math.min(100, total / maxTotal * 100)); return <button key={row.id || row.number} type="button" className={`loans-bar-item${isPaid(row) ? ' is-paid' : ''}${chosen?.number === row.number ? ' is-selected' : ''}`} onClick={() => setActiveNumber(row.number)} aria-label={`Parcela ${row.number}, ${month(row.dueDate)}, ${currency(total)}, ${isPaid(row) ? 'paga' : 'não confirmada'}`} aria-pressed={chosen?.number === row.number}>
              <span className="loans-bar" style={{ height: `${Math.max(fraction, 12)}%` }}><span className="loans-bar-interest" style={{ height: `${total ? Number(row.interest) / total * 100 : 0}%` }} /><span className="loans-bar-other" style={{ height: `${total ? Number(row.other) / total * 100 : 0}%` }} /><span className="loans-bar-principal" style={{ height: `${total ? Number(row.principal) / total * 100 : 0}%` }} /></span><span className="loans-bar-month">{month(row.dueDate)}</span>
            </button>; })}
          </div></div>
          {chosen && <div className="loans-chart-detail" aria-live="polite"><strong>{month(chosen.dueDate)} · parcela {chosen.number} · {chosen.reconciliation === 'PAGO_DIVERGENTE' ? 'Pago · conferir valor' : isPaid(chosen) ? 'Pago' : chosen.reconciliation === 'HISTORICO_ANTERIOR' ? 'Histórico anterior' : chosen.reconciliation === 'VALOR_DIVERGENTE' ? 'Conferir valor' : 'Não confirmado'}</strong><span>{chosen.reconciliation === 'PAGO_DIVERGENTE' ? `Pago ${currency(chosen.cpMatch.amount)} · Cadastrado ${currency(chosen.total)}` : `Capital ${currency(chosen.principal)} · Juros ${currency(chosen.interest)}`}</span></div>}
          <p className="loans-chart-caption">Barras esmaecidas indicam parcelas ainda não confirmadas como pagas.</p>
        </> : <p className="loans-empty">Complete um cronograma para visualizar a composição das parcelas.</p>}
      </section>

      <section className="loans-card loans-progress-card" aria-labelledby="loans-progress-title">
        <h2 id="loans-progress-title">Parcelas · {current?.bank || 'Contrato'}</h2><p className="loans-muted">Evolução do contrato selecionado</p>
        {current ? <><div className="loans-progress-label"><strong>{paidCurrent.length} pagas</strong><span>{installments.filter((row) => dayKey(row.dueDate) >= today && !isPaid(row)).length} a vencer</span></div><div className="loans-progress-track" role="progressbar" aria-label="Parcelas confirmadas como pagas" aria-valuenow={paidCurrent.length} aria-valuemin="0" aria-valuemax={current.installmentCount || installments.length}><div style={{ width: `${current.installmentCount ? paidCurrent.length / current.installmentCount * 100 : 0}%` }} /></div><div className="loans-progress-label secondary"><span>Parcelas confirmadas</span><strong>{paidCurrent.length} / {current.installmentCount}</strong></div>
          <div className="loans-mini-section"><h3>Juros</h3><div><span>Pagos identificados</span><strong>{currency(paidCurrent.filter((row) => row.reconciliation === 'PAGO').reduce((sum, row) => sum + Number(row.interest), 0))}</strong></div><div><span>Futuros na projeção</span><strong>{currency(interestFuture)}</strong></div></div></> : <p className="loans-empty">Nenhum contrato com parcelas cadastradas.</p>}
        <div className="loans-mini-section"><h3>Próximos vencimentos</h3>{upcoming.length ? upcoming.map((row) => <div key={`${row.contract.id}-${row.number}`}><span>{date(row.dueDate)} · {row.contract.bank} · {row.number}/{row.contract.installmentCount}</span><strong>{currency(row.total)}</strong></div>) : <p className="loans-empty">Nenhuma parcela futura cadastrada.</p>}</div>
      </section>
    </div>

    <section className="loans-card loans-exec-summary" aria-labelledby="loans-summary-title"><div className="loans-section-title"><div><h2 id="loans-summary-title">Resumo dos contratos</h2><p>Situação e próximas atualizações</p></div><button type="button" className="loans-link" onClick={onShowContracts}>Ver todos</button></div>
      {summary.map((item) => { const confirmed = item.installments.filter(isPaid).length; const review = item.installments.filter((row) => ['PAGO_DIVERGENTE','VALOR_DIVERGENTE','CONFERIR'].includes(row.reconciliation)).length; return <div className="loans-summary-row" key={item.id}><div><strong>{item.holder || 'Titular a confirmar'} · {item.bank}</strong><small>{item.sourceKey || item.contractNumber || item.modality || 'Contrato'} · {item.kind === 'CONSORCIO' ? 'Consórcio' : 'Empréstimo'}</small></div><span>{confirmed ? `${confirmed} pagas` : 'Cronograma a completar'}{review ? ` · ${review} valor a conferir` : ''}</span><b className={item.status === 'QUITADO' ? 'is-closed' : item.cpDocument ? '' : 'is-pending'}>{item.status === 'QUITADO' ? 'Quitado' : item.cpDocument ? 'Em acompanhamento' : 'Dados a completar'}</b></div>; })}
      <p className="loans-note">O valor contratado soma todos os titulares e exclui os consórcios; não representa saldo devedor. Pagamentos sem histórico anterior a 2026 não entram no total pago.</p>
    </section>
  </div>;
}
