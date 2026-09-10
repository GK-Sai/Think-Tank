/* Date helpers — a direct port of the ones in the original dashboard,
   extended so the app carries a real point in time rather than a bare day.

   Two string shapes travel through the app and every helper below accepts
   both:

     'YYYY-MM-DD'                  a calendar day (a due date, a month cell)
     '2026-08-27T10:04:31.000Z'    an instant (when something was created)

   An instant is stored in UTC and rendered in the reader's own timezone, so
   an idea raised at 10:00 AM reads as 10:00 AM on the screen of anyone in
   the same office. That is the whole fix for the 9:00 / 10:00 discrepancy:
   nothing is ever written as a bare hour string again. */

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const DAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Local midnight for today. Computed once so every comparison agrees. */
export const TODAY = (() => {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
})();

export const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Any stored value -> a local Date.
 *
 * A bare 'YYYY-MM-DD' becomes local midnight (so month grids and due-date
 * arithmetic behave). A full timestamp is parsed by the engine and therefore
 * lands on the reader's own clock.
 */
export const toDate = (value) => {
  if (value instanceof Date) return value;
  const s = String(value ?? '');
  if (!s) return new Date(NaN);
  if (s.includes('T')) return new Date(s);
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return new Date(NaN);
  return new Date(y, m - 1, d);
};

/** Kept under its old name — every existing call site still works, and it
    now tolerates a full timestamp instead of returning Invalid Date. */
export const parseYmd = (s) => {
  const d = toDate(s);
  if (Number.isNaN(d.getTime())) return d;
  // Normalise a timestamp down to the local day it fell on.
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

/** The local calendar day a stored value belongs to, as 'YYYY-MM-DD'. */
export const dayOf = (value) => {
  const d = toDate(value);
  return Number.isNaN(d.getTime()) ? '' : ymd(d);
};

/** The instant, right now, in the form everything is stored in. */
export const nowIso = () => new Date().toISOString();

/** Build a timestamp for a given local day and time — used to seed demo data
    and to place a task on the calendar at a chosen hour. */
export const isoAt = (dayStr, hours = 9, minutes = 0) => {
  const d = parseYmd(dayStr);
  if (Number.isNaN(d.getTime())) return nowIso();
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
};

export const addDays = (d, n) => {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
};

export const fmtLong = (d) => {
  const x = toDate(d);
  return `${MONTHS[x.getMonth()]} ${x.getDate()}, ${x.getFullYear()}`;
};

export const fmtShort = (d) => {
  const x = toDate(d);
  return `${String(x.getDate()).padStart(2, '0')} ${MONTHS[x.getMonth()].slice(0, 3)} ${x.getFullYear()}`;
};

/** '10:04 AM' in the reader's own timezone. */
export const fmtTime = (value) => {
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return '';
  let h = d.getHours();
  const suffix = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${String(h).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} ${suffix}`;
};

/** Minutes since local midnight — what positions a task in the week grid. */
export const minutesOfDay = (value) => {
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return 0;
  return d.getHours() * 60 + d.getMinutes();
};

/** 'Aug 27, 2026 · 10:04 AM' — the stamp shown beside a change. */
export const fmtDateTime = (value) => {
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}, ${d.getFullYear()} · ${fmtTime(d)}`;
};

/** 'Today, 10:04 AM' / 'Yesterday, 5:40 PM' / '24 Aug 2026 · 11:00 AM'. */
export const fmtWhen = (value) => {
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return '';
  const diff = daysBetween(parseYmd(d), TODAY);
  if (diff === 0) return `Today, ${fmtTime(d)}`;
  if (diff === 1) return `Yesterday, ${fmtTime(d)}`;
  return fmtDateTime(d);
};

/** Monday-based start of week, matching the original chart. */
export const startOfWeek = (d) => {
  const c = new Date(d);
  c.setDate(c.getDate() - ((c.getDay() + 6) % 7));
  c.setHours(0, 0, 0, 0);
  return c;
};

export const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / 86400000);

/** Offset from today as a 'YYYY-MM-DD' string — used to seed demo data. */
export const dayOffset = (n) => ymd(addDays(TODAY, n));

/**
 * Offset from today as a full timestamp at a chosen local hour.
 *
 * Used only to seed the demo data. Something that already happened must not
 * be stamped in the future: if you open the app at 7am and the seed wants
 * "today at 9:12", the stamp is pulled back into the recent past instead,
 * keeping the order the seed intended.
 *
 * Only offsets in the past or today are clamped. A positive offset is a
 * scheduled start — work due next Tuesday is supposed to be in the future.
 */
export const stampOffset = (n, hours = 9, minutes = 0) => {
  const iso = isoAt(dayOffset(n), hours, minutes);
  if (n > 0 || new Date(iso).getTime() <= Date.now()) return iso;
  const minutesBack = Math.max(2, (24 - hours) * 5 - Math.round(minutes / 10));
  return new Date(Date.now() - minutesBack * 60000).toISOString();
};

/** Which heading a notification or log sits under. */
export const bucketOf = (value) => {
  const diff = daysBetween(parseYmd(value), TODAY);
  if (diff <= 0) return 'today';
  if (diff === 1) return 'yesterday';
  return 'earlier';
};

/** Compact "4m" / "2h" / "3w" style age used beside a comment author's name.
    Timestamps get minute and hour resolution; a bare day starts at "today". */
export const fmtAgo = (value) => {
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return '';

  const hasTime = String(value).includes('T');
  if (hasTime) {
    const mins = Math.floor((Date.now() - d.getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
  }

  const days = daysBetween(parseYmd(d), TODAY);
  if (days <= 0) return 'today';
  if (days === 1) return '1d';
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}w`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${Math.floor(days / 365)}y`;
};
