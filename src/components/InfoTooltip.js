"use client";

import { Info } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

export default function InfoTooltip({ title, content }) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, below: false });
  const containerRef = useRef(null);
  const popoverRef = useRef(null);
  const closeTimerRef = useRef(null);

  const updatePosition = useCallback(() => {
    if (!containerRef.current || typeof window === 'undefined') return;
    const rect = containerRef.current.getBoundingClientRect();
    const width = Math.min(320, Math.max(240, window.innerWidth - 24));
    const left = Math.min(
      Math.max(12, rect.right - width),
      Math.max(12, window.innerWidth - width - 12)
    );
    const below = rect.top < 190;
    setPosition({
      top: below ? rect.bottom + 8 : rect.top - 8,
      left,
      below,
    });
  }, []);

  const openTooltip = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    updatePosition();
    setIsOpen(true);
  };

  const scheduleClose = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => setIsOpen(false), 120);
  };

  useEffect(() => {
    if (!isOpen) return undefined;
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      const insideTrigger = containerRef.current?.contains(event.target);
      const insidePopover = popoverRef.current?.contains(event.target);
      if (!insideTrigger && !insidePopover) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  const popover = isOpen && typeof document !== 'undefined' ? createPortal(
    <div
      ref={popoverRef}
      className="info-tooltip-popover"
      onMouseEnter={openTooltip}
      onMouseLeave={scheduleClose}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        transform: position.below ? 'none' : 'translateY(-100%)',
        width: 'max-content',
        maxWidth: 'min(320px, calc(100vw - 24px))',
        minWidth: 'min(240px, calc(100vw - 24px))',
        backgroundColor: 'var(--bg-elevated)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        padding: '1rem',
        color: 'var(--text-main)',
        fontSize: '12px',
        lineHeight: '1.5',
        boxShadow: '0 14px 34px rgba(0,0,0,0.45)',
        zIndex: 2147483000,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        pointerEvents: 'auto'
      }}
    >
      {title && (
        <h4 style={{ fontSize: '13px', fontWeight: '600', color: 'var(--primary)', margin: 0, borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
          {title}
        </h4>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', whiteSpace: 'normal' }}>
        {content}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <div
        className="info-tooltip-container"
        ref={containerRef}
        style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
        onMouseEnter={openTooltip}
        onMouseLeave={scheduleClose}
      >
        <button
          type="button"
          className="btn"
          aria-label={title ? `Informações: ${title}` : 'Informações'}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!isOpen) updatePosition();
            setIsOpen((open) => !open);
          }}
          onFocus={openTooltip}
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
      </div>
      {popover}
    </>
  );
}
