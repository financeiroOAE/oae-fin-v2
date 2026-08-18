"use client";

import InfoTooltip from "../InfoTooltip";

export default function ChartHeader({ title, subtitle, infoTitle, infoContent, action }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)', margin: 0 }}>
            {title}
          </h2>
          {infoContent && (
            <InfoTooltip title={infoTitle || title} content={infoContent} />
          )}
        </div>
        {subtitle && (
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            {subtitle}
          </p>
        )}
      </div>
      {action && (
        <div style={{ marginLeft: '1rem' }}>
          {action}
        </div>
      )}
    </div>
  );
}
