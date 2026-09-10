import { useEffect, useMemo, useRef, useState } from 'react';
import Modal from '../ui/Modal';
import { useApp } from '../../store/AppContext';
import { calClass, effStatus } from '../../lib/format';
import { SearchIcon, ChevronDownIcon } from '../../lib/icons';
import {
  TODAY, MONTHS, DAYS_FULL, ymd, addDays, fmtLong, fmtShort, fmtTime, minutesOfDay, dayOf,
} from '../../lib/date';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/* ---- phone or not ----
   The mobile calendar is a different shape, not a squeezed copy of the
   desktop one, so it is switched in JS rather than hidden with CSS. The
   query matches the 640px breakpoint every other mobile rule uses; above
   it nothing in this file behaves differently from before. */
const PHONE = '(max-width: 640px)';

function useIsPhone() {
  const [phone, setPhone] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(PHONE).matches
  );
  useEffect(() => {
    const mq = window.matchMedia(PHONE);
    const on = (e) => setPhone(e.matches);
    mq.addEventListener ? mq.addEventListener('change', on) : mq.addListener(on);
    setPhone(mq.matches);
    return () => {
      mq.removeEventListener ? mq.removeEventListener('change', on) : mq.removeListener(on);
    };
  }, []);
  return phone;
}

/** Which colour dot a task gets in the compact phone views. Implementation
    milestones keep the purple they have in the legend. */
const dotClass = (t) => (t.milestone ? 'i' : calClass(t));

/* The time grid runs 7am to 9pm — long enough for a working day at either
   end without half the column being empty. */
const DAY_START = 7;
const DAY_END = 21;
const HOURS = Array.from({ length: DAY_END - DAY_START }, (_, i) => DAY_START + i);
const SLOT_H = 46;               // pixels per hour, matched in global.css
const GRID_H = HOURS.length * SLOT_H;

const hourLabel = (h) =>
  `${String(h % 12 || 12)} ${h >= 12 ? 'PM' : 'AM'}`;

/** Where a task sits in the column, and how tall it is. */
function place(task) {
  const mins = minutesOfDay(task.start || task.due);
  const top = ((Math.min(Math.max(mins, DAY_START * 60), DAY_END * 60 - 30) - DAY_START * 60) / 60) * SLOT_H;
  return { top, height: SLOT_H - 6 };
}

/** Two tasks at the same hour sit side by side rather than on top of one
    another — the thing a list view cannot show you. */
function laneOut(tasks) {
  const sorted = [...tasks].sort(
    (a, b) => minutesOfDay(a.start || a.due) - minutesOfDay(b.start || b.due)
  );
  const lanes = [];   // lane index -> end minute of its last task
  return sorted.map((t) => {
    const startM = minutesOfDay(t.start || t.due);
    const endM = startM + 55;
    let lane = lanes.findIndex((end) => end <= startM);
    if (lane === -1) { lane = lanes.length; lanes.push(endM); } else { lanes[lane] = endM; }
    return { task: t, lane };
  }).map((row, _, all) => ({
    ...row,
    lanes: Math.max(...all.map((r) => r.lane)) + 1,
  }));
}

function AgendaRow({ task, onView }) {
  return (
    <div className="ag-row">
      <span className={`bar ${calClass(task)}`} />
      <span className="ag-b">
        <strong>{task.title}</strong>
        <span>{task.dept} · {task.time} · {effStatus(task)}</span>
      </span>
      {onView && <button className="btn-view" onClick={() => onView(task)}>View</button>}
    </div>
  );
}

const BLANK = { query: '', status: 'all', priority: 'all' };

