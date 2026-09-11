import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BackLink from '../components/layout/BackLink';
import Select from '../components/ui/Select';
import { useApp } from '../store/AppContext';
import { useToast } from '../store/ToastContext';
import { bucketOf, fmtWhen, fmtDateTime, toDate } from '../lib/date';
import {
  SearchIcon, CloseIcon, ChevronDownIcon,
  TaskIcon, BulbIcon, SmallTeamIcon, ClockIcon, WarnIcon, CheckIcon,
} from '../lib/icons';

const ICONS = {
  task: { cls: '', El: TaskIcon },
  idea: { cls: '', El: BulbIcon },
  team: { cls: '', El: SmallTeamIcon },
  snooze: { cls: 'amber', El: ClockIcon },
  warn: { cls: 'red', El: WarnIcon },
  ok: { cls: 'green', El: CheckIcon },
};

const ORDER = { today: 0, yesterday: 1, earlier: 2 };
const LABEL = { today: 'Today', yesterday: 'Yesterday', earlier: 'Earlier' };

/* The "kind" filter groups the six icons into the four things people
   actually look for. */
const KINDS = [
  ['', 'All types'],
  ['idea', 'Ideas'],
  ['task', 'Tasks'],
  ['team', 'Team'],
  ['alert', 'Alerts & reminders'],
];

const kindOf = (icon) => {
  if (icon === 'idea') return 'idea';
  if (icon === 'task' || icon === 'ok') return 'task';
  if (icon === 'team') return 'team';
  return 'alert';
};

const WHEN = [
  ['', 'Any time'],
  ['today', 'Today'],
  ['yesterday', 'Yesterday'],
  ['earlier', 'Earlier'],
];

export default function Notifications() {
  const { notifs, markAllRead, unreadCount } = useApp();
  const toast = useToast();
  const navigate = useNavigate();

  const [tab, setTab] = useState('unread');
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('');
  const [when, setWhen] = useState('');
  /* Phone only — see Team.jsx: the field folds behind the icon at the right
     of the heading and opens on that same line. */
  const [searchOpen, setSearchOpen] = useState(false);

  /* Which heading a notification sits under is worked out from its timestamp
     in the reader's own timezone, so nothing has to be relabelled as the day
     rolls over — and nobody is told a 10 AM change happened at 9. */
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notifs
      .map((n) => ({ ...n, bucket: bucketOf(n.at) }))
      .filter((n) => {
        if (tab === 'unread' && !n.unread) return false;
        if (tab === 'reminders' && !n.reminder) return false;
        if (kind && kindOf(n.icon) !== kind) return false;
        if (when && n.bucket !== when) return false;
        return !q || n.title.toLowerCase().includes(q);
      })
      .sort((a, b) => ORDER[a.bucket] - ORDER[b.bucket] || toDate(b.at) - toDate(a.at));
  }, [notifs, tab, query, kind, when]);

  const activeCount = [query, kind, when].filter(Boolean).length;

  // Insert a heading whenever the bucket changes.
  const rows = [];
  let last = null;
  list.forEach((n) => {
    if (n.bucket !== last) { rows.push({ heading: LABEL[n.bucket] }); last = n.bucket; }
    rows.push({ notif: n });
  });

  return (
    <>
      <BackLink to="/" label="Back to Dashboard" />

      <div className={`sec-head${searchOpen ? ' searching' : ''}`}>
        <div className="sh-txt">
          <h2>Notifications</h2>
          <p>{unreadCount ? `${unreadCount} unread` : 'All caught up'}</p>
        </div>

        {searchOpen && (
          <div className="search-box head-search">
            <SearchIcon />
            <input
              type="search"
              autoFocus
              placeholder="Search notifications"
              aria-label="Search notifications"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') { setQuery(''); setSearchOpen(false); } }}
            />
          </div>
        )}

        {/* Disabled once nothing is unread, so it cannot fire the toast again. */}
        <button
          className="btn-mark"
          disabled={unreadCount === 0}
          onClick={async () => {
            if (unreadCount === 0) return;
            await markAllRead();
            toast('All notifications marked as read');
          }}
        >
          {unreadCount === 0 ? 'All read' : 'Mark all as read'}
        </button>

        <button
          type="button"
          className={`hs-btn${searchOpen ? ' on' : ''}`}
          aria-label={searchOpen ? 'Close search' : 'Search notifications'}
          aria-expanded={searchOpen}
          onClick={() => {
            if (searchOpen) setQuery('');
            setSearchOpen((v) => !v);
          }}
        >
          {searchOpen ? <CloseIcon /> : <SearchIcon />}
        </button>
      </div>

      <div className="nf-tabs">
        {[['all', 'All'], ['unread', 'Unread'], ['reminders', 'Reminders']].map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={tab === key ? 'on' : undefined}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="idea-filters">
        <div className="search-box">
          <SearchIcon />
          <input
            type="search"
            placeholder="Search notifications"
            aria-label="Search notifications"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <Select
          label="Filter by type"
          value={kind}
          onChange={setKind}
          options={KINDS.map(([v, l]) => ({ value: v, label: l }))}
        />

        <Select
          label="Filter by when"
          value={when}
          onChange={setWhen}
          options={WHEN.map(([v, l]) => ({ value: v, label: l }))}
        />
      </div>

      <div className="tl-card" style={{ marginTop: 12 }}>
        {rows.map((row, i) => {
          if (row.heading) return <div className="nf-group" key={`h-${row.heading}-${i}`}>{row.heading}</div>;
          const { cls, El } = ICONS[row.notif.icon] || ICONS.task;
          const { link } = row.notif;
          return (
            <div
              className={`nf-item${row.notif.unread ? ' unread' : ''}${link ? ' clickable' : ''}`}
              key={row.notif.id}
              role={link ? 'button' : undefined}
              tabIndex={link ? 0 : undefined}
              onClick={link ? () => navigate(link) : undefined}
              onKeyDown={link ? (e) => { if (e.key === 'Enter') navigate(link); } : undefined}
            >
              <span className={`nf-ico ${cls}`}><El /></span>
              <span className="nf-b">
                <strong>{row.notif.title}</strong>
                {/* Date and time of the change, on the reader's own clock. */}
                <span title={fmtDateTime(row.notif.at)}>{fmtWhen(row.notif.at)}</span>
              </span>
            </div>
          );
        })}
        {list.length === 0 && (
          <div className="empty">
            {activeCount ? 'No notifications match your filters.' : 'Nothing here.'}
          </div>
        )}
      </div>
    </>
  );
}
