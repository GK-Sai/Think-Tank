import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Pager from '../components/ui/Pager';
import IdeaSanctuaryModal from '../components/thinklog/IdeaSanctuaryModal';
import CreateTaskModal from '../components/thinklog/CreateTaskModal';
import LogViewModal from '../components/thinklog/LogViewModal';
import EditPointModal from '../components/thinklog/EditPointModal';
import BackLink from '../components/layout/BackLink';
import { useApp } from '../store/AppContext';
import { useAuth } from '../store/AuthContext';
import { useToast } from '../store/ToastContext';
import { TODAY, ymd, parseYmd, fmtLong, fmtShort, daysBetween } from '../lib/date';
import {
  SearchIcon, CalendarIcon, ChevronDownIcon, CheckIcon, PencilIcon,
} from '../lib/icons';
import { displayName } from '../lib/format';

const PER_PAGE = 6;

/* How long the box waits after the last keystroke before it saves itself.
   Short enough that a thought is on the record almost as soon as it is
   written; long enough that it is not saving in the middle of a word. */
const AUTOSAVE_MS = 3000;

/* A point is not one thing or the other — the same note can go to Tasks and to
   Ideas — so what it became is a list. Tasks are listed first because that is
   the order the two rows read in on the page: the task in blue, the idea under
   it in orange. */
const KINDS = ['task', 'idea'];
const KIND_LABEL = { task: 'In Tasks', idea: 'In Ideas' };
const ADD_LABEL = { task: 'Add to Task', idea: 'Add to Idea' };

/* On a phone a point shows its first four words and no more, so the two
   coloured buttons land in the same place on every row down the list. Tapping
   the note opens it out in full. */
const SHORT_WORDS = 4;
const shorten = (text) => {
  const words = String(text).trim().split(/\s+/);
  return words.length > SHORT_WORDS
    ? `${words.slice(0, SHORT_WORDS).join(' ')}…`
    : text;
};

const has = (states, kind) => (states || []).includes(kind);
const withKind = (states, kind) => (has(states, kind) ? states : [...(states || []), kind]);

/** Which heading a past log sits under. */
function bucketOf(dateStr) {
  const diff = daysBetween(parseYmd(dateStr), TODAY);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff <= 7) return 'This Week';
  return 'Earlier';
}

