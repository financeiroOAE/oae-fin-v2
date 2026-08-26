"use client";

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, LabelList } from 'recharts';

export default function TopBarChart({ data, dataKey = "valor", nameKey = "nome", color = "var(--primary)" }) {
  if (!data || data.length === 0) {
    return <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>Sem dados suficientes.</div>;
  }

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(val || 0);

  const wrapLabel = (value, maxChars = 30) => {
    const text = String(value || '').trim();
    if (!text) return [''];
    const lines = [];
    let remaining = text;

    while (remaining.length > maxChars) {
      const dash = remaining.lastIndexOf('-', maxChars);
      const space = remaining.lastIndexOf(' ', maxChars);
      let cut = Math.max(dash, space);
      if (cut < 12) cut = maxChars;
      if (remaining[cut] === '-') cut += 1;
      lines.push(remaining.slice(0, cut).trim());
      remaining = remaining.slice(cut).trim();
    }
    if (remaining) lines.push(remaining);
    return lines;
  };

  const CustomYAxisTick = ({ x, y, payload }) => {
    const fullLabel = String(payload?.value || '');
    const lines = wrapLabel(fullLabel, 30);
    const lineHeight = 11;
    const startY = 4 - ((lines.length - 1) * lineHeight) / 2;

    return (
      <g transform={`translate(${x},${y})`}>
        <title>{fullLabel}</title>
        {lines.map((line, index) => (
          <text
            key={`${fullLabel}-${index}`}
            x={-8}
            y={startY + index * lineHeight}
            textAnchor="end"
            fill="var(--text-main)"
            fontSize={10}
            fontWeight={500}
          >
            {line}
          </text>
        ))}
      </g>
    );
  };

  return (
    <div style={{ width: '100%', height: '100%', marginTop: '0.5rem', minWidth: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 128, left: 4, bottom: 5 }} barCategoryGap="22%">
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey={nameKey}
            axisLine={false}
            tickLine={false}
            tick={<CustomYAxisTick />}
            width={238}
            interval={0}
          />
          <Tooltip
            contentStyle={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-main)', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}
            formatter={(value) => [formatCurrency(value), "Valor"]}
            labelFormatter={(label) => String(label || '')}
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
