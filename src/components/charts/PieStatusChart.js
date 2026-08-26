"use client";

export default function PieStatusChart({
  realizado,
  pendente,
  colorRealizado,
  colorPendente,
  titulo,
  labelRealizado: labelRealizadoProp,
  labelPendente: labelPendenteProp,
}) {
  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val || 0);

  const realizadoValue = Number(realizado) || 0;
  const pendenteValue = Number(pendente) || 0;
  const total = realizadoValue + pendenteValue;
  const isReceipt = /RECEB|ENTRADA/i.test(String(titulo || ''));
  const labelRealizado = labelRealizadoProp || (isReceipt ? 'Recebido' : 'Pago');
  const labelPendente = labelPendenteProp || (isReceipt ? 'A Receber' : 'A Pagar');
  const pRealizado = total > 0 ? Math.round((realizadoValue / total) * 100) : 0;
  const pPendente = total > 0 ? 100 - pRealizado : 0;

  const statusRows = [
    { label: labelRealizado, value: realizadoValue, percent: pRealizado, color: colorRealizado },
    { label: labelPendente, value: pendenteValue, percent: pPendente, color: colorPendente },
  ];

  return (
    <div style={{
      width: '100%',
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: '0.6rem',
      padding: '0.75rem',
      border: '1px solid rgba(148,163,184,0.10)',
      borderRadius: '8px',
      background: 'rgba(255,255,255,0.012)',
    }}>
      <div style={{ minWidth: 0, display: 'grid', gap: '0.18rem' }}>
        <h3 style={{ fontSize: '12px', lineHeight: 1.2, fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>{titulo}</h3>
        <span style={{ display: 'block', fontSize: '9.5px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          Total: {formatCurrency(total)}
        </span>
      </div>

      <div style={{ display: 'flex', height: '7px', width: '100%', borderRadius: '999px', overflow: 'hidden', background: 'var(--bg-body)' }}>
        {total > 0 ? (
          <>
            <div style={{ width: `${pRealizado}%`, background: colorRealizado, transition: 'width 0.35s ease' }} />
            <div style={{ width: `${pPendente}%`, background: colorPendente, transition: 'width 0.35s ease' }} />
          </>
        ) : (
          <div style={{ width: '100%', background: 'var(--border-color)' }} />
        )}
      </div>

      <div style={{ display: 'grid', gap: '0.55rem' }}>
        {statusRows.map((row) => (
          <div key={row.label} style={{ display: 'grid', gridTemplateColumns: '8px minmax(0, 1fr)', gap: '0.45rem', alignItems: 'start', minWidth: 0 }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: row.color, display: 'block', marginTop: '3px' }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.45rem', minWidth: 0 }}>
                <span style={{ fontSize: '9px', color: 'var(--text-secondary)', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.label}</span>
                <strong style={{ fontSize: '9.5px', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>{row.percent}%</strong>
              </div>
              <strong style={{ display: 'block', marginTop: '0.08rem', fontSize: '11px', lineHeight: 1.2, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={formatCurrency(row.value)}>{formatCurrency(row.value)}</strong>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
