"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X, Search } from 'lucide-react';

export default function MultiSelect({ label, options = [], value, selected, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 260, maxHeight: 280 });
  const ref = useRef(null);
  const menuRef = useRef(null);
  const actualValue = value || selected || [];

  // Em todo o sistema, array vazio significa "sem restrição" = todas as opções.
  // Isso é importante porque a lista visível do filtro pode ser menor que a base
  // financeira completa. Selecionar todas não deve transformar "Todos" numa lista
  // explícita e acidentalmente excluir valores que não aparecem no seletor.
  const implicitAll = actualValue.length === 0;
  const explicitAll = options.length > 0 && options.every((opt) => actualValue.includes(opt));
  const allSelected = implicitAll || explicitAll;

  const updateMenuPosition = useCallback(() => {
    if (!ref.current || typeof window === 'undefined') return;
    const rect = ref.current.getBoundingClientRect();
    const viewportPadding = 12;
    const desiredWidth = Math.max(rect.width, Math.min(360, window.innerWidth - viewportPadding * 2));
    const width = Math.min(desiredWidth, window.innerWidth - viewportPadding * 2);
    const left = Math.min(
      Math.max(viewportPadding, rect.left),
      Math.max(viewportPadding, window.innerWidth - width - viewportPadding)
    );
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
    const spaceAbove = rect.top - viewportPadding;
    const openUpward = spaceBelow < 220 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(160, Math.min(320, openUpward ? spaceAbove - 8 : spaceBelow - 8));

    setMenuPosition({
      left,
      width,
      maxHeight,
      top: openUpward ? Math.max(viewportPadding, rect.top - maxHeight - 6) : rect.bottom + 6,
    });
  }, []);

  useEffect(() => {
    const handler = (event) => {
      const insideTrigger = ref.current?.contains(event.target);
      const insideMenu = menuRef.current?.contains(event.target);
      if (!insideTrigger && !insideMenu) {
        setOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [open, updateMenuPosition]);

  const toggle = (opt) => {
    if (implicitAll) {
      // Usuário partiu de "Todas" e desmarcou uma opção: passamos a representar
      // explicitamente todas as demais opções.
      onChange(options.filter((valueOption) => valueOption !== opt));
      return;
    }
    if (actualValue.includes(opt)) onChange(actualValue.filter((v) => v !== opt));
    else onChange([...actualValue, opt]);
  };

  const selectAll = () => {
    // "Todas" é representado por [] em todas as páginas. Assim o resultado é
    // exatamente o mesmo de não aplicar o filtro.
    onChange([]);
    setSearchTerm('');
  };

  const clear = (event) => {
    event.stopPropagation();
    onChange([]);
  };

  const filteredOptions = options.filter((opt) =>
    String(opt).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isOptionSelected = (opt) => implicitAll || actualValue.includes(opt);

  const checkboxStyle = (checked) => ({
    width: '14px',
    height: '14px',
    marginTop: '2px',
    border: `2px solid ${checked ? 'var(--primary)' : 'var(--border-color)'}`,
    borderRadius: '3px',
    background: checked ? 'var(--primary)' : 'transparent',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  });

  const menu = open && typeof document !== 'undefined' ? createPortal(
    <div
      ref={menuRef}
      role="listbox"
      style={{
        position: 'fixed',
        top: menuPosition.top,
        left: menuPosition.left,
        width: menuPosition.width,
        maxHeight: menuPosition.maxHeight,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        zIndex: 2147483646,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 22px 48px rgba(0,0,0,0.58)',
        isolation: 'isolate',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-elevated)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-main)', padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
          <Search size={14} color="var(--text-secondary)" />
          <input
            type="text"
            placeholder="Pesquisar..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            onClick={(event) => event.stopPropagation()}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: '13px', outline: 'none', width: '100%', minWidth: 0 }}
            autoFocus
          />
        </div>
      </div>

      {options.length > 0 && (
        <div
          role="option"
          aria-selected={allSelected}
          onClick={selectAll}
          style={{
            padding: '0.55rem 0.75rem',
            borderBottom: '1px solid var(--border-color)',
            fontSize: '12px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.5rem',
            color: allSelected ? 'var(--primary)' : 'var(--text-main)',
            background: allSelected ? 'rgba(56,189,248,0.08)' : 'rgba(255,255,255,0.015)',
            flexShrink: 0,
          }}
        >
          <div style={checkboxStyle(allSelected)}>
            {allSelected && <span style={{ color: '#fff', fontSize: '9px', fontWeight: '900' }}>✓</span>}
          </div>
          <span>{allSelected ? 'Todas as opções' : 'Selecionar todas as opções'}</span>
        </div>
      )}

      <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, paddingBottom: '0.25rem' }}>
        {filteredOptions.length === 0 ? (
          <div style={{ padding: '0.75rem', fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center' }}>
            Nenhum resultado encontrado
          </div>
        ) : filteredOptions.map((opt) => {
          const checked = isOptionSelected(opt);
          return (
            <div
              key={opt}
              role="option"
              aria-selected={checked}
              onClick={() => toggle(opt)}
              style={{
                padding: '0.55rem 0.75rem',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.5rem',
                color: checked ? 'var(--primary)' : 'var(--text-main)',
                background: checked ? 'rgba(56,189,248,0.08)' : 'transparent',
                lineHeight: 1.35,
              }}
            >
              <div style={checkboxStyle(checked)}>
                {checked && <span style={{ color: '#fff', fontSize: '9px', fontWeight: '900' }}>✓</span>}
              </div>
              <span title={opt} style={{ whiteSpace: 'normal', overflowWrap: 'anywhere', minWidth: 0 }}>{opt}</span>
            </div>
          );
        })}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <div ref={ref} style={{ position: 'relative', width: '100%', minWidth: 0 }}>
        {label && <span style={{ display: 'block', marginBottom: '0.25rem' }}>{label}</span>}
        <div
          onClick={() => {
            if (!open) updateMenuPosition();
            setOpen((current) => !current);
          }}
          style={{
            minHeight: '40px',
            padding: '0 0.65rem',
            background: 'var(--bg-elevated)',
            border: `1px solid ${open ? 'var(--primary)' : 'var(--border-color)'}`,
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '4px',
            transition: 'border-color 0.2s',
            minWidth: 0,
          }}
        >
          {implicitAll ? (
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', userSelect: 'none', flex: 1, minWidth: 0 }}>Todas as opções</span>
          ) : explicitAll ? (
            <span style={{ fontSize: '12px', color: 'var(--text-main)', fontWeight: '600', flex: 1, minWidth: 0, lineHeight: 1.3 }}>
              Todas as opções
            </span>
          ) : actualValue.length > 1 ? (
            <span style={{ fontSize: '12px', color: 'var(--text-main)', fontWeight: '600', flex: 1, minWidth: 0, lineHeight: 1.3 }}>
              {actualValue.length} opções selecionadas
            </span>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', flex: 1, overflow: 'hidden', minWidth: 0 }}>
              {actualValue.map((v) => (
                <span key={v} style={{
                  display: 'inline-flex', alignItems: 'center', gap: '3px',
                  background: 'rgba(56,189,248,0.15)', color: 'var(--primary)',
                  border: '1px solid rgba(56,189,248,0.3)', borderRadius: '4px',
                  fontSize: '11px', fontWeight: '600', padding: '2px 5px',
                  maxWidth: '100%', minWidth: 0,
                }} title={v}>
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v}</span>
                  <span onClick={(event) => { event.stopPropagation(); toggle(v); }} style={{ cursor: 'pointer', opacity: 0.7, flexShrink: 0 }}>
                    <X size={10} />
                  </span>
                </span>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0, marginLeft: 'auto' }}>
            {!implicitAll && (
              <span onClick={clear} title="Usar todas as opções" style={{ color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <X size={12} />
              </span>
            )}
            <ChevronDown size={14} color="var(--text-secondary)" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </div>
        </div>
      </div>
      {menu}
    </>
  );
}
