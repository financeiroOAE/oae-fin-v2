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
        <strong style={{ fontSize: '14px', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>{formatCurrency(total)}</strong>
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
          marginBottom: '0.75rem',
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: '0.45rem 0.75rem' }}>
        {visibleItems.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelect?.(item)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
              border: 0,
              background: 'transparent',
              padding: '0.15rem 0',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              textAlign: 'left',
              minWidth: 0,
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', minWidth: 0, fontSize: '10.5px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color, flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
            </span>
            <strong style={{ fontSize: '10.5px', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>{formatCurrency(item.value)}</strong>
          </button>
        ))}
      </div>
    </div>
  );
}
