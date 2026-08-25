"use client";

import { Info } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

export default function InfoTooltip({ title, content }) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const containerRef = useRef(null);
  const closeTimerRef = useRef(null);

  const updatePosition = useCallback(() => {
    if (!containerRef.current || typeof window === 'undefined') return;

    const rect = containerRef.current.getBoundingClientRect();
    const viewportPadding = 10;
    const gap = 10;
    const width = Math.min(260, Math.max(190, window.innerWidth - viewportPadding * 2));
    const hasRoomRight = rect.right + gap + width <= window.innerWidth - viewportPadding;
    const hasRoomLeft = rect.left - gap - width >= viewportPadding;

    let left;
    if (hasRoomRight) left = rect.right + gap;
    else if (hasRoomLeft) left = rect.left - width - gap;
    else left = Math.min(Math.max(viewportPadding, rect.left), window.innerWidth - width - viewportPadding);

    const top = Math.min(
      Math.max(viewportPadding, rect.top - 4),
      Math.max(viewportPadding, window.innerHeight - 120)
    );

    setPosition({ top, left });
  }, []);

  const openTooltip = useCallback(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    updatePosition();
    setIsOpen(true);
  }, [updatePosition]);

  const closeTooltip = useCallback(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => setIsOpen(false), 70);
  }, []);

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

  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

  const popover = isOpen && typeof document !== 'undefined' ? createPortal(
    <div
      role="tooltip"
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        width: 'max-content',
        maxWidth: 'min(260px, calc(100vw - 20px))',
        background: 'rgba(18, 27, 38, 0.96)',
        border: '1px solid rgba(148, 163, 184, 0.18)',
        borderRadius: '6px',
        padding: '0.5rem 0.6rem',
        color: 'var(--text-secondary)',
        fontSize: '11px',
        lineHeight: 1.4,
        boxShadow: '0 8px 22px rgba(0,0,0,0.26)',
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
          event.preventDefault();
          event.stopPropagation();
          openTooltip();
        }}
        role="button"
        tabIndex={0}
        aria-label={title ? `Informações: ${title}` : 'Informações'}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '15px',
          height: '15px',
          color: 'var(--text-secondary)',
          opacity: 0.52,
          cursor: 'help',
          flexShrink: 0,
          transition: 'opacity 0.15s ease',
        }}
      >
        <Info size={12} strokeWidth={1.8} />
      </span>
      {popover}
    </>
  );
}
