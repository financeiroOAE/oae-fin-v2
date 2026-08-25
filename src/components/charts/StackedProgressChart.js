"use client";

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE = 5;

export default function StackedProgressChart({ data }) {
  const [page, setPage] = useState(1);
  const [sortOrder, setSortOrder] = useState('Maior Contrato');

  if (!data || data.length === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
        Sem dados de contratos.
      </div>
    );
  }

  const formatCurrency = (val) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(val || 0);

  const sortedData = [...data].sort((a, b) => {
    if (sortOrder === 'Maior Faturado') {
      return (b.Faturado || 0) - (a.Faturado || 0);
    } else if (sortOrder === 'Maior a Faturar') {
      return (b.Saldo || 0) - (a.Saldo || 0);
    }
    return (b.Contratado || 0) - (a.Contratado || 0);
  });

  const totalPages = Math.ceil(sortedData.length / PAGE_SIZE);
  const pageData = sortedData.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Ordenar:</label>
          <select value={sortOrder} onChange={(e) => { setSortOrder(e.target.value); setPage(1); }} style={{ padding: '2px 6px', fontSize: '11px', background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '4px' }}>
            <option value="Maior Contrato">Maior Contrato</option>
            <option value="Maior Faturado">Maior Faturado</option>
            <option value="Maior a Faturar">Maior A Faturar</option>
          </select>
        </div>
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          Projetos {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, sortedData.length)} de {sortedData.length}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', flex: 1 }}>
        {pageData.map((item, index) => {
          const faturado = Math.max(0, item.Faturado || 0);
          const contrato = Math.max(0, item.Contratado || 0);
          const saldo = Math.max(0, item.Saldo || 0);
          const percFaturado = contrato > 0 ? Math.min(100, (faturado / contrato) * 100) : 0;
          const percSaldo = 100 - percFaturado;

          return (
            <div key={item.nome || index} style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                <span style={{ fontWeight: '600', fontSize: '12px', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: '1rem', flex: 1 }}>
                  {item.nome}
                </span>
                <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-main)' }}>
                  Contrato: {formatCurrency(contrato)}
                </span>
              </div>

              <div style={{ width: '100%', height: '16px', background: 'var(--bg-main)', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-color)', display: 'flex', marginBottom: '0.3rem' }}>
                <div title={`Faturado: ${formatCurrency(faturado)} (${percFaturado.toFixed(1)}%)`} style={{ width: `${percFaturado}%`, height: '100%', background: 'var(--primary)', transition: 'width 0.4s ease-out', borderRadius: percFaturado >= 99 ? '5px' : '5px 0 0 5px' }} />
                <div title={`A Faturar: ${formatCurrency(saldo)}`} style={{ width: `${percSaldo}%`, height: '100%', background: 'var(--warning)', transition: 'width 0.4s ease-out', borderRadius: percFaturado <= 1 ? '5px' : '0 5px 5px 0' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                <span style={{ color: 'var(--primary)' }}>
                  Faturado: <strong>{formatCurrency(faturado)} · {percFaturado.toFixed(1)}%</strong>
                </span>
                <span style={{ color: 'var(--warning)' }}>A Faturar: <strong>{formatCurrency(saldo)}</strong></span>
              </div>
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
          <button onClick={() => setPage(1)} disabled={page === 1} className="btn" style={{ padding: '5px 9px', fontSize: '11px', opacity: page === 1 ? 0.4 : 1, background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}>«</button>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn" style={{ padding: '5px 8px', fontSize: '11px', opacity: page === 1 ? 0.4 : 1, background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)', display: 'flex', alignItems: 'center' }}><ChevronLeft size={13} /></button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => setPage(p)} className="btn" style={{ padding: '5px 10px', fontSize: '11px', background: page === p ? 'var(--primary)' : 'transparent', border: `1px solid ${page === p ? 'var(--primary)' : 'var(--border-color)'}`, color: page === p ? '#fff' : 'var(--text-main)', fontWeight: page === p ? '600' : '400' }}>{p}</button>
          ))}
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn" style={{ padding: '5px 8px', fontSize: '11px', opacity: page === totalPages ? 0.4 : 1, background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)', display: 'flex', alignItems: 'center' }}><ChevronRight size={13} /></button>
          <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="btn" style={{ padding: '5px 9px', fontSize: '11px', opacity: page === totalPages ? 0.4 : 1, background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}>»</button>
        </div>
      )}
    </div>
  );
}
