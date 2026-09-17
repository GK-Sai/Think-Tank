import { useEffect, useState } from 'react';

/**
 * "Is this a phone or a tablet?"
 *
 * CSS can hold a change to one screen size; a component cannot. A media query
 * gates a *style*, so a rule written inside `@media (max-width: 1279px)` never
 * reaches a laptop — but a component that renders an arrow instead of a
 * labelled button, or the app's own dropdown instead of the browser's, renders
 * that way everywhere, because JavaScript has no media query around it.
 *
 * That is how a round of mobile-only work ended up changing the web app as
 * well. This is the missing guard: every component that behaves differently on
 * a small screen asks this first, and above the breakpoint they render exactly
 * what they rendered before any of this started.
 *
 * 1279px matches the breakpoint in app.css. Keep the two in step — if one
 * moves and the other does not, a tablet gets a phone's component inside a
 * desktop's layout.
 */
const QUERY = '(max-width: 1279px)';

export default function useCompact() {
  const [compact, setCompact] = useState(() => (
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(QUERY).matches
      : false
  ));

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mq = window.matchMedia(QUERY);
    const onChange = (e) => setCompact(e.matches);
    setCompact(mq.matches);          // in case it changed before this ran
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return compact;
}