export default function MyTasksCalendar({ onViewTask }) {
  const { myTasks } = useApp();
  const isPhone = useIsPhone();
  /* The month is what you want first: where the work sits across the weeks.
     Day and Week are the zoom-ins, one tap away. */
  const [view, setView] = useState('month');
  const [cursor, setCursor] = useState(new Date(TODAY));
  /* The day whose tasks are listed under the calendar on a phone. It starts
     on today and follows whatever the member taps. */
  const [selected, setSelected] = useState(new Date(TODAY));
  const [dayOpen, setDayOpen] = useState(null);
  const [filters, setFilters] = useState(BLANK);
  /* On a phone the open search field is its own icon button, opening the
     field on tap — the same pattern Think Log uses for its past-log search. */
  const [searchOpen, setSearchOpen] = useState(false);
  const gridRef = useRef(null);

  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }));

  /* Filters apply before the calendar is built, so a filtered-out task
     disappears from the grid rather than leaving an empty chip behind. */
  const visible = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    return myTasks.filter((t) => {
      if (filters.status !== 'all' && effStatus(t) !== filters.status) return false;
      if (filters.priority !== 'all' && (t.priority || 'Medium') !== filters.priority) return false;
      if (!q) return true;
      return `${t.title} ${t.description} ${t.dept}`.toLowerCase().includes(q);
    });
  }, [myTasks, filters]);

  /** date string -> tasks due that day */
  const byDay = useMemo(() => {
    const map = {};
    visible.forEach((t) => { (map[t.due] ||= []).push(t); });
    return map;
  }, [visible]);

  /** date string -> tasks placed on the time grid, by their start time */
  const byStart = useMemo(() => {
    const map = {};
    visible.forEach((t) => {
      const key = dayOf(t.start || t.due) || t.due;
      (map[key] ||= []).push(t);
    });
    return map;
  }, [visible]);

  /* Prev / Next. The selected day travels with the arrows so the list under
     the calendar is never left pointing at a day that is no longer on
     screen: a month step keeps the same date (clamped to the shorter
     month), a week step keeps the same weekday, a day step is a day. */
  const step = (dir) => {
    if (view === 'month') {
      const next = new Date(cursor.getFullYear(), cursor.getMonth() + dir, 1);
      const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      setCursor(next);
      setSelected(new Date(next.getFullYear(), next.getMonth(), Math.min(selected.getDate(), lastDay)));
    } else {
      const n = dir * (view === 'week' ? 7 : 1);
      setCursor(addDays(cursor, n));
      setSelected(addDays(selected, n));
    }
  };

  const goToday = () => { setCursor(new Date(TODAY)); setSelected(new Date(TODAY)); };

  /* Switching view keeps you on the day you were looking at. */
  const switchView = (v) => { setView(v); setCursor(new Date(selected)); };

  /* ---------- title and the days on screen ---------- */
  let title;
  let days = [];
  if (view === 'month') {
    title = `${MONTHS[cursor.getMonth()].slice(0, 3)} ${cursor.getFullYear()}`;
  } else if (view === 'day') {
    title = fmtLong(selected);
    days = [new Date(selected)];
  } else {
    const ws = addDays(cursor, -cursor.getDay());
    days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
    title = `${fmtShort(days[0])} – ${fmtShort(days[6])}`;
  }

  const selKey = ymd(selected);
  /* Tasks listed under the calendar on a phone, earliest first. */
  const selTasks = useMemo(
    () => [...(byDay[selKey] || [])].sort(
      (a, b) => minutesOfDay(a.start || a.due) - minutesOfDay(b.start || b.due)
    ),
    [byDay, selKey]
  );

  /* Open the grid at the working day rather than at 7am. */
  useEffect(() => {
    if (view === 'month' || !gridRef.current) return;
    gridRef.current.scrollTop = Math.max(0, (9 - DAY_START) * SLOT_H - 20);
  }, [view, cursor, selKey]);

  /* ---------- month grid ---------- */
  const cells = useMemo(() => {
    if (view !== 'month') return [];
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const gridStart = addDays(first, -first.getDay());   // grid always starts on Sunday
    return Array.from({ length: 42 }, (_, i) => {
      const day = addDays(gridStart, i);
      const key = ymd(day);
      return {
        key,
        day,
        out: day.getMonth() !== cursor.getMonth(),
        today: key === ymd(TODAY),
        events: byDay[key] || [],
      };
    });
  }, [view, cursor, byDay]);

  /* The red line across today's column, so "now" is visible at a glance. */
  const nowTop = (() => {
    const mins = new Date().getHours() * 60 + new Date().getMinutes();
    if (mins < DAY_START * 60 || mins > DAY_END * 60) return null;
    return ((mins - DAY_START * 60) / 60) * SLOT_H;
  })();

  return (
    <>
      <div className="sec-head mt-head">
        <div>
          <h2>My Tasks</h2>
          <p>
            {visible.length} task{visible.length === 1 ? '' : 's'}
            {visible.length !== myTasks.length && ` of ${myTasks.length}`} on your calendar
          </p>
        </div>
        {/* Mobile-only: a collapsed search icon at the top-right of the
            section header, next to the title. Hidden on desktop, where the
            full search field below stays as it was. */}
        <button
          type="button"
          className={`mt-search-btn${searchOpen ? ' on' : ''}`}
          aria-expanded={searchOpen}
          aria-controls="myTaskSearch"
          aria-label={searchOpen ? 'Hide task search' : 'Search my tasks'}
          title="Search my tasks"
          onClick={() => {
            const next = !searchOpen;
            setSearchOpen(next);
            if (!next) setFilter('query', '');
          }}
        >
          <SearchIcon />
        </button>
      </div>

      <div className="idea-filters mt-filters">
        <div id="myTaskSearch" className={`search-box${searchOpen ? ' open' : ''}`}>
          <SearchIcon />
          <input
            type="search"
            placeholder="Search my tasks"
            aria-label="Search my tasks"
            value={filters.query}
            onChange={(e) => setFilter('query', e.target.value)}
          />
        </div>

        <div className="select-box">
          <select aria-label="Filter by status" value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
            <option value="Overdue">Overdue</option>
            <option value="Re Assign">Re Assign</option>
          </select>
          <ChevronDownIcon />
        </div>

        <div className="select-box">
          <select aria-label="Filter by priority" value={filters.priority} onChange={(e) => setFilter('priority', e.target.value)}>
            <option value="all">All Priorities</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
          <ChevronDownIcon />
        </div>
      </div>

      {/* The view toggle. Same markup on both, but on a phone it is lifted
          into the top bar between Today and the next arrow. */}
      {(() => {
        const views = (
          <div className="cal-views">
            {['day', 'week', 'month'].map((v) => (
              <button
                key={v}
                type="button"
                className={view === v ? 'on' : undefined}
                onClick={() => switchView(v)}
              >
                {v[0].toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        );

        const legend = (
          <div className="cal-legend">
            <span><i className="lg-task" />Tasks</span>
            <span><i className="lg-impl" />Implementation</span>
            <span><i className="lg-reassign" />Re Assign</span>
            <span><i className="lg-done" />Completed</span>
          </div>
        );

        /* ---- phone: one row, no month/year ----
           Prev at the top-left, Today beside it, the Day / Week / Month
           toggle next, and Next pushed out to the top-right. The date the
           title used to carry is now the heading of the task list below,
           where it is actually needed. */
        if (isPhone) {
          return (
            <>
              <div className="cal-top cal-top-m">
                <button type="button" className="cal-arrow" onClick={() => step(-1)} aria-label="Previous">
                  &lsaquo;
                </button>
                <button type="button" className="cal-today" onClick={goToday}>Today</button>
                {views}
                <button type="button" className="cal-arrow" onClick={() => step(1)} aria-label="Next">
                  &rsaquo;
                </button>
              </div>
              <div className="cal-bar cal-bar-m">{legend}</div>
            </>
          );
        }

        /* ---- desktop: exactly as it was ---- */
        return (
          <>
            <div className="cal-top">
              <div className="cal-title">{title}</div>
              <div className="cal-nav">
                <button type="button" onClick={() => step(-1)} aria-label="Previous">&lt;</button>
                <button type="button" onClick={() => step(1)} aria-label="Next">&gt;</button>
                <button type="button" onClick={goToday}>Today</button>
              </div>
            </div>
            <div className="cal-bar">{views}{legend}</div>
          </>
        );
      })()}

      {view === 'month' ? (
        <div className="cal-shell">
          <div className="mcal">
            <div className="cal-head">
              {WEEKDAYS.map((w) => <div key={w}>{w}</div>)}
            </div>
            <div className="cal-body">
              {cells.map((c) => (
                <div
                  className={`cal-cell${c.out ? ' out' : ''}${c.today ? ' today' : ''}${
                    isPhone && c.key === selKey ? ' sel' : ''
                  }`}
                  key={c.key}
                  /* On a phone the whole cell is the target: tapping a date
                     lists that day's tasks below the grid. */
                  role={isPhone ? 'button' : undefined}
                  tabIndex={isPhone ? 0 : undefined}
                  aria-pressed={isPhone ? c.key === selKey : undefined}
                  onClick={isPhone ? () => setSelected(new Date(c.day)) : undefined}
                  onKeyDown={isPhone ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(new Date(c.day)); }
                  } : undefined}
                >
                  {c.events.slice(0, 2).map((t) => (
                    <button
                      key={t.id}
                      className={`chip-ev ${calClass(t)}${t.milestone ? ' milestone' : ''}`}
                      onClick={(e) => { e.stopPropagation(); onViewTask?.(t); }}
                      title={t.title}
                    >
                      {t.title}
                    </button>
                  ))}
                  {c.events.length > 2 && (
                    <button
                      className="chip-more"
                      onClick={(e) => { e.stopPropagation(); setDayOpen(c); }}
                    >
                      +{c.events.length - 2}
                    </button>
                  )}
                  <span className="dnum">{c.day.getDate()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : isPhone && view === 'week' ? (
        /* ---------- the week on a phone ----------
           Seven hour-columns never fitted a phone screen. The week is a
           strip instead: day name, date, and a coloured dot per task, all
           seven across the screen with nothing to scroll. Tapping a day
           lists its tasks underneath. */
        <div className="wstrip" role="group" aria-label="Week">
          {days.map((d) => {
            const key = ymd(d);
            const events = byDay[key] || [];
            return (
              <button
                type="button"
                key={key}
                className={`wday${key === selKey ? ' sel' : ''}${key === ymd(TODAY) ? ' today' : ''}`}
                aria-pressed={key === selKey}
                onClick={() => setSelected(new Date(d))}
              >
                <span className="dw">{DAYS_FULL[d.getDay()].slice(0, 3)}</span>
                <span className="n">{d.getDate()}</span>
                <span className="wdots">
                  {events.slice(0, 4).map((t) => (
                    <i key={t.id} className={`dot ${dotClass(t)}`} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        /* ---------- the real week / day calendar ----------
           Seven columns (or one), an hour rail down the left, and every task
           sitting at the hour it actually starts. */
        <div className={`tgrid-shell ${view}`}>
          <div className="tgrid-head">
            <div className="tgrid-gutter-head" aria-hidden="true" />
            {days.map((d) => {
              const isToday = ymd(d) === ymd(TODAY);
              const count = (byStart[ymd(d)] || []).length;
              return (
                <div className={`tgrid-daycol${isToday ? ' today' : ''}`} key={ymd(d)}>
                  <span className="tg-dow">{DAYS_FULL[d.getDay()].slice(0, 3)}</span>
                  <span className="tg-num">{d.getDate()}</span>
                  {count > 0 && <span className="tg-count">{count}</span>}
                </div>
              );
            })}
          </div>

          <div className="tgrid-body" ref={gridRef}>
            <div className="tgrid-inner" style={{ height: GRID_H }}>
              <div className="tgrid-gutter">
                {HOURS.map((h) => (
                  <div className="tg-hour" key={h} style={{ height: SLOT_H }}>
                    <span>{hourLabel(h)}</span>
                  </div>
                ))}
              </div>

              {days.map((d) => {
                const key = ymd(d);
                const isToday = key === ymd(TODAY);
                const placed = laneOut(byStart[key] || []);
                return (
                  <div className={`tgrid-col${isToday ? ' today' : ''}`} key={key}>
                    {HOURS.map((h) => (
                      <div className="tg-slot" key={h} style={{ height: SLOT_H }} />
                    ))}

                    {isToday && nowTop !== null && (
                      <div className="tg-now" style={{ top: nowTop }} aria-hidden="true" />
                    )}

                    {placed.map(({ task, lane, lanes }) => {
                      const { top, height } = place(task);
                      return (
                        <button
                          key={task.id}
                          type="button"
                          className={`tg-ev ${calClass(task)} p-${(task.priority || 'Medium').toLowerCase()}${task.milestone ? ' milestone' : ''}`}
                          style={{
                            top,
                            height,
                            left: `calc(${(lane / lanes) * 100}% + 3px)`,
                            width: `calc(${100 / lanes}% - 6px)`,
                          }}
                          onClick={() => onViewTask?.(task)}
                          title={`${task.title} — ${fmtTime(task.start || task.due)} · ${effStatus(task)}`}
                        >
                          <strong>{task.title}</strong>
                          <span>{fmtTime(task.start || task.due)}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          {!isPhone && days.every((d) => !(byStart[ymd(d)] || []).length) && (
            <div className="empty">Nothing scheduled in this {view}.</div>
          )}
        </div>
      )}

      {/* ---------- the tapped day's tasks, under the calendar ----------
          Phone only. Whatever the view, the day you last tapped — or today,
          on first open — is spelled out here in full, so the calendar above
          can stay small enough to fit the screen. */}
      {isPhone && (
        <div className="mt-daylist">
          <div className="mt-daylist-head">
            <b>{fmtLong(selected)}</b>
            <span>{selTasks.length} task{selTasks.length === 1 ? '' : 's'}</span>
          </div>

          {selTasks.length ? selTasks.map((t) => (
            <button
              type="button"
              key={t.id}
              className="mt-tcard"
              onClick={() => onViewTask?.(t)}
            >
              <span className={`bar ${dotClass(t)}`} />
              <span className="b">
                <strong>{t.title}</strong>
                <span>
                  {[t.dept, fmtTime(t.start || t.due)].filter(Boolean).join(' · ')}
                </span>
              </span>
              <span className={`pill ${dotClass(t)}`}>
                {t.milestone ? 'Implementation' : effStatus(t)}
              </span>
            </button>
          )) : (
            <div className="mt-empty">Nothing scheduled on this day.</div>
          )}
        </div>
      )}

      <Modal
        open={!!dayOpen}
        title={dayOpen ? fmtLong(dayOpen.day) : ''}
        subtitle={dayOpen ? `${dayOpen.events.length} task${dayOpen.events.length === 1 ? '' : 's'}` : ''}
        onClose={() => setDayOpen(null)}
        labelledBy="dayTitle"
        footer={<button className="btn-ghost" onClick={() => setDayOpen(null)}>Close</button>}
      >
        {dayOpen?.events.map((t) => <AgendaRow key={t.id} task={t} onView={onViewTask} />)}
      </Modal>
    </>
  );
}
