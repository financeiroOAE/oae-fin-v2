"use client";

import { Info } from "lucide-react";
import { useState, useRef, useEffect } from "react";

export default function InfoTooltip({ title, content }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  return (
    <div 
      className="info-tooltip-container" 
      ref={containerRef}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button 
        className="btn"
        onClick={(e) => {
          e.preventDefault();
          setIsOpen(!isOpen);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        style={{ 
          background: 'transparent', 
          border: 'none', 
          padding: '4px', 
          color: 'var(--text-secondary)', 
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <Info size={16} />
      </button>
      
      {isOpen && (
        <div className="info-tooltip-popover" style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          width: 'max-content',
          maxWidth: '320px',
          minWidth: '240px',
          backgroundColor: 'var(--bg-elevated)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          padding: '1rem',
          color: 'var(--text-main)',
          fontSize: '12px',
          lineHeight: '1.5',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          marginTop: '0.5rem',
          animation: 'popoverFadeIn 0.2s ease-out'
        }}>
          {title && <h4 style={{ fontSize: '13px', fontWeight: '600', color: 'var(--primary)', marginBottom: '0.25rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>{title}</h4>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', whiteSpace: 'normal' }}>
            {content}
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes popoverFadeIn {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  );
}
