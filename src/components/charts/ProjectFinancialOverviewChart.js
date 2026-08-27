"use client";

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ReferenceLine } from 'recharts';

const COLORS = {
  Recebido: 'var(--success)',
  'Custos + Despesas': 'var(--danger)',
  Tributos: 'var(--warning)',
  Resultado: 'var(--primary)',
};

const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(Number(value) || 0);

export default function ProjectFinancialOverviewChart({ recebido = 0, saidas = 0, tributos = 0, resultado = 0 }) {
  const data = [
    { name: 'Recebido', value: recebido },
    { name: 'Custos + Despesas', value: saidas },
    { name: 'Tributos', value: tributos },
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

  const formatAxis = (value) => {
    const abs = Math.abs(Number(value) || 0);
    if (abs >= 1_000_000) return `${(Number(value) / 1_000_000).toFixed(1).replace('.', ',')} mi`;
    if (abs >= 1_000) return `${(Number(value) / 1_000).toFixed(0)} mil`;
    return String(Math.round(Number(value) || 0));
  };

  return (
    <div style={{ width: '100%', height: '250px', minHeight: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 10, right: 18, left: 8, bottom: 24 }} barCategoryGap="28%">
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-color)" opacity={0.3} />
          <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} tickFormatter={formatAxis} />
          <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={118} tick={{ fill: 'var(--text-main)', fontSize: 11, fontWeight: 650 }} />
          <ReferenceLine x={0} stroke="var(--border-color)" strokeWidth={1} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.025)' }} />
          <Bar dataKey="value" radius={[6, 6, 6, 6]} maxBarSize={34}>
            {data.map((row) => <Cell key={row.name} fill={COLORS[row.name] || 'var(--primary)'} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
