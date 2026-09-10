import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import BackLink from '../components/layout/BackLink';
import IdeaComments from '../components/ideas/IdeaComments';
import DescriptionView from '../components/ideas/DescriptionView';
import EditIdeaModal from '../components/ideas/EditIdeaModal';
import ExportBar from '../components/ideas/ExportBar';
import PrintableDescription from '../components/ideas/PrintableDescription';
import ImplementationDateModal from '../components/ideas/ImplementationDateModal';
import ShareIdeaModal from '../components/ideas/ShareIdeaModal';
import HistoryModal from '../components/ideas/HistoryModal';
import MessagingHub from '../components/messaging/MessagingHub';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useApp } from '../store/AppContext';
import { useAuth } from '../store/AuthContext';
import { useToast } from '../store/ToastContext';
import { parseYmd, fmtShort, fmtWhen } from '../lib/date';
import { displayName, statusTagClass } from '../lib/format';
import { CalendarIcon, ShareIcon, PencilIcon, HistoryIcon, MenuIcon, CloseIcon } from '../lib/icons';

/* The words the board filters and colours by. A published idea is never put
   back to Draft — the company has already been told about it — so Draft is
   offered only while the idea still is one. */
const LIVE_STATUSES = ['Under Review', 'Approved', 'In Progress', 'On Hold', 'Rejected'];

/**
 * One version of the description.
 *
 * Every version is on the page, oldest first: what the chairman created, then
 * each edit below it. Reading down the page is reading the idea as it
 * developed.
 *
 * Every one of them is drawn in the shape it was written, not only the newest
 * — the chairman's original flowchart is still a flowchart after a member has
 * edited it, because each version stores its own description rather than a
 * text summary of it.
 *
 * **Each version prints itself.** One pair of buttons at the top of the page
 * printed whichever version happened to be newest, which on an idea that has
 * been edited two or three times is a guess dressed up as a feature: the sheet
 * that came out did not say which version it was, so two people could print
 * "the idea" on the same afternoon and hold different pages. The buttons
 * belong to the version they sit on. Each one carries its own hidden sheet,
 * headed with the version it is and who wrote it, and saves under its own
 * name — `-v1`, `-v2`, `-v3` — so the file on disk cannot be mistaken either.
 */
