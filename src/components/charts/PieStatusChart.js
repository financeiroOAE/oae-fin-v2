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
    <div style={{ width: '100%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ minWidth: 0 }}>
        <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '0.2rem' }}>{titulo}</h3>
        <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          Total: {formatCurrency(total)}
        </span>
      </div>

      <div style={{ display: 'flex', height: '9px', width: '100%', borderRadius: '999px', overflow: 'hidden', background: 'var(--bg-body)' }}>
        {total > 0 ? (
          <>
            <div style={{ width: `${pRealizado}%`, background: colorRealizado, transition: 'width 0.35s ease' }} />
            <div style={{ width: `${pPendente}%`, background: colorPendente, transition: 'width 0.35s ease' }} />
          </>
        ) : (
          <div style={{ width: '100%', background: 'var(--border-color)' }} />
        )}
      </div>

      <div style={{ display: 'grid', gap: '0.6rem' }}>
        {statusRows.map((row) => (
          <div key={row.label} style={{ display: 'grid', gridTemplateColumns: '10px minmax(0, 1fr) auto', gap: '0.5rem', alignItems: 'center', minWidth: 0 }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: row.color, display: 'block' }} />
            <div style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.label}</span>
              <strong style={{ display: 'block', marginTop: '0.1rem', fontSize: '12px', lineHeight: 1.25, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>{formatCurrency(row.value)}</strong>
            </div>
            <strong style={{ fontSize: '12px', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>{row.percent}%</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
