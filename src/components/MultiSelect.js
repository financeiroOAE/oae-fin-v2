"use client";

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, X, Search } from 'lucide-react';

export default function MultiSelect({ label, options, value, selected, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const ref = useRef(null);
  const actualValue = value || selected || [];

  useEffect(() => {
    const handler = (e) => { 
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setSearchTerm("");
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (opt) => {
    if (actualValue.includes(opt)) {
      onChange(actualValue.filter(v => v !== opt));
    } else {
      onChange([...actualValue, opt]);
    }
  };

  const clear = (e) => { e.stopPropagation(); onChange([]); };

  const filteredOptions = options.filter(opt => 
    opt.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          minHeight: '34px',
          padding: '0 0.5rem',
          background: 'var(--bg-elevated)',
          border: `1px solid ${open ? 'var(--primary)' : 'var(--border-color)'}`,
          borderRadius: '6px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '4px',
          transition: 'border-color 0.2s',
        }}
      >
        {actualValue.length === 0 ? (
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)', userSelect: 'none', flex: 1 }}>{placeholder || 'Todos'}</span>
        ) : actualValue.length > 1 ? (
          <span style={{ fontSize: '12px', color: 'var(--text-main)', fontWeight: '600', flex: 1, whiteSpace: 'normal', lineHeight: 1.3 }}>
            {actualValue.length} opções selecionadas
          </span>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', flex: 1, overflow: 'hidden' }}>
            {actualValue.map(v => (
              <span key={v} style={{
                display: 'inline-flex', alignItems: 'center', gap: '3px',
                background: 'rgba(56,189,248,0.15)', color: 'var(--primary)',
                border: '1px solid rgba(56,189,248,0.3)', borderRadius: '4px',
                fontSize: '11px', fontWeight: '600', padding: '2px 5px',
                maxWidth: '100%'
              }} title={v}>
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v}</span>
                <span onClick={(e) => { e.stopPropagation(); toggle(v); }} style={{ cursor: 'pointer', opacity: 0.7, flexShrink: 0 }}>
                  <X size={10} />
                </span>
              </span>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0, marginLeft: 'auto' }}>
          {actualValue.length > 0 && (
            <span onClick={clear} style={{ color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <X size={12} />
            </span>
          )}
          <ChevronDown size={14} color="var(--text-secondary)" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </div>
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0,
          width: 'max(100%, min(340px, calc(100vw - 2rem)))',
          background: 'var(--bg-elevated)', border: '1px solid var(--border-color)',
          borderRadius: '8px', zIndex: 1000, maxHeight: '280px', display: 'flex', flexDirection: 'column',
          boxShadow: '0 8px 16px rgba(0,0,0,0.4)',
        }}>
          <div style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, background: 'var(--bg-elevated)', zIndex: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-main)', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
              <Search size={14} color="var(--text-secondary)" />
              <input 
                type="text" 
                placeholder="Pesquisar..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: '13px', outline: 'none', width: '100%' }}
                autoFocus
              />
            </div>
          </div>
          
          <div style={{ overflowY: 'auto', flex: 1, paddingBottom: '0.25rem' }}>
            {filteredOptions.length === 0 ? (
              <div style={{ padding: '0.75rem', fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                Nenhum resultado encontrado
              </div>
            ) : (
              filteredOptions.map(opt => (
                <div
                  key={opt}
                  onClick={() => toggle(opt)}
                  style={{
                    padding: '0.5rem 0.75rem',
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    color: actualValue.includes(opt) ? 'var(--primary)' : 'var(--text-main)',
                    background: actualValue.includes(opt) ? 'rgba(56,189,248,0.08)' : 'transparent',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { if (!actualValue.includes(opt)) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = actualValue.includes(opt) ? 'rgba(56,189,248,0.08)' : 'transparent'; }}
                >
                  <div style={{
                    width: '14px', height: '14px', border: `2px solid ${actualValue.includes(opt) ? 'var(--primary)' : 'var(--border-color)'}`,
                    borderRadius: '3px', background: actualValue.includes(opt) ? 'var(--primary)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {actualValue.includes(opt) && <span style={{ color: '#fff', fontSize: '9px', fontWeight: '900' }}>✓</span>}
                  </div>
                  <span title={opt} style={{ whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.35 }}>{opt}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
