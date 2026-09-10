/* ------------------------------------------------------------------
   The real API client — one place that talks to the backend.

   Nothing imports this file directly: lib/api.js decides between this
   and lib/mockApi.js. Until the backend exists the app runs on the mock;
   set VITE_USE_MOCK=false in .env to switch over.

   Auth is a Bearer token: login hands back a JWT, this file keeps it in
   localStorage and attaches it as `Authorization: Bearer <token>` on every
   request. Nothing outside this file needs to know that — `api.auth.login`
   still returns the user, exactly as the mock does.
------------------------------------------------------------------ */

/* Where the API lives.

   Leave VITE_API_URL empty and every call goes to the page's own origin,
   which is what the Vite proxy in vite.config.js is for: the browser only
   ever talks to the dev server and CORS never comes into it. Set it to an
   absolute URL to call a deployed API directly instead. */
const BASE = import.meta.env.VITE_API_URL || window.location.origin;

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/* ------------------------------------------------------------------
   The access token.

   Login hands one back; it lives in localStorage so a refresh is not a
   sign-out, and a module variable holds it too so the common path never
   touches storage. Nothing else in the app imports these.
------------------------------------------------------------------ */

const TOKEN_KEY = 'tt_token';

let token = (() => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
})();

export const getToken = () => token;

export function setToken(next) {
  token = next || null;
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* Private browsing, or storage is full. The session still works for as
       long as this tab stays open — it just will not survive a refresh. */
  }
}

const authHeaders = (body) => {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

async function request(path, { method = 'GET', body, params } = {}) {
  const url = new URL(BASE + path);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
    });
  }

  let res;
  try {
    res = await fetch(url, {
      method,
      headers: authHeaders(body),
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Cannot reach the server. Is the API running?', 0);
  }

  if (res.status === 204) return null;

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    /* An expired or rejected token is not worth keeping: drop it so the next
       boot goes straight to the sign-in screen instead of retrying it. */
    if (res.status === 401) setToken(null);
    // FastAPI puts the message in `detail`; validation errors make it a list.
    const detail = data?.detail;
    const message = Array.isArray(detail)
      ? detail.map((d) => d.msg).join(', ')
      : detail || `Request failed (${res.status})`;
    throw new ApiError(message, res.status);
  }
  return data;
}

const get = (path, params) => request(path, { params });
const post = (path, body, params) => request(path, { method: 'POST', body, params });
const put = (path, body) => request(path, { method: 'PUT', body });
const patch = (path, body, params) => request(path, { method: 'PATCH', body, params });
const del = (path) => request(path, { method: 'DELETE' });

/* ------------------------------------------------------------------
   Shape adapters.
   The API speaks snake_case and returns nested owner objects; the React
   components were written against the original flat camelCase shapes.
   Converting here keeps every component unchanged.
------------------------------------------------------------------ */

export const toMember = (u) => ({
  id: u.id,
  name: u.name,
  dept: u.dept,
  role: u.title,            // the job title shown in the Role pill
  accountRole: u.role,      // 'chairman' | 'member'
  email: u.email,
  av: u.av,
  online: !!u.online,
  lastSeenAt: u.last_seen_at || null,
});

export const toIdea = (i) => ({
  id: i.id,
  title: i.title,
  tagline: i.tagline,
  purpose: i.purpose,
  tag: i.tag,
  status: i.status,
  created: i.created,
  owner: i.owner?.name || '',
  ownerId: i.owner?.id,
  ownerAv: i.owner?.av || ['male', 0],
  ownerRole: i.owner?.role || 'member',
  createdAt: i.created_at || i.created,
  updatedAt: i.updated_at || i.created_at || i.created,
  sharedWith: (i.shared_with || []).map((u) => u.id),
  implementationDate: i.implementation_date || null,
  /* The think-log point this idea was captured from, as its id. The title is
     not stored on the idea — the page looks it up in the think logs it has
     already loaded, so a reworded note reads correctly here too. */
  fromLog: i.from_log ?? null,
  dept: i.dept || null,
  /* The server decides who may post and who may edit — see the rules at the
     top of mockApi.js, which the backend mirrors. */
  canComment: !!i.can_comment,
  canEditIdea: !!i.can_edit_idea,
  descriptionType: i.description_type,
  descriptionContent: i.description_content,
  activity: (i.activity || []).map((a) => ({
    id: a.id,
    at: a.created_at,
    actorId: a.actor?.id,
    actorName: a.actor?.name || '',
    actorRole: a.actor?.role || 'member',
    what: a.what,
  })),
  assignments: (i.assignments || []).map(toTask),
  revisions: (i.revisions || []).map((r) => ({
    id: r.id,
    authorId: r.author?.id,
    authorName: r.author?.name || '',
    authorAv: r.author?.av || ['male', 0],
    authorRole: r.author?.role || 'member',
    at: r.created_at,
    text: r.text,
    /* Each version keeps the description it was, so an older flowchart is
       still drawn as that flowchart. */
    descriptionType: r.description_type || null,
    descriptionContent: r.description_content || null,
  })),
  comments: (i.comments || []).map((c) => ({
    id: c.id,
    authorId: c.author?.id,
    authorName: c.author?.name || '',
    authorAv: c.author?.av || ['male', 0],
    authorRole: c.author?.role || 'member',
    at: c.created_at,
    /* The original time stays and this is added, which is what the "edited"
       mark beside a message is drawn from. */
    editedAt: c.edited_at || null,
    text: c.text,
  })),
});

