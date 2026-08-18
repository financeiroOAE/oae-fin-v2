"use client";

export default function RankingBarChart({ data, dataKey, color, emptyMessage, onClickItem, showPercentage = false }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
        {emptyMessage || 'Sem dados.'}
      </div>
    );
  }

  const formatCurrency = (val) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(val || 0);

  const maxVal = Math.max(...data.map(d => d[dataKey] || 0));
  const totalVal = data.reduce((sum, item) => sum + (Number(item[dataKey]) || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingTop: '0.25rem' }}>
      {data.map((item, index) => {
        const val = item[dataKey] || 0;
        const perc = maxVal > 0 ? (val / maxVal) * 100 : 0;
        const share = totalVal > 0 ? (val / totalVal) * 100 : 0;
        
        let label = "Sem identificação";
        if (item.nome) label = item.nome;
        else if (item.name) label = item.name;
        else if (item.label) label = item.label;
        
        const clickable = !!onClickItem;
        return (
          <div key={label || index}
               onClick={clickable ? () => onClickItem(item) : undefined}
               title={clickable ? `Clique para ver os lançamentos de ${label}` : label}
               style={{ cursor: clickable ? 'pointer' : 'default', transition: 'opacity 0.2s', padding: clickable ? '0.25rem 0.35rem' : 0, margin: clickable ? '-0.25rem -0.35rem' : 0, borderRadius: '6px' }}
               onMouseEnter={clickable ? (e) => e.currentTarget.style.opacity = '0.8' : undefined}
               onMouseLeave={clickable ? (e) => e.currentTarget.style.opacity = '1' : undefined}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <span style={{ fontWeight: '600', fontSize: '12px', color: 'var(--text-main)', whiteSpace: 'normal', overflowWrap: 'anywhere', paddingRight: '0.75rem', flex: 1, lineHeight: 1.35 }}>
                {index + 1}. {label}
              </span>
              <span style={{ fontSize: '13px', fontWeight: '700', color, flexShrink: 0, textAlign: 'right', whiteSpace: 'nowrap' }}>
                {formatCurrency(val)}
                {showPercentage && <small style={{ display: 'block', marginTop: '1px', color: 'var(--text-secondary)', fontSize: '10px', fontWeight: '600' }}>{share.toFixed(1).replace('.', ',')}% do total</small>}
              </span>
            </div>
            <div style={{ width: '100%', height: '10px', background: 'var(--bg-main)', borderRadius: '5px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
              <div style={{ width: `${perc}%`, height: '100%', background: color, borderRadius: '5px', transition: 'width 0.5s ease-out' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
