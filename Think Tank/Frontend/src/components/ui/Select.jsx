import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDownIcon } from '../../lib/icons';

/**
 * A dropdown the app draws itself.
 *
 * A native `<select>` hands the list to the operating system, and the
 * operating system does what it likes with it: Android picks the direction
 * from the room below the control — on the Think Log filters that meant the
 * list opened *upward*, over the heading and the Jump to Today button — and it
 * ignores the page's font size, so a small control opened an oversized list.
 * None of that is reachable from CSS. The same reason the date picker had to
 * stop being a native one.
 *
 * So this draws the list. It opens downward, at the size the page asks for,
 * and looks the same on a phone, a tablet and a laptop. It flips upward only
 * when there is genuinely not enough room below and more room above — which on
 * these screens is rare, and is the one case where opening down would put the
 * options off the bottom of the glass.
 *
 * It is a drop-in for the `<select>` it replaces: same value in, same value
 * out, and it keeps the `select-box` class so the layout rules that size these
 * controls still apply.
 *
 * `options` is `[{ value, label }]`. `onChange` is handed the value itself
 * rather than an event, because there is no event to hand it.
 */
export default function Select({
  value,
  onChange,
  options = [],
  label,
  className = '',
  id,
}) {
  const [open, setOpen] = useState(false);
  const [drop, setDrop] = useState('down');
  const [cap, setCap] = useState(null);
  const [active, setActive] = useState(0);
  const wrapRef = useRef(null);
  const listRef = useRef(null);

  const chosen = options.find((o) => o.value === value);
  const shown = chosen ? chosen.label : (options[0]?.label ?? '');

  /* Down unless the list genuinely will not fit and there is more room above.
     Measured against the real list once it has rendered, not guessed from a
     fixed height — these lists run from three options to a dozen. */
  const MIN_ROOM = 132;   // about three options — below this, down is useless

  useLayoutEffect(() => {
    if (!open) return;
    const box = wrapRef.current?.getBoundingClientRect();
    if (!box) return;
    const below = window.innerHeight - box.bottom - 12;
    const above = box.top - 12;

    /* Down is the rule, not the preference. Where the list is taller than the
       room under it, it is shortened and scrolls rather than jumping above the
       control — a menu that opens over the heading you were reading is worse
       than one you scroll two lines. Up is kept for the one case down cannot
       serve: a control sitting almost on the bottom edge of the screen. */
    if (below < MIN_ROOM && above > below) {
      setDrop('up');
      setCap(Math.max(MIN_ROOM, Math.min(260, above)));
    } else {
      setDrop('down');
      setCap(Math.max(MIN_ROOM, Math.min(260, below)));
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    /* Closing on scroll rather than following the control: the list is
       anchored to a button that has just moved, and a menu that hangs in the
       air over the page while you scroll is worse than one that closes. */
    const onScroll = () => setOpen(false);
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('touchstart', onDocClick);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('touchstart', onDocClick);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  const pick = useCallback((v) => {
    onChange(v);
    setOpen(false);
  }, [onChange]);

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { setOpen(false); return; }
    if (!open && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown')) {
      e.preventDefault();
      setActive(Math.max(0, options.findIndex((o) => o.value === value)));
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (options[active]) pick(options[active].value);
    }
  };

  return (
    <div className={`select-box tt-select${open ? ' open' : ''} ${className}`} ref={wrapRef}>
      <button
        type="button"
        id={id}
        className="tt-select-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => {
          setActive(Math.max(0, options.findIndex((o) => o.value === value)));
          setOpen((v) => !v);
        }}
        onKeyDown={onKeyDown}
      >
        <span className="tt-select-value">{shown}</span>
        <ChevronDownIcon />
      </button>

      {open && (
        <ul
          className={`tt-select-list ${drop}`}
          role="listbox"
          ref={listRef}
          aria-label={label}
          style={cap ? { maxHeight: cap } : undefined}
        >
          {options.map((o, i) => (
            <li key={o.value}>
              <button
                type="button"
                role="option"
                aria-selected={o.value === value}
                className={`tt-select-opt${o.value === value ? ' on' : ''}${i === active ? ' active' : ''}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(o.value)}
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
