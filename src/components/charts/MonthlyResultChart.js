"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine
} from 'recharts';

export default function MonthlyResultChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
        Sem dados suficientes.
      </div>
    );
  }

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);

  // Calcula resultado se já não existir
  const processedData = data.map(d => ({
    ...d,
    Resultado: d.Resultado !== undefined ? d.Resultado : (d.Entradas - d.Saídas)
  }));

  // Gradiente dinâmico com base em positivo/negativo seria ideal,
  // mas o Recharts nativo simplifica usando fill. Faremos um AreaChart base.
  return (
    <div style={{ width: '100%', height: '300px', marginTop: '1rem' }}>
      <ResponsiveContainer>
        <ComposedChart
          data={processedData}
          margin={{ top: 20, right: 0, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorResultado" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--info)" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="var(--info)" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
          <XAxis 
            dataKey="label" 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
            dy={10}
          />
          <YAxis 
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
            formatter={(value) => [formatCurrency(value), "Resultado Mês"]}
            labelStyle={{ color: 'var(--text-secondary)', marginBottom: '0.25rem' }}
            itemStyle={{ padding: '2px 0' }}
          />
          <ReferenceLine y={0} stroke="var(--text-secondary)" strokeDasharray="3 3" />
          <Area 
            type="monotone" 
            dataKey="Resultado" 
            stroke="var(--info)" 
            fillOpacity={1} 
            fill="url(#colorResultado)" 
            strokeWidth={3}
            activeDot={{ r: 6 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
