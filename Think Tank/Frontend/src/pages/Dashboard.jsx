import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHead from '../components/layout/PageHead';
import WeeklyProgress from '../components/dashboard/WeeklyProgress';
import DateRangePicker from '../components/dashboard/DateRangePicker';
import TaskViewModal from '../components/tasks/TaskViewModal';
import { useApp } from '../store/AppContext';
import { useAuth } from '../store/AuthContext';
import { useToast } from '../store/ToastContext';
import DueTag from '../components/ui/DueTag';
import { TODAY, parseYmd, fmtShort } from '../lib/date';
import { effStatus, displayName } from '../lib/format';
import {
  BulbIcon, CheckSquareIcon, ClockIcon, WarnIcon, EyeIcon, PencilIcon,
} from '../lib/icons';
// EyeIcon is still used by Pending Tasks; the ideas row no longer has one.

export default function Dashboard() {
  const navigate = useNavigate();
  const toast = useToast();
  const { isChair } = useAuth();
  const { myIdeas, myTasks } = useApp();

  const [range, setRange] = useState({ key: 'today', from: TODAY, to: TODAY, label: 'Today' });
  const [viewTask, setViewTask] = useState(null);

  const inRange = (s) => {
    const dt = parseYmd(s);
    return dt >= range.from && dt <= range.to;
  };

  const applyRange = (next) => {
    setRange(next);
    toast(`Showing: ${next.label}`);
  };

  /* ---- Recent Ideas: never show an empty card just because the range is narrow ---- */
  const { recentIdeas, ideasInRange } = useMemo(() => {
    const inR = myIdeas.filter((i) => inRange(i.created));
    const source = inR.length ? inR : myIdeas;
    return {
      ideasInRange: inR.length,
      recentIdeas: [...source]
        .sort((a, b) => parseYmd(b.created) - parseYmd(a.created))
        .slice(0, 5),
    };
  }, [myIdeas, range]);

  /* ---- Pending tasks ---- */
  const pending = useMemo(
    () => myTasks.filter((t) => effStatus(t) !== 'Completed'),
    [myTasks]
  );
  const { topTasks, tasksInRange } = useMemo(() => {
    const inR = pending.filter((t) => inRange(t.date));
    const source = inR.length ? inR : pending;
    return {
      tasksInRange: inR.length,
      topTasks: [...source].sort((a, b) => parseYmd(a.due) - parseYmd(b.due)).slice(0, 6),
    };
  }, [pending, range]);

  /* Only the chairman creates ideas, so "My Ideas" was a lie on a member's
     screen — it was counting the chairman's. Everyone is shown the same
     thing: the ideas they can actually open, which is exactly the number the
     Ideas page puts above its list. Members see what is open to the team; the
     chairman also sees his own drafts, and the card says how many of the
     number are drafts — so the two screens can never disagree. */
  const myDrafts = myIdeas.filter((i) => i.status === 'Draft').length;

  const overdue = myTasks.filter((t) => effStatus(t) === 'Overdue').length;
  const completed = myTasks.filter((t) => effStatus(t) === 'Completed').length;

  return (
    <>
      {/* The date picker is the whole page's control — every card on the
          dashboard reads the range it sets — so it sits opposite the page
          heading rather than inside one card's corner. */}
      <PageHead
        className="with-range"
        title="Dashboard"
        subtitle={`Welcome back, ${isChair ? 'Chairman' : 'there'}`}
        hideSubtitleOnMobile
        action={<DateRangePicker value={range} onApply={applyRange} />}
      />

      {/* The tone class carries the card's colour to the number, which is what
          the phone layout shows in place of the icon. */}
      <div className="stats">
        <div className="stat s-blue">
          <span className="ico blue"><BulbIcon /></span>
          <span className="meta">
            <span className="n">{myIdeas.length}</span>
            <span className="l">
              Total Ideas
              {isChair && myDrafts > 0 && (
                <em className="stat-note"> · {myDrafts} draft{myDrafts === 1 ? '' : 's'}</em>
              )}
            </span>
          </span>
        </div>
        <div className="stat s-green">
          <span className="ico green"><CheckSquareIcon /></span>
          <span className="meta"><span className="n">{completed}</span><span className="l">Tasks Completed</span></span>
        </div>
        <div className="stat s-amber">
          <span className="ico amber"><ClockIcon /></span>
          <span className="meta">
            <span className="n">{pending.length}</span>
            <span className="l">{isChair ? 'Pending Tasks' : 'My Pending Tasks'}</span>
          </span>
        </div>
        <div className="stat s-red">
          <span className="ico red"><WarnIcon /></span>
          <span className="meta"><span className="n">{overdue}</span><span className="l">Overdue</span></span>
        </div>
      </div>

      <WeeklyProgress />

      {/* ---------- Recent Ideas ---------- */}
      <div className="card">
        <div className="card-head">
          <div>
            <h2>Recent Ideas</h2>
            <span className="sub">
              {ideasInRange
                ? `${ideasInRange} idea${ideasInRange === 1 ? '' : 's'} in range`
                : myIdeas.length ? 'No ideas in range — showing latest' : 'No ideas yet'}
            </span>
          </div>
          <div className="right">
            <button className="link-btn" onClick={() => navigate('/ideas')}>View all →</button>
          </div>
        </div>
        <p className="swipe-hint">Swipe the table sideways to see all columns</p>
        <div className="table-wrap">
          <table className="stacks acts-inline">
            <thead>
              <tr>
                <th>Title</th><th>Created Date</th><th>Department</th>
                <th>Category/Tag</th><th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {recentIdeas.map((i) => (
                <tr key={i.id}>
                  <td className="td-title">{i.title}<small>by {displayName(i.owner, i.ownerRole)}</small></td>
                  <td className="nowrap" data-label="Created">{fmtShort(parseYmd(i.created))}</td>
                  <td data-label="Department">{i.dept || '—'}</td>
                  <td data-label="Category"><span className="tag">{i.tag}</span></td>
                  <td className="td-act">
                    <div className="actions">
                      {/* One control, not two. The eye opened a preview of what
                          the discussion page shows in full, so the row offered
                          the same idea twice and the second offer was smaller
                          and less useful than the first. Straight into the
                          discussion page — that is where the comments live. */}
                      <button className="act edit" onClick={() => navigate(`/ideas/${i.id}`)} title="View / Edit" aria-label={`View or edit ${i.title}`}>
                        <PencilIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {recentIdeas.length === 0 && <div className="empty">No ideas in the selected date range.</div>}
      </div>

      {/* ---------- Pending Tasks ---------- */}
      <div className="card">
        <div className="card-head">
          <div>
            <h2>{isChair ? 'Pending Tasks' : 'My Pending Tasks'}</h2>
            <span className="sub">
              {tasksInRange
                ? `${tasksInRange} pending in range`
                : pending.length ? 'No tasks in range — showing all pending' : 'Nothing pending'}
            </span>
          </div>
          <div className="right">
            <button className="link-btn" onClick={() => navigate('/tasks')}>View all →</button>
          </div>
        </div>
        <p className="swipe-hint">Swipe the table sideways to see all columns</p>
        <div className="table-wrap">
          <table className="stacks acts-inline">
            <thead>
              <tr>
                <th>Task</th><th>Assigned To</th><th>Date</th>
                <th>Time</th><th>Due</th><th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {topTasks.map((t) => (
                <tr key={t.id}>
                  <td className="td-title">{t.title}<small>{t.dept}</small></td>
                  <td className="nowrap" data-label="Assigned to">{displayName(t.owner, t.ownerRole)}</td>
                  <td className="nowrap" data-label="Date">{fmtShort(parseYmd(t.date))}</td>
                  <td className="nowrap" data-label="Time">{t.time}</td>
                  <td className="nowrap" data-label="Due"><DueTag due={t.due} /></td>
                  <td className="td-act">
                    <div className="actions">
                      <button className="act" onClick={() => setViewTask(t)} title="View" aria-label={`View ${t.title}`}>
                        <EyeIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {topTasks.length === 0 && <div className="empty">Nothing pending in the selected date range.</div>}
      </div>

      <TaskViewModal task={viewTask} onClose={() => setViewTask(null)} />
    </>
  );
}
