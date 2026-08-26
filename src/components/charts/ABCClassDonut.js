"use client";

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { ChevronDown, ChevronUp } from 'lucide-react';

function compactProjectName(value) {
  const text = String(value || '').trim();
  if (!text) return '-';
  const parts = text.split(/[-_\s]+/).filter(Boolean);
  const code = parts.shift() || text;
  const firstNameToken = parts.find((part) => /[A-Za-zÀ-ÿ]/.test(part));
  if (!firstNameToken) return code;
  const shortName = firstNameToken.slice(0, 5).toUpperCase();
  return `${code}-${shortName}`;
}

export default function ABCClassDonut({ data }) {
  const [expandedClass, setExpandedClass] = useState(null);
  const pathname = usePathname();
  const showFullProjectNames = pathname?.startsWith('/projetos');

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
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, 190px) minmax(0, 1fr)', alignItems: 'center', width: '100%', gap: '1rem', minWidth: 0 }}>
        <div style={{ width: '100%', height: '180px', maxWidth: '190px', margin: '0 auto' }}>
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

        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
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
                  gridTemplateColumns: '10px minmax(0, 1fr) auto',
                  alignItems: 'center',
                  gap: '0.55rem',
                  background: isExpanded ? 'rgba(255,255,255,0.035)' : 'transparent',
                  border: `1px solid ${isExpanded ? item.color : 'transparent'}`,
                  borderRadius: '7px',
                  padding: '0.45rem 0.55rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textAlign: 'left',
                }}
              >
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: item.color, display: 'block' }} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '1px', minWidth: 0 }}>
                    <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>{item.name}</span>
                    <span style={{ fontSize: '12px', fontWeight: '600', color: item.color, whiteSpace: 'nowrap' }}>{perc}%</span>
                  </span>
                  <span style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', fontSize: '10px', color: 'var(--text-secondary)', minWidth: 0 }}>
                    <span style={{ whiteSpace: 'nowrap' }}>{item.count} projeto{item.count !== 1 ? 's' : ''}</span>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatCurrency(item.value)}</span>
                  </span>
                </span>
                {isExpanded
                  ? <ChevronUp size={13} color="var(--text-secondary)" />
                  : <ChevronDown size={13} color="var(--text-secondary)" />
                }
              </button>
            );
          })}
        </div>
      </div>

      {expandedItem?.projects?.length > 0 && (
        <div style={{
          marginTop: '0.75rem',
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          border: `1px solid ${expandedItem.color}`,
          borderRadius: '8px',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease',
        }}>
          <div style={{ width: '100%', maxWidth: '100%', overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: '0', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: '10px' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  <th style={{ padding: '0.45rem 0.45rem', textAlign: 'left', fontWeight: '600', width: showFullProjectNames ? '42%' : '26%' }}>Projeto</th>
                  <th style={{ padding: '0.45rem 0.45rem', textAlign: 'right', fontWeight: '600', width: showFullProjectNames ? '26%' : '34%' }}>Contrato</th>
                  <th style={{ padding: '0.45rem 0.45rem', textAlign: 'right', fontWeight: '600', width: '16%' }}>% Total</th>
                  <th style={{ padding: '0.45rem 0.45rem', textAlign: 'right', fontWeight: '600', width: showFullProjectNames ? '16%' : '20%' }}>% Fat.</th>
                </tr>
              </thead>
              <tbody>
                {expandedItem.projects.map((p) => (
                  <tr key={p.nome} style={{ borderTop: '1px solid var(--border-color)' }} title={p.nome}>
                    <td style={{
                      padding: '0.48rem 0.45rem',
                      color: 'var(--text-main)',
                      fontWeight: '600',
                      whiteSpace: showFullProjectNames ? 'normal' : 'nowrap',
                      overflow: showFullProjectNames ? 'visible' : 'hidden',
                      textOverflow: showFullProjectNames ? 'clip' : 'ellipsis',
                      overflowWrap: showFullProjectNames ? 'anywhere' : 'normal',
                      lineHeight: 1.35,
                    }}>{showFullProjectNames ? p.nome : compactProjectName(p.nome)}</td>
                    <td style={{ padding: '0.48rem 0.45rem', textAlign: 'right', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatCurrency(p.contratado)}</td>
                    <td style={{ padding: '0.48rem 0.45rem', textAlign: 'right', color: expandedItem.color, whiteSpace: 'nowrap' }}>
                      {total > 0 ? ((p.contratado / total) * 100).toFixed(1) : 0}%
                    </td>
                    <td style={{ padding: '0.48rem 0.45rem', textAlign: 'right', color: 'var(--success)', whiteSpace: 'nowrap' }}>
                      {p.contratado > 0 ? ((p.faturado / p.contratado) * 100).toFixed(1) : 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style jsx>{`
        @media (max-width: 620px) {
          div:first-child > div:first-child {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
