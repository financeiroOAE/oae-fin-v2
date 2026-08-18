import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

export default function TopPieChart({ data, color }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
        Sem dados suficientes
      </div>
    );
  }

  // Pre-generate slightly varying shades of the base color if we have many items
  const COLORS = data.map((_, index) => {
    // A simple opacity scale based on the index to differentiate slices
    const opacity = 1 - (index * 0.08);
    const alpha = Math.max(opacity, 0.2).toFixed(2);
    // Parse the css variable or hex (assuming color is 'var(--success)' etc or HEX)
    // For simplicity, since recharts can take rgba, we'll try to just pass opacity or rely on recharts fillOpacity
    return color;
  });

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', padding: '0.75rem', borderRadius: '8px', boxShadow: 'var(--shadow-md)', zIndex: 1000, maxWidth: '280px' }}>
          <p style={{ margin: 0, fontWeight: '600', fontSize: '13px', color: 'var(--text-main)', marginBottom: '0.25rem' }}>{payload[0].name}</p>
          <p style={{ margin: 0, color: payload[0].payload.fill, fontWeight: '500', fontSize: '13px' }}>
            Valor: {formatCurrency(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  const renderLegendText = (value) => {
    return <span style={{ color: 'var(--text-main)', fontSize: '11px' }}>{value.length > 25 ? value.substring(0, 25) + '...' : value}</span>;
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          dataKey="value"
          nameKey="nome"
          stroke="var(--bg-card)"
          strokeWidth={2}
        >
          {data.map((entry, index) => {
            // Generating nice palette based on primary color to avoid dark slices
            let sliceFill = color;
            if (color === "var(--success)") {
              const opacities = ["#10b981", "#059669", "#047857", "#34d399", "#6ee7b7", "#a7f3d0", "#059669", "#10b981", "#34d399", "#047857"];
              sliceFill = opacities[index % opacities.length];
            } else if (color === "var(--danger)") {
              const opacities = ["#ef4444", "#dc2626", "#b91c1c", "#f87171", "#fca5a5", "#fecaca", "#dc2626", "#ef4444", "#f87171", "#b91c1c"];
              sliceFill = opacities[index % opacities.length];
            }
            return (
              <Cell 
                key={`cell-${index}`} 
                fill={sliceFill}
              />
            )
          })}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ paddingLeft: '20px' }} formatter={renderLegendText} />
      </PieChart>
    </ResponsiveContainer>
  );
}
