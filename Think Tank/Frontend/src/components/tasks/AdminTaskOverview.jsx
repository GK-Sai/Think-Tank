import { useEffect, useMemo, useState } from 'react';
import Pager from '../ui/Pager';
import { useApp } from '../../store/AppContext';
import { TODAY, parseYmd, daysBetween } from '../../lib/date';
import { effStatus, displayName } from '../../lib/format';
import { SearchIcon, CloseIcon } from '../../lib/icons';

const PER_PAGE = 7;

/** The status pill: derived so a task that slips past its due date self-corrects. */
function StatusPill({ task }) {
  /* An implementation milestone is a date on an idea, not work anybody was
     given, so it is never "Overdue" or "In Progress" — it says what it is. */
  if (task.milestone) return <span className="pill implementation">Implementation</span>;

  const st = effStatus(task);
  if (st === 'Completed') return <span className="pill completed">Completed</span>;
  if (st === 'Overdue') return <span className="pill overdue">Overdue</span>;
  if (st === 'Re Assign') return <span className="pill reassign">Re Assign</span>;

  const diff = daysBetween(TODAY, parseYmd(task.due));
  if (diff === 0) return <span className="pill due">Due today</span>;
  if (diff <= 3) return <span className="pill due">Due in {diff} day{diff === 1 ? '' : 's'}</span>;
  return <span className="pill progress">In Progress</span>;
}

const CARDS = [
  { key: 'all', label: 'Total Tasks', cls: 'c-total' },
  { key: 'In Progress', label: 'In Progress', cls: 'c-prog' },
  { key: 'Overdue', label: 'Over Due', cls: 'c-over' },
  { key: 'Completed', label: 'Completed', cls: 'c-done' },
];

const BLANK = { query: '', range: 'all', status: 'all', member: 'all', dept: 'all', priority: 'all' };