/** The id of the think-log point an idea came from, whichever shape it is in.
    The Idea Sanctuary hands over a bare id; older callers passed the whole
    `{ id, title }` object the mock used. */
const logIdOf = (v) => {
  if (v === null || v === undefined) return null;
  const id = typeof v === 'object' ? v.id : v;
  return Number.isFinite(Number(id)) ? Number(id) : null;
};

export const fromIdea = (draft) => ({
  tagline: draft.tagline,
  purpose: draft.purpose,
  dept: draft.dept,
  status: draft.status,
  tag: draft.tag || null,
  description_type: draft.descriptionType,
  description_content: draft.descriptionContent,
  /* Without this the note an idea was captured from never reached the server,
     so "Captured from the think log" could not be shown on the idea page. */
  from_log: logIdOf(draft.fromLog),
});

export const toTask = (t) => ({
  id: t.id,
  /* An implementation milestone is worked out from an idea rather than stored
     as a task row. The calendar colours it differently and refuses to treat it
     as editable work, which it can only do if the flag survives this far. */
  milestone: !!t.milestone,
  title: t.title,
  description: t.description,
  dept: t.dept,
  owner: t.owner?.name || '',
  ownerId: t.owner?.id,
  ownerRole: t.owner?.role || 'member',
  assignedBy: t.assigned_by?.name || '',
  assignedByRole: t.assigned_by?.role || 'member',
  ideaId: t.idea_id || null,
  logId: t.log_id || null,
  logTitle: t.log_title || '',
  /* `start` is a full timestamp; `date` and `time` are what the older
     screens read, derived from it rather than stored separately. */
  start: t.start_at,
  at: t.created_at,
  date: t.start_at ? t.start_at.slice(0, 10) : t.date,
  time: t.time,
  due: t.due,
  status: t.status,
  priority: t.priority,
});

/**
 * A point can be several things at once — a note sent to Tasks and to Ideas
 * is both — so what it became is a list. A server still sending the older
 * single `state` reads as a list of one.
 */
const pointStates = (p) => {
  if (Array.isArray(p?.states)) return p.states.filter(Boolean);
  return p?.state ? [p.state] : [];
};

export const toLog = (l) => ({
  id: l.id,
  date: l.date,
  at: l.created_at || l.date,
  title: l.title,
  /* Whose note this is. The past-logs list and the log dialog both print the
     author beside the date; without these three the line ended on a bare "·". */
  ownerId: l.owner?.id ?? null,
  owner: l.owner?.name || '',
  ownerRole: l.owner?.role || 'member',
  sample: !!l.sample,
  points: (l.points || []).map((p) => ({ id: p.id, text: p.text, states: pointStates(p) })),
});

export const toThread = (t) => ({
  withId: t.with?.id,
  with: t.with ? toMember(t.with) : null,
  online: !!t.with?.online,
  lastSeenAt: t.with?.last_seen_at || null,
  lastText: t.last_text || '',
  lastMine: !!t.last_mine,
  lastAt: t.last_at || null,
  unread: t.unread || 0,
  messages: (t.messages || []).map((m) => ({
    id: m.id,
    fromId: m.from?.id,
    mine: !!m.mine,
    text: m.text,
    at: m.created_at,
  })),
});

export const toNotif = (n) => ({
  id: n.id,
  icon: n.icon,
  title: n.title,
  /* A real instant, rendered in the reader's timezone. The old
     pre-formatted `time_label` / `bucket` pair is gone: the server no
     longer decides what "Today" means for somebody else's clock. */
  at: n.created_at,
  link: n.link || null,
  unread: n.unread,
  reminder: n.reminder,
});

/* ------------------------------------------------------------------ */

