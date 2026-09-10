import { useEffect, useRef, useState } from 'react';
import { Avatar } from '../../lib/avatars';
import { fmtWhen, fmtTime, parseYmd, fmtLong, dayOf } from '../../lib/date';
import { TrashIcon, SendIcon, PencilIcon } from '../../lib/icons';
import { displayName, CHAIR_LABEL } from '../../lib/format';
import { useAuth } from '../../store/AuthContext';

/**
 * The group discussion beside an idea.
 *
 * Everyone the chairman invited is in here, and every message carries the
 * person's name and the date and time they wrote it — that is the whole
 * record of how a decision got made. You can edit your own message; the
 * original time stays and an "edited" mark is added, so nothing is quietly
 * rewritten after the fact.
 *
 */
export default function IdeaComments({
  comments = [], onAdd, onRemove, onEdit, canComment = true,
}) {
  const { user, isChair } = useAuth();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const listRef = useRef(null);
  const seen = useRef(comments.length);

  /* Keep the newest message in view as the conversation grows, the way any
     group chat does — but only when something was actually added, so reading
     back through the thread is not yanked to the bottom on every re-render. */
  useEffect(() => {
    if (comments.length > seen.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
    seen.current = comments.length;
  }, [comments.length]);

  const send = async () => {
    const clean = text.trim();
    if (!clean || sending) return;
    setSending(true);
    try {
      await onAdd(clean);
      setText('');
    } catch {
      /* the store already showed the error in a toast */
    } finally {
      setSending(false);
    }
  };

  // Enter posts, Shift+Enter starts a new line — what people expect of a
  // comment box, and it keeps the button honest for keyboard users.
  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const saveEdit = async (id) => {
    const clean = editText.trim();
    if (!clean) return;
    try {
      await onEdit(id, clean);
      setEditingId(null);
    } catch { /* toasted already */ }
  };

  const [sex, variant] = user?.av || ['male', 0];

  /* A "Today" / "Yesterday" line whenever the day changes, so a long thread
     reads as a conversation over time rather than one undated wall. */
  let lastDay = null;

  return (
    <aside className="cmt-rail" aria-label="Discussion">
      <h3 className="cmt-h">
        Discussion
        {comments.length > 0 && <span className="cmt-h-count">{comments.length}</span>}
      </h3>

      <div className="cmt-list" ref={listRef}>
        {comments.map((c) => {
          const mine = c.authorId === user?.id;
          const [csex, cvar] = c.authorAv || ['male', 0];
          const who = displayName(c.authorName, c.authorRole);
          const showRole = c.authorRole === 'chairman' && who !== CHAIR_LABEL;
          const day = dayOf(c.at);
          const newDay = day !== lastDay;
          lastDay = day;
          const editing = editingId === c.id;

          return (
            <div key={c.id}>
              {newDay && <div className="cmt-day">{fmtLong(parseYmd(c.at))}</div>}

              <div className={`cmt${mine ? ' mine' : ''}`}>
                <Avatar sex={csex} variant={cvar} className="cmt-av" title={who} />
                <div className="cmt-b">
                  <div className="cmt-meta">
                    <strong>{who}</strong>
                    {showRole && <span className="cmt-role">Chairman</span>}
                    {/* Name, date and time on every single message. */}
                    <span className="cmt-time" title={fmtWhen(c.at)}>{fmtTime(c.at)}</span>
                    {c.editedAt && (
                      <span className="cmt-edited" title={`Edited ${fmtWhen(c.editedAt)}`}>edited</span>
                    )}

                    {mine && onEdit && canComment && !editing && (
                      <button
                        type="button"
                        className="cmt-act"
                        title="Edit message"
                        aria-label="Edit your message"
                        onClick={() => { setEditingId(c.id); setEditText(c.text); }}
                      >
                        <PencilIcon />
                      </button>
                    )}
                    {(mine || isChair) && onRemove && (
                      <button
                        type="button"
                        className="cmt-act cmt-del"
                        title="Delete message"
                        aria-label={`Delete message by ${who}`}
                        onClick={() => onRemove(c.id)}
                      >
                        <TrashIcon />
                      </button>
                    )}
                  </div>

                  {editing ? (
                    <div className="cmt-edit">
                      <textarea
                        rows={3}
                        value={editText}
                        aria-label="Edit your message"
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(c.id); }
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                      />
                      <div className="cmt-edit-foot">
                        <button type="button" className="btn-ghost-sm" onClick={() => setEditingId(null)}>
                          Cancel
                        </button>
                        <button type="button" className="btn-solid-sm" onClick={() => saveEdit(c.id)}>
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="cmt-text">{c.text}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {comments.length === 0 && (
          <p className="cmt-empty">Nobody has spoken yet. Say the first thing.</p>
        )}
      </div>

      {canComment ? (
        <div className="cmt-compose">
          <Avatar sex={sex} variant={variant} className="cmt-av" />
          <div className="cmt-input">
            <textarea
              rows={1}
              placeholder="Write to the team"
              aria-label="Write a message to the team"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
            />
            <button
              type="button"
              className="cmt-send"
              onClick={send}
              disabled={sending || !text.trim()}
              aria-label="Send message"
              title="Send message"
            >
              <SendIcon />
            </button>
          </div>
        </div>
      ) : (
        <p className="cmt-locked">This idea is not open for discussion.</p>
      )}
    </aside>
  );
}
