"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';

const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
}).format(Number(value) || 0);

function TooltipContent({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-color)',
      borderRadius: '8px',
      padding: '0.75rem 0.85rem',
      boxShadow: '0 14px 32px rgba(0,0,0,0.4)',
      minWidth: '180px',
    }}>
      <strong style={{ display: 'block', color: 'var(--text-main)', fontSize: '12px', marginBottom: '0.45rem' }}>{label}/2026</strong>
      {payload.map((item) => (
        <div key={item.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', fontSize: '11px', marginTop: '0.25rem' }}>
          <span style={{ color: item.color }}>{item.name}</span>
          <strong style={{ color: 'var(--text-main)', whiteSpace: 'nowrap' }}>{formatCurrency(item.value)}</strong>
        </div>
      ))}
    </div>
  );
}

export default function ProjectMonthlyFinancialLineChart({ data = [] }) {
  return (
    <div style={{ width: '100%', height: '300px', minWidth: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 18, left: 10, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} opacity={0.5} />
          <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
          <YAxis axisLine={false} tickLine={false} width={92} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} tickFormatter={formatCurrency} />
          <ReferenceLine y={0} stroke="var(--border-color)" />
          <Tooltip content={<TooltipContent />} />
          <Legend iconType="line" wrapperStyle={{ fontSize: '11px' }} />
          <Line type="monotone" dataKey="Receitas" name="Receita Líquida" stroke="var(--success)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
          <Line type="monotone" dataKey="Custos" name="Custos" stroke="var(--warning)" strokeWidth={2.25} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
          <Line type="monotone" dataKey="Despesas" name="Despesas" stroke="var(--danger)" strokeWidth={2.25} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
          <Line type="monotone" dataKey="Tributos" name="Tributos" stroke="var(--primary)" strokeWidth={2.25} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

