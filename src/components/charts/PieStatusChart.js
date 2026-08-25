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

  const total = (realizado || 0) + (pendente || 0);
  const isReceipt = /RECEB|ENTRADA/i.test(String(titulo || ''));
  const labelRealizado = labelRealizadoProp || (isReceipt ? 'Recebido' : 'Pago');
  const labelPendente = labelPendenteProp || (isReceipt ? 'A Receber' : 'A Pagar');

  if (total === 0) {
    return (
      <div style={{ padding: '1rem 0', color: 'var(--text-secondary)', fontSize: '13px' }}>
        <p style={{ fontWeight: '600', marginBottom: '0.25rem', color: 'var(--text-main)' }}>{titulo}</p>
        Sem movimentações.
      </div>
    );
  }

  const pRealizado = Math.round((realizado / total) * 100) || 0;
  const pPendente = 100 - pRealizado;

  return (
    <div style={{ width: '100%', marginBottom: '0.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', gap: '1rem', flexWrap: 'wrap' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-main)' }}>{titulo}</h3>
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total: {formatCurrency(total)}</span>
      </div>

      <div style={{ display: 'flex', height: '10px', width: '100%', borderRadius: '5px', overflow: 'hidden', marginBottom: '1rem', background: 'var(--bg-body)' }}>
        <div style={{ width: `${pRealizado}%`, background: colorRealizado, transition: 'width 0.5s ease' }} />
        <div style={{ width: `${pPendente}%`, background: colorPendente, transition: 'width 0.5s ease' }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 180px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: colorRealizado }} />
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{labelRealizado}</span>
            <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-main)', marginLeft: 'auto' }}>{pRealizado}%</span>
          </div>
          <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-main)' }}>{formatCurrency(realizado)}</p>
        </div>

        <div style={{ flex: '1 1 180px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: colorPendente }} />
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{labelPendente}</span>
            <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-main)', marginLeft: 'auto' }}>{pPendente}%</span>
          </div>
          <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-main)' }}>{formatCurrency(pendente)}</p>
        </div>
      </div>
    </div>
  );
}
