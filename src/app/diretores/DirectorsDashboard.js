'use client';

import { useCallback, useEffect, useState } from 'react';
import '../equipe/management.css';

const brl = (n) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n) || 0);
const labels = { FIXO: 'Fixo mensal', RETIRADA: 'Retirada dos sócios', REEMBOLSO: 'Reembolso', OUTRO: 'Outras saídas' };
function monthOf(raw) { const s = String(raw || ''); const iso = s.match(/^(\d{4}-\d{2})/); if (iso) return iso[1]; const br = s.match(/^\d{1,2}\/(\d{1,2})\/(\d{4})/); return br ? `${br[2]}-${br[1].padStart(2, '0')}` : ''; }

export default function DirectorsDashboard({ isAdmin }) {
  const [data, setData] = useState({ profiles: [], candidates: [] });
  const [users, setUsers] = useState([]);
  const [profileId, setProfileId] = useState('');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [name, setName] = useState('');
  const [userId, setUserId] = useState('');
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState(null);
  const [category, setCategory] = useState('FIXO');
  const [allocations, setAllocations] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async (q = '') => {
    const response = await fetch(`/api/diretores?q=${encodeURIComponent(q)}`, { cache: 'no-store' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    setData(result);
  }, []);
  useEffect(() => {
    let active = true;
    fetch('/api/diretores', { cache: 'no-store' }).then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (active) setData(result);
    }).catch((err) => { if (active) setError(err.message); });
    if (isAdmin) fetch('/api/users', { cache: 'no-store' }).then((r) => r.json()).then((result) => { if (active) setUsers(result.users || []); }).catch(() => {});
    return () => { active = false; };
  }, [isAdmin]);
  const profile = data.profiles.find((item) => item.id === profileId) || data.profiles[0];
  const links = (profile?.cpLinks || []).filter((link) => link.source && monthOf(link.source.data) === month);
  const paid = links.filter((link) => link.source.paid).reduce((sum, link) => sum + link.source.valor, 0);
  const open = links.filter((link) => !link.source.paid).reduce((sum, link) => sum + link.source.valor, 0);
  const byCategory = Object.keys(labels).map((key) => ({ key, value: links.filter((link) => link.category === key && link.source.paid).reduce((sum, link) => sum + link.source.valor, 0) }));
  const fixed = byCategory.find((x) => x.key === 'FIXO')?.value || 0;
  const allocation = new Map();
  links.filter((link) => link.category === 'FIXO').forEach((link) => (link.allocations || []).forEach((item) => allocation.set(item.project, (allocation.get(item.project) || 0) + Number(item.amount))));

  async function post(payload) {
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/diretores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      await reload();
      if (result.profile) { setProfileId(result.profile.id); setName(''); setUserId(''); }
      setChosen(null); setAllocations(''); setMessage('Controle salvo.');
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  async function search(event) { event.preventDefault(); setError(''); try { await reload(query); } catch (err) { setError(err.message); } }
  async function unlink(sourceKey) { const response = await fetch(`/api/diretores?sourceKey=${encodeURIComponent(sourceKey)}`, { method: 'DELETE' }); if (response.ok) await reload(); else setError((await response.json()).error); }
  function saveLink() {
    if (!profile || !chosen) return;
    const entries = allocations.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => { const separator = line.lastIndexOf(':'); return { project: line.slice(0, separator).trim(), amount: Number(line.slice(separator + 1).trim().replace(',', '.')) }; });
    post({ type: 'link', profileId: profile.id, sourceKey: chosen.sourceKey, category, allocations: entries });
  }

  return <div className="mgmt"><header className="mgmt-header"><div><span className="mgmt-eyebrow">SAÍDAS · PAGO · EM ABERTO</span><h1>Diretores</h1><p>Fixo, retiradas e reembolsos por pessoa. Somente títulos de saída do CP.</p></div><label>Mês<input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></label></header>
    {error && <div className="mgmt-alert">{error}</div>}{message && <div className="mgmt-alert good">{message}</div>}
    {isAdmin && <section className="mgmt-panel"><h2>Cadastrar perfil</h2><p>Vincule um usuário apenas quando quiser liberar a visão individual para ele em Configurações → Permissões e Acessos.</p><div className="mgmt-inline"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do diretor" /><select value={userId} onChange={(e) => setUserId(e.target.value)}><option value="">Sem usuário vinculado</option>{users.filter((u) => u.role !== 'ADMIN').map((u) => <option key={u.id} value={u.id}>{u.displayName || u.username}</option>)}</select><button className="btn btn-primary" disabled={busy || !name.trim()} onClick={() => post({ type: 'profile', name, userId })}>Salvar perfil</button></div></section>}
    {data.profiles.length > 0 ? <><div className="mgmt-inline">{data.profiles.map((item) => <button key={item.id} className={`btn ${profile?.id === item.id ? 'btn-primary' : ''}`} onClick={() => setProfileId(item.id)}>{item.name}</button>)}</div>
    <div className="mgmt-kpis"><div><span>Pago no mês</span><strong>{brl(paid)}</strong></div><div><span>Em aberto no mês</span><strong>{brl(open)}</strong></div><div><span>Fixo pago</span><strong>{brl(fixed)}</strong></div><div><span>Retirada + reembolso + outros</span><strong>{brl(paid - fixed)}</strong></div></div>
    <div className="mgmt-flow"><section className="mgmt-panel"><h2>Saídas pagas por tipo</h2>{byCategory.map((item) => <div key={item.key}><div className="mgmt-line"><span>{labels[item.key]}</span><b>{brl(item.value)}</b></div><div className="mgmt-meter"><i style={{ width: `${paid ? item.value / paid * 100 : 0}%` }} /></div></div>)}</section><section className="mgmt-panel"><h2>Fixo alocado nas obras</h2><p>A distribuição explica o pagamento; não cria novas saídas.</p>{[...allocation.entries()].map(([project, value]) => <div className="mgmt-line" key={project}><span>{project}</span><b>{brl(value)}</b></div>)}{!allocation.size && <p>Nenhuma alocação informada neste mês.</p>}</section></div>
    <section className="mgmt-panel"><h2>{profile.name} · títulos do mês</h2><div className="mgmt-table-wrap"><table className="mgmt-table"><thead><tr><th>Documento / beneficiário</th><th>Conta</th><th>Natureza</th><th>Obra / alocação</th><th>Valor</th><th>Status</th><th></th></tr></thead><tbody>{links.map((link) => <tr key={link.id}><td>{link.source.documento || link.source.titulo} · {link.source.nome}</td><td>{link.source.contaNome}</td><td>{labels[link.category]}</td><td>{link.allocations?.length ? link.allocations.map((a) => a.project).join(', ') : link.source.projeto}</td><td>{brl(link.source.valor)}</td><td>{link.source.paid ? 'Pago' : 'A pagar'}</td><td>{isAdmin && <button className="mgmt-text-button" onClick={() => unlink(link.sourceKey)}>Desvincular</button>}</td></tr>)}</tbody></table></div>{!links.length && <p>Sem pagamentos vinculados neste mês.</p>}</section></> : <section className="mgmt-panel"><p>{isAdmin ? 'Cadastre Paulo e Francielle para iniciar o controle.' : 'Seu perfil ainda não foi vinculado pelo administrador.'}</p></section>}
    {isAdmin && profile && <section className="mgmt-panel"><h2>Vincular título do CP a {profile.name}</h2><p>Pesquise documento, beneficiário, obra ou conta. Confirme a natureza mesmo quando o nome do título for diferente.</p><form className="mgmt-inline" onSubmit={search}><input value={query} onChange={(e) => setQuery(e.target.value)} minLength={3} required placeholder="Buscar no CP, mínimo 3 letras" /><button className="btn" type="submit">Pesquisar</button></form>{data.candidates.map((row) => <div className="mgmt-line" key={row.sourceKey}><span>{row.documento || row.titulo} · {row.nome} · {row.contaNome} · {row.projeto}</span><b>{brl(row.valor)}</b><button className="btn" onClick={() => setChosen(row)}>Selecionar</button></div>)}{chosen && <div className="mgmt-subcard"><strong>{chosen.documento || chosen.titulo} · {brl(chosen.valor)}</strong><div className="mgmt-fields"><label>Natureza<select value={category} onChange={(e) => setCategory(e.target.value)}>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="wide">Distribuição por obra (uma linha: Projeto:Valor)<textarea rows={3} value={allocations} onChange={(e) => setAllocations(e.target.value)} placeholder="Projeto A:5000\nProjeto B:5000" /></label></div><button className="btn btn-primary" disabled={busy} onClick={saveLink}>Confirmar vínculo</button></div>}</section>}
  </div>;
}
