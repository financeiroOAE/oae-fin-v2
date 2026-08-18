"use client";

export default function TopRecebimentosChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
        Sem dados de recebimento.
      </div>
    );
  }

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);
  
  // Acha o valor máximo para definir 100% da largura
  const maxRecebido = Math.max(...data.map(d => d.Recebido));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingTop: '0.5rem' }}>
      {data.map((item, index) => {
        const perc = maxRecebido > 0 ? (item.Recebido / maxRecebido) * 100 : 0;
        
        return (
          <div key={item.nome || index} style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.4rem' }}>
              <span style={{ fontWeight: '600', fontSize: '13px', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: '1rem' }}>
                {index + 1}. {item.nome}
              </span>
              <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--success)' }}>
                {formatCurrency(item.Recebido)}
              </span>
            </div>
            
            <div style={{ width: '100%', height: '12px', background: 'var(--bg-main)', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
              <div 
                style={{ 
                  width: `${perc}%`, 
                  height: '100%', 
                  background: 'var(--success)', 
                  transition: 'width 0.5s ease-out' 
                }} 
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
