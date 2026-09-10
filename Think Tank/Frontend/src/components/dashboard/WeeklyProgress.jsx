import { useEffect, useMemo, useState } from 'react';
import DateRangePicker from './DateRangePicker';
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

export default function WeeklyProgress({ range, onRangeChange }) {
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
      <div className="card-head">
        <div>
          <h2>Weekly Task Progress</h2>
          <span className="sub">{fmtShort(sow)} – {fmtShort(addDays(sow, 6))}</span>
        </div>
        <div className="right range-holder">
          <DateRangePicker value={range} onApply={onRangeChange} />
        </div>
      </div>

      <div className="card-body" style={{ paddingTop: 0 }}>
        <div className="big-pct">{pct}%</div>
        <div className="pct-line">
          <span>This Week</span>
          <span className={`delta${delta < 0 ? ' down' : ''}`}>{delta >= 0 ? '+' : ''}{delta}%</span>
          <span>· {done} of {total} tasks completed</span>
        </div>
        <div className="pct-chips">
          <span className="chip">{total} total</span>
          <span className="chip green">{done} done</span>
          <span className="chip amber">{total - done} remaining</span>
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