export default function AdminTaskOverview({ onViewTask }) {
  const { tasks, team } = useApp();
  const [filters, setFilters] = useState(BLANK);
  const [page, setPage] = useState(1);
  /* Phone only: the search field folds behind the icon at the right of the
     heading — the same pattern Ideas, Team and Notifications use. */
  const [searchOpen, setSearchOpen] = useState(false);

  const setFilter = (key, value) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  useEffect(() => { setPage(1); }, [filters]);

  /* Departments come from the tasks themselves — no list to keep in sync. */
  const depts = useMemo(
    () => Array.from(new Set(tasks.map((t) => t.dept).filter(Boolean))).sort(),
    [tasks]
  );

  const counts = useMemo(() => {
    const by = (s) => tasks.filter((t) => effStatus(t) === s).length;
    return {
      all: tasks.length,
      'In Progress': by('In Progress'),
      Overdue: by('Overdue'),
      Completed: by('Completed'),
    };
  }, [tasks]);

  const rows = useMemo(() => {
    const rangeOk = (t) => {
      const diff = daysBetween(TODAY, parseYmd(t.due));
      switch (filters.range) {
        case 'today': return diff === 0;
        case 'week': return diff >= 0 && diff <= 7;
        case 'month': return diff >= -30 && diff <= 30;
        case 'overdue': return diff < 0 && effStatus(t) !== 'Completed';
        default: return true;
      }
    };

    const q = filters.query.trim().toLowerCase();

    return tasks
      .filter((t) => {
        if (!rangeOk(t)) return false;
        if (filters.status !== 'all' && effStatus(t) !== filters.status) return false;
        if (filters.member !== 'all' && t.owner !== filters.member) return false;
        if (filters.dept !== 'all' && t.dept !== filters.dept) return false;
        if (filters.priority !== 'all' && (t.priority || 'Medium') !== filters.priority) return false;
        if (!q) return true;
        return `${t.title} ${t.description} ${t.dept} ${t.owner}`.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        // Open work first, then most urgent.
        const ac = effStatus(a) === 'Completed' ? 1 : 0;
        const bc = effStatus(b) === 'Completed' ? 1 : 0;
        if (ac !== bc) return ac - bc;
        return parseYmd(a.due) - parseYmd(b.due);
      });
  }, [tasks, filters]);

  const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const current = Math.min(page, pages);
  const slice = rows.slice((current - 1) * PER_PAGE, current * PER_PAGE);

  return (
    <>
      <div className={`sec-head${searchOpen ? ' searching' : ''}`}>
        <div className="sh-txt">
          <h2>Admin Task Overview</h2>
          <p>
            {rows.length} task{rows.length === 1 ? '' : 's'}
            {rows.length !== tasks.length && ` of ${tasks.length}`} across the organization
          </p>
        </div>

        {/* Phone only — the same fold-away field Ideas, Team and Notifications
            use. The field in the filter bar below is hidden on a phone, so
            without this the chairman had no way to search his own task board
            on the device he is most likely reading it on. */}
        {searchOpen && (
          <div className="search-box head-search">
            <SearchIcon />
            <input
              type="search"
              autoFocus
              placeholder="Search tasks"
              aria-label="Search tasks"
              value={filters.query}
              onChange={(e) => setFilter('query', e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setFilter('query', ''); setSearchOpen(false); }
              }}
            />
          </div>
        )}

        <button
          type="button"
          className={`hs-btn${searchOpen ? ' on' : ''}`}
          aria-label={searchOpen ? 'Close search' : 'Search tasks'}
          aria-expanded={searchOpen}
          onClick={() => {
            if (searchOpen) setFilter('query', '');
            setSearchOpen((v) => !v);
          }}
        >
          {searchOpen ? <CloseIcon /> : <SearchIcon />}
        </button>
      </div>

      <div className="idea-filters">
        <div className="search-box">
          <SearchIcon />
          <input
            type="search"
            placeholder="Search tasks"
            aria-label="Search tasks"
            value={filters.query}
            onChange={(e) => setFilter('query', e.target.value)}
          />
        </div>
      </div>

      <div className="filters">
        <label className="filter-pill">
          <select aria-label="Date range" value={filters.range} onChange={(e) => setFilter('range', e.target.value)}>
            <option value="all">Date Range</option>
            <option value="today">Today</option>
            <option value="week">This week</option>
            <option value="month">This month</option>
            <option value="overdue">Past due</option>
          </select>
        </label>
        <label className="filter-pill">
          <select aria-label="Status" value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
            <option value="all">Status</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
            <option value="Overdue">Overdue</option>
            <option value="Re Assign">Re Assign</option>
          </select>
        </label>
        <label className="filter-pill">
          <select aria-label="Team member" value={filters.member} onChange={(e) => setFilter('member', e.target.value)}>
            <option value="all">Team Member</option>
            {team.map((m) => (
              <option key={m.id} value={m.name}>{displayName(m.name, m.accountRole)}</option>
            ))}
          </select>
        </label>
        <label className="filter-pill">
          <select aria-label="Department" value={filters.dept} onChange={(e) => setFilter('dept', e.target.value)}>
            <option value="all">Department</option>
            {depts.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
        <label className="filter-pill">
          <select aria-label="Priority" value={filters.priority} onChange={(e) => setFilter('priority', e.target.value)}>
            <option value="all">Priority</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </label>      </div>

      {/* The stat cards double as the status filter. */}
      <div className="statcards">
        {CARDS.map((c) => (
          <button
            key={c.key}
            type="button"
            className={`statcard ${c.cls}${filters.status === c.key ? ' on' : ''}`}
            onClick={() => setFilter('status', c.key)}
          >
            <span className="lab">{c.label}</span>
            <span className="num">{counts[c.key]}</span>
          </button>
        ))}
      </div>

      <p className="swipe-hint">Swipe the table sideways to see all columns</p>
      <div className="bt-wrap">
        {/* Each cell names its column, so on a phone the row can be read as a
            card instead of being scrolled sideways column by column. */}
        <table className="bluetable stacks">
          <thead>
            <tr>
              <th>Task Name</th><th>Department</th><th>Assigned To</th><th>Due Date</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {slice.map((t) => (
              <tr key={t.id}>
                {/* The row opens the task, which is where its status is
                    moved. Without this the board could be read but never
                    acted on: nothing anywhere could mark a task done. */}
                <td className="t-name">
                  {onViewTask ? (
                    <button type="button" className="link-action row-open" onClick={() => onViewTask(t)}>
                      {t.title}
                    </button>
                  ) : t.title}
                </td>
                <td className="muted" data-label="Department">{t.dept}</td>
                <td className="muted" data-label="Assigned to">{displayName(t.owner, t.ownerRole)}</td>
                <td className="muted nowrap" data-label="Due">{t.due}</td>
                <td data-label="Status"><StatusPill task={t} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {slice.length === 0 && <div className="empty">No tasks match these filters.</div>}

      <Pager page={current} pages={pages} onChange={setPage} />
    </>
  );
}
