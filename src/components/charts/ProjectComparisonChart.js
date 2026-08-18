"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  LabelList
} from 'recharts';

export default function ProjectComparisonChart({ data, keys, colors, names }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
        Sem dados para comparação.
      </div>
    );
  }

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);
  
  const formatShortCurrency = (val) => {
    if (val === 0) return '';
    const absVal = Math.abs(val);
    const sign = val < 0 ? '-' : '';
    if (absVal >= 1000000) return `${sign}R$ ${(absVal / 1000000).toFixed(1).replace('.', ',')} mi`;
    if (absVal >= 1000) return `${sign}R$ ${(absVal / 1000).toFixed(1).replace('.', ',')} mil`;
    return formatCurrency(val);
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          backgroundColor: 'var(--bg-elevated)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          padding: '1rem',
          fontSize: '12px',
          color: 'var(--text-main)',
          boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
        }}>
          <p style={{ fontWeight: '600', marginBottom: '0.5rem', color: 'var(--primary)' }}>{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color, display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
              <span>{entry.name}:</span>
              <strong>{formatCurrency(entry.value)}</strong>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const CustomYAxisTick = ({ x, y, payload }) => {
    let line1 = payload.value;
    let line2 = '';
    if (line1.length > 24) {
      const splitPoint = line1.substring(0, 24).lastIndexOf(' ');
      if (splitPoint > 0) {
        line1 = payload.value.substring(0, splitPoint);
        line2 = payload.value.substring(splitPoint + 1);
        if (line2.length > 22) line2 = line2.substring(0, 20) + '...';
      } else {
        line1 = payload.value.substring(0, 24);
        line2 = payload.value.substring(24, 44) + '...';
      }
    }

    return (
      <g transform={`translate(${x},${y})`}>
        <text x={-5} y={line2 ? -6 : 4} textAnchor="end" fill="var(--text-main)" fontSize={11}>
          {line1}
        </text>
        {line2 && (
          <text x={-5} y={6} textAnchor="end" fill="var(--text-main)" fontSize={11}>
            {line2}
          </text>
        )}
      </g>
    );
  };

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '350px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 90, left: 30, bottom: 5 }}
          barCategoryGap="20%"
        >
          <XAxis type="number" hide />
          <YAxis 
            type="category"
            dataKey="nome"
            axisLine={false}
            tickLine={false}
            tick={<CustomYAxisTick />}
            width={180}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
          <Legend wrapperStyle={{ fontSize: '12px', color: 'var(--text-main)' }} verticalAlign="top" />
          
          {keys.map((key, index) => (
            <Bar 
              key={key} 
              dataKey={key} 
              name={names[index] || key} 
              fill={colors[index]} 
              radius={[0, 4, 4, 0]} 
            >
              <LabelList 
                dataKey={key} 
                position="right" 
                formatter={(val) => formatShortCurrency(val)} 
                style={{ fill: 'var(--text-secondary)', fontSize: '10px', fontWeight: '500' }} 
              />
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
