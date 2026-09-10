import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import { fmtWhen } from '../../lib/date';
import {
  TaskIcon, BulbIcon, SmallTeamIcon, ClockIcon, WarnIcon, CheckIcon, CloseIcon,
} from '../../lib/icons';

const ICONS = {
  task: { cls: '', El: TaskIcon },
  idea: { cls: '', El: BulbIcon },
  team: { cls: '', El: SmallTeamIcon },
  snooze: { cls: 'amber', El: ClockIcon },
  warn: { cls: 'red', El: WarnIcon },
  ok: { cls: 'green', El: CheckIcon },
};

/* Anything older than this was already on the screen before you looked, so it
   arrives as a bell badge rather than as a card in front of your work. */
const FRESH_MS = 2 * 60 * 1000;
const LIFETIME = 9000;
const MAX_ON_SCREEN = 3;

/**
 * The pop-up that tells you the chairman has opened an idea.
 *
 * It watches the notification list for entries that appeared *since this
 * screen loaded* and slides a card in at the top right for each one. The card
 * carries the message and the time, and clicking it takes you straight to the
 * discussion — which is the whole point: you are being asked to come and say
 * something, so the popup should put you there in one click.
 *
 * Notifications already sitting unread when you sign in do not pop; they would
 * be a wall of cards for things you have not missed. The bell handles those.
 */
export default function NotificationPopups() {
  const { notifs, loading } = useApp();
  const navigate = useNavigate();

  const [queue, setQueue] = useState([]);
  const known = useRef(null);          // ids seen on a previous render
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setQueue((q) => q.filter((n) => n.id !== id));
    const t = timers.current.get(id);
    if (t) { clearTimeout(t); timers.current.delete(id); }
  }, []);

  useEffect(() => {
    /* Wait for the first load to finish before taking the baseline. The store
       starts with an empty list, and treating that as "what was already here"
       would pop a card for every recent unread notification the moment you
       signed in — exactly the wall of cards this is meant to avoid. */
    if (loading) return;

    // First pass after sign-in: remember what is already there, pop nothing.
    if (known.current === null) {
      known.current = new Set(notifs.map((n) => n.id));
      return;
    }

    const fresh = notifs.filter((n) => {
      if (known.current.has(n.id)) return false;
      known.current.add(n.id);
      if (!n.unread) return false;
      return Date.now() - new Date(n.at).getTime() < FRESH_MS;
    });

    if (!fresh.length) return;

    setQueue((q) => [...fresh, ...q].slice(0, MAX_ON_SCREEN));

    fresh.forEach((n) => {
      timers.current.set(n.id, setTimeout(() => dismiss(n.id), LIFETIME));
    });
  }, [notifs, loading, dismiss]);

  useEffect(() => () => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current.clear();
  }, []);

  const open = (n) => {
    dismiss(n.id);
    if (n.link) navigate(n.link);
  };

  if (!queue.length) return null;

  return (
    <div className="popups" role="region" aria-label="New notifications">
      {queue.map((n) => {
        const { cls, El } = ICONS[n.icon] || ICONS.idea;
        return (
          <div
            className="popup"
            key={n.id}
            role="alert"
            ref={(el) => bindSwipe(el, () => dismiss(n.id))}
          >
            {/* The banner itself is the button. A phone notification is not a
                card with a link inside it — you tap the thing that appeared. */}
            <button
              type="button"
              className="popup-tap"
              onClick={() => open(n)}
              disabled={!n.link}
            >
              {/* Who it is from, the way a push banner names its app. */}
              <span className="popup-head">
                <img className="popup-app" src="/logo-mark.png" alt="" aria-hidden="true" />
                <span className="popup-app-name">Think Tank</span>
                <span className="popup-when">{fmtWhen(n.at)}</span>
              </span>

              <span className="popup-msg">
                <span className={`popup-ico ${cls}`}><El /></span>
                <span className="popup-b">
                  <strong>{n.title}</strong>
                  {n.link && (
                    <span className="popup-hint">
                      {n.link.startsWith('/ideas/') ? 'Tap to open the discussion' : 'Tap to take a look'}
                    </span>
                  )}
                </span>
              </span>
            </button>

            {/* A phone dismisses with a swipe, which the handle hints at; the
                × is for everyone reading this on a desktop. */}
            <span className="popup-grip" aria-hidden="true" />
            <button
              type="button"
              className="popup-x"
              onClick={() => dismiss(n.id)}
              aria-label="Dismiss notification"
            >
              <CloseIcon />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Flick a banner away.
 *
 * A push notification is got rid of with a swipe, not by hunting for a close
 * button, so the banner follows the finger and leaves if it is thrown far
 * enough. The listeners go on the node directly because the move has to be
 * passive:false — the page underneath would otherwise scroll instead.
 */
function bindSwipe(el, onGone) {
  if (!el || el.dataset.swipe) return;
  el.dataset.swipe = '1';

  let x0 = 0;
  let y0 = 0;
  let dx = 0;
  let dy = 0;
  let live = false;

  const reset = () => { el.style.transition = 'transform .18s ease, opacity .18s ease'; el.style.transform = ''; el.style.opacity = ''; };

  el.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    live = true;
    dx = 0; dy = 0;
    x0 = e.touches[0].clientX;
    y0 = e.touches[0].clientY;
    el.style.transition = 'none';
  }, { passive: true });

  el.addEventListener('touchmove', (e) => {
    if (!live) return;
    dx = e.touches[0].clientX - x0;
    dy = e.touches[0].clientY - y0;
    /* Up, or either way sideways — the directions a banner is thrown. Down is
       left alone so the page can still be scrolled from here. */
    if (dy > 12 && Math.abs(dy) > Math.abs(dx)) { live = false; reset(); return; }
    e.preventDefault();
    const up = Math.min(0, dy);
    el.style.transform = `translate(${dx}px, ${up}px)`;
    el.style.opacity = String(Math.max(0.25, 1 - (Math.abs(dx) + Math.abs(up)) / 220));
  }, { passive: false });

  const end = () => {
    if (!live) return;
    live = false;
    if (Math.abs(dx) > 70 || dy < -44) {
      el.style.transition = 'transform .16s ease, opacity .16s ease';
      el.style.transform = `translate(${dx > 0 ? 400 : -400}px, ${Math.min(0, dy)}px)`;
      el.style.opacity = '0';
      setTimeout(onGone, 140);
    } else {
      reset();
    }
  };

  el.addEventListener('touchend', end);
  el.addEventListener('touchcancel', end);
}
