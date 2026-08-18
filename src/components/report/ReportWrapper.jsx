"use client";

import React from "react";
import { useReport } from "@/contexts/ReportContext";
import { PlusCircle } from "lucide-react";

export default function ReportWrapper({ children, title, componentName, page, data, filters, type = "GENERAL", style = {} }) {
  const { isReportMode, addReportItem } = useReport();

  if (!isReportMode) {
    return <div style={style}>{children}</div>;
  }

  const handleAdd = (e) => {
    e.stopPropagation();
    addReportItem({ title, componentName, page, data, filters, type });
  };

  return (
    <div style={{ 
      position: 'relative', 
      border: '2px dashed var(--primary)', 
      borderRadius: '8px', 
      padding: '4px',
      margin: '-4px',
      transition: 'all 0.2s',
      cursor: 'pointer',
      ...style 
    }}
    onClick={handleAdd}
    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.05)'}
    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
    >
      <div style={{ position: 'absolute', top: '-12px', right: '-12px', zIndex: 10 }}>
        <button 
          style={{ 
            background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '50%', 
            width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)', cursor: 'pointer'
          }}
          title="Adicionar ao Relatório"
        >
          <PlusCircle size={20} />
        </button>
      </div>
      <div style={{ pointerEvents: 'none' }}>
        {children}
      </div>
    </div>
  );
}
