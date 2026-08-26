"use client";

import { Info } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

export default function InfoTooltip({ title, content }) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const containerRef = useRef(null);

  const updatePosition = useCallback(() => {
    if (!containerRef.current || typeof window === 'undefined') return;

    const rect = containerRef.current.getBoundingClientRect();
    const viewportPadding = 10;
    const gap = 8;
    const width = Math.min(250, Math.max(180, window.innerWidth - viewportPadding * 2));
    const hasRoomRight = rect.right + gap + width <= window.innerWidth - viewportPadding;
    const hasRoomLeft = rect.left - gap - width >= viewportPadding;

    let left;
    if (hasRoomRight) left = rect.right + gap;
    else if (hasRoomLeft) left = rect.left - width - gap;
    else left = Math.min(Math.max(viewportPadding, rect.left), window.innerWidth - width - viewportPadding);

    const estimatedHeight = 72;
    const top = Math.min(
      Math.max(viewportPadding, rect.top - 2),
      Math.max(viewportPadding, window.innerHeight - estimatedHeight - viewportPadding)
    );

    setPosition({ top, left });
  }, []);

  const openTooltip = useCallback(() => {
    updatePosition();
    setIsOpen(true);
  }, [updatePosition]);

  const closeTooltip = useCallback(() => setIsOpen(false), []);

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

  const popover = isOpen && typeof document !== 'undefined' ? createPortal(
    <div
      role="tooltip"
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        width: 'max-content',
        maxWidth: 'min(250px, calc(100vw - 20px))',
        background: 'rgba(18, 27, 38, 0.97)',
        border: '1px solid rgba(148, 163, 184, 0.14)',
        borderRadius: '6px',
        padding: '0.45rem 0.55rem',
        color: 'var(--text-secondary)',
        fontSize: '10.5px',
        lineHeight: 1.4,
        boxShadow: '0 8px 20px rgba(0,0,0,0.24)',
        zIndex: 2147483000,
        pointerEvents: 'none',
        whiteSpace: 'normal',
      }}
    >
      {content}
    </div>,
    document.body
  ) : null;

  return (
    <>
      <span
        ref={containerRef}
        className="info-tooltip-container"
        onMouseEnter={openTooltip}
        onMouseLeave={closeTooltip}
        onFocus={openTooltip}
        onBlur={closeTooltip}
        onClick={(event) => {
          // Mantém suporte ao toque no celular, mas no desktop a leitura é por hover.
          event.preventDefault();
          event.stopPropagation();
          setIsOpen((current) => !current);
        }}
        role="button"
        tabIndex={0}
        aria-label={title || 'Informação do indicador'}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '13px',
          height: '13px',
          color: 'var(--text-secondary)',
          opacity: 0.34,
          cursor: 'help',
          flexShrink: 0,
          transition: 'opacity 0.15s ease',
        }}
        onMouseOver={(event) => { event.currentTarget.style.opacity = '0.65'; }}
        onMouseOut={(event) => { event.currentTarget.style.opacity = '0.34'; }}
      >
        <Info size={10} strokeWidth={1.7} />
      </span>
      {popover}
    </>
  );
}
