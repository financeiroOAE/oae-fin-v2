'use client';

import { useEffect, useState } from 'react';
import '../equipe/management.css';
import '../equipe/managementExtras.css';

const brl = (n) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n) || 0);
const labels = { FIXO: 'Fixo / equipe', RETIRADA: 'Retirada', REEMBOLSO: 'Reembolso', OUTRO: 'Outras saídas' };
const monthOf = (raw) => { const value = String(raw || ''); const iso = value.match(/^(\d{4})-(\d{1,2})/); if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}`; const br = value.match(/^\d{1,2}\/(\d{1,2})\/(\d{4})/); return br ? `${br[2]}-${br[1].padStart(2, '0')}` : null; };
const monthLabel = (value) => new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(new Date(`${value}-01T12:00:00Z`));
const lastMonths = (month) => Array.from({ length: 6 }, (_, index) => {
  const [year, number] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, number - 1 - (5 - index), 1));
  return date.toISOString().slice(0, 7);
});

export default function DirectorsDashboard({ isAdmin }) {
  const [data, setData] = useState({ profiles: [] });
  const [profileId, setProfileId] = useState('celi-barba');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [error, setError] = useState('');
  const [busyKey, setBusyKey] = useState('');

  async function reload() {
    const response = await fetch('/api/diretores', { cache: 'no-store' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    setData(result);
  }
  useEffect(() => { let active = true; fetch('/api/diretores', { cache: 'no-store' }).then(async (response) => {
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    if (active) setData(result);
  }).catch((err) => { if (active) setError(err.message); }); return () => { active = false; }; }, []);

  const profile = data.profiles.find((item) => item.id === profileId) || data.profiles[0];
  const links = (profile?.cpLinks || []).filter((link) => monthOf(link.source.data) === month).sort((a, b) => String(a.source.data).localeCompare(String(b.source.data)));
  const paid = links.filter((link) => link.source.paid).reduce((sum, link) => sum + link.source.valor, 0);
  const open = links.filter((link) => !link.source.paid).reduce((sum, link) => sum + link.source.valor, 0);
  const byCategory = Object.keys(labels).map((key) => ({ key, paid: links.filter((link) => link.category === key && link.source.paid).reduce((sum, link) => sum + link.source.valor, 0),
    open: links.filter((link) => link.category === key && !link.source.paid).reduce((sum, link) => sum + link.source.valor, 0) }));
  const projects = new Map();
  links.forEach((link) => {
    const allocations = link.allocations?.length ? link.allocations : [{ project: link.source.projeto || 'Sem obra definida', amount: link.source.valor }];
    allocations.forEach(({ project, amount }) => {
      const item = projects.get(project) || { paid: 0, open: 0 };
      item[link.source.paid ? 'paid' : 'open'] += Number(amount) || 0;
      projects.set(project, item);
    });
  });
  const trend = lastMonths(month).map((value) => {
    const items = (profile?.cpLinks || []).filter((link) => monthOf(link.source.data) === value);
    return { month: value, paid: items.filter((link) => link.source.paid).reduce((sum, link) => sum + link.source.valor, 0),
      open: items.filter((link) => !link.source.paid).reduce((sum, link) => sum + link.source.valor, 0) };
  });
  const trendMax = Math.max(1, ...trend.map((item) => item.paid + item.open));

  async function setCategory(link, category) {
    setBusyKey(link.sourceKey); setError('');
    try {
      const response = await fetch('/api/diretores', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceKey: link.sourceKey, category }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      await reload();
    } catch (err) { setError(err.message); } finally { setBusyKey(''); }
  }

  return <div className="mgmt"><header className="mgmt-header"><div><span className="mgmt-eyebrow">PAGAMENTOS · CP GERAL</span><h1>Diretores</h1><p>Saídas de Celi Barba e Paulo Henrique Araújo, identificadas nos títulos da base. Valores por natureza e por obra, sem duplicar o pagamento.</p></div><label>Mês<input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></label></header>
    {error && <div className="mgmt-alert">{error}</div>}
    <div className="mgmt-inline mgmt-tabs">{data.profiles.map((item) => <button key={item.id} className={`btn ${profile?.id === item.id ? 'btn-primary' : ''}`} onClick={() => setProfileId(item.id)}>{item.name}</button>)}</div>
    {profile && <><div className="mgmt-kpis"><div><span>Total do mês</span><strong>{brl(paid + open)}</strong></div><div><span>Pago</span><strong>{brl(paid)}</strong></div><div><span>Em aberto</span><strong>{brl(open)}</strong></div><div><span>Lançamentos</span><strong>{links.length}</strong></div></div>
      <div className="mgmt-flow"><section className="mgmt-panel"><h2>Evolução mensal · {profile.name}</h2><p>Pagamentos e títulos em aberto nos últimos seis meses até o período selecionado.</p><div className="mgmt-bars">{trend.map((item) => <div className="mgmt-bar-row" key={item.month}><span>{monthLabel(item.month)}</span><div className="mgmt-bar-track"><i className="mgmt-bar-paid" style={{ width: `${item.paid / trendMax * 100}%` }} /><i className="mgmt-bar-open" style={{ width: `${item.open / trendMax * 100}%` }} /></div><b>{brl(item.paid + item.open)}</b></div>)}</div><p>Verde: pago · Âmbar: em aberto</p></section>
      <section className="mgmt-panel"><h2>Composição das saídas</h2>{byCategory.map((item) => <div key={item.key}><div className="mgmt-line"><span>{labels[item.key]}</span><b>{brl(item.paid)} pago · {brl(item.open)} aberto</b></div><div className="mgmt-meter"><i style={{ width: `${paid + open ? (item.paid + item.open) / (paid + open) * 100 : 0}%` }} /></div></div>)}</section></div>
      <section className="mgmt-panel"><h2>Distribuição por obra / projeto</h2><div className="mgmt-table-wrap"><table className="mgmt-table"><thead><tr><th>Obra / projeto</th><th>Pago</th><th>Em aberto</th><th>Total</th></tr></thead><tbody>{[...projects.entries()].sort((a, b) => (b[1].paid + b[1].open) - (a[1].paid + a[1].open)).map(([name, values]) => <tr key={name}><td>{name}</td><td>{brl(values.paid)}</td><td>{brl(values.open)}</td><td><strong>{brl(values.paid + values.open)}</strong></td></tr>)}</tbody></table></div>{!projects.size && <p>Sem lançamentos para este mês.</p>}</section>
      <section className="mgmt-panel"><h2>Demonstrativo · {profile.name}</h2><p>O tipo de saída é sugerido pela conta e pela descrição. Admin pode corrigir a classificação na própria linha.</p><div className="mgmt-table-wrap"><table className="mgmt-table"><thead><tr><th>Data</th><th>Documento / título</th><th>Conta</th><th>Obra / projeto</th><th>Natureza</th><th>Valor</th><th>Status</th></tr></thead><tbody>{links.map((link) => <tr key={link.sourceKey}><td>{link.source.data}</td><td><strong>{link.source.documento || link.source.titulo || '—'}</strong><br />{link.source.nome}</td><td>{link.source.contaNome || '—'}</td><td>{link.allocations?.length ? link.allocations.map((a) => a.project).join(', ') : link.source.projeto || '—'}</td><td>{isAdmin ? <select aria-label={`Natureza de ${link.source.documento || link.source.titulo}`} value={link.category} disabled={busyKey === link.sourceKey} onChange={(e) => setCategory(link, e.target.value)}>{Object.entries(labels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select> : labels[link.category]}</td><td>{brl(link.source.valor)}</td><td>{link.source.paid ? 'Pago' : 'Em aberto'}</td></tr>)}</tbody></table></div>{!links.length && <p>Não há pagamentos identificados para {profile.name} neste mês. Confira o período e o nome do beneficiário na base.</p>}</section></>}
  </div>;
}
