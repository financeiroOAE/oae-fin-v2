"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ReferenceLine,
  LabelList
} from 'recharts';

export default function DivergingResultChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
        Sem dados para comparação.
      </div>
    );
  }

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);
  
  const formatShortCurrency = (val) => {
    if (!val && val !== 0) return '';
    const absVal = Math.abs(val);
    const sign = val < 0 ? '-' : '';
    if (absVal >= 1000000) return `${sign}R$ ${(absVal / 1000000).toFixed(1).replace('.', ',')} mi`;
    if (absVal >= 1000) return `${sign}R$ ${(absVal / 1000).toFixed(1).replace('.', ',')} mil`;
    return formatCurrency(val);
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
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
          <p style={{ fontWeight: '600', marginBottom: '0.75rem', color: 'var(--primary)' }}>{label}</p>
          <p style={{ color: 'var(--success)', display: 'flex', justifyContent: 'space-between', gap: '1.5rem', marginBottom: '0.25rem' }}>
            <span>Recebido (Entradas):</span>
            <strong>{formatCurrency(dataPoint.Recebido)}</strong>
          </p>
          <p style={{ color: 'var(--danger)', display: 'flex', justifyContent: 'space-between', gap: '1.5rem', marginBottom: '0.5rem' }}>
            <span>Pago (Saídas):</span>
            <strong>{formatCurrency(dataPoint.Pago)}</strong>
          </p>
          <div style={{ height: '1px', background: 'var(--border-color)', margin: '0.5rem 0' }} />
          <p style={{ color: dataPoint.Resultado >= 0 ? 'var(--success)' : 'var(--danger)', display: 'flex', justifyContent: 'space-between', gap: '1.5rem', fontWeight: '600' }}>
            <span>Resultado Caixa:</span>
            <span>{formatCurrency(dataPoint.Resultado)}</span>
          </p>
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

  const DivergingLabel = (props) => {
    const { x, y, width, height, value } = props;
    if (value === undefined || value === null) return null;
    const isNegative = value < 0;
    
    // For negative values, x is the left edge of the bar. For positive, x+width is the right edge.
    const labelX = isNegative ? x - 5 : x + width + 5;
    const anchor = isNegative ? 'end' : 'start';
    
    return (
      <text x={labelX} y={y + height / 2 + 4} fill={isNegative ? 'var(--danger)' : 'var(--success)'} fontSize={10} fontWeight="600" textAnchor={anchor}>
        {formatShortCurrency(value)}
      </text>
    );
  };

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '400px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 10, right: 60, left: 20, bottom: 5 }}
          barSize={20}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="var(--border-color)" opacity={0.3} />
          <XAxis type="number" hide />
          <YAxis 
            type="category"
            dataKey="nome"
            axisLine={false}
            tickLine={false}
            tick={<CustomYAxisTick />}
            width={180}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          
          <ReferenceLine x={0} stroke="var(--border-color)" strokeWidth={2} />

          <Bar dataKey="Resultado" radius={[4, 4, 4, 4]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.Resultado >= 0 ? 'var(--success)' : 'var(--danger)'} />
            ))}
            <LabelList dataKey="Resultado" content={<DivergingLabel />} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
