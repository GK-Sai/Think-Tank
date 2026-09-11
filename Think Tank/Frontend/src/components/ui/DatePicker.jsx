import { useEffect, useMemo, useState } from 'react';
import { ChevronDownIcon } from '../../lib/icons';
import { TODAY, ymd, parseYmd } from '../../lib/date';

/**
 * The app's own calendar.
 *
 * `<input type="date">` opens whatever picker the device ships with: on
 * Android that is a teal header, green buttons and a blue circle, on iOS a
 * spinning wheel, on Windows something else again. None of it can be restyled
 * from CSS — `accent-color` reaches the selected day and nothing else — so a
 * date chosen in Think Tank looked like it belonged to a different product,
 * and looked different on every phone in the room.
 *
 * This draws the month itself: blue and white, the same on every device, and
 * it reads back in the format people here actually write dates in.
 *
 * It is a controlled field. `value` and what comes back out of `onChange` are
 * both 'YYYY-MM-DD', which is what the API stores — only the display is
 * DD/MM/YYYY, so nothing downstream has to know this component exists.
 */

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** '01/10/2026' — the format written on paper here, not the ISO one. */
export const fmtDMY = (value) => {
  if (!value) return '';
  const d = parseYmd(value);
  if (Number.isNaN(d.getTime())) return '';
  return [
    String(d.getDate()).padStart(2, '0'),
    String(d.getMonth() + 1).padStart(2, '0'),
    d.getFullYear(),
  ].join('/');
};

const sameDay = (a, b) => a && b
  && a.getFullYear() === b.getFullYear()
  && a.getMonth() === b.getMonth()
  && a.getDate() === b.getDate();

export default function DatePicker({ value, min, onChange, id }) {
  const selected = value ? parseYmd(value) : null;
  const floor = min ? parseYmd(min) : null;

  /* Which month is on screen. It follows the selection when that changes from
     outside — reopening the dialog on a date in March should not leave the
     reader looking at today's month. */
  const [cursor, setCursor] = useState(
    () => new Date((selected || TODAY).getFullYear(), (selected || TODAY).getMonth(), 1),
  );

  useEffect(() => {
    const base = value ? parseYmd(value) : TODAY;
    if (!Number.isNaN(base.getTime())) {
      setCursor(new Date(base.getFullYear(), base.getMonth(), 1));
    }
  }, [value]);

  /* The grid: leading blanks so the 1st falls under its weekday, then the
     days of the month. Trailing blanks are not needed — the grid ends where
     the month does. */
  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const total = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const lead = first.getDay();
    return [
      ...Array.from({ length: lead }, () => null),
      ...Array.from({ length: total }, (_, i) => new Date(cursor.getFullYear(), cursor.getMonth(), i + 1)),
    ];
  }, [cursor]);

  const step = (months) => setCursor(
    (c) => new Date(c.getFullYear(), c.getMonth() + months, 1),
  );

  const headline = selected
    ? `${DAYS_SHORT[selected.getDay()]}, ${String(selected.getDate()).padStart(2, '0')} ${MONTHS[selected.getMonth()].slice(0, 3)}`
    : 'No date set';

  return (
    <div className="tt-cal" id={id}>
      {/* The chosen date, spelled out. Its own line, because the grid below
          shows the month rather than the choice. */}
      <div className="tt-cal-head">
        <span className="tt-cal-year">{selected ? selected.getFullYear() : ''}</span>
        <span className="tt-cal-day">{headline}</span>
      </div>

      <div className="tt-cal-body">
        <div className="tt-cal-nav">
          <button type="button" className="tt-cal-arrow" onClick={() => step(-1)} aria-label="Previous month">
            <ChevronDownIcon />
          </button>
          <span className="tt-cal-month">{MONTHS[cursor.getMonth()]} {cursor.getFullYear()}</span>
          <button type="button" className="tt-cal-arrow next" onClick={() => step(1)} aria-label="Next month">
            <ChevronDownIcon />
          </button>
        </div>

        <div className="tt-cal-grid" role="grid">
          {WEEKDAYS.map((w, i) => (
            <span key={`w${i}`} className="tt-cal-wd" aria-hidden="true">{w}</span>
          ))}

          {cells.map((day, i) => {
            if (!day) return <span key={`b${i}`} className="tt-cal-blank" />;
            const disabled = floor && day < floor;
            const isSel = sameDay(day, selected);
            const isToday = sameDay(day, TODAY);
            return (
              <button
                key={ymd(day)}
                type="button"
                className={`tt-cal-d${isSel ? ' on' : ''}${isToday && !isSel ? ' today' : ''}`}
                disabled={disabled}
                aria-pressed={isSel}
                aria-label={`${day.getDate()} ${MONTHS[day.getMonth()]} ${day.getFullYear()}`}
                onClick={() => onChange(ymd(day))}
              >
                {day.getDate()}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
