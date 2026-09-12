import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../store/AppContext';
import { TODAY, DAYS, ymd, startOfWeek, addDays, fmtShort } from '../../lib/date';

/** Completed / total per weekday for the seven days starting at `weekStart`. */
function weekBuckets(tasks, weekStart) {
  return Array.from({ length: 7 }, (_, i) => {
    const key = ymd(addDays(weekStart, i));
    const due = tasks.filter((t) => t.due === key);
    return {
      total: due.length,
      done: due.filter((t) => t.status === 'Completed').length,
    };
  });
}

const pctOf = (rows) => {
  const done = rows.reduce((s, r) => s + r.done, 0);
  const total = rows.reduce((s, r) => s + r.total, 0);
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
};

/**
 * The week's progress.
 *
 * The date picker used to live in this card's top-right corner, which left
 * the percentage sitting alone under it with a column of empty card beside
 * it. The picker belongs to the whole dashboard, not to this one card, so it
 * has moved up to the page heading — opposite "Dashboard" — and the room it
 * leaves behind is now doing work: the percentage reads on the title's own
 * line, and the three counts sit where the picker was.
 */
export default function WeeklyProgress() {
  const { myTasks } = useApp();

  // Bars start at 0 and grow on the next frame so the CSS height transition runs.
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const sow = startOfWeek(TODAY);
  const todayIdx = (TODAY.getDay() + 6) % 7;      // chart runs Mon..Sun

  const { thisWeek, delta } = useMemo(() => {
    const current = weekBuckets(myTasks, sow);
    const previous = weekBuckets(myTasks, addDays(sow, -7));
    return {
      thisWeek: current,
      delta: pctOf(current).pct - pctOf(previous).pct,
    };
  }, [myTasks, sow]);

  const { done, total, pct } = pctOf(thisWeek);

  return (
    <div className="card">
      <div className="card-head wp-head">
        <div className="wp-title">
          <h2>Weekly Task Progress</h2>
          <span className="sub">{fmtShort(sow)} – {fmtShort(addDays(sow, 6))}</span>
        </div>
        {/* Beside the title, not under it — the number and the thing it is a
            number of belong on one line. */}
        <div className="big-pct inline">{pct}%</div>
        <div className="right">
          <div className="pct-chips">
            <span className="chip">{total} total</span>
            <span className="chip green">{done} done</span>
            <span className="chip amber">{total - done} remaining</span>
          </div>
        </div>
      </div>

      <div className="card-body" style={{ paddingTop: 0 }}>
        <div className="pct-line">
          <span>This Week</span>
          <span className={`delta${delta < 0 ? ' down' : ''}`}>{delta >= 0 ? '+' : ''}{delta}%</span>
          <span>· {done} of {total} tasks completed</span>
        </div>

        <div className="chart">
          {thisWeek.map((s, i) => {
            const dayPct = s.total ? Math.round((s.done / s.total) * 100) : 0;
            return (
              <div className={`col${i === todayIdx ? ' today' : ''}`} key={DAYS[i]}>
                <span className="val">{dayPct}%</span>
                <span className="track">
                  <span className="fill" style={{ height: grown ? `${dayPct}%` : 0 }} />
                </span>
                <span className="day">{DAYS[i]}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
