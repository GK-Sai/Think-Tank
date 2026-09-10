import { useEffect, useMemo, useRef, useState } from 'react';
import MessagingDock from './MessagingDock';
import { Avatar } from '../../lib/avatars';
import { displayName } from '../../lib/format';
import { fmtTime, fmtShort, fmtWhen, dayOf, toDate } from '../../lib/date';
import { useApp } from '../../store/AppContext';
import { useAuth } from '../../store/AuthContext';
import {
  ChevronDownIcon, ChevronLeftIcon, SearchIcon, PencilIcon, CloseIcon,
} from '../../lib/icons';

/**
 * Messaging — one panel, under the discussion.
 *
 * The shape is LinkedIn's: a bar saying **Messaging** with your own picture on
 * it, and an arrow that opens it into the list of conversations — search at the
 * top and every row showing the last thing said and when. Picking a row opens
 * that conversation *in the same panel*, with a back arrow to the list.
 *
 * One list, not two. It used to be split into Focused and Other — the people
 * you had written to, and the rest of the team — which meant that writing to
 * somebody for the first time was a different action, in a different tab, from
 * carrying on a conversation. On a team this size there is no crowd to filter:
 * everyone is on the one list, ordered by what needs reading first, and
 * whoever you have not written to yet is simply further down it.
 *
 * There is deliberately only one place on the page to write to somebody. The
 * older layout had two — a team list under the discussion, and a chat window
 * that floated over it — and scrolling ran the two together. Now the column
 * reads top to bottom: the discussion, then messaging under it, nothing
 * covering anything.
 */

/** 'Aug 27' for an old message, the clock time for one from today. */
function whenLabel(at) {
  if (!at) return '';
  const d = toDate(at);
  if (Number.isNaN(d.getTime())) return '';
  if (dayOf(d) === dayOf(new Date())) return fmtTime(d);
  const [day, mon] = fmtShort(d).split(' ');
  return `${mon} ${Number(day)}`;
}

