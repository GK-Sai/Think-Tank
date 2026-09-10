import { useEffect, useRef, useState } from 'react';
import { displayName } from '../../lib/format';
import { fmtTime, dayOf, parseYmd, fmtLong } from '../../lib/date';
import { useApp } from '../../store/AppContext';
import { SendIcon } from '../../lib/icons';

/**
 * One conversation: the messages, and the box to write the next one.
 *
 * It has no window of its own. It is the body of the Messaging panel — whose
 * conversation this is sits in that panel's header — so a private message is
 * read in the place the list of conversations was, and never in a second
 * floating window laid over the page.
 */
export default function MessagingDock({ person }) {
  const { openThread, sendMessage } = useApp();

  const [thread, setThread] = useState(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bodyRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!person) { setThread(null); return undefined; }
    let cancelled = false;
    setText('');
    openThread(person.id)
      .then((t) => { if (!cancelled) setThread(t); })
      .catch(() => { if (!cancelled) setThread(null); });
    return () => { cancelled = true; };
  }, [person, openThread]);

  /* Land at the newest message, and put the cursor in the box — the two
     things you always want when a conversation opens. */
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [thread]);

  useEffect(() => { inputRef.current?.focus(); }, [person]);

  if (!person) return null;

  const who = displayName(person.name, person.accountRole);

  const send = async () => {
    const clean = text.trim();
    if (!clean || sending) return;
    setSending(true);
    try {
      const t = await sendMessage(person.id, clean);
      setThread(t);
      setText('');
    } catch {
      /* the store toasted the reason */
    } finally {
      setSending(false);
    }
  };

  let lastDay = null;

  return (
    <>
      <div className="dock-body" ref={bodyRef}>
        {thread?.messages?.length ? thread.messages.map((m) => {
          const day = dayOf(m.at);
          const newDay = day !== lastDay;
          lastDay = day;
          return (
            <div key={m.id}>
              {newDay && <div className="dock-day">{fmtLong(parseYmd(m.at))}</div>}
              <div className={`dock-msg${m.mine ? ' mine' : ''}`}>
                <p>{m.text}</p>
                <span>{fmtTime(m.at)}</span>
              </div>
            </div>
          );
        }) : (
          <p className="dock-empty">
            No messages yet. This stays between you and {who} — it is not part
            of the group discussion.
          </p>
        )}
      </div>

      <div className="dock-compose">
        <textarea
          ref={inputRef}
          rows={1}
          placeholder={`Message ${who}`}
          aria-label={`Message ${who}`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
          }}
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
    </>
  );
}
