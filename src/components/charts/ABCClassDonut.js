"use client";

import { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function ABCClassDonut({ data, allProjects }) {
  const [expandedClass, setExpandedClass] = useState(null);

  if (!data || data.length === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
        Sem dados para Curva ABC.
      </div>
    );
  }

  const formatCurrency = (val) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(val || 0);

  const total = data.reduce((acc, curr) => acc + curr.value, 0);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const { name, value, count, color } = payload[0].payload;
      const perc = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
      return (
        <div style={{
          backgroundColor: 'var(--bg-elevated)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          padding: '1rem',
          fontSize: '12px',
          color: 'var(--text-main)',
          boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
        }}>
          <p style={{ fontWeight: '600', marginBottom: '0.5rem', color }}>{name}</p>
          <p style={{ marginBottom: '0.25rem' }}>Projetos: <strong>{count}</strong></p>
          <p style={{ marginBottom: '0.25rem' }}>Valor Total: <strong>{formatCurrency(value)}</strong></p>
          <p>Participação: <strong>{perc}%</strong></p>
          <p style={{ marginTop: '0.5rem', color: 'var(--text-secondary)', fontSize: '11px' }}>Clique na legenda para ver os projetos</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ width: '100%' }}>

      {/* Donut + Legenda */}
      <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '1rem' }}>
        <div style={{ flex: '0 0 180px', height: '180px' }}>
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

        {/* Legenda Clicável */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {data.map((item) => {
            const perc = total > 0 ? ((item.value / total) * 100).toFixed(1) : 0;
            const isExpanded = expandedClass === item.name;

            return (
              <div key={item.name}>
                <button
                  onClick={() => setExpandedClass(isExpanded ? null : item.name)}
                  style={{
                    width: '100%',
                    display: 'flex',
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
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: item.color, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-main)' }}>{item.name}</span>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: item.color }}>{perc}%</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
                      <span>{item.count} projeto{item.count !== 1 ? 's' : ''}</span>
                      <span>{formatCurrency(item.value)}</span>
                    </div>
                  </div>
                  {isExpanded
                    ? <ChevronUp size={14} color="var(--text-secondary)" />
                    : <ChevronDown size={14} color="var(--text-secondary)" />
                  }
                </button>

                {/* Tabela expandida de projetos desta classe */}
                {isExpanded && item.projects && item.projects.length > 0 && (
                  <div style={{
                    marginTop: '4px',
                    border: `1px solid ${item.color}`,
                    borderRadius: '8px',
                    overflow: 'hidden',
                    animation: 'fadeIn 0.2s ease',
                  }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                      <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                          <th style={{ padding: '0.4rem 0.75rem', textAlign: 'left', fontWeight: '600' }}>#</th>
                          <th style={{ padding: '0.4rem 0.75rem', textAlign: 'left', fontWeight: '600' }}>Projeto</th>
                          <th style={{ padding: '0.4rem 0.75rem', textAlign: 'right', fontWeight: '600' }}>Contrato</th>
                          <th style={{ padding: '0.4rem 0.75rem', textAlign: 'right', fontWeight: '600' }}>% Total</th>
                          <th style={{ padding: '0.4rem 0.75rem', textAlign: 'right', fontWeight: '600' }}>% Faturado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {item.projects.map((p, i) => (
                          <tr key={p.nome} style={{ borderTop: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '0.4rem 0.75rem', color: 'var(--text-secondary)' }}>{i + 1}</td>
                            <td style={{ padding: '0.4rem 0.75rem', color: 'var(--text-main)', fontWeight: '500' }}>{p.nome}</td>
                            <td style={{ padding: '0.4rem 0.75rem', textAlign: 'right', color: 'var(--text-main)' }}>{formatCurrency(p.contratado)}</td>
                            <td style={{ padding: '0.4rem 0.75rem', textAlign: 'right', color: item.color }}>
                              {total > 0 ? ((p.contratado / total) * 100).toFixed(1) : 0}%
                            </td>
                            <td style={{ padding: '0.4rem 0.75rem', textAlign: 'right', color: 'var(--success)' }}>
                              {p.contratado > 0 ? ((p.faturado / p.contratado) * 100).toFixed(1) : 0}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
