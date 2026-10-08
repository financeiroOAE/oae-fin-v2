"use client";

import { useEffect, useState } from 'react';
import { FlaskConical, Moon, Sun } from 'lucide-react';

const SURFACE_KEY = 'oae_design_preview_surface';

export default function DesignPreviewToggle({ active, collapsed }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [surface, setSurfaceState] = useState('light');

  useEffect(() => {
    if (!active) {
      document.documentElement.removeAttribute('data-preview-surface');
      return;
    }
    const saved = localStorage.getItem(SURFACE_KEY);
    const next = saved === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-preview-surface', next);
    const timer = window.setTimeout(() => setSurfaceState(next), 0);
    return () => window.clearTimeout(timer);
  }, [active]);

  function setSurface(next) {
    if (!['light', 'dark'].includes(next)) return;
    setSurfaceState(next);
    localStorage.setItem(SURFACE_KEY, next);
    document.documentElement.setAttribute('data-preview-surface', next);
  }
  async function toggle() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/design-preview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: !active }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível alterar a prévia.');
      // Reload all layouts and clear the previous account's client router state.
      window.location.reload();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }
  return (
    <div className="design-preview-control">
      {active && !collapsed && (
        <div className="design-surface-picker" role="group" aria-label="Aparência da prévia">
          <button type="button" className={surface === 'light' ? 'is-active' : ''} onClick={() => setSurface('light')} aria-pressed={surface === 'light'}><Sun size={14} /> Clara</button>
          <button type="button" className={surface === 'dark' ? 'is-active' : ''} onClick={() => setSurface('dark')} aria-pressed={surface === 'dark'}><Moon size={14} /> Escura</button>
        </div>
      )}
      <button type="button" onClick={toggle} disabled={busy} aria-pressed={active}
        aria-label={active ? 'Voltar ao visual atual' : 'Experimentar prévia Ameba'}
        title={active ? 'Voltar ao visual atual' : 'Prévia Ameba · apenas admin'}>
        <FlaskConical size={18} aria-hidden="true" />
        {!collapsed && <span>{busy ? 'Alterando…' : active ? 'Encerrar prévia' : 'Prévia Ameba'}<small>Apenas admin · em avaliação</small></span>}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
