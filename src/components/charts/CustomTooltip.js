"use client";

import styles from './CustomTooltip.module.css';

const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const isLiquidRevenueEntry = (entry) => {
  const name = String(entry?.name || entry?.dataKey || '').trim().toUpperCase();
  return name === 'RECEBIDO' || name === 'RECEBIDO LÍQUIDO' || name === 'RECEBIDO LIQUIDO';
};

const liquidRevenueLabel = (entry, fallback) => (
  isLiquidRevenueEntry(entry) ? 'Receita líquida' : fallback
);

export default function CustomTooltip({ active, payload, label, formatter, labelFormatter }) {
  if (active && payload && payload.length) {
    return (
      <div className={styles.tooltip} style={{
        backgroundColor: 'var(--bg-elevated)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        padding: '0.75rem 1rem',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        color: 'var(--text-main)',
        fontSize: '12px',
        pointerEvents: 'none'
      }}>
        {label && (
          <div style={{ fontWeight: '600', marginBottom: '0.5rem', color: 'var(--text-main)', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.25rem' }}>
            {labelFormatter ? labelFormatter(label, payload) : label}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {payload.map((entry, index) => {
            if (formatter) {
              const formatted = formatter(entry.value, entry.name, entry, index, payload);
              if (Array.isArray(formatted)) {
                return (
                  <div key={index} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', color: entry.color || 'var(--text-secondary)' }}>
                    <span style={{ fontWeight: '500' }}>{liquidRevenueLabel(entry, formatted[1] || entry.name)}:</span>
                    <span style={{ fontWeight: '600' }}>{formatted[0]}</span>
                  </div>
                );
              }
            }

            return (
              <div key={index} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', color: entry.color || 'var(--text-secondary)' }}>
                <span style={{ fontWeight: '500' }}>{liquidRevenueLabel(entry, entry.name)}:</span>
                <span style={{ fontWeight: '600' }}>{formatCurrency(entry.value)}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}
