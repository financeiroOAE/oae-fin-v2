"use client";

import { useState } from 'react';
import { FlaskConical } from 'lucide-react';

export default function DesignPreviewToggle({ active, collapsed }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
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
      <button type="button" onClick={toggle} disabled={busy} aria-pressed={active}
        aria-label={active ? 'Voltar ao visual atual' : 'Experimentar prévia Ameba'}
        title={active ? 'Voltar ao visual atual' : 'Prévia Ameba · apenas admin'}>
        <FlaskConical size={18} aria-hidden="true" />
        {!collapsed && <span>{busy ? 'Alterando…' : active ? 'Voltar ao visual atual' : 'Prévia Ameba'}<small>Apenas admin · em avaliação</small></span>}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
