import { useEffect, useRef } from 'react';
import { CloseIcon } from '../../lib/icons';

/**
 * Overlay modal. Locks body scroll, closes on Escape and on backdrop click,
 * and restores focus to whatever was focused before it opened.
 */
export default function Modal({
  open, title, subtitle, onClose, children, footer, labelledBy, size,
}) {
  const lastFocused = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    lastFocused.current = document.activeElement;
    document.body.style.overflow = 'hidden';

    const first = panelRef.current?.querySelector('button, input, select, textarea');
    first?.focus();

    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      lastFocused.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="overlay show"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* `size="wide"` is for the dialogs that hold a canvas rather than a
          form — a flowchart squeezed into a 560px column is unusable. */}
      <div className={`modal${size ? ` ${size}` : ''}`} ref={panelRef}>
        <div className="modal-head">
          <div>
            <h3 id={labelledBy} style={{ color: 'var(--blue)' }}>{title}</h3>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}
