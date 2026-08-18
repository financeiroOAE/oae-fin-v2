"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

export default function MonthlyFlowChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
        Sem dados suficientes para exibir o gráfico.
      </div>
    );
  }

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);

  return (
    <div style={{ width: '100%', height: '320px', marginTop: '1rem' }}>
      <ResponsiveContainer>
        <ComposedChart
          data={data}
          margin={{ top: 20, right: 0, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
          <XAxis 
            dataKey="mes" 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
            dy={10}
          />
          <YAxis 
            yAxisId="left"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
            tickFormatter={(value) => `R$ ${(value / 1000)}k`}
            dx={-10}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'var(--bg-elevated)', 
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              fontSize: '12px',
              color: 'var(--text-main)',
              boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
            }}
            formatter={(value) => formatCurrency(value)}
            itemStyle={{ padding: '2px 0' }}
          />
          <Legend 
            wrapperStyle={{ fontSize: '12px', paddingTop: '15px' }}
            iconType="circle"
          />
          
          <Bar yAxisId="left" dataKey="Entradas" name="Entradas" fill="var(--success)" radius={[4, 4, 0, 0]} maxBarSize={40} />
          <Bar yAxisId="left" dataKey="Saídas" name="Saídas" fill="var(--danger)" radius={[4, 4, 0, 0]} maxBarSize={40} />
          <Line yAxisId="left" type="monotone" dataKey="Saldo" name="Saldo Acumulado" stroke="var(--info)" strokeWidth={3} dot={{ r: 4, fill: 'var(--info)', strokeWidth: 2, stroke: 'var(--bg-card)' }} activeDot={{ r: 6 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
