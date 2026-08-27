"use client";

const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(Number(value) || 0);

export default function FinancialCompositionBar({ title, total = 0, items = [], onSelect }) {
  const visibleItems = items.filter((item) => Math.abs(Number(item.value) || 0) > 0.005);
  const absoluteTotal = visibleItems.reduce((sum, item) => sum + Math.abs(Number(item.value) || 0), 0);

  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.65rem' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase' }}>{title}</span>
        <strong style={{ fontSize: 'clamp(11px, 0.9vw, 13px)', color: 'var(--text-main)', whiteSpace: 'nowrap', letterSpacing: '-0.025em', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(total)}</strong>
      </div>

      <div
        aria-label={`Composição de ${title}`}
        style={{
          display: 'flex',
          width: '100%',
          height: '16px',
          borderRadius: '8px',
          overflow: 'hidden',
          background: 'var(--bg-main)',
          marginBottom: '0.9rem',
        }}
      >
        {visibleItems.map((item) => {
          const width = absoluteTotal > 0 ? (Math.abs(Number(item.value) || 0) / absoluteTotal) * 100 : 0;
          return (
            <button
              key={item.key}
              type="button"
              aria-label={`${item.label}: ${formatCurrency(item.value)}`}
              onClick={() => onSelect?.(item)}
              style={{
                width: `${width}%`,
                minWidth: width > 0 ? '5px' : 0,
                height: '100%',
                border: 0,
                padding: 0,
                background: item.color,
                cursor: 'pointer',
                transition: 'filter 0.15s ease, opacity 0.15s ease',
              }}
              onMouseEnter={(event) => { event.currentTarget.style.filter = 'brightness(1.12)'; }}
              onMouseLeave={(event) => { event.currentTarget.style.filter = 'none'; }}
            />
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 175px), 1fr))', gap: '0.55rem' }}>
        {visibleItems.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelect?.(item)}
            style={{
              display: 'grid',
              gridTemplateColumns: '9px minmax(0, 1fr) auto',
              alignItems: 'center',
              gap: '0.5rem',
              border: '1px solid rgba(148,163,184,0.14)',
              borderRadius: '7px',
              background: 'rgba(255,255,255,0.018)',
              padding: '0.5rem 0.6rem',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              textAlign: 'left',
              minWidth: 0,
              transition: 'background 0.15s ease, border-color 0.15s ease',
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.background = 'rgba(255,255,255,0.035)';
              event.currentTarget.style.borderColor = 'rgba(148,163,184,0.28)';
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.background = 'rgba(255,255,255,0.018)';
              event.currentTarget.style.borderColor = 'rgba(148,163,184,0.14)';
            }}
          >
            <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: item.color, flexShrink: 0 }} />
            <span style={{ fontSize: '10.5px', lineHeight: 1.25, color: 'var(--text-secondary)', whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{item.label}</span>
            <strong style={{ fontSize: 'clamp(8.5px, 0.72vw, 10px)', color: 'var(--text-main)', whiteSpace: 'nowrap', letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(item.value)}</strong>
          </button>
        ))}
      </div>
    </div>
  );
}