export default function MessagingHub({ person, onSelect, onClose }) {
  const { team, threads, unreadMessages } = useApp();
  const { user } = useAuth();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchRef = useRef(null);

  useEffect(() => {
    if (open && !person) searchRef.current?.focus();
  }, [open, person]);

  // Opening a conversation opens the panel it lives in.
  useEffect(() => { if (person) setOpen(true); }, [person]);

  const byId = useMemo(() => {
    const map = new Map();
    threads.forEach((t) => map.set(t.withId, t));
    return map;
  }, [threads]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return team
      .filter((m) => m.id !== user?.id)
      .map((m) => {
        const t = byId.get(m.id);
        return {
          member: m,
          talked: !!t?.lastAt,
          lastText: t?.lastText || '',
          lastMine: !!t?.lastMine,
          lastAt: t?.lastAt || null,
          unread: t?.unread || 0,
        };
      })
      .filter((r) => !needle || r.member.name.toLowerCase().includes(needle)
        || (r.member.role || '').toLowerCase().includes(needle)
        || r.lastText.toLowerCase().includes(needle))
      .sort((a, b) => {
        if (a.unread !== b.unread) return b.unread - a.unread;
        if (a.lastAt && b.lastAt) return new Date(b.lastAt) - new Date(a.lastAt);
        if (a.lastAt) return -1;
        if (b.lastAt) return 1;
        if (a.member.online !== b.member.online) return a.member.online ? -1 : 1;
        return a.member.name.localeCompare(b.member.name);
      });
  }, [team, user, byId, query]);

  /* `rows` is already in the order the list should read: unread first, then
     the most recent conversations, then whoever is online, then the rest of
     the team alphabetically. Nothing is filtered out. */
  const searching = query.trim().length > 0;
  const shown = rows;

  const [mySex, myVariant] = user?.av || ['male', 0];
  const me = displayName(user?.name, user?.role);

  const who = person ? displayName(person.name, person.accountRole) : '';
  const [theirSex, theirVariant] = person?.av || ['male', 0];

  return (
    <section className={`mhub${open ? ' open' : ''}`} aria-label="Messaging">
      <header className="mhub-head">
        {person ? (
          <>
            <button
              type="button"
              className="dock-btn"
              onClick={onClose}
              aria-label="Back to all messages"
              title="Back to all messages"
            >
              <ChevronLeftIcon />
            </button>
            <span className="mhub-av">
              <Avatar sex={theirSex} variant={theirVariant} className="mhub-face" title={who} />
              <i className={`mhub-dot${person.online ? ' on' : ''}`} aria-hidden="true" />
            </span>
            <span className="mhub-title as-text">
              <strong>{who}</strong>
              <span>
                {person.online
                  ? 'Online'
                  : person.lastSeenAt ? `Last seen ${fmtWhen(person.lastSeenAt)}` : 'Offline'}
              </span>
            </span>
            <button
              type="button"
              className="dock-btn"
              onClick={onClose}
              aria-label="Close conversation"
              title="Close conversation"
            >
              <CloseIcon />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="mhub-title"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="mhubList"
            >
              <span className="mhub-av">
                <Avatar sex={mySex} variant={myVariant} className="mhub-face" title={me} />
                <i className="mhub-dot on" aria-hidden="true" />
              </span>
              <strong>Messaging</strong>
              {unreadMessages > 0 && <span className="mhub-unread">{unreadMessages}</span>}
            </button>

            <button
              type="button"
              className="dock-btn"
              onClick={() => {
                setOpen(true);
                setQuery('');
                searchRef.current?.focus();
              }}
              aria-label="Start a new message"
              title="New message"
            >
              <PencilIcon />
            </button>
          </>
        )}

        <button
          type="button"
          className="dock-btn"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Close messaging' : 'Open messaging'}
          title={open ? 'Close' : 'Open'}
        >
          <ChevronDownIcon style={{ transform: open ? undefined : 'rotate(180deg)' }} />
        </button>
      </header>

      {open && (person ? (
        <MessagingDock person={person} />
      ) : (
        <div className="mhub-body" id="mhubList">
          <div className="mhub-search">
            <SearchIcon />
            <input
              ref={searchRef}
              type="search"
              value={query}
              placeholder="Search messages"
              aria-label="Search messages"
              onChange={(e) => setQuery(e.target.value)}
            />
            {searching && (
              <button type="button" onClick={() => setQuery('')} aria-label="Clear search">
                <CloseIcon />
              </button>
            )}
          </div>

          <ul className="mhub-list">
            {shown.map((r) => {
              const [sex, variant] = r.member.av || ['male', 0];
              const rowWho = displayName(r.member.name, r.member.accountRole);
              const preview = r.lastText
                ? `${r.lastMine ? 'You: ' : ''}${r.lastText}`
                : `${r.member.accountRole === 'chairman' ? 'Chairman' : r.member.role} · ${r.member.online ? 'Online' : 'Offline'}`;
              return (
                <li key={r.member.id}>
                  <button
                    type="button"
                    className={`mhub-row${r.unread ? ' unread' : ''}`}
                    onClick={() => onSelect(r.member)}
                  >
                    <span className="mhub-av">
                      <Avatar sex={sex} variant={variant} className="mhub-face" title={rowWho} />
                      <i className={`mhub-dot${r.member.online ? ' on' : ''}`} aria-hidden="true" />
                    </span>
                    <span className="mhub-who">
                      <strong>{rowWho}</strong>
                      <span className="mhub-last">{preview}</span>
                    </span>
                    <span className="mhub-meta">
                      <span className="mhub-when">{whenLabel(r.lastAt)}</span>
                      {r.unread > 0 && <span className="mhub-badge">{r.unread}</span>}
                    </span>
                  </button>
                </li>
              );
            })}

            {shown.length === 0 && (
              <li className="mhub-none">
                {searching ? 'Nobody matches that.' : 'Nobody else on the team yet.'}
              </li>
            )}
          </ul>
        </div>
      ))}
    </section>
  );
}
