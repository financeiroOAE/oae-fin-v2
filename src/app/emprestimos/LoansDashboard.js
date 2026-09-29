'use client';

import { useCallback, useEffect, useState } from 'react';
import { Landmark, Plus, Save, FileText, RefreshCw, Pencil, ArrowLeft } from 'lucide-react';
import './loans.css';

const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);
const day = (date) => date ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(date)) : '—';
const empty = { cpDocument: '', sourceKey: '', holder: '', kind: 'EMPRESTIMO', bank: '', contractNumber: '', modality: '', amount: '', startDate: '', installmentCount: '0', status: 'A_CONFERIR', sourceNote: '', reviewNotes: '', scheduleBasis: 'SEM_CRONOGRAMA', installments: [] };
const statusLabel = { PAGO: 'Pago', A_VENCER: 'A vencer', VENCIDO: 'Vencido', CONFERIR: 'Conferir CP', SEM_VINCULO: 'Sem vínculo CP', SEM_BASE_CP: 'Sem base CP', SEM_DOCUMENTO: 'Documento CP pendente', VALOR_DIVERGENTE: 'Conferir valor CP' };
const statusText = { ATIVO: 'Ativo na relação', A_CONFERIR: 'Situação a conferir', QUITADO: 'Quitado', RENEGOCIADO: 'Renegociado', SUSPENSO: 'Suspenso' };
const basisText = { OFICIAL: 'Cronograma oficial', PROJETADO: 'Projeção da planilha', SEM_CRONOGRAMA: 'Cronograma pendente' };

function isoDate(value) { return value ? String(value).slice(0, 10) : ''; }
function monthDate(first, index) {
  const [y, m, d] = first.split('-').map(Number);
  const month = m - 1 + index;
  const last = new Date(Date.UTC(y, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, month, Math.min(d, last))).toISOString().slice(0, 10);
}
function numberValue(value) { return Number(String(value || '0').replace(',', '.')); }
function prepared(contract) {
  return { ...contract, cpDocument: contract.cpDocument || '', sourceKey: contract.sourceKey || '', holder: contract.holder || '', sourceNote: contract.sourceNote || '', reviewNotes: contract.reviewNotes || '', amount: String(contract.amount), startDate: isoDate(contract.startDate),
    installments: contract.installments.map((item) => ({ number: item.number, dueDate: isoDate(item.dueDate), principal: String(item.principal), interest: String(item.interest), other: String(item.other), total: String(item.total) })) };
}