function Version({ idea, revision, index, total, isLatest, footer }) {
  const who = displayName(revision.authorName, revision.authorRole);
  const printRef = useRef(null);
  const versionNo = index + 1;

  /* "Version 2 of 3" on the page and in the file name. A lone version needs
     no number — there is nothing for it to be confused with. */
  const stamp = total > 1 ? `Version ${versionNo} of ${total}` : null;
  const fileName = total > 1 ? `${idea.title} v${versionNo}` : idea.title;

  return (
    <article className={`rev-block${isLatest ? ' latest' : ''}`}>
      <div className="rev-head">
        <h2 className="rev-title">
          {idea.title}
          {stamp && (
            <span className={`rev-vtag${isLatest ? ' current' : ''}`}>
              {stamp}{isLatest ? ' · current' : ''}
            </span>
          )}
        </h2>
        <ExportBar
          targetRef={printRef}
          name={fileName}
          label={stamp ? `version ${versionNo}` : 'this idea'}
        />
      </div>

      {revision.descriptionType ? (
        <DescriptionView
          type={revision.descriptionType}
          content={revision.descriptionContent}
          fallbackText={revision.text}
        />
      ) : (
        /* A record written before versions kept their own snapshot. */
        <div className="rev-text">
          {revision.text.split('\n').filter(Boolean).map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      )}

      <div className="rev-foot">
        {footer}
        <span className="rev-by">
          {index === 0 ? `Created By ${who}` : `Edited By ${who}`}
          <em>{fmtWhen(revision.at)}</em>
        </span>
      </div>

      <PrintableDescription
        ref={printRef}
        title={idea.title}
        version={stamp}
        tagline={idea.tagline}
        purpose={idea.purpose}
        dept={idea.dept}
        author={`${index === 0 ? 'Created by' : 'Edited by'} ${who}`}
        when={fmtWhen(revision.at)}
        type={revision.descriptionType}
        content={revision.descriptionContent}
        fallbackText={revision.text}
      />
    </article>
  );
}

export default function IdeaDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user, isChair } = useAuth();
  const {
    ideas, team, thinkLogs, getIdea, addIdeaComment, removeIdeaComment, editIdeaComment,
    addIdeaRevision, setImplementationDate, setIdeaStatus, shareIdea,
  } = useApp();

  // Show whatever the list already has while the fresh copy loads, so the
  // page paints immediately instead of flashing a spinner.
  const cached = useMemo(
    () => ideas.find((i) => i.id === Number(id)) || null,
    [ideas, id]
  );

  const [idea, setIdea] = useState(cached);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState(null);

  const [editOpen, setEditOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [removingComment, setRemovingComment] = useState(null);
  const [savingStatus, setSavingStatus] = useState(false);
  const [chatWith, setChatWith] = useState(null);
  /* Phone only: the discussion is folded away behind the hamburger in the top
     bar and slides in from the left over the idea. On a wide screen it is
     always the right-hand column and this flag is never read. */
  const [discussOpen, setDiscussOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(!cached);
    getIdea(id)
      .then((found) => { if (!cancelled) { setIdea(found); setError(null); } })
      .catch((err) => { if (!cancelled) setError(err?.message || 'Could not load this idea'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // `cached` deliberately left out: it changes on every store write and
    // would re-fetch in a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, getIdea]);

  // Keep the page in step with store updates made elsewhere.
  useEffect(() => { if (cached) setIdea(cached); }, [cached]);

  /* While the discussion is over the page, Escape closes it and the page
     behind it does not scroll away under your thumb. */
  useEffect(() => {
    if (!discussOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setDiscussOpen(false); };
    document.addEventListener('keydown', onKey);
    const kept = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = kept;
    };
  }, [discussOpen]);

  /* Whoever is being messaged has to come from the live team list, so the
     online dot in the chat header keeps up with the heartbeat. */
  const chatPerson = useMemo(
    () => (chatWith ? team.find((m) => m.id === chatWith.id) || chatWith : null),
    [chatWith, team]
  );

  /* The note this idea was captured from. The idea stores the point's id, so
     the wording comes from the think log itself and follows any rewording of
     it — rather than being a copy taken on the day. */
  const fromLogText = useMemo(() => {
    if (!idea?.fromLog) return '';
    for (const log of thinkLogs) {
      const point = (log.points || []).find((p) => p.id === idea.fromLog);
      if (point) return point.text;
    }
    return '';
  }, [idea, thinkLogs]);

  const revisions = idea?.revisions || [];
  const latest = revisions[revisions.length - 1] || null;

  if (loading && !idea) {
    return (
      <>
        <BackLink to="/ideas" label="Back to Ideas" />
        <div className="empty" style={{ marginTop: 24 }}>Loading idea…</div>
      </>
    );
  }

  if (error || !idea) {
    return (
      <>
        <BackLink to="/ideas" label="Back to Ideas" />
        <div className="empty" style={{ marginTop: 24 }}>
          {error || 'That idea could not be found.'}
        </div>
      </>
    );
  }

  const carrying = team.filter((m) => (idea.sharedWith || []).includes(m.id));

  return (
    <>
      <div className="detail-bar">
        <BackLink to="/ideas" label="Back to Ideas" />

        {/* Phone only: opens the discussion as a panel over the page. It sits
            on the Back-to-Ideas line at the far right and carries the number
            of messages, so you can see there is a conversation without
            opening it. */}
        <button
          type="button"
          className="btn-icon-act disc-toggle"
          onClick={() => setDiscussOpen(true)}
          aria-label="Open discussion"
          title="Discussion"
        >
          <MenuIcon />
          {idea.comments?.length > 0 && (
            <span className="share-count">{idea.comments.length}</span>
          )}
        </button>

        <div className="detail-actions">
          {/* The history sits behind a clock at the top right rather than in a
              panel under the conversation. */}
          <button
            type="button"
            className="btn-icon-act"
            onClick={() => setHistoryOpen(true)}
            aria-label="Change history"
            title="Change history"
          >
            <HistoryIcon />
            {idea.activity?.length > 0 && (
              <span className="share-count">{idea.activity.length}</span>
            )}
          </button>

          {idea.canEditIdea && (
            <button type="button" className="btn-edit-idea" onClick={() => setEditOpen(true)}>
              <PencilIcon />
              Edit
            </button>
          )}

          {/* Share is the chairman's: it names who will carry the project.
              Once it is shared, the button simply says so. It carries no
              count: a number here read as an unread badge that came back on
              every visit, and the people carrying the project are named on
              the page underneath — and inside the dialog — anyway. */}
          {isChair && (
            <button
              type="button"
              className={`btn-share${carrying.length ? ' shared' : ''}`}
              onClick={() => setShareOpen(true)}
              title={carrying.length
                ? `Carried by ${carrying.map((m) => displayName(m.name, m.accountRole)).join(', ')}`
                : 'Name the people who will carry this project'}
            >
              <ShareIcon />
              {carrying.length ? 'Shared' : 'Share'}
            </button>
          )}
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-main">
          <div className="detail-meta">
            <span className="detail-sub">
              Created by {displayName(idea.owner, idea.ownerRole)} on {fmtWhen(idea.createdAt || idea.created)}
            </span>

            {/* Where the idea has got to. Moving it on is the chairman's —
                the same decision the Ideas board filters by — so for him it
                is a control and for everyone else it is the label it was. */}
            {isChair ? (
              <span className="status-select">
                <select
                  aria-label="Idea status"
                  value={idea.status}
                  disabled={savingStatus}
                  onChange={async (e) => {
                    const next = e.target.value;
                    if (next === idea.status) return;
                    setSavingStatus(true);
                    try {
                      const saved = await setIdeaStatus(idea.id, next);
                      setIdea(saved);
                      toast(`Status set to ${next}`);
                    } catch { /* the store toasted the reason */ }
                    setSavingStatus(false);
                  }}
                >
                  {(idea.status === 'Draft' ? ['Draft', ...LIVE_STATUSES] : LIVE_STATUSES)
                    .map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </span>
            ) : (
              <span className={`tag ${statusTagClass(idea.status)}`}>{idea.status}</span>
            )}
          </div>

          {carrying.length > 0 && (
            <div className="access-row">
              <span className="access-pill owner">Shared with</span>
              {carrying.map((m) => (
                <span className="access-pill" key={m.id}>
                  {displayName(m.name, m.accountRole)}
                </span>
              ))}
            </div>
          )}

          {/* Created first, then every edit under it. */}
          {revisions.map((rev, index) => (
            <Version
              key={rev.id ?? index}
              idea={idea}
              revision={rev}
              index={index}
              total={revisions.length}
              isLatest={rev === latest}
              footer={rev === latest && (
                <>
                  {/* Only the chairman schedules an idea. */}
                  {isChair && (
                    <button type="button" className="btn-impl" onClick={() => setDateOpen(true)}>
                      {idea.implementationDate
                        ? `Implementing ${fmtShort(parseYmd(idea.implementationDate))}`
                        : 'Set Implementation Date'}
                      <CalendarIcon />
                    </button>
                  )}
                  {!isChair && idea.implementationDate && (
                    <span className="impl-static">
                      <CalendarIcon />
                      Implementing {fmtShort(parseYmd(idea.implementationDate))}
                    </span>
                  )}
                </>
              )}
            />
          ))}

          {idea.purpose && (
            <div className="detail-purpose">
              <h4>Purpose of the idea</h4>
              <p>{idea.purpose}</p>
            </div>
          )}

          {idea.fromLog != null && (
            <p className="from-log">
              {fromLogText
                ? <>Captured from the think log — “{fromLogText}”</>
                : 'Captured from the think log'}
            </p>
          )}

          {idea.canEditIdea && (
            <button
              type="button"
              className="btn-ghost-sm full-editor-link"
              onClick={() => navigate(`/ideas/${idea.id}/edit`)}
            >
              Open the full editor (tagline, purpose, department, flowchart…)
            </button>
          )}
        </div>

        {/* The group discussion. It has the whole column to itself: the team
            and the private messages are in the Messaging bar at the bottom of
            the screen, so there is only ever one place to write to somebody. */}
        <button
          type="button"
          className={`disc-scrim${discussOpen ? ' open' : ''}`}
          aria-label="Close discussion"
          tabIndex={discussOpen ? 0 : -1}
          onClick={() => setDiscussOpen(false)}
        />

        <div className={`detail-side${discussOpen ? ' open' : ''}`}>
          {/* Phone only — the drawer's own title bar. */}
          <div className="side-head">
            <h3>Discussion</h3>
            <button
              type="button"
              className="side-close"
              onClick={() => setDiscussOpen(false)}
              aria-label="Close discussion"
            >
              <CloseIcon />
            </button>
          </div>

          <IdeaComments
            comments={idea.comments || []}
            canComment={idea.canComment}
            onAdd={async (text) => {
              const saved = await addIdeaComment(idea.id, text);
              setIdea(saved);
            }}
            onEdit={async (commentId, text) => {
              const saved = await editIdeaComment(idea.id, commentId, text);
              setIdea(saved);
            }}
            onRemove={(commentId) => setRemovingComment(commentId)}
          />

          {/* Messaging sits under the discussion, in the same column: the
              group thread on top, the private word underneath. */}
          <MessagingHub
            person={chatPerson}
            onSelect={setChatWith}
            onClose={() => setChatWith(null)}
          />
        </div>
      </div>

      <EditIdeaModal
        open={editOpen}
        idea={idea}
        onClose={() => setEditOpen(false)}
        onSave={async (description) => {
          const saved = await addIdeaRevision(idea.id, description);
          setIdea(saved);
          toast('New version saved');
        }}
      />

      <ImplementationDateModal
        open={dateOpen}
        current={idea.implementationDate}
        onClose={() => setDateOpen(false)}
        onSave={async (date) => {
          const saved = await setImplementationDate(idea.id, date);
          setIdea(saved);
          toast(date
            ? `Implementation date set — it is on the team's calendar`
            : 'Implementation date cleared');
        }}
      />

      <ShareIdeaModal
        open={shareOpen}
        idea={idea}
        onClose={() => setShareOpen(false)}
        onSave={async (payload) => {
          const saved = await shareIdea(idea.id, payload);
          setIdea(saved);
        }}
      />

      <HistoryModal
        open={historyOpen}
        activity={idea.activity}
        onClose={() => setHistoryOpen(false)}
      />

      <ConfirmDialog
        open={removingComment !== null}
        title="Delete this message?"
        body="It will disappear for everyone in the discussion."
        okLabel="Delete"
        onCancel={() => setRemovingComment(null)}
        onConfirm={async () => {
          try {
            const saved = await removeIdeaComment(idea.id, removingComment);
            setIdea(saved);
            toast('Message deleted');
          } finally {
            setRemovingComment(null);
          }
        }}
      />

    </>
  );
}
