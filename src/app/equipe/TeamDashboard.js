'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import './management.css';

const brl = (n) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n) || 0);
const personEmpty = { name: '', department: '', relationship: 'PJ', modality: '', jobTitle: '', company: '', email: '', phone: '', cpBeneficiary: '', status: 'ATIVO' };
const contractEmpty = { project: '', object: '', contractNumber: '', accountCode: '', documentUrl: '', amount: '', startDate: '', endDate: '', status: 'ATIVO' };
const stageEmpty = { label: '', dueDate: '', amount: '', cpDocument: '' };

export default function TeamDashboard() {
  const [data, setData] = useState({ people: [], links: [], cp: [], candidates: [] });
  const [department, setDepartment] = useState('');
  const [personId, setPersonId] = useState('');
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [cpSearch, setCpSearch] = useState('');
  const [linkContract, setLinkContract] = useState('');

  const reload = useCallback(async () => {
    const response = await fetch('/api/equipe', { cache: 'no-store' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Não foi possível carregar a equipe.');
    setData(result);
  }, []);
  useEffect(() => {
    let active = true;
    fetch('/api/equipe', { cache: 'no-store' }).then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (active) setData(result);
    }).catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, []);

  const departments = useMemo(() => [...new Set(data.people.map((p) => p.department))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [data.people]);
  const currentDepartment = department || departments[0] || '';
  const people = data.people.filter((p) => p.department === currentDepartment);
  const person = data.people.find((p) => p.id === personId) || people[0];
  const cpByKey = new Map(data.cp.map((row) => [row.sourceKey, row]));
  const linked = data.links.filter((link) => link.personId === person?.id).map((link) => ({ ...link, row: cpByKey.get(link.sourceKey) })).filter((link) => link.row);
  const missingLinks = data.links.filter((link) => link.personId === person?.id && !cpByKey.has(link.sourceKey)).length;
  const paid = linked.filter((link) => link.row.paid).reduce((sum, link) => sum + link.row.valor, 0);
  const open = linked.filter((link) => !link.row.paid).reduce((sum, link) => sum + link.row.valor, 0);
  const contracted = person?.contracts.reduce((sum, contract) => sum + Number(contract.amount), 0) || 0;
  const suggestions = data.candidates || [];

  async function searchCp(value = cpSearch) {
    setError('');
    try {
      const response = await fetch(`/api/equipe?q=${encodeURIComponent(value)}`, { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setData(result);
    } catch (err) { setError(err.message); }
  }

  async function save(event) {
    event.preventDefault(); setSaving(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/equipe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível salvar.');
      await reload();
      if (result.person) { setDepartment(result.person.department); setPersonId(result.person.id); }
      setForm(null); setMessage('Informações salvas.');
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }
  async function link(row) {
    if (!person) return;
    setError(''); setMessage('');
    try {
      const response = await fetch('/api/equipe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'link', sourceKey: row.sourceKey, personId: person.id, contractId: linkContract || null }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      await reload(); setMessage('Título vinculado à pessoa.');
    } catch (err) { setError(err.message); }
  }
  async function unlink(sourceKey) {
    setError('');
    const response = await fetch(`/api/equipe?sourceKey=${encodeURIComponent(sourceKey)}`, { method: 'DELETE' });
    if (response.ok) await reload(); else setError((await response.json()).error);
  }
  const change = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  return <div className="mgmt">
    <header className="mgmt-header"><div><span className="mgmt-eyebrow">PESSOAS · CONTRATOS · OBRAS</span><h1>Equipe</h1><p>Departamento → pessoa → contrato → títulos pagos ou em aberto.</p></div><button className="btn btn-primary" onClick={() => setForm({ type: 'person', ...personEmpty })}>+ Pessoa</button></header>
    {error && <div className="mgmt-alert">{error}</div>}{message && <div className="mgmt-alert good">{message}</div>}
    <div className="mgmt-flow"><section className="mgmt-panel"><h2>1. Departamentos</h2>{departments.length ? departments.map((name) => <button key={name} className={`mgmt-choice ${name === currentDepartment ? 'active' : ''}`} onClick={() => { setDepartment(name); setPersonId(''); setCpSearch(''); }}><strong>{name}</strong><small>{data.people.filter((p) => p.department === name).length} pessoas</small></button>) : <p>Cadastre a primeira pessoa para começar.</p>}</section>
    <section className="mgmt-panel"><h2>2. Pessoas {currentDepartment && `· ${currentDepartment}`}</h2>{people.map((item) => <button key={item.id} className={`mgmt-choice ${person?.id === item.id ? 'active' : ''}`} onClick={() => { setPersonId(item.id); setCpSearch(''); setLinkContract(''); }}><strong>{item.name}</strong><small>{item.relationship} · {item.jobTitle || 'Função pendente'} · {item.contracts.length} contrato(s)</small></button>)}</section></div>
    {person && <><section className="mgmt-panel"><div className="mgmt-panel-head"><div><h2>3. {person.name}</h2><p>{person.department} · {person.relationship} · {person.modality || 'Modalidade não informada'}</p></div><div className="mgmt-actions"><button className="btn" onClick={() => setForm({ type: 'person', ...person })}>Editar pessoa</button><button className="btn btn-primary" onClick={() => setForm({ type: 'contract', personId: person.id, ...contractEmpty })}>+ Contrato</button></div></div><div className="mgmt-kpis"><div><span>Contratado</span><strong>{brl(contracted)}</strong></div><div><span>Pago no CP</span><strong>{brl(paid)}</strong></div><div><span>Em aberto no CP</span><strong>{brl(open)}</strong></div><div><span>Saldo contratual</span><strong>{brl(Math.max(0, contracted - paid))}</strong></div></div><div className="mgmt-cards">{person.contracts.map((contract) => <article className="mgmt-subcard" key={contract.id}><div><strong>{contract.project}</strong><small>{contract.contractNumber || 'Contrato sem número'} · {brl(contract.amount)}</small></div><p>{contract.object}</p><small>Conta {contract.accountCode || 'a informar'} · {contract.stages.length} etapa(s)</small><div className="mgmt-actions"><button className="btn" onClick={() => setForm({ type: 'contract', ...contract, amount: String(contract.amount), startDate: contract.startDate?.slice(0, 10) || '', endDate: contract.endDate?.slice(0, 10) || '' })}>Editar</button><button className="btn" onClick={() => setForm({ type: 'stage', contractId: contract.id, ...stageEmpty })}>+ Etapa</button>{contract.documentUrl && <a className="btn" href={contract.documentUrl} target="_blank" rel="noopener noreferrer">Documento ↗</a>}</div>{contract.stages.map((stage) => <div className="mgmt-line" key={stage.id}><span>{stage.label} · {stage.dueDate.slice(0, 10)} · {stage.cpDocument || 'Sem documento CP'}</span><b>{brl(stage.amount)}</b></div>)}</article>)}{!person.contracts.length && <p>Nenhum contrato cadastrado para esta pessoa.</p>}</div></section>
    <section className="mgmt-panel"><h2>4. Pagamentos vinculados</h2><p>Os títulos vêm do CP. Vincule cada título uma vez; o status pago ou aberto acompanha a atualização da base.</p>{missingLinks > 0 && <div className="mgmt-alert">{missingLinks} vínculo(s) não localizados após a sincronização. Confira o título antes de usar os totais.</div>}<div className="mgmt-table-wrap"><table className="mgmt-table"><thead><tr><th>Documento / título</th><th>Obra</th><th>Conta</th><th>Valor</th><th>Situação</th><th></th></tr></thead><tbody>{linked.map(({ sourceKey, row }) => <tr key={sourceKey}><td>{row.documento || row.titulo || 'Título'}</td><td>{row.projeto}</td><td>{row.contaNome}</td><td>{brl(row.valor)}</td><td>{row.paid ? 'Pago' : 'Em aberto'}</td><td><button className="mgmt-text-button" onClick={() => unlink(sourceKey)}>Desvincular</button></td></tr>)}</tbody></table></div>{!linked.length && <p>Sem títulos vinculados.</p>}</section>
    <section className="mgmt-panel"><div className="mgmt-panel-head"><div><h2>Encontrar títulos da pessoa</h2><p>Pesquise pelo beneficiário do CP, documento ou obra e confirme o vínculo.</p></div></div><form className="mgmt-inline" onSubmit={(e) => { e.preventDefault(); searchCp(); }}><input value={cpSearch} onChange={(e) => setCpSearch(e.target.value)} minLength={3} required placeholder="Buscar no CP (mínimo 3 letras)" /><button type="button" className="btn" onClick={() => { const value = person.cpBeneficiary || person.name; setCpSearch(value); searchCp(value); }}>Buscar nome</button><button type="submit" className="btn">Pesquisar</button><select value={linkContract} onChange={(e) => setLinkContract(e.target.value)}><option value="">Sem contrato específico</option>{person.contracts.map((contract) => <option key={contract.id} value={contract.id}>{contract.project} · {contract.contractNumber || 'Contrato'}</option>)}</select></form>{suggestions.map((row) => <div className="mgmt-line" key={row.sourceKey}><span><strong>{row.nome}</strong> · {row.documento || row.titulo} · {row.projeto} · {row.paid ? 'Pago' : 'Aberto'}</span><b>{brl(row.valor)}</b><button className="btn" onClick={() => link(row)}>Vincular</button></div>)}{!suggestions.length && <p>Pesquise para encontrar títulos ainda sem vínculo.</p>}</section></>}
    {form && <div className="mgmt-overlay" role="presentation" onMouseDown={() => setForm(null)}><form className="mgmt-drawer" onMouseDown={(e) => e.stopPropagation()} onSubmit={save}><div className="mgmt-panel-head"><h2>{form.type === 'person' ? 'Cadastro da pessoa' : form.type === 'contract' ? 'Contrato por pessoa e obra' : 'Etapa de pagamento'}</h2><button type="button" className="btn" onClick={() => setForm(null)}>Fechar</button></div><div className="mgmt-fields">
      {form.type === 'person' && <><label>Nome *<input required value={form.name} onChange={(e) => change('name', e.target.value)} /></label><label>Departamento *<input required value={form.department} onChange={(e) => change('department', e.target.value)} placeholder="Ex.: Elétrica" /></label><label>Tipo de vínculo<select value={form.relationship} onChange={(e) => change('relationship', e.target.value)}>{['PJ','CLT','ASSOCIADO','TERCEIRO','AUTÔNOMO','ESTAGIÁRIO','OUTRO'].map((x) => <option key={x}>{x}</option>)}</select></label><label>Modalidade<select value={form.modality || ''} onChange={(e) => change('modality', e.target.value)}>{['','BIG ROOM','PRESENCIAL','HOME OFFICE','HIBRIDO','POR DEMANDA'].map((x) => <option key={x}>{x}</option>)}</select></label><label>Função<input value={form.jobTitle || ''} onChange={(e) => change('jobTitle', e.target.value)} /></label><label>Empresa / razão social<input value={form.company || ''} onChange={(e) => change('company', e.target.value)} /></label><label>Beneficiário no CP<input value={form.cpBeneficiary || ''} onChange={(e) => change('cpBeneficiary', e.target.value)} placeholder="Nome usado nos títulos" /></label><label>E-mail<input type="email" value={form.email || ''} onChange={(e) => change('email', e.target.value)} /></label><label>Celular<input value={form.phone || ''} onChange={(e) => change('phone', e.target.value)} /></label><label>Situação<select value={form.status} onChange={(e) => change('status', e.target.value)}><option value="ATIVO">Ativo</option><option value="INATIVO">Inativo</option></select></label></>}
      {form.type === 'contract' && <><label>Obra / projeto *<input required value={form.project} onChange={(e) => change('project', e.target.value)} /></label><label>Nº do contrato<input value={form.contractNumber || ''} onChange={(e) => change('contractNumber', e.target.value)} /></label><label className="wide">Objeto *<textarea required rows={3} value={form.object} onChange={(e) => change('object', e.target.value)} /></label><label>Valor contratado *<input type="number" required min="0" step="0.01" value={form.amount} onChange={(e) => change('amount', e.target.value)} /></label><label>Código da conta EQUIP. TÉC.<input value={form.accountCode || ''} onChange={(e) => change('accountCode', e.target.value)} /></label><label>Início<input type="date" value={form.startDate || ''} onChange={(e) => change('startDate', e.target.value)} /></label><label>Fim<input type="date" value={form.endDate || ''} onChange={(e) => change('endDate', e.target.value)} /></label><label className="wide">Link privado do contrato (HTTPS)<input type="url" value={form.documentUrl || ''} onChange={(e) => change('documentUrl', e.target.value)} placeholder="https://..." /></label><label>Situação<select value={form.status} onChange={(e) => change('status', e.target.value)}><option value="ATIVO">Ativo</option><option value="CONCLUIDO">Concluído</option><option value="SUSPENSO">Suspenso</option></select></label></>}
      {form.type === 'stage' && <><label>Etapa *<input required value={form.label} onChange={(e) => change('label', e.target.value)} /></label><label>Vencimento *<input type="date" required value={form.dueDate} onChange={(e) => change('dueDate', e.target.value)} /></label><label>Valor *<input type="number" required min="0" step="0.01" value={form.amount} onChange={(e) => change('amount', e.target.value)} /></label><label>Documento CP previsto<input value={form.cpDocument} onChange={(e) => change('cpDocument', e.target.value)} /></label></>}
    </div><button className="btn btn-primary" disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</button></form></div>}
  </div>;
}
