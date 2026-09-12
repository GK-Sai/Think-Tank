import { useEffect, useRef, useState } from 'react';
import { CalendarIcon, ChevronDownIcon } from '../../lib/icons';
import useCompact from '../../lib/useCompact';
import { TODAY, ymd, parseYmd, addDays, startOfWeek, fmtShort, fmtLong } from '../../lib/date';

const OPTIONS = [
  ['today', 'Today'],
  ['yesterday', 'Yesterday'],
  ['thisweek', 'This Week'],
  ['lastweek', 'Last Week'],
  ['thismonth', 'This Month'],
  ['lastmonth', 'Last Month'],
  ['custom', 'Custom Range'],
];

/** Resolve a range key into [from, to, label]. */
export function rangeBounds(key, fromValue, toValue) {
  const sow = startOfWeek(TODAY);
  switch (key) {
    case 'today': return [TODAY, TODAY, 'Today'];
    case 'yesterday': return [addDays(TODAY, -1), addDays(TODAY, -1), 'Yesterday'];
    case 'thisweek': return [sow, addDays(sow, 6), 'This Week'];
    case 'lastweek': return [addDays(sow, -7), addDays(sow, -1), 'Last Week'];
    case 'thismonth':
      return [
        new Date(TODAY.getFullYear(), TODAY.getMonth(), 1),
        new Date(TODAY.getFullYear(), TODAY.getMonth() + 1, 0),
        'This Month',
      ];
    case 'lastmonth':
      return [
        new Date(TODAY.getFullYear(), TODAY.getMonth() - 1, 1),
        new Date(TODAY.getFullYear(), TODAY.getMonth(), 0),
        'Last Month',
      ];
    case 'custom': {
      let f = fromValue ? parseYmd(fromValue) : TODAY;
      let t = toValue ? parseYmd(toValue) : TODAY;
      if (f > t) [f, t] = [t, f];        // tolerate a reversed range
      return [f, t, `${fmtShort(f)} – ${fmtShort(t)}`];
    }
    default: return [TODAY, TODAY, 'Today'];
  }
}

export default function DateRangePicker({ value, onApply }) {
  const compact = useCompact();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(value.key);
  const [from, setFrom] = useState(ymd(TODAY));
  const [to, setTo] = useState(ymd(TODAY));
  const wrapRef = useRef(null);

  // Clicking anywhere outside closes the menu without applying.
  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = () => {
    setPending(value.key);
    setOpen((v) => !v);
  };

  const applyKey = (key, f0 = from, t0 = to) => {
    const [f, t, label] = rangeBounds(key, f0, t0);
    onApply({ key, from: f, to: t, label });
    setOpen(false);
  };

  const apply = () => applyKey(pending);

  /**
   * A named range is one tap.
   *
   * Today, Yesterday, This Week and the rest are a single unambiguous choice
   * — there is nothing half-picked about them — so making the reader confirm
   * with Apply spent a second tap on a decision that takes one tap to undo.
   * They apply on touch and the menu closes.
   *
   * Custom Range is the exception, and keeps Cancel and Apply: a range is two
   * dates, and redrawing the page the moment the first one is chosen would
   * show a range nobody asked for.
   */
  const choose = (key) => {
    setPending(key);
    /* Phone and tablet only. On a laptop the menu behaves as it always did:
       pick, then Apply. */
    if (compact && key !== 'custom') applyKey(key);
  };

  const triggerLabel = value.key === 'today' ? fmtLong(TODAY) : value.label;

  return (
    <div className={`range${open ? ' open' : ''}`} ref={wrapRef}>
      {/* On a phone the label is hidden and only the calendar icon is left, so
          the button has to say in its name what the icon means and which
          range is showing. */}
      <button
        className="range-trigger"
        onClick={toggle}
        aria-haspopup="true"
        aria-expanded={open}
        title={`Date range: ${triggerLabel}`}
        aria-label={`Change date range — showing ${triggerLabel}`}
      >
        <span className="cal" aria-hidden="true"><CalendarIcon /></span>
        <span className="range-value">{triggerLabel}</span>
        <ChevronDownIcon className="chev" />
      </button>

      <div className="range-menu" role="menu">
        {OPTIONS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="menuitem"
            className={`range-opt${pending === key ? ' selected' : ''}`}
            onClick={() => choose(key)}
          >
            {label}
          </button>
        ))}

        <div className={`custom-range${pending === 'custom' ? ' show' : ''}`}>
          <label>From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label>To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        </div>

        {/* On a phone only the custom range needs confirming — see `choose`.
            On a laptop every choice does, as before. */}
        {(!compact || pending === 'custom') && (
          <div className="range-actions">
            <button type="button" className="btn-cancel" onClick={() => setOpen(false)}>Cancel</button>
            <button type="button" className="btn-apply" onClick={apply}>Apply</button>
          </div>
        )}
      </div>
    </div>
  );
}
