import { TODAY, parseYmd, daysBetween } from './date';

/* The chairman is never shown by personal name — the whole organisation
   knows the office, not the person. One constant so the word only ever
   has to change in a single place. */
export const CHAIR_LABEL = 'Chairman';

/**
 * What to print where a person's name would go.
 *
 * The database can still hold the chairman's real name (and the backend can
 * keep sending it); the UI substitutes the office. Everyone else is shown
 * exactly as they are.
 */
export const displayName = (name, role) =>
  (role === 'chairman' ? CHAIR_LABEL : (name || ''));

/** True when this record is the chairman, whichever field carries the role. */
export const isChairRecord = (r) =>
  r?.role === 'chairman' || r?.accountRole === 'chairman' || r?.authorRole === 'chairman';

export const initialsOf = (name) =>
  String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');

export const fmtSize = (b) => {
  if (b >= 1048576) return `${(b / 1048576).toFixed(1)} MB`;
  if (b >= 1024) return `${Math.round(b / 1024)} KB`;
  return `${b} B`;
};

export const extOf = (name) => {
  const p = String(name).split('.');
  return p.length > 1 ? p.pop().slice(0, 4) : 'file';
};

export const wordCount = (t) => (String(t).trim() ? String(t).trim().split(/\s+/).length : 0);

/** A task is Overdue the moment its due date passes, whatever it was saved as. */
export const effStatus = (t) => {
  if (t.status === 'Completed') return 'Completed';
  if (daysBetween(TODAY, parseYmd(t.due)) < 0) return 'Overdue';
  return t.status;
};

export const statusTagClass = (s) =>
  s === 'Approved' ? 'green' : s === 'In Progress' ? '' : s === 'On Hold' ? 'grey' : 'amber';

/** Which colour a task gets on the calendar. */
export const calClass = (t) => {
  const st = effStatus(t);
  if (st === 'Completed') return 'd';
  if (st === 'Re Assign') return 'r';
  return 't';
};

export const plural = (n, word, suffix = 's') => `${n} ${word}${n === 1 ? '' : suffix}`;
