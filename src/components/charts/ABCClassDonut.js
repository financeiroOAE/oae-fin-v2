"use client";

import { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function ABCClassDonut({ data }) {
  const [expandedClass, setExpandedClass] = useState(null);

  if (!data || data.length === 0) {
    return (
      <div style={{ minHeight: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
        Sem dados para Curva ABC.
      </div>
    );
  }

  const formatCurrency = (val) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(val || 0);

  const total = data.reduce((acc, curr) => acc + curr.value, 0);
  const expandedItem = data.find((item) => item.name === expandedClass);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const { name, value, count, color } = payload[0].payload;
      const perc = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
      return (
        <div style={{
          backgroundColor: 'var(--bg-elevated)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          padding: '0.8rem',
          fontSize: '12px',
          color: 'var(--text-main)',
          boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
        }}>
          <p style={{ fontWeight: '600', marginBottom: '0.4rem', color }}>{name}</p>
          <p style={{ marginBottom: '0.2rem' }}>Projetos: <strong>{count}</strong></p>
          <p style={{ marginBottom: '0.2rem' }}>Valor Total: <strong>{formatCurrency(value)}</strong></p>
          <p>Participação: <strong>{perc}%</strong></p>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ width: '100%', minWidth: 0, maxWidth: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '1rem', flexWrap: 'wrap', minWidth: 0 }}>
        <div style={{ flex: '0 0 180px', height: '180px', maxWidth: '100%', margin: '0 auto' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                innerRadius={50}
                outerRadius={75}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div style={{ flex: '1 1 260px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {data.map((item) => {
            const perc = total > 0 ? ((item.value / total) * 100).toFixed(1) : 0;
            const isExpanded = expandedClass === item.name;

            return (
              <button
                key={item.name}
                onClick={() => setExpandedClass(isExpanded ? null : item.name)}
                style={{
                  width: '100%',
                  minWidth: 0,
                  display: 'grid',
                  gridTemplateColumns: '12px minmax(0, 1fr) auto',
                  alignItems: 'center',
                  gap: '0.75rem',
                  background: isExpanded ? 'rgba(255,255,255,0.04)' : 'transparent',
                  border: `1px solid ${isExpanded ? item.color : 'transparent'}`,
                  borderRadius: '8px',
                  padding: '0.6rem 0.75rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textAlign: 'left',
                }}
              >
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: item.color, display: 'block' }} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '2px', minWidth: 0 }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>{item.name}</span>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: item.color, whiteSpace: 'nowrap' }}>{perc}%</span>
                  </span>
                  <span style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', fontSize: '11px', color: 'var(--text-secondary)', minWidth: 0 }}>
                    <span style={{ whiteSpace: 'nowrap' }}>{item.count} projeto{item.count !== 1 ? 's' : ''}</span>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatCurrency(item.value)}</span>
                  </span>
                </span>
                {isExpanded
                  ? <ChevronUp size={14} color="var(--text-secondary)" />
                  : <ChevronDown size={14} color="var(--text-secondary)" />
                }
              </button>
            );
          })}
        </div>
      </div>

      {expandedItem?.projects?.length > 0 && (
        <div style={{
          marginTop: '0.9rem',
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          border: `1px solid ${expandedItem.color}`,
          borderRadius: '8px',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease',
        }}>
          <div style={{ width: '100%', maxWidth: '100%', overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: '620px', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  <th style={{ padding: '0.5rem 0.65rem', textAlign: 'left', fontWeight: '600', width: '42px' }}>#</th>
                  <th style={{ padding: '0.5rem 0.65rem', textAlign: 'left', fontWeight: '600' }}>Projeto</th>
                  <th style={{ padding: '0.5rem 0.65rem', textAlign: 'right', fontWeight: '600', whiteSpace: 'nowrap' }}>Contrato</th>
                  <th style={{ padding: '0.5rem 0.65rem', textAlign: 'right', fontWeight: '600', whiteSpace: 'nowrap' }}>% Total</th>
                  <th style={{ padding: '0.5rem 0.65rem', textAlign: 'right', fontWeight: '600', whiteSpace: 'nowrap' }}>% Faturado</th>
                </tr>
              </thead>
              <tbody>
                {expandedItem.projects.map((p, i) => (
                  <tr key={p.nome} style={{ borderTop: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.55rem 0.65rem', color: 'var(--text-secondary)' }}>{i + 1}</td>
                    <td style={{ padding: '0.55rem 0.65rem', color: 'var(--text-main)', fontWeight: '500', overflowWrap: 'anywhere' }}>{p.nome}</td>
                    <td style={{ padding: '0.55rem 0.65rem', textAlign: 'right', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>{formatCurrency(p.contratado)}</td>
                    <td style={{ padding: '0.55rem 0.65rem', textAlign: 'right', color: expandedItem.color, whiteSpace: 'nowrap' }}>
                      {total > 0 ? ((p.contratado / total) * 100).toFixed(1) : 0}%
                    </td>
                    <td style={{ padding: '0.55rem 0.65rem', textAlign: 'right', color: 'var(--success)', whiteSpace: 'nowrap' }}>
                      {p.contratado > 0 ? ((p.faturado / p.contratado) * 100).toFixed(1) : 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
