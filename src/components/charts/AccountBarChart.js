"use client";

import { useState } from "react";
import InfoTooltip from "@/components/InfoTooltip";

export default function AccountBarChart({ data, title, infoContent, color = "var(--primary)" }) {
  const [expanded, setExpanded] = useState(false);
  const [tooltipIdx, setTooltipIdx] = useState(null);

  if (!data || data.length === 0) {
    return (
      <div style={{ minHeight: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
        Nenhuma movimentação para este plano de contas.
      </div>
    );
  }

  const formatCurrency = (val) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  const formatShortCurrency = (val) => {
    if (val >= 1000000) return `R$ ${(val / 1000000).toFixed(1).replace('.', ',')} mi`;
    if (val >= 1000) return `R$ ${(val / 1000).toFixed(1).replace('.', ',')} mil`;
    return formatCurrency(val);
  };

  const totalValue = data.reduce((acc, curr) => acc + curr.valor, 0);
  const maxItemValue = data.length > 0 ? Math.max(...data.map(d => d.valor)) : 0;
  const displayCount = expanded ? data.length : 10;
  const visibleData = data.slice(0, displayCount);
  const hasMore = data.length > 10;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
          {title}
          <InfoTooltip title={title} content={infoContent} />
        </h2>
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>
          {formatShortCurrency(totalValue)}
        </span>
      </div>

      {/* Bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        {visibleData.map((item, idx) => {
          const pctOfTotal = totalValue > 0 ? (item.valor / totalValue) * 100 : 0;
          const pctOfMax = maxItemValue > 0 ? (item.valor / maxItemValue) * 100 : 0;
          const isHovered = tooltipIdx === idx;

          return (
            <div
              key={idx}
              style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}
              onMouseEnter={() => setTooltipIdx(idx)}
              onMouseLeave={() => setTooltipIdx(null)}
            >
              {/* Label row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span
                  style={{
                    fontSize: '12px', fontWeight: '500',
                    color: isHovered ? 'var(--text-main)' : 'var(--text-secondary)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    maxWidth: '72%', transition: 'color 0.15s',
                  }}
                  title={item.nome}
                >
                  {item.nome}
                </span>
                <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-main)', flexShrink: 0, marginLeft: '0.5rem' }}>
                  {formatShortCurrency(item.valor)}
                </span>
              </div>

              {/* Bar track */}
              <div style={{ width: '100%', height: '7px', background: 'rgba(255,255,255,0.07)', borderRadius: '4px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${pctOfMax}%`,
                    height: '100%',
                    background: color,
                    borderRadius: '4px',
                    transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
                    opacity: isHovered ? 1 : 0.75,
                  }}
                />
              </div>

              {/* Inline mini-tooltip (shown below the bar, never floats) */}
              {isHovered && (
                <div style={{
                  fontSize: '11px', color: 'var(--text-secondary)',
                  display: 'flex', gap: '1rem', paddingLeft: '2px',
                  animation: 'fadeIn 0.1s ease'
                }}>
                  <span>{formatCurrency(item.valor)}</span>
                  <span style={{ color: color }}>{pctOfTotal.toFixed(1).replace('.', ',')}% do total</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Expand/collapse button */}
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            marginTop: '1.25rem', alignSelf: 'center',
            fontSize: '12px', fontWeight: '500', color: 'var(--primary)',
            background: 'transparent', border: '1px solid var(--border-color)',
            padding: '0.4rem 1rem', borderRadius: '20px',
            cursor: 'pointer', transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(57,198,198,0.08)'; e.currentTarget.style.borderColor = 'var(--primary)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}
        >
          {expanded ? '▲ Ver menos' : `▼ Ver mais ${data.length - 10} conta${data.length - 10 !== 1 ? 's' : ''}`}
        </button>
      )}
    </div>
  );
}
