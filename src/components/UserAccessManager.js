"use client";

import { useEffect, useState } from 'react';
import { Check, KeyRound, LoaderCircle, Plus, Save, ShieldCheck, UserRound } from 'lucide-react';

const emptyForm = { displayName: '', username: '', password: '', permissions: [] };

function PermissionGrid({ menus, permissions, onChange, disabled = false }) {
  const togglePermission = (permission) => permissions.includes(permission)
    ? permissions.filter((item) => item !== permission)
    : [...permissions, permission];

  return (
    <div className="permission-grid">
      {menus.map((menu) => {
        const checked = disabled || permissions.includes(menu.key);
        return (
          <label key={menu.key} className={`permission-option ${checked ? 'is-checked' : ''}`}>
            <input type="checkbox" checked={checked} disabled={disabled} onChange={() => onChange(togglePermission(menu.key))} />
            <span className="permission-check">{checked && <Check size={12} />}</span>
            <span>{menu.label}</span>
          </label>
        );
      })}
    </div>
  );
}

export default function UserAccessManager() {
  const [users, setUsers] = useState([]);
  const [menus, setMenus] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [resetPasswords, setResetPasswords] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/users', { cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Não foi possível carregar os usuários.');
        if (active) {
          setUsers(result.users || []);
          setMenus(result.menus || []);
        }
      })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const createUser = async (event) => {
    event.preventDefault();
    setSavingId('new');
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível criar o usuário.');
      setUsers((current) => [...current, result.user]);
      setForm(emptyForm);
      setMessage('Usuário criado. No primeiro acesso, ele deverá trocar a senha inicial.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingId('');
    }
  };

  const updateLocalUser = (id, changes) => setUsers((current) => current.map((user) => user.id === id ? { ...user, ...changes } : user));

  const saveUser = async (user) => {
    setSavingId(user.id);
    setError('');
    setMessage('');
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: user.displayName,
          username: user.username,
          permissions: user.permissions,
          isActive: user.isActive,
          password: resetPasswords[user.id] || undefined,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível salvar o acesso.');
      updateLocalUser(user.id, result.user);
      setResetPasswords((current) => ({ ...current, [user.id]: '' }));
      setMessage(`Acesso de ${result.user.username} atualizado.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingId('');
    }
  };

  if (loading) return <div className="settings-state"><LoaderCircle className="report-spin" size={20} /> Carregando acessos...</div>;

  return (
    <div>
      <div className="settings-section-heading">
        <div>
          <h2><ShieldCheck size={19} /> Permissões e Acessos</h2>
          <p>Somente o administrador pode criar usuários e definir os menus visíveis.</p>
        </div>
      </div>

      {error && <div className="settings-alert is-error">{error}</div>}
      {message && <div className="settings-alert is-success">{message}</div>}

      <form onSubmit={createUser} className="access-create-card">
        <div className="settings-section-heading compact">
          <div><h3><Plus size={17} /> Novo usuário</h3><p>Acesso básico com usuário, senha inicial e menus selecionados.</p></div>
        </div>
        <div className="settings-form-grid">
          <label>Nome<input value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} placeholder="Nome do colaborador" /></label>
          <label>Usuário<input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} placeholder="ex.: maria.silva" required /></label>
          <label>Senha inicial<input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Mínimo de 8 caracteres" required minLength={8} /></label>
        </div>
        <p className="access-label">Menus liberados</p>
        <PermissionGrid menus={menus} permissions={form.permissions} onChange={(permissions) => setForm({ ...form, permissions })} />
        <div className="settings-actions"><button className="btn btn-primary" type="submit" disabled={savingId === 'new'}>{savingId === 'new' ? <LoaderCircle size={15} className="report-spin" /> : <Plus size={15} />} Criar usuário</button></div>
      </form>

      <div className="access-user-list">
        {users.map((user) => {
          const isAdmin = user.role === 'ADMIN';
          return (
            <article key={user.id} className="access-user-card">
              <header>
                <div className="access-avatar">{isAdmin ? <ShieldCheck size={18} /> : <UserRound size={18} />}</div>
                <div><strong>{user.displayName || user.username}</strong><span>@{user.username}</span></div>
                <span className={`access-role ${isAdmin ? 'is-admin' : ''}`}>{isAdmin ? 'Administrador único' : 'Usuário'}</span>
              </header>

              {isAdmin ? (
                <div className="access-admin-note">Acesso total e permanente. Este perfil é o único autorizado a alterar permissões.</div>
              ) : (
                <>
                  <div className="settings-form-grid compact">
                    <label>Nome<input value={user.displayName || ''} onChange={(event) => updateLocalUser(user.id, { displayName: event.target.value })} /></label>
                    <label>Usuário<input value={user.username} onChange={(event) => updateLocalUser(user.id, { username: event.target.value })} /></label>
                    <label>Nova senha (opcional)<span className="input-with-icon"><KeyRound size={14} /><input type="password" value={resetPasswords[user.id] || ''} onChange={(event) => setResetPasswords({ ...resetPasswords, [user.id]: event.target.value })} placeholder="Redefinir senha" minLength={8} /></span></label>
                  </div>
                  <p className="access-label">Menus que este usuário pode ver</p>
                  <PermissionGrid menus={menus} permissions={user.permissions || []} onChange={(permissions) => updateLocalUser(user.id, { permissions })} />
                  <div className="settings-actions split">
                    <label className="access-active"><input type="checkbox" checked={user.isActive} onChange={(event) => updateLocalUser(user.id, { isActive: event.target.checked })} /> Usuário ativo</label>
                    <button type="button" className="btn btn-primary" onClick={() => saveUser(user)} disabled={savingId === user.id}>{savingId === user.id ? <LoaderCircle size={15} className="report-spin" /> : <Save size={15} />} Salvar acesso</button>
                  </div>
                </>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