export default function ThinkLog() {
  const { thinkLogs, addThinkLog, markLogPoint, editLogPoint } = useApp();
  const { user, isChair } = useAuth();
  const toast = useToast();

  const [draft, setDraft] = useState('');
  const [draftStates, setDraftStates] = useState([]);   // any of 'task', 'idea'
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);  // phone: search is an icon
  const [period, setPeriod] = useState('all');   // how far back to look
  const [kind, setKind] = useState('all');       // what became of the points
  const [page, setPage] = useState(1);
  const [viewLog, setViewLog] = useState(null);
  const [pending, setPending] = useState(null); // { text, kind }
  const [editing, setEditing] = useState(null);
  /* Which point has been tapped open to show its whole note (phone only). */
  const [openPoint, setOpenPoint] = useState(null); // a saved point being reworded
  const draftRef = useRef(null);
  const searchRef = useRef(null);

  /* ---------- the composer saves itself ----------
     There is no Save button. The point of a think log is that a thought gets
     written down before it is lost, and a button is one more thing standing
     between having the thought and keeping it — the notes that went missing
     were the ones written in a hurry and never saved.

     `savedPointId` is the point this box has already become. While it is null
     the next save creates a log; after that the same box keeps rewording that
     one point, so a note you carry on adding to stays one thought rather than
     turning into a new log every few seconds. */
  const [savedPointId, setSavedPointId] = useState(null);
  const [saveState, setSaveState] = useState('idle'); // idle | dirty | saving | saved
  const savedTextRef = useRef('');   // what is on the server right now
  const savingRef = useRef(false);   // one save in flight at a time

  /* A note is one point, however many lines it runs to. Shift+Enter is for
     writing a second line of the same thought — it should not split what you
     are saying into two separate things to action. */
  const noteText = draft.trim();

  const flushDraft = useCallback(async () => {
    const text = draft.trim();
    if (!text || text === savedTextRef.current || savingRef.current) return;

    savingRef.current = true;
    setSaveState('saving');
    try {
      if (savedPointId === null) {
        const saved = await addThinkLog({
          date: ymd(TODAY),
          title: text.split('\n')[0].trim(),
          points: [{ text, states: draftStates }],
        });
        setSavedPointId(saved?.points?.[0]?.id ?? null);
        setPage(1);
      } else {
        await editLogPoint(savedPointId, text);
      }
      savedTextRef.current = text;
      setSaveState('saved');
    } catch {
      /* AppContext toasted the server's message. Back to dirty so the next
         keystroke — or tapping away — tries again rather than the note
         quietly sitting there believing it is safe. */
      setSaveState('dirty');
    } finally {
      savingRef.current = false;
    }
  }, [draft, savedPointId, draftStates, addThinkLog, editLogPoint]);

  /* Save three seconds after the last keystroke. Every keystroke restarts the
     wait, so it never fires in the middle of a sentence. */
  useEffect(() => {
    const text = draft.trim();
    if (!text || text === savedTextRef.current) {
      if (!text) setSaveState('idle');
      return undefined;
    }
    setSaveState('dirty');
    const id = setTimeout(flushDraft, AUTOSAVE_MS);
    return () => clearTimeout(id);
  }, [draft, flushDraft]);

  /** Clear the box for the next thought, leaving the saved one where it is. */
  const startNewNote = () => {
    setDraft('');
    setDraftStates([]);
    setSavedPointId(null);
    savedTextRef.current = '';
    setSaveState('idle');
    draftRef.current?.focus();
  };

  /* Everything that can still be turned into an idea or a task: what is in
     the box right now, and every point from a note already saved. Before
     this, a thought you had on Monday stopped being actionable the moment you
     cleared the box. */
  const actionable = useMemo(() => {
    /* Only while the box has not saved itself yet — a second or two. Once it
       has, the same words come back from `thinkLogs` below and listing the
       draft as well would show the point twice. */
    const rows = noteText && savedPointId === null
      ? [{ key: 'draft', id: null, text: noteText, states: draftStates, when: null, sample: false }]
      : [];

    thinkLogs.forEach((log) => {
      log.points.forEach((pt) => {
        rows.push({
          key: `p${pt.id}`,
          id: pt.id,
          text: pt.text,
          states: pt.states || [],
          when: log.date,
          sample: log.sample,
        });
      });
    });
    return rows;
  }, [noteText, savedPointId, draftStates, thinkLogs]);

  /**
   * Remember what a point became, whether it is the draft or a saved one.
   *
   * Adds to what the point already is: sending a note to Tasks does not undo
   * its being an idea, so the same thought can show as both.
   */
  const markPoint = async (row, kind) => {
    if (row.id === null) { setDraftStates((cur) => withKind(cur, kind)); return; }
    try { await markLogPoint(row.id, kind); } catch { /* toasted already */ }
  };

  /* ---------- past logs ---------- */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const maxAge = period === 'all' ? null : Number(period);

    return thinkLogs
      .filter((l) => {
        if (maxAge !== null && daysBetween(parseYmd(l.date), TODAY) > maxAge) return false;
        if (kind === 'idea' && !l.points.some((p) => has(p.states, 'idea'))) return false;
        if (kind === 'task' && !l.points.some((p) => has(p.states, 'task'))) return false;
        if (kind === 'open' && !l.points.some((p) => !(p.states || []).length)) return false;
        if (!q) return true;
        if (l.title.toLowerCase().includes(q)) return true;
        return l.points.some((p) => p.text.toLowerCase().includes(q));
      })
      .sort((a, b) => parseYmd(b.date) - parseYmd(a.date));
  }, [thinkLogs, query, period, kind]);

  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const current = Math.min(page, pages);
  const slice = filtered.slice((current - 1) * PER_PAGE, current * PER_PAGE);

  useEffect(() => { setPage(1); }, [query, period, kind]);

  // Group the visible page under its date headings.
  const grouped = [];
  let lastBucket = null;
  slice.forEach((log) => {
    const b = bucketOf(log.date);
    if (b !== lastBucket) { grouped.push({ heading: b }); lastBucket = b; }
    grouped.push({ log });
  });

  return (
    <>
      <div className="tl-grid">
        {/* ---------- composer ---------- */}
        <div>
          {/* This page's heading is the date, so the back arrow sits on that
              line rather than on one of its own. */}
          <div className="tl-datehead">
            <BackLink to="/" label="Back to Dashboard" />
            <div className="tl-date">{fmtLong(TODAY)}</div>
          </div>

          <div className="tl-card">
            <textarea
              id="logDraft"
              ref={draftRef}
              className="soft-in"
              placeholder="Write your thoughts for today…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              /* Tapping away is as clear a "done" as a pause is, and on a
                 phone it is usually what happens first. */
              onBlur={flushDraft}
            />
            <div className="tl-compose-foot">
              <span className={`save-state is-${saveState}`}>
                {saveState === 'saving' && <>Saving…</>}
                {saveState === 'dirty' && <>Saves itself in a moment…</>}
                {saveState === 'saved' && (
                  <>
                    <CheckIcon />
                    Saved{isChair ? ' — it is in Actionable Points below' : ' to your think log'}
                  </>
                )}
                {saveState === 'idle' && (
                  <>The whole note is one point — Shift+Enter for another line. It saves itself.</>
                )}
              </span>
              {savedPointId !== null && (
                <button type="button" className="btn-ghost-sm" onClick={startNewNote}>
                  New note
                </button>
              )}
            </div>
          </div>

          {/* Turning a point into an idea or a task is the chairman's to do.
              For everyone else the think log is a notebook, so the panel is
              not shown at all. */}
          {isChair && (
            <>
              <h3 className="tl-h3">
                Actionable Points
                {actionable.length > 0 && <span className="tl-count">{actionable.length}</span>}
              </h3>
              <div className="tl-card ap-card">
                {actionable.map((row) => {
                  /* Which note this came from — today's draft, or one you
                     wrote a fortnight ago and can still act on. */
                  const when = (
                    <span className="ap-when">
                      {row.when ? fmtShort(parseYmd(row.when)) : 'Not saved yet'}
                      {row.sample && <em className="sample-tag">sample</em>}
                    </span>
                  );

                  const marked = KINDS.filter((k) => has(row.states, k));

                  /* Reword a point that is already on the record. A point that
                     has not saved yet is edited in the box it is still sitting
                     in, so it gets no button. */
                  const editBtn = row.id !== null && (
                    <button
                      className="mini-btn edit"
                      onClick={() => setEditing(row)}
                      title="Edit this point"
                      aria-label={`Edit point: ${row.text.slice(0, 60)}`}
                    >
                      <PencilIcon />
                      Edit
                    </button>
                  );

                  /* Nothing has been done with it yet: one row, both offers. */
                  if (marked.length === 0) {
                    return (
                      <div key={row.key} className={`ap-row${openPoint === row.key ? ' open' : ''}`}>
                        <span className="ap-b">
                          <button
                            type="button"
                            className="ap-tap"
                            title={row.text}
                            aria-expanded={openPoint === row.key}
                            onClick={() => setOpenPoint((k) => (k === row.key ? null : row.key))}
                          >
                            <span className="ap-text">{row.text}</span>
                            <span className="ap-short">{shorten(row.text)}</span>
                          </button>
                          {when}
                        </span>
                        <span className="ap-acts">
                          {editBtn}
                          <button className="mini-btn idea" onClick={() => setPending({ row, kind: 'idea' })}>
                            Add to Idea
                          </button>
                          <button className="mini-btn task" onClick={() => setPending({ row, kind: 'task' })}>
                            Add to Task
                          </button>
                        </span>
                      </div>
                    );
                  }

                  /* One row per thing the point became — the task in blue, and
                     the same note again under it in orange when it is an idea
                     as well. Whatever it is not yet is still offered, on the
                     first of the two rows. */
                  return marked.map((kind, i) => (
                    <div
                      key={`${row.key}-${kind}`}
                      className={`ap-row used-${kind}${i ? ' echo' : ''}${!i && marked.length > 1 ? ' paired' : ''}${openPoint === `${row.key}-${kind}` ? ' open' : ''}`}
                    >
                      <span className="ap-b">
                        <button
                          type="button"
                          className="ap-tap"
                          title={row.text}
                          aria-expanded={openPoint === `${row.key}-${kind}`}
                          onClick={() => setOpenPoint((k) => (
                            k === `${row.key}-${kind}` ? null : `${row.key}-${kind}`
                          ))}
                        >
                          <span className="ap-text">{row.text}</span>
                          <span className="ap-short">{shorten(row.text)}</span>
                        </button>
                        {i === 0
                          ? when
                          : <span className="ap-when">{kind === 'idea' ? 'Also an idea' : 'Also a task'}</span>}
                      </span>
                      <span className="ap-acts">
                        {i === 0 && editBtn}
                        <button className="mini-btn done" disabled>{KIND_LABEL[kind]}</button>
                        {i === 0 && KINDS.filter((k) => !has(row.states, k)).map((k) => (
                          <button
                            key={k}
                            className={`mini-btn ${k}`}
                            onClick={() => setPending({ row, kind: k })}
                          >
                            {ADD_LABEL[k]}
                          </button>
                        ))}
                      </span>
                    </div>
                  ));
                })}
                {actionable.length === 0 && (
                  <div className="empty">Write something above to create an actionable point.</div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ---------- past logs ---------- */}
        <div className="tl-past">
          {/* Three rows, in the order they are read: what this is and the one
              action that resets it, then the field you search with, then the
              two things you narrow it by. "Jump to Today" sits on the
              heading's line because it belongs to the list as a whole, not to
              the filters underneath. */}
          <div className="tl-head-row">
            <h3 className="tl-h3">
              Think Logs
              <span className="tl-count">
                {filtered.length}{filtered.length !== thinkLogs.length && ` of ${thinkLogs.length}`}
              </span>
            </h3>

            <button
              type="button"
              className="btn-add tl-jump"
              onClick={() => {
                setQuery('');
                setSearchOpen(false);
                setPeriod('all');
                setKind('all');
                setPage(1);
                draftRef.current?.focus();
                toast('Jumped to today');
              }}
            >
              <CalendarIcon />
              Jump to Today
            </button>
          </div>

          {/* The field is always here now. Folding it behind an icon saved a
              row and cost a tap on the thing this panel is for. */}
          <div id="logSearch" className="search-wrap tl-search open">
            <SearchIcon />
            <input
              ref={searchRef}
              type="search"
              className="soft-in"
              placeholder="Search past logs…"
              aria-label="Search past logs"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="idea-filters tl-filters">
            <div className="select-box">
              <select aria-label="Filter logs by date" value={period} onChange={(e) => setPeriod(e.target.value)}>
                <option value="all">Any date</option>
                <option value="0">Today</option>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 3 months</option>
              </select>
              <ChevronDownIcon />
            </div>

            <div className="select-box">
              <select aria-label="Filter logs by outcome" value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="all">All points</option>
                <option value="idea">Became ideas</option>
                <option value="task">Became tasks</option>
                <option value="open">Still open</option>
              </select>
              <ChevronDownIcon />
            </div>
          </div>

          <div>
            {grouped.map((row, i) =>
              row.heading ? (
                <div className="past-group" key={`h-${row.heading}-${i}`}>{row.heading}</div>
              ) : (
                <div className="past-item" key={row.log.id}>
                  <span className="pi-body">
                    <strong>{row.log.title}</strong>
                    <span>
                      {fmtLong(parseYmd(row.log.date))}
                      {/* Whose note this is. The chairman's are readable by
                          everyone; your own are yours alone. */}
                      {' · '}
                      {row.log.ownerId === user?.id
                        ? 'You'
                        : displayName(row.log.owner, row.log.ownerRole)}
                      {row.log.sample && <em className="sample-tag">sample</em>}
                    </span>
                  </span>
                  <button className="btn-view" onClick={() => setViewLog(row.log)}>View</button>
                </div>
              )
            )}
          </div>
          {slice.length === 0 && <div className="empty">No past logs match your filters.</div>}

          <Pager page={current} pages={pages} onChange={setPage} />
        </div>
      </div>

      <IdeaSanctuaryModal
        open={pending?.kind === 'idea'}
        seedText={pending?.row?.text}
        logId={pending?.row?.id || null}
        onClose={() => setPending(null)}
        onSaved={() => markPoint(pending.row, 'idea')}
      />

      <CreateTaskModal
        open={pending?.kind === 'task'}
        seedText={pending?.row?.text}
        logId={pending?.row?.id || null}
        onClose={() => setPending(null)}
        onSaved={() => markPoint(pending.row, 'task')}
      />

      <EditPointModal
        open={!!editing}
        point={editing}
        onClose={() => setEditing(null)}
        onSave={(text) => editLogPoint(editing.id, text)}
      />

      <LogViewModal log={viewLog} onClose={() => setViewLog(null)} />
    </>
  );
}