export const api = {
  auth: {
    /* The server answers with { access_token, token_type, user }. The token
       is kept here and the user handed back, so this matches the mock's
       return shape and AuthContext needs no idea which one it is talking to. */
    login: async (username, password) => {
      const data = await post('/api/auth/login', { username, password });
      setToken(data.access_token);
      return data.user;
    },
    me: () => get('/api/auth/me'),
    /* Nothing to end server-side — dropping the token is the sign-out. The
       call is still made so the backend can log it. */
    logout: async () => {
      try { await post('/api/auth/logout'); } finally { setToken(null); }
    },
  },

  team: {
    list: () => get('/api/team').then((r) => r.map(toMember)),
    invite: (m) => post('/api/team', {
      name: m.name, email: m.email, dept: m.dept, role: m.role,
      avatar_sex: m.av[0], avatar_variant: m.av[1],
    }).then(toMember),
    update: (id, patchBody) => patch(`/api/team/${id}`, patchBody).then(toMember),
    remove: (id) => del(`/api/team/${id}`),
  },

  ideas: {
    list: (params) => get('/api/ideas', params).then((r) => r.map(toIdea)),
    create: (draft, sharedWith = []) =>
      post('/api/ideas', { ...fromIdea(draft), shared_with: sharedWith }).then(toIdea),
    update: (id, draft) => put(`/api/ideas/${id}`, fromIdea(draft)).then(toIdea),
    remove: (id) => del(`/api/ideas/${id}`),

    /* --- the idea detail page --- */
    get: (id) => get(`/api/ideas/${id}`).then(toIdea),
    /* A version is the description itself, not a line of text about it — the
       Edit dialog sends back the flowchart, the bullets or the paragraph it
       was written in. A plain string is still accepted, which is what the
       older text-only editor sent. */
    addRevision: (id, payload) => post(
      `/api/ideas/${id}/revisions`,
      typeof payload === 'string'
        ? { text: payload }
        : {
          description_type: payload?.descriptionType,
          description_content: payload?.descriptionContent,
        },
    ).then(toIdea),
    addComment: (id, text) => post(`/api/ideas/${id}/comments`, { text }).then(toIdea),
    removeComment: (id, commentId) => del(`/api/ideas/${id}/comments/${commentId}`).then(toIdea),
    editComment: (id, commentId, text) =>
      patch(`/api/ideas/${id}/comments/${commentId}`, { text }).then(toIdea),
    /* Hands the project to the people who will carry it. Chairman only. */
    share: (id, { memberIds = [] } = {}) =>
      post(`/api/ideas/${id}/share`, { member_ids: memberIds }).then(toIdea),
    setImplementationDate: (id, date) =>
      patch(`/api/ideas/${id}`, { implementation_date: date }).then(toIdea),
    setStatus: (id, status) => patch(`/api/ideas/${id}`, { status }).then(toIdea),
  },

  tasks: {
    list: (params) => get('/api/tasks', params).then((r) => r.map(toTask)),
    stats: () => get('/api/tasks/stats'),
    create: ({
      title, description, due, priority,
      memberIds = [], deptNames = [], ideaId = null, logId = null, logTitle = '', startAt = null,
    }) =>
      post('/api/tasks', {
        title, description, due, priority,
        member_ids: memberIds,
        dept_names: deptNames,
        idea_id: ideaId,
        log_id: logId,
        log_title: logTitle,
        start_at: startAt,
      }).then((r) => r.map(toTask)),
    update: (id, body) => patch(`/api/tasks/${id}`, body).then(toTask),
    remove: (id) => del(`/api/tasks/${id}`),
  },

  thinkLogs: {
    list: (q) => get('/api/think-logs', { q }).then((r) => r.map(toLog)),
    create: (points, title) =>
      post('/api/think-logs', { points, title: title || null }).then(toLog),
    markPoint: (pointId, state) =>
      patch(`/api/think-logs/points/${pointId}`, undefined, { state }).then(toLog),
    /* Same endpoint as markPoint — the body says which of the two you meant:
       a `text` reword here, a `state` query param there. */
    editPoint: (pointId, text) =>
      patch(`/api/think-logs/points/${pointId}`, { text }).then(toLog),
    remove: (id) => del(`/api/think-logs/${id}`),
  },

  /* One-to-one messages, beside the group discussion. */
  messages: {
    threads: () => get('/api/messages').then((r) => r.map(toThread)),
    with: (userId) => get(`/api/messages/${userId}`).then(toThread),
    send: (userId, text) => post(`/api/messages/${userId}`, { text }).then(toThread),
    unreadCount: () => get('/api/messages/unread-count').then((r) => r.count),
  },

  notifications: {
    list: (tab, q) => get('/api/notifications', { tab, q }).then((r) => r.map(toNotif)),
    unreadCount: () => get('/api/notifications/unread-count').then((r) => r.count),
    markAllRead: () => post('/api/notifications/read-all'),
    markRead: (id) => post(`/api/notifications/${id}/read`).then(toNotif),
  },
};
