"use client";

import { ResponsiveContainer, ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';

export default function MonthlyResultChart({ data }) {
  if (!data || data.length === 0) {
    return <div style={{ height: '320px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>Sem dados suficientes.</div>;
  }

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(val || 0);

  const processedData = data.map(d => ({ ...d, Resultado: d.Resultado !== undefined ? d.Resultado : (d.Entradas - d.Saídas) }));

  return (
    <div style={{ width: '100%', height: '320px', marginTop: '0.25rem', minWidth: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={processedData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorResultado" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--info)" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="var(--info)" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} dy={10} />
          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} tickFormatter={formatCurrency} width={96} />
          <Tooltip contentStyle={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-main)', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }} formatter={(value) => [formatCurrency(value), "Resultado Mês"]} labelStyle={{ color: 'var(--text-secondary)', marginBottom: '0.25rem' }} itemStyle={{ padding: '2px 0' }} />
          <ReferenceLine y={0} stroke="var(--text-secondary)" strokeDasharray="3 3" />
          <Area type="monotone" dataKey="Resultado" stroke="var(--info)" fillOpacity={1} fill="url(#colorResultado)" strokeWidth={3} activeDot={{ r: 6 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
