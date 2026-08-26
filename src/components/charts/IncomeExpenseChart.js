"use client";

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

export default function IncomeExpenseChart({ data }) {
  if (!data || data.length === 0) {
    return <div style={{ height: '320px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>Sem dados suficientes.</div>;
  }

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(val || 0);

  return (
    <div style={{ width: '100%', height: '320px', marginTop: '0.25rem', minWidth: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 6, left: 6, bottom: 0 }} barCategoryGap="16%">
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} dy={8} />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 9, fill: 'var(--text-secondary)' }}
            tickFormatter={formatCurrency}
            width={8}
            mirror
            tickMargin={8}
          />
          <Tooltip
            contentStyle={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-main)', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}
            formatter={(value, name) => [formatCurrency(value), name]}
            labelStyle={{ color: 'var(--text-secondary)', marginBottom: '0.25rem' }}
            itemStyle={{ padding: '2px 0' }}
            cursor={{ fill: 'rgba(255,255,255,0.02)' }}
          />
          <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} iconType="circle" />
          <Bar dataKey="Entradas" name="Entradas" fill="var(--success)" radius={[4, 4, 0, 0]} maxBarSize={46} />
          <Bar dataKey="Saídas" name="Saídas" fill="var(--danger)" radius={[4, 4, 0, 0]} maxBarSize={46} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
