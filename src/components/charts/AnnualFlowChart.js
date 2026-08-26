"use client";

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

export default function AnnualFlowChart({ data }) {
  if (!data || data.length === 0) {
    return <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>Sem dados suficientes para o ano de 2026.</div>;
  }

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(val || 0);

  return (
    <div style={{ width: '100%', height: '300px', marginTop: '1rem' }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 20, right: 10, left: 85, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
          <XAxis dataKey="mesNome" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} dy={10} />
          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} tickFormatter={formatCurrency} width={105} />
          <Tooltip contentStyle={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-main)', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }} formatter={(value, name) => [formatCurrency(value), name]} labelStyle={{ color: 'var(--text-secondary)', marginBottom: '0.25rem' }} itemStyle={{ padding: '2px 0' }} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
          <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '15px' }} iconType="circle" />
          <Bar dataKey="Entradas Realizadas" name="Entradas Realizadas (líquidas)" fill="var(--success)" radius={[4, 4, 0, 0]} maxBarSize={30} />
          <Bar dataKey="Entradas Programadas" name="Entradas Programadas (títulos a receber)" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={30} />
          <Bar dataKey="Saídas" name="Saídas" fill="var(--danger)" radius={[4, 4, 0, 0]} maxBarSize={30} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
