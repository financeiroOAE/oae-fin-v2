"use client";

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, LabelList } from 'recharts';

const COLORS = {
  Recebido: 'var(--success)',
  'Custos + Despesas': 'var(--danger)',
  Resultado: 'var(--primary)',
};

const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(Number(value) || 0);

export default function ProjectFinancialOverviewChart({ recebido = 0, saidas = 0, resultado = 0 }) {
  const data = [
    { name: 'Recebido', value: recebido },
    { name: 'Custos + Despesas', value: saidas },
    { name: 'Resultado', value: resultado },
  ];

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const row = payload[0].payload;
    return (
      <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.7rem 0.85rem', boxShadow: '0 12px 28px rgba(0,0,0,0.35)' }}>
        <strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-main)', marginBottom: '0.25rem' }}>{row.name}</strong>
        <span style={{ fontSize: '12px', color: COLORS[row.name] || 'var(--text-main)' }}>{formatCurrency(row.value)}</span>
      </div>
    );
  };

  const ValueLabel = ({ x, y, width, height, value }) => {
    const positive = Number(value) >= 0;
    return (
      <text
        x={positive ? x + width + 8 : x - 8}
        y={y + height / 2 + 4}
        textAnchor={positive ? 'start' : 'end'}
        fill="var(--text-secondary)"
        fontSize={10}
        fontWeight={600}
      >
        {formatCurrency(value)}
      </text>
    );
  };

  return (
    <div style={{ width: '100%', height: '220px', minHeight: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 135, left: 12, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-color)" opacity={0.35} />
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={115} tick={{ fill: 'var(--text-main)', fontSize: 11, fontWeight: 600 }} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.025)' }} />
          <Bar dataKey="value" radius={[5, 5, 5, 5]} maxBarSize={30}>
            {data.map((row) => <Cell key={row.name} fill={COLORS[row.name] || 'var(--primary)'} />)}
            <LabelList dataKey="value" content={<ValueLabel />} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
