"use client";

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, LabelList } from 'recharts';

export default function TopBarChart({ data, dataKey = "valor", nameKey = "nome", color = "var(--primary)" }) {
  if (!data || data.length === 0) {
    return <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>Sem dados suficientes.</div>;
  }

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(val || 0);

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
        <text x={-5} y={line2 ? -6 : 4} textAnchor="end" fill="var(--text-main)" fontSize={11}>{line1}</text>
        {line2 && <text x={-5} y={6} textAnchor="end" fill="var(--text-main)" fontSize={11}>{line2}</text>}
      </g>
    );
  };

  return (
    <div style={{ width: '100%', height: '100%', marginTop: '0.5rem' }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 150, left: 0, bottom: 5 }} barCategoryGap="25%">
          <XAxis type="number" hide />
          <YAxis type="category" dataKey={nameKey} axisLine={false} tickLine={false} tick={<CustomYAxisTick />} width={160} />
          <Tooltip
            contentStyle={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-main)', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}
            formatter={(value) => [formatCurrency(value), "Valor"]}
            cursor={{ fill: 'rgba(255,255,255,0.02)' }}
          />
          <Bar dataKey={dataKey} radius={[0, 4, 4, 0]} minPointSize={2} maxBarSize={20}>
            {data.map((entry, index) => <Cell key={`cell-${index}`} fill={color} />)}
            <LabelList dataKey={dataKey} position="right" formatter={(val) => val ? formatCurrency(val) : ''} style={{ fill: 'var(--text-secondary)', fontSize: '10px', fontWeight: '500' }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