export default function LoansDashboard() {
  const [contracts, setContracts] = useState([]);
  const [snapshotAt, setSnapshotAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [tab, setTab] = useState('overview');
  const [form, setForm] = useState(null);
  const [selectedId, setSelectedId] = useState('');
  const [firstDue, setFirstDue] = useState('');
  const [saving, setSaving] = useState(false);
  const [quote, setQuote] = useState('');

  const reload = useCallback(async () => {
    const response = await fetch('/api/emprestimos', { cache: 'no-store' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Erro ao carregar empréstimos.');
    setContracts(result.contracts || []);
    setSnapshotAt(result.snapshotAt);
  }, []);
  useEffect(() => {
    let active = true;
    fetch('/api/emprestimos', { cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Erro ao carregar empréstimos.');
        if (active) { setContracts(result.contracts || []); setSnapshotAt(result.snapshotAt); }
      })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const selected = contracts.find((item) => item.id === selectedId) || contracts[0];
  const all = contracts.flatMap((contract) => contract.installments.map((item) => ({ ...item, contract })));
  const totals = {
    contracted: contracts.reduce((sum, item) => sum + Number(item.amount), 0),
    paid: all.filter((item) => item.reconciliation === 'PAGO').reduce((sum, item) => sum + Number(item.total), 0),
    principalPaid: all.filter((item) => item.reconciliation === 'PAGO').reduce((sum, item) => sum + Number(item.principal), 0),
    interestPaid: all.filter((item) => item.reconciliation === 'PAGO').reduce((sum, item) => sum + Number(item.interest), 0),
    open: all.filter((item) => item.reconciliation !== 'PAGO').length,
  };
  const remaining = selected?.installments.filter((item) => item.reconciliation !== 'PAGO') || [];
  const canCompare = selected?.scheduleBasis === 'OFICIAL' && selected.installmentCount > 0 && selected.installments.length === selected.installmentCount && Boolean(selected.cpDocument);
  const future = remaining.reduce((sum, item) => sum + Number(item.total), 0);
  const futurePrincipal = remaining.reduce((sum, item) => sum + Number(item.principal), 0);
  const futureInterest = remaining.reduce((sum, item) => sum + Number(item.interest), 0);
  const quoteValue = numberValue(quote);

  function changeInstallment(index, key, value) {
    setForm((current) => ({ ...current, installments: current.installments.map((row, i) => {
      if (i !== index) return row;
      const next = { ...row, [key]: value };
      if (key !== 'total' && next.principal !== '' && next.interest !== '') {
        next.total = ((Math.round(numberValue(next.principal) * 100) + Math.round(numberValue(next.interest) * 100) + Math.round(numberValue(next.other) * 100)) / 100).toFixed(2);
      }
      return next;
    }) }));
  }
  function generateRows() {
    const count = Number(form.installmentCount);
    if (!firstDue || !Number.isInteger(count) || count < 1 || count > 600) return setError('Informe a quantidade e o primeiro vencimento.');
    setError('');
    setForm((current) => ({ ...current, installments: Array.from({ length: count }, (_, i) => {
      const previous = current.installments.find((row) => Number(row.number) === i + 1);
      return previous || { number: i + 1, dueDate: monthDate(firstDue, i), principal: '', interest: '', other: '', total: '' };
    }) }));
  }
  function repeatFirst() {
    setForm((current) => ({ ...current, installments: current.installments.map((row, i) => i ? {
      ...row, principal: current.installments[0].principal, interest: current.installments[0].interest,
      other: current.installments[0].other, total: current.installments[0].total,
    } : row) }));
  }
  async function save(event) {
    event.preventDefault(); setError(''); setMessage('');
    const rows = form.installments.filter((row) => row.total !== '');
    if (rows.some((row) => row.principal === '' || row.interest === '')) return setError('Preencha capital e juros, mesmo que o valor seja zero, nas parcelas lançadas.');
    setSaving(true);
    try {
      const response = await fetch(form.id ? `/api/emprestimos/${form.id}` : '/api/emprestimos', {
        method: form.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount: numberValue(form.amount), installments: rows.map((row) => ({ ...row,
          principal: numberValue(row.principal), interest: numberValue(row.interest), other: numberValue(row.other), total: numberValue(row.total),
        })) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível salvar.');
      setForm(null); setSelectedId(result.contract.id); setTab('contracts');
      await reload(); setMessage('Contrato salvo. Confira a conciliação das parcelas com a CP_GERAL.');
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }
  async function upload(event) {
    const file = event.target.files?.[0];
    if (!file || !selected) return;
    setError(''); setMessage('');
    const body = new FormData(); body.append('file', file);
    try {
      const response = await fetch(`/api/emprestimos/${selected.id}/documentos`, { method: 'POST', body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Falha ao anexar PDF.');
      await reload(); setMessage('PDF anexado ao contrato.');
    } catch (err) { setError(err.message); } finally { event.target.value = ''; }
  }

  async function importContracts(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(''); setMessage(''); setSaving(true);
    try {
      const body = JSON.parse(await file.text());
      const response = await fetch('/api/emprestimos/importar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível importar.');
      await reload();
      setMessage(`${result.added.length} contratos adicionados; ${result.skipped.length} já constavam no painel. Confira as pendências de cada um.`);
    } catch (err) { setError(err.message); } finally { setSaving(false); event.target.value = ''; }
  }

  return <div className="loans-page fade-in">
    <header className="loans-header"><div><span className="loans-eyebrow"><Landmark size={15} /> CONTROLE FINANCEIRO</span><h1>Empréstimos e consórcios</h1><p>Contratos, pendências, parcelas e conferência com a CP_GERAL.</p></div>
      <div className="loans-header-actions"><label className="btn loans-upload">Importar relação JSON<input type="file" accept="application/json,.json" onChange={importContracts} disabled={saving} hidden /></label><button className="btn btn-primary" onClick={() => { setForm({ ...empty }); setFirstDue(''); setError(''); }}><Plus size={16} /> Novo contrato</button></div></header>
    <nav className="loans-tabs" aria-label="Seções de empréstimos">{[['overview','Visão geral'],['contracts','Contratos'],['installments','Parcelas'],['payoff','Quitação']].map(([id,label]) => <button key={id} type="button" className={tab === id ? 'active' : ''} onClick={() => { setTab(id); setForm(null); setError(''); }}>{label}</button>)}</nav>
    {error && <div className="loans-alert error">{error}</div>}{message && <div className="loans-alert success">{message}</div>}
    {form ? <form className="loans-card loans-form" onSubmit={save}>
      <div className="loans-section-title"><div><h2>{form.id ? 'Editar contrato' : 'Cadastrar contrato'}</h2><p>Preencha o Documento CP quando encontrar o número exato na CP_GERAL. As pendências podem ser completadas depois.</p></div><button type="button" className="loans-link" onClick={() => setForm(null)}><ArrowLeft size={15} /> Voltar</button></div>
      <div className="loans-fields">
        <label>Documento CP<input value={form.cpDocument} onChange={(e) => setForm({ ...form, cpDocument: e.target.value })} placeholder="Número exato da CP_GERAL" /></label>
        <label>Titular<input value={form.holder || ''} onChange={(e) => setForm({ ...form, holder: e.target.value })} placeholder="OAE, IAE, pessoa…" /></label>
        <label>Tipo<select value={form.kind || 'EMPRESTIMO'} onChange={(e) => setForm({ ...form, kind: e.target.value })}><option value="EMPRESTIMO">Empréstimo</option><option value="CONSORCIO">Consórcio</option></select></label>
        <label>Banco *<input required value={form.bank} onChange={(e) => setForm({ ...form, bank: e.target.value })} placeholder="Ex.: Caixa" /></label>
        <label>Número do contrato<input value={form.contractNumber || ''} onChange={(e) => setForm({ ...form, contractNumber: e.target.value })} /></label>
        <label>Modalidade<input value={form.modality || ''} onChange={(e) => setForm({ ...form, modality: e.target.value })} placeholder="Ex.: PRONAMPE" /></label>
        <label>Valor contratado *<input type="number" min="0.01" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
        <label>Data inicial<input type="date" value={form.startDate || ''} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></label>
        <label>Quantidade de parcelas<input type="number" min="0" max="600" required value={form.installmentCount} onChange={(e) => setForm({ ...form, installmentCount: e.target.value })} /></label>
        <label>Status<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="A_CONFERIR">Situação a conferir</option><option value="ATIVO">Ativo na relação</option><option value="QUITADO">Quitado</option><option value="RENEGOCIADO">Renegociado</option><option value="SUSPENSO">Suspenso</option></select></label>
        <label>Base do cronograma<select value={form.scheduleBasis || 'SEM_CRONOGRAMA'} onChange={(e) => setForm({ ...form, scheduleBasis: e.target.value })}><option value="SEM_CRONOGRAMA">Cronograma pendente</option><option value="PROJETADO">Projeção da planilha</option><option value="OFICIAL">Cronograma oficial</option></select></label>
        <label>Identificação na planilha<input value={form.sourceKey || ''} onChange={(e) => setForm({ ...form, sourceKey: e.target.value })} /></label>
      </div>
      <div className="loans-notes-fields"><label>Fonte e data dos dados<textarea rows="2" value={form.sourceNote || ''} onChange={(e) => setForm({ ...form, sourceNote: e.target.value })} /></label><label>O que falta conferir<textarea rows="3" value={form.reviewNotes || ''} onChange={(e) => setForm({ ...form, reviewNotes: e.target.value })} /></label></div>
      <div className="loans-section-title"><div><h2>Parcelas</h2><p>Capital + juros/encargos + outros = total. Você pode completar o cronograma depois.</p></div></div>
      <div className="loans-row-actions"><label>Primeiro vencimento<input type="date" value={firstDue} onChange={(e) => setFirstDue(e.target.value)} /></label><button type="button" className="btn" onClick={generateRows}>Gerar linhas mensais</button>{form.installments.length > 1 && <button type="button" className="btn" onClick={repeatFirst}>Repetir valores da 1ª</button>}</div>
      {form.installments.length > 0 && <div className="loans-table-wrap"><table className="loans-table"><thead><tr><th>Nº</th><th>Vencimento</th><th>Capital</th><th>Juros/encargos</th><th>Outros</th><th>Total</th></tr></thead><tbody>{form.installments.map((row, i) => <tr key={row.number}><td>{row.number}/{form.installmentCount}</td><td><input aria-label={`Vencimento parcela ${row.number}`} type="date" value={row.dueDate} onChange={(e) => changeInstallment(i, 'dueDate', e.target.value)} /></td>{['principal','interest','other','total'].map((key) => <td key={key}><input aria-label={`${key} parcela ${row.number}`} type="number" min="0" step="0.01" value={row[key]} onChange={(e) => changeInstallment(i, key, e.target.value)} /></td>)}</tr>)}</tbody></table></div>}
      <div className="loans-form-footer"><span>O PDF pode ser anexado após salvar o contrato.</span><button type="submit" className="btn btn-primary" disabled={saving}><Save size={16} /> {saving ? 'Salvando…' : 'Salvar contrato'}</button></div>
    </form> : loading ? <div className="loans-card">Carregando empréstimos…</div> : <>
      {tab === 'overview' && <><div className="loans-kpis">{[['Valores de origem/crédito',totals.contracted],['Pago na CP',totals.paid],['Capital amortizado',totals.principalPaid],['Juros pagos',totals.interestPaid]].map(([label,value]) => <article className="loans-card" key={label}><span>{label}</span><strong>{money(value)}</strong></article>)}</div><div className="loans-card"><div className="loans-section-title"><div><h2>Posição dos contratos</h2><p>{contracts.length} contratos cadastrados · {contracts.filter((item) => !item.cpDocument).length} sem Documento CP · {contracts.filter((item) => item.status === 'A_CONFERIR').length} com situação a conferir.</p></div></div>{contracts.length ? <div className="loans-table-wrap"><table className="loans-table"><thead><tr><th>Titular / contrato</th><th>Documento CP</th><th>Valor de origem</th><th>Parcelas</th><th>Pendências</th></tr></thead><tbody>{contracts.map((item) => <tr key={item.id} onClick={() => { setSelectedId(item.id); setTab('contracts'); }} className="clickable"><td><strong>{item.holder || 'Titular a conferir'} · {item.bank}</strong><small>{item.sourceKey || item.contractNumber || 'Sem identificação'} · {item.kind === 'CONSORCIO' ? 'Consórcio' : item.modality || 'Empréstimo'}</small></td><td>{item.cpDocument || 'Pendente'}</td><td>{money(item.amount)}</td><td>{item.installmentCount ? `${item.installments.length}/${item.installmentCount}` : 'A confirmar'} · {basisText[item.scheduleBasis] || 'Cronograma pendente'}</td><td>{item.reviewNotes ? 'Conferir dados' : statusText[item.status] || item.status}</td></tr>)}</tbody></table></div> : <p className="loans-empty">Comece cadastrando um contrato. A planilha antiga pode ser usada como referência para as parcelas.</p>}</div><p className="loans-note">A soma de origem inclui créditos de consórcio e valores financiados de titulares diferentes; não representa saldo devedor. Totais pagos exigem conciliação com a CP_GERAL e cronogramas oficiais completos.</p></>}
      {tab === 'contracts' && <div className="loans-two-col"><aside className="loans-card loans-list"><h2>Contratos</h2>{contracts.length ? contracts.map((item) => <button key={item.id} className={selected?.id === item.id ? 'selected' : ''} onClick={() => setSelectedId(item.id)}><strong>{item.holder || 'Titular a conferir'} · {item.bank}</strong><small>{item.sourceKey || item.contractNumber || item.modality || 'Contrato'} · {statusText[item.status] || item.status}</small></button>) : <p className="loans-empty">Nenhum contrato cadastrado.</p>}</aside><section className="loans-card">{selected ? <><div className="loans-section-title"><div><h2>{selected.bank} · {selected.modality || 'Empréstimo'}</h2><p>{selected.holder || 'Titular a conferir'} · {selected.kind === 'CONSORCIO' ? 'Consórcio' : 'Empréstimo'} · Documento CP {selected.cpDocument || 'pendente'} · Contrato {selected.contractNumber || 'não informado'}</p></div><button className="btn" onClick={() => { setForm(prepared(selected)); setFirstDue(isoDate(selected.installments[0]?.dueDate)); }}><Pencil size={15} /> Editar</button></div><div className="loans-review"><strong>{statusText[selected.status] || selected.status} · {basisText[selected.scheduleBasis] || 'Cronograma pendente'}</strong><p>{selected.sourceNote || 'Origem não informada.'}</p><h3>Falta atualizar</h3><p>{selected.reviewNotes || 'Nenhuma pendência descrita.'}</p></div><div className="loans-detail-grid"><div><span>Valor de origem</span><strong>{money(selected.amount)}</strong></div><div><span>Parcelas lançadas</span><strong>{selected.installments.length}/{selected.installmentCount}</strong></div><div><span>Capital nas parcelas em aberto</span><strong>{money(futurePrincipal)}</strong></div><div><span>Juros futuros lançados</span><strong>{money(futureInterest)}</strong></div></div><div className="loans-section-title"><div><h2>Documentos</h2><p>PDFs guardados com o contrato, limite de 5 MB por arquivo.</p></div><label className="btn loans-upload"><Plus size={15} /> Anexar PDF<input type="file" accept="application/pdf" onChange={upload} hidden /></label></div>{selected.documents.length ? selected.documents.map((doc) => <a className="loans-document" key={doc.id} target="_blank" rel="noopener noreferrer" href={`/api/emprestimos/${selected.id}/documentos/${doc.id}`}><FileText size={16} /> {doc.filename}</a>) : <p className="loans-empty">Nenhum PDF anexado.</p>}</> : <p className="loans-empty">Selecione um contrato.</p>}</section></div>}
      {tab === 'installments' && <div className="loans-card"><div className="loans-section-title"><div><h2>Parcelas e conciliação</h2><p>Documento CP + título/parcela + data + soma das linhas. Dados da CP atualizados em {snapshotAt ? day(snapshotAt) : 'nenhuma sincronização disponível'}.</p></div><button className="btn" onClick={() => reload().catch((err) => setError(err.message))}><RefreshCw size={15} /> Recarregar</button></div><div className="loans-table-wrap"><table className="loans-table"><thead><tr><th>Vencimento</th><th>Banco / documento</th><th>Parcela</th><th>Capital</th><th>Juros</th><th>Outros</th><th>Total</th><th>CP_GERAL</th></tr></thead><tbody>{all.sort((a,b) => isoDate(a.dueDate).localeCompare(isoDate(b.dueDate))).map((item) => <tr key={item.id}><td>{day(item.dueDate)}</td><td><strong>{item.contract.bank}</strong><small>{item.contract.cpDocument || 'Documento CP pendente'}</small></td><td>{item.number}/{item.contract.installmentCount}</td><td>{money(item.principal)}</td><td>{money(item.interest)}</td><td>{money(item.other)}</td><td>{money(item.total)}</td><td><span className={`loans-status ${item.reconciliation}`}>{statusLabel[item.reconciliation]}{item.cpMatch?.rowCount > 1 ? ` · ${item.cpMatch.rowCount} linhas` : ''}{item.reconciliation === 'VALOR_DIVERGENTE' ? ` (CP ${money(item.cpMatch.amount)})` : ''}</span></td></tr>)}</tbody></table>{!all.length && <p className="loans-empty">Nenhuma parcela lançada.</p>}</div><p className="loans-note">“Sem vínculo CP” indica que não foi localizada a parcela; linhas com o mesmo Documento, Título e data são somadas. “Conferir valor CP” indica diferença entre a soma e o cadastro. “Conferir CP” indica mais de um título candidato. A baixa não é duplicada neste módulo.</p></div>}
      {tab === 'payoff' && <div className="loans-two-col"><section className="loans-card"><h2>Simular quitação integral</h2><p className="loans-muted">Compare as parcelas cadastradas ainda sem baixa com a proposta oficial do banco.</p><label className="loans-full-label">Contrato<select value={selected?.id || ''} onChange={(e) => { setSelectedId(e.target.value); setQuote(''); }}>{contracts.map((item) => <option key={item.id} value={item.id}>{item.bank} · {item.sourceKey || item.cpDocument || item.contractNumber}</option>)}</select></label><label className="loans-full-label">Valor de quitação informado pelo banco<input type="number" min="0" step="0.01" value={quote} onChange={(e) => setQuote(e.target.value)} placeholder="R$ 0,00" /></label><p className="loans-note">Use uma proposta válida do banco. Esta tela não baixa parcelas nem altera o caixa.</p></section><section className="loans-card"><h2>Comparativo</h2>{selected && !canCompare && <p className="loans-alert error">Complete o Documento CP e o cronograma oficial antes de comparar uma quitação. Projeções e extratos antigos não são valores de quitação.</p>}{selected && canCompare ? <div className="loans-simulation"><div><span>Parcelas futuras lançadas</span><strong>{money(future)}</strong></div><div><span>Capital previsto nessas parcelas</span><strong>{money(futurePrincipal)}</strong></div><div><span>Juros/encargos previstos</span><strong>{money(futureInterest)}</strong></div><div><span>Outros custos previstos</span><strong>{money(remaining.reduce((sum,item) => sum + Number(item.other),0))}</strong></div><div><span>Quitação informada</span><strong>{quote ? money(quoteValue) : '—'}</strong></div><div className="highlight"><span>Diferença nominal</span><strong>{canCompare && quote && quoteValue > 0 ? money(future - quoteValue) : '—'}</strong></div></div> : <p className="loans-empty">{selected ? 'Comparação indisponível enquanto houver pendências.' : 'Cadastre um contrato para simular.'}</p>}</section></div>}
    </>}
  </div>;
}
