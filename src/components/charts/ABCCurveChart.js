"use client";

import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell, ReferenceLine } from 'recharts';

export default function ABCCurveChart({ data }) {
  if (!data || data.length === 0) {
    return <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>Sem dados suficientes para Curva ABC.</div>;
  }

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(val || 0);
  const formatPercent = (val) => `${Number(val || 0).toFixed(1)}%`;
  const getBarColor = (classe) => classe === 'A' ? 'var(--success)' : classe === 'B' ? 'var(--warning)' : classe === 'C' ? 'var(--danger)' : 'var(--primary)';

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const dataPoint = payload[0].payload;
    return (
      <div style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem', fontSize: '12px', color: 'var(--text-main)', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
        <p style={{ fontWeight: '600', marginBottom: '0.5rem', color: 'var(--primary)' }}>{dataPoint.nomeOriginal || label}</p>
        <p style={{ color: 'var(--text-secondary)' }}>Classe: <strong style={{ color: getBarColor(dataPoint.classe) }}>{dataPoint.classe}</strong></p>
        <p>Valor Contratado: <strong>{formatCurrency(dataPoint.valor)}</strong></p>
        <p>Participação: <strong>{formatPercent(dataPoint.percentual)}</strong></p>
        <p>Acumulado: <strong>{formatPercent(dataPoint.percentualAcumulado)}</strong></p>
      </div>
    );
  };

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '300px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 20, right: 100, bottom: 20, left: 115 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
          <XAxis dataKey="nome" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} interval={0} angle={-35} textAnchor="end" height={70} />
          <YAxis yAxisId="left" tickFormatter={formatCurrency} width={120} tick={{ fontSize: 9, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="right" orientation="right" tickFormatter={formatPercent} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} domain={[0, 100]} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
          <Legend wrapperStyle={{ fontSize: '12px', marginTop: '10px', color: 'var(--text-main)' }} verticalAlign="top" />
          <ReferenceLine y={80} yAxisId="right" stroke="var(--warning)" strokeDasharray="4 4" label={{ position: 'top', value: '80%', fill: 'var(--warning)', fontSize: 10 }} />
          <ReferenceLine y={95} yAxisId="right" stroke="var(--danger)" strokeDasharray="4 4" label={{ position: 'top', value: '95%', fill: 'var(--danger)', fontSize: 10 }} />
          <Bar yAxisId="left" dataKey="valor" name="Valor Contratado" radius={[4, 4, 0, 0]} maxBarSize={40}>{data.map((entry, index) => <Cell key={`cell-${index}`} fill={getBarColor(entry.classe)} />)}</Bar>
          <Line yAxisId="right" type="monotone" dataKey="percentualAcumulado" name="% Acumulado" stroke="var(--primary)" strokeWidth={3} dot={{ r: 4, fill: 'var(--bg-main)', strokeWidth: 2 }} activeDot={{ r: 6 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
