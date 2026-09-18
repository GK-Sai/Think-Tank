/* ------------------------------------------------------------------
   The mock API.

   Same function names, arguments and return shapes as lib/httpApi.js —
   the components cannot tell the two apart. Every call is async and
   goes through a small delay so loading states behave like they will
   against a real server.

   The life of an idea:

   1. The chairman writes it — a tagline, a purpose, a department, and a
      description in whichever editor suits it.
   2. Every team member is notified and comes to the discussion page. Everyone
      posts, and everyone may edit the idea's text; each edit is a new version
      stamped with who wrote it and when, and the whole team is told.
   3. The chairman sets the implementation date, and shares the project with
      the people who will carry it. The discussion stays open throughout.

   SEEING an idea       Once an idea leaves Draft it is visible to the whole
                        organisation. A Draft belongs to the chairman alone.
   POSTING on an idea   Everybody, for as long as the idea exists.
   CHAIRMAN ONLY        Creating an idea, setting the implementation date,
                        sharing the project, assigning tasks, changing status,
                        and the think log's Add to Idea / Add to Task.
------------------------------------------------------------------ */

import { getDb, saveDb, nextId } from './mockDb';
import { TODAY, ymd, nowIso, isoAt, parseYmd, daysBetween } from './date';
import { DEPT_TAG } from '../data/seed';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/* A short delay makes spinners and disabled buttons visible in the demo. */
const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms));

const db = () => getDb();

const currentUser = () => {
  const d = db();
  return d.users.find((u) => u.id === d.sessionUserId) || null;
};

/* Somebody counts as online if they did anything in the app in the last few
   minutes. There is no socket to hold open in a demo, and a stamp on every
   authenticated call is an honest enough answer to "is Priya around?". */
const ONLINE_WINDOW_MS = 3 * 60 * 1000;

const isOnline = (u) =>
  !!u.lastSeenAt && Date.now() - new Date(u.lastSeenAt).getTime() < ONLINE_WINDOW_MS;

const requireUser = () => {
  const u = currentUser();
  if (!u) throw new ApiError('Not signed in', 401);
  u.lastSeenAt = nowIso();
  return u;
};

const userById = (id) => db().users.find((u) => u.id === id) || null;

/* Deliberately does not spread `u` — the password must never leave here. */
const publicUser = (u) => u && ({
  id: u.id,
  name: u.name,
  title: u.title,
  role: u.role,
  dept: u.dept,
  email: u.email,
  av: u.av,
  label: u.role === 'chairman' ? 'Chairman' : u.title,
});

const CHAIR = 'Chairman';

/** What to call the actor in a notification line. */
const actorLabel = (u) => (u.role === 'chairman' ? CHAIR : u.name);

/* A notification is a line you scan in a list, not something you read. Long
   titles get cut rather than allowed to wrap into a paragraph. */
const clip = (text, max = 42) => {
  const t = String(text || '').trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
};

/* ---------------- shape adapters ----------------
   Mirrors of the ones in httpApi.js so both layers hand components
   identical objects. */

const toMember = (u) => ({
  id: u.id,
  name: u.name,
  dept: u.dept,
  role: u.title,          // the job title shown in the Role pill
  accountRole: u.role,    // 'chairman' | 'member'
  email: u.email,
  av: u.av,
  online: isOnline(u),
  lastSeenAt: u.lastSeenAt || null,
});

const toTask = (t) => ({
  id: t.id,
  title: t.title,
  description: t.description,
  dept: t.dept,
  owner: userById(t.ownerId)?.name || '',
  ownerId: t.ownerId,
  ownerRole: userById(t.ownerId)?.role || 'member',
  assignedBy: userById(t.assignedById)?.name || '',
  assignedByRole: userById(t.assignedById)?.role || 'member',
  ideaId: t.ideaId || null,
  logId: t.logId || null,
  logTitle: t.logTitle || '',
  /* `start` is the real instant the task sits at on the calendar; `date`
     and `time` are derived from it so older screens keep working. */
  start: t.start,
  at: t.at,
  date: ymd(parseYmd(t.start)),
  time: fmtClock(t.start),
  due: t.due,
  status: t.status,
  priority: t.priority,
});

function fmtClock(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  let h = d.getHours();
  const suffix = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${String(h).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} ${suffix}`;
}

const toIdea = (i, me = currentUser()) => {
  const owner = userById(i.ownerId);
  return {
    id: i.id,
    title: i.title,
    tagline: i.tagline,
    purpose: i.purpose,
    dept: i.dept || null,
    tag: i.tag,
    status: i.status,
    created: i.created,
    createdAt: i.createdAt || i.created,
    updatedAt: i.updatedAt || i.createdAt || i.created,
    owner: owner?.name || '',
    ownerId: i.ownerId,
    ownerAv: owner?.av || ['male', 0],
    ownerRole: owner?.role || 'member',
    sharedWith: i.sharedWith || [],
    implementationDate: i.implementationDate || null,
    fromLog: i.fromLog || null,
    sample: !!i.sample,
    /* Worked out here rather than in the browser so the rule lives in one
       place and the API is the thing that decides. */
    canComment: me ? canCommentOnIdea(i, me) : false,
    canEditIdea: me ? canEditIdea(i, me) : false,
    descriptionType: i.descriptionType,
    descriptionContent: i.descriptionContent,
    activity: (i.activity || []).map((a) => ({ ...a })),
    assignments: db().tasks
      .filter((t) => t.ideaId === i.id)
      .map(toTask),
    revisions: (i.revisions || []).map((r, index, all) => ({
      ...r,
      authorAv: userById(r.authorId)?.av || ['male', 0],
      authorRole: userById(r.authorId)?.role || 'member',
      /* Records written before versions carried their own snapshot: the last
         one is by definition what the idea holds now, so it can borrow it. */
      descriptionType: r.descriptionType
        || (index === all.length - 1 ? i.descriptionType : null),
      descriptionContent: r.descriptionContent
        || (index === all.length - 1 ? i.descriptionContent : null),
    })),
    comments: (i.comments || []).map((c) => ({
      ...c,
      authorAv: userById(c.authorId)?.av || ['male', 0],
      authorRole: userById(c.authorId)?.role || 'member',
    })),
  };
};

/**
 * What a note has become, as a list.
 *
 * A point is not one thing or the other: the chairman can send the same note
 * to Tasks and to Ideas, and both have to survive — marking it a task used to
 * overwrite the fact that it was already an idea. Rows written before this
 * (the seed, and anything already sitting in a browser's storage) carry a
 * single `state`, so read either shape and always write the list back.
 */
export const pointStates = (p) => {
  if (Array.isArray(p?.states)) return p.states.filter(Boolean);
  return p?.state ? [p.state] : [];
};

const toLog = (l) => {
  const owner = userById(l.ownerId);
  return {
    id: l.id,
    date: l.date,
    at: l.at || l.date,
    title: l.title,
    ownerId: l.ownerId,
    owner: owner?.name || '',
    ownerRole: owner?.role || 'member',
    sample: !!l.sample,
    points: l.points.map((p) => ({ id: p.id, text: p.text, states: pointStates(p) })),
  };
};

const toNotif = (n) => ({
  id: n.id,
  icon: n.icon,
  title: n.title,
  at: n.at,
  link: n.link || null,
  unread: n.unread,
  reminder: n.reminder,
});

/* ---------------- visibility ---------------- */

/** A Draft is private to its author; anything published is org-wide, so the
    whole company can read the idea it was just notified about. */
const canSeeIdea = (idea, me) =>
  me.role === 'chairman'
  || idea.ownerId === me.id
  || idea.status !== 'Draft';

/**
 * Who may post on the idea.
 *
 * While the discussion is open: everybody, chairman and team member alike —
 * it is one room, and the point of telling the whole company about an idea is
 * that the whole company can answer.
 *
 * Once a department has been assigned the thread is the record of a decision
 * that has already been taken, so it is read-only for everyone, the chairman
 * included. He reopens it rather than quietly writing under the line.
 */
function canCommentOnIdea(idea, me) {
  if (!me) return false;
  if (idea.status === 'Draft') return idea.ownerId === me.id || me.role === 'chairman';
  return true;
}

/** Editing the idea's own text is the room's too: anyone in the discussion may
    sharpen the wording, and the signed version trail is what keeps it honest. */
function canEditIdea(idea, me) {
  if (!me) return false;
  if (idea.status === 'Draft') return idea.ownerId === me.id || me.role === 'chairman';
  return true;
}

const findIdea = (id, me) => {
  const idea = db().ideas.find((i) => i.id === Number(id));
  if (!idea) throw new ApiError('That idea no longer exists', 404);
  if (!canSeeIdea(idea, me)) throw new ApiError('You do not have access to this idea', 403);
  return idea;
};

const requireComment = (idea, me) => {
  if (!canCommentOnIdea(idea, me)) {
    throw new ApiError('You cannot post on this idea', 403);
  }
};

const titleFrom = (tagline) => String(tagline || 'Untitled idea').trim();

/* ---------------- notifications ---------------- */

/** Everyone with an account, minus whoever caused the change. */
const everyoneElse = (me) => db().users.filter((u) => u.id !== me.id).map((u) => u.id);

/** Threads are keyed by the sorted pair, so the lookup works either way round. */
const findThread = (a, b) => {
  const [x, y] = [a, b].sort((m, n) => m - n);
  return db().dms.find((t) => t.pair[0] === x && t.pair[1] === y) || null;
};

const memberIdsOfDepts = (deptNames = []) =>
  db().users.filter((u) => deptNames.includes(u.dept)).map((u) => u.id);

/** Writes one notification per recipient, all stamped with the same instant
    so "Aug 27, 2026 · 10:04 AM" reads identically for everyone. */
function notify({ userIds = [], icon = 'idea', title, reminder = false, link = null }) {
  const d = db();
  const at = nowIso();
  Array.from(new Set(userIds)).forEach((uid) => {
    d.notifs.unshift({
      id: nextId('notif'),
      userId: uid,
      icon,
      title,
      at,
      unread: true,
      reminder,
      link,
    });
  });
  return at;
}

/** Records what changed on the idea itself, so the page carries its own
    history rather than relying on someone still having the notification. */
function logActivity(idea, me, what) {
  idea.activity = idea.activity || [];
  idea.activity.unshift({
    id: nextId('revision'),
    at: nowIso(),
    actorId: me.id,
    actorName: me.name,
    actorRole: me.role,
    what,
  });
  idea.activity = idea.activity.slice(0, 30);
  idea.updatedAt = idea.activity[0].at;
}

/**
 * Record a change to an idea.
 *
 * It writes to the idea's own change history and stops there. Notifications
 * are deliberately not sent from here.
 *
 * A bell that pings on every edit, every comment, every status change is a
 * bell people stop reading, and then the one message that mattered goes past
 * unnoticed. So the rule is: a notification is for something a person has to
 * know about and would not otherwise see —
 *
 *   · the chairman has opened a new idea          (everyone)
 *   · a task has been assigned to you             (the assignee)
 *   · a project has been shared with you          (the person named)
 *   · somebody has sent you a message             (the recipient)
 *
 * Everything else lives on the page it happened on: the change history behind
 * the clock icon, and the discussion itself.
 */
function announce(idea, me, what) {
  logActivity(idea, me, what);
}

/* ---------------- the API ---------------- */

export const api = {
  auth: {
    async login(username, password) {
      await delay(260);
      const key = String(username).trim().toLowerCase();
      const u = db().users.find(
        (x) => x.username === key || x.email.toLowerCase() === key
      );
      if (!u) throw new ApiError('No account matches that username.', 401);
      // The demo stores the password in plain text because it is a demo. The
      // real backend hashes it and this whole block goes away — see httpApi.
      if (password !== u.password) throw new ApiError('Incorrect password.', 401);
      db().sessionUserId = u.id;
      saveDb();
      return publicUser(u);
    },

    async me() {
      await delay(60);
      const u = currentUser();
      if (!u) throw new ApiError('Not signed in', 401);
      return publicUser(u);
    },

    async logout() {
      await delay(80);
      db().sessionUserId = null;
      saveDb();
      return null;
    },
  },

  team: {
    async list() {
      await delay();
      requireUser();
      return db().users.map(toMember);
    },

    async invite(m) {
      await delay(200);
      const me = requireUser();
      if (me.role !== 'chairman') throw new ApiError('Only the chairman can add members', 403);
      const id = nextId('user');
      const user = {
        id,
        username: String(m.name).split(/\s+/)[0].toLowerCase(),
        password: 'tt123',                       // the shared demo password
        name: m.name,
        title: m.role,
        role: 'member',
        dept: m.dept,
        email: m.email,
        av: m.av || ['male', 0],
      };
      db().users.push(user);
      saveDb();
      return toMember(user);
    },

    async update(id, patchBody) {
      await delay(180);
      requireUser();
      const u = userById(Number(id));
      if (!u) throw new ApiError('That member no longer exists', 404);
      if (patchBody.role !== undefined) u.title = patchBody.role;
      if (patchBody.dept !== undefined) u.dept = patchBody.dept;
      if (patchBody.name !== undefined) u.name = patchBody.name;
      saveDb();
      return toMember(u);
    },

    async remove(id) {
      await delay(180);
      const me = requireUser();
      if (Number(id) === me.id) throw new ApiError('You cannot remove your own account', 400);
      const d = db();
      d.users = d.users.filter((u) => u.id !== Number(id));
      saveDb();
      return null;
    },
  },

  ideas: {
    async list() {
      await delay();
      const me = requireUser();
      return db().ideas.filter((i) => canSeeIdea(i, me)).map((i) => toIdea(i, me));
    },

    async get(id) {
      await delay(90);
      const me = requireUser();
      return toIdea(findIdea(id, me), me);
    },

    /**
     * The chairman opens an idea: a tagline, a purpose, a department and a
     * description. Everyone is told, so they can come and answer.
     */
    async create(draft, sharedWith = []) {
      await delay(220);
      const me = requireUser();
      if (me.role !== 'chairman') {
        throw new ApiError('Only the chairman can open a new idea', 403);
      }
      const id = nextId('idea');
      const text = describe(draft);
      const at = nowIso();
      const status = draft.status || 'Under Review';
      const idea = {
        id,
        title: titleFrom(draft.tagline),
        tagline: draft.tagline,
        purpose: draft.purpose,
        dept: draft.dept || null,
        tag: draft.tag || DEPT_TAG[draft.dept] || 'Innovation',
        status,
        created: ymd(TODAY),
        createdAt: at,
        updatedAt: at,
        ownerId: me.id,
        sharedWith: (sharedWith || []).filter((x) => x !== me.id),
        implementationDate: null,
        /* Stored as the think-log point's id, matching what the real API
           keeps, so the idea page reads the same either way. */
        fromLog: (typeof draft.fromLog === 'object' && draft.fromLog)
          ? (draft.fromLog.id ?? null)
          : (draft.fromLog ?? null),
        descriptionType: draft.descriptionType,
        descriptionContent: draft.descriptionContent,
        activity: [{
          id: nextId('revision'),
          at,
          actorId: me.id,
          actorName: me.name,
          actorRole: me.role,
          what: 'created this idea',
        }],
        revisions: [{
          id: nextId('revision'),
          authorId: me.id,
          authorName: me.name,
          at,
          text,
          /* Each version keeps the description it *was*, so the flowchart the
             chairman drew is still drawable after someone edits it. Without
             this the older version could only be shown as "A → B → C". */
          descriptionType: draft.descriptionType,
          descriptionContent: draft.descriptionContent,
        }],
        comments: [],
      };
      db().ideas.unshift(idea);

      /* Everyone. A Draft is announced to nobody. */
      if (status !== 'Draft') {
        notify({
          userIds: everyoneElse(me),
          icon: 'idea',
          title: `New idea: ${clip(idea.title)}`,
          link: `/ideas/${idea.id}`,
        });
      }

      saveDb();
      return toIdea(idea, me);
    },

    /** The full editor — tagline, purpose, department, description. Open to
        anyone in the discussion. */
    async update(id, draft) {
      await delay(220);
      const me = requireUser();
      const idea = findIdea(id, me);
      if (!canEditIdea(idea, me)) throw new ApiError('You cannot edit this idea', 403);
      const wasDraft = idea.status === 'Draft';
      const deptChanged = draft.dept && draft.dept !== idea.dept;

      Object.assign(idea, {
        title: titleFrom(draft.tagline),
        tagline: draft.tagline,
        purpose: draft.purpose,
        dept: draft.dept || idea.dept,
        tag: draft.tag || DEPT_TAG[draft.dept] || idea.tag,
        status: draft.status || idea.status,
        descriptionType: draft.descriptionType,
        descriptionContent: draft.descriptionContent,
      });

      if (idea.status === 'Draft') {
        logActivity(idea, me, 'updated this draft');
      } else if (wasDraft) {
        logActivity(idea, me, 'created this idea');
        notify({
          userIds: everyoneElse(me),
          icon: 'idea',
          title: `New idea: ${clip(idea.title)}`,
          link: `/ideas/${idea.id}`,
        });
      } else {
        announce(idea, me, deptChanged ? `moved this idea to ${idea.dept}` : 'updated the idea');
      }

      saveDb();
      return toIdea(idea, me);
    },

    async remove(id) {
      await delay(180);
      const me = requireUser();
      const idea = findIdea(id, me);
      if (me.role !== 'chairman' && idea.ownerId !== me.id) {
        throw new ApiError('You can only delete your own ideas', 403);
      }
      const d = db();
      d.ideas = d.ideas.filter((i) => i.id !== idea.id);
      d.tasks = d.tasks.map((t) => (t.ideaId === idea.id ? { ...t, ideaId: null } : t));
      saveDb();
      return null;
    },

    /* --- the idea detail page --- */

    /**
     * Save a new version of the description.
     *
     * Takes the description in whatever shape it was written — the flowchart's
     * shapes and links, the bullet list, the paragraph, the file list — and
     * stores that, so an edited flowchart is shown as the edited flowchart
     * rather than reverting to the drawing it started as. A flattened text
     * copy goes into the revision trail alongside it, because a history only
     * ever needs to be readable.
     *
     * A plain string is still accepted, which is what the old callers sent.
     */
    async addRevision(id, payload) {
      await delay(200);
      const me = requireUser();
      const idea = findIdea(id, me);
      if (!canEditIdea(idea, me)) throw new ApiError('You cannot edit this idea', 403);

      const asText = typeof payload === 'string';
      const type = asText ? idea.descriptionType : (payload?.descriptionType || idea.descriptionType);
      const content = asText
        ? { ...idea.descriptionContent, paragraph: payload }
        : payload?.descriptionContent;

      if (!content) throw new ApiError('There is nothing to save', 400);

      const text = asText
        ? String(payload || '').trim()
        : describe({ descriptionType: type, descriptionContent: content, purpose: idea.purpose });

      if (!String(text).trim()) throw new ApiError('The description cannot be empty', 400);

      idea.revisions = idea.revisions || [];

      /* Freeze the description onto the version it belongs to before a newer
         one arrives. The newest version is shown with the idea's own
         description, so a version saved without a snapshot of its own would
         turn into plain text the moment somebody edited after it — the
         chairman's original flowchart would stop being a flowchart. */
      const previous = idea.revisions[idea.revisions.length - 1];
      if (previous && !previous.descriptionType) {
        previous.descriptionType = idea.descriptionType;
        previous.descriptionContent = JSON.parse(JSON.stringify(idea.descriptionContent || {}));
      }

      /* This is the part that was missing: the stored description is replaced,
         not just the text summary, so every reader sees the new version. */
      idea.descriptionType = type;
      idea.descriptionContent = content;

      idea.revisions.push({
        id: nextId('revision'),
        authorId: me.id,
        authorName: me.name,
        at: nowIso(),
        text: String(text).trim(),
        descriptionType: type,
        descriptionContent: content,
      });

      logActivity(idea, me, 'edited the idea');
      saveDb();
      return toIdea(idea, me);
    },

    async addComment(id, text) {
      await delay(160);
      const me = requireUser();
      const idea = findIdea(id, me);
      requireComment(idea, me);
      const clean = String(text || '').trim();
      if (!clean) throw new ApiError('Write something first', 400);

      idea.comments = idea.comments || [];
      idea.comments.push({
        id: nextId('comment'),
        authorId: me.id,
        authorName: me.name,
        at: nowIso(),
        text: clean,
      });

      idea.updatedAt = nowIso();
      saveDb();
      return toIdea(idea, me);
    },

    /** Edit your own message. The original time stays; an `editedAt` is added
        so nobody can quietly rewrite what they said an hour ago. */
    async editComment(id, commentId, text) {
      await delay(150);
      const me = requireUser();
      const idea = findIdea(id, me);
      requireComment(idea, me);
      const c = (idea.comments || []).find((x) => x.id === Number(commentId));
      if (!c) throw new ApiError('That message no longer exists', 404);
      if (c.authorId !== me.id) throw new ApiError('You can only edit your own messages', 403);

      const clean = String(text || '').trim();
      if (!clean) throw new ApiError('A message cannot be empty', 400);

      c.text = clean;
      c.editedAt = nowIso();
      idea.updatedAt = c.editedAt;
      saveDb();
      return toIdea(idea, me);
    },

    async removeComment(id, commentId) {
      await delay(140);
      const me = requireUser();
      const idea = findIdea(id, me);
      const c = (idea.comments || []).find((x) => x.id === Number(commentId));
      if (!c) throw new ApiError('That comment no longer exists', 404);
      if (c.authorId !== me.id && me.role !== 'chairman') {
        throw new ApiError('You can only delete your own comments', 403);
      }
      idea.comments = idea.comments.filter((x) => x.id !== Number(commentId));
      saveDb();
      return toIdea(idea, me);
    },

    /**
     * Share the project with the people who will carry it.
     *
     * This is the chairman's second closing move, beside choosing the
     * department: a short list of the team members most connected to the
     * work. They are told directly, and they are named on the idea page so
     * everyone can see who picked it up.
     */
    async share(id, { memberIds = [] } = {}) {
      await delay(200);
      const me = requireUser();
      const idea = findIdea(id, me);
      if (me.role !== 'chairman') {
        throw new ApiError('Only the chairman can share a project', 403);
      }

      const before = new Set(idea.sharedWith || []);
      idea.sharedWith = Array.from(new Set(memberIds.map(Number)))
        .filter((x) => x !== me.id);

      const added = idea.sharedWith.filter((x) => !before.has(x));
      const names = added.map((x) => userById(x)?.name).filter(Boolean);

      if (names.length) {
        logActivity(idea, me, `shared this project with ${names.join(', ')}`);
        notify({
          userIds: added,
          icon: 'ok',
          title: `Shared with you: ${clip(idea.title)}`,
          link: `/ideas/${idea.id}`,
        });
      } else {
        idea.updatedAt = nowIso();
      }

      saveDb();
      return toIdea(idea, me);
    },

    /** Chairman only — this is the decision that turns an idea into work. */
    async setImplementationDate(id, date) {
      await delay(180);
      const me = requireUser();
      if (me.role !== 'chairman') {
        throw new ApiError('Only the chairman can set an implementation date', 403);
      }
      const idea = findIdea(id, me);
      idea.implementationDate = date || null;
      // Scheduling an idea is the decision to do it, so it stops being a
      // draft or a review item at the same moment.
      if (date && (idea.status === 'Under Review' || idea.status === 'Draft')) {
        idea.status = 'Approved';
      }
      announce(
        idea,
        me,
        date ? `set the implementation date to ${date}` : 'cleared the implementation date'
      );
      saveDb();
      return toIdea(idea, me);
    },

    async setStatus(id, status) {
      await delay(160);
      const me = requireUser();
      if (me.role !== 'chairman') {
        throw new ApiError('Only the chairman can change an idea’s status', 403);
      }
      const idea = findIdea(id, me);
      const was = idea.status;
      idea.status = status;
      announce(idea, me, `set the status to ${status}`);
      saveDb();
      return toIdea(idea, me);
    },
  },

  tasks: {
    async list() {
      await delay();
      const me = requireUser();
      const rows = me.role === 'chairman'
        ? db().tasks
        : db().tasks.filter((t) => t.ownerId === me.id);
      return [...rows.map(toTask), ...milestonesFor(me)];
    },

    async stats() {
      await delay(90);
      const me = requireUser();
      const rows = me.role === 'chairman'
        ? db().tasks
        : db().tasks.filter((t) => t.ownerId === me.id);
      const done = rows.filter((t) => t.status === 'Completed').length;
      const overdue = rows.filter(
        (t) => t.status !== 'Completed' && daysBetween(TODAY, parseYmd(t.due)) < 0
      ).length;
      return { total: rows.length, completed: done, overdue, pending: rows.length - done };
    },

    /**
     * Assign work.
     *
     * `memberIds` names people directly; `deptNames` hands the same task to a
     * whole department. `ideaId` ties the task back to the idea it came from,
     * which is what puts it on that idea's page; `logId` / `logTitle` carry
     * the think-log line it started life as.
     */
    async create({
      title, description, due, priority,
      memberIds = [], deptNames = [],
      ideaId = null, logId = null, logTitle = '', startAt = null,
    }) {
      await delay(240);
      const me = requireUser();
      if (me.role !== 'chairman') throw new ApiError('Only the chairman can assign tasks', 403);

      const targets = Array.from(new Set([
        ...memberIds.map(Number),
        ...memberIdsOfDepts(deptNames),
      ])).filter((x) => x !== me.id);

      if (!targets.length) throw new ApiError('Pick at least one person or department', 400);

      const at = nowIso();
      const start = startAt || at;

      const created = targets.map((mid) => {
        const owner = userById(mid);
        const task = {
          id: nextId('task'),
          title,
          description: description || '',
          dept: owner?.dept || 'Executive',
          ownerId: mid,
          assignedById: me.id,
          ideaId: ideaId ? Number(ideaId) : null,
          logId: logId || null,
          logTitle: logTitle || '',
          at,
          start,
          due: due || ymd(TODAY),
          status: 'In Progress',
          priority: priority || 'Medium',
        };
        db().tasks.push(task);
        return task;
      });

      notify({
        userIds: targets,
        icon: 'task',
        title: `New task: ${clip(title)}`,
        link: '/tasks',
      });

      if (ideaId) {
        const idea = db().ideas.find((i) => i.id === Number(ideaId));
        if (idea) {
          const who = deptNames.length
            ? deptNames.join(', ')
            : targets.map((x) => userById(x)?.name).filter(Boolean).join(', ');
          logActivity(idea, me, `assigned “${title}” to ${who}`);
        }
      }

      saveDb();
      return created.map(toTask);
    },

    async update(id, body) {
      await delay(160);
      const me = requireUser();
      if (String(id).startsWith('impl-')) {
        throw new ApiError('An implementation date is changed on the idea, not here', 400);
      }
      const t = db().tasks.find((x) => x.id === Number(id));
      if (!t) throw new ApiError('That task no longer exists', 404);
      Object.assign(t, body);
      saveDb();
      return toTask(t);
    },

    async remove(id) {
      await delay(160);
      requireUser();
      const d = db();
      d.tasks = d.tasks.filter((t) => t.id !== Number(id));
      saveDb();
      return null;
    },
  },

  thinkLogs: {
    /**
     * Your own notes, plus the chairman's.
     *
     * The think log is where the chairman works out what he is going to raise,
     * and the team can read that — it is the reasoning behind the ideas they
     * are about to be asked about. Your own notes stay yours; nobody else's
     * private notes appear here.
     */
    async list(q) {
      await delay();
      const me = requireUser();
      const needle = String(q || '').trim().toLowerCase();
      return db().logs
        .filter((l) => l.ownerId === me.id || userById(l.ownerId)?.role === 'chairman')
        .filter((l) => !needle
          || l.title.toLowerCase().includes(needle)
          || l.points.some((p) => p.text.toLowerCase().includes(needle)))
        .sort((a, b) => new Date(b.at || b.date) - new Date(a.at || a.date))
        .map(toLog);
    },

    async create(points, title) {
      await delay(200);
      const me = requireUser();
      const log = {
        id: nextId('log'),
        ownerId: me.id,
        date: ymd(TODAY),
        at: nowIso(),
        sample: false,
        title: title || points[0]?.text || 'Untitled log',
        points: points.map((p) => ({ id: nextId('comment'), text: p.text, states: pointStates(p) })),
      };
      db().logs.unshift(log);
      saveDb();
      return toLog(log);
    },

    /**
     * Records that a point has become an idea or a task. Chairman only — he
     * is the only one who can turn a point into either.
     *
     * The new state is added to what the point already is rather than
     * replacing it, so a note sent to Tasks and then to Ideas is both. Passing
     * no state clears the point back to unactioned.
     */
    async markPoint(pointId, state) {
      await delay(120);
      const me = requireUser();
      if (me.role !== 'chairman') {
        throw new ApiError('Only the chairman can action a think-log point', 403);
      }
      const log = db().logs.find((l) => l.points.some((p) => p.id === Number(pointId)));
      if (!log) throw new ApiError('That point no longer exists', 404);

      const point = log.points.find((p) => p.id === Number(pointId));
      const states = pointStates(point);
      point.states = !state ? [] : (states.includes(state) ? states : [...states, state]);
      delete point.state;   // the row is on the list shape from here on

      saveDb();
      return toLog(log);
    },

    /**
     * Reword a point that has already been saved.
     *
     * The note saves itself a few seconds after you stop typing now, so the
     * first version of a thought is on the record before you have finished
     * having it. Editing is how you tidy it afterwards — without it, autosave
     * would only be a faster way to store a typo.
     *
     * A log's title is the first line of its first point, so rewording that
     * point renames the log with it: leaving the old title behind would make
     * the past-logs list disagree with what the log actually says.
     */
    async editPoint(pointId, text) {
      await delay(120);
      const me = requireUser();
      const body = String(text || '').trim();
      if (!body) throw new ApiError('A point cannot be empty', 400);

      const log = db().logs.find((l) => l.points.some((p) => p.id === Number(pointId)));
      if (!log) throw new ApiError('That point no longer exists', 404);
      if (log.ownerId !== me.id) {
        throw new ApiError('You can only edit your own think log', 403);
      }

      const point = log.points.find((p) => p.id === Number(pointId));
      point.text = body;
      if (log.points[0]?.id === point.id) log.title = body.split('\n')[0].trim();

      saveDb();
      return toLog(log);
    },

    async remove(id) {
      await delay(140);
      requireUser();
      const d = db();
      d.logs = d.logs.filter((l) => l.id !== Number(id));
      saveDb();
      return null;
    },
  },

  /* ---------------- direct messages ----------------
     One-to-one, beside the group discussion. The discussion is the record of
     how a decision was made and belongs to everybody; this is for the quiet
     word you would otherwise have on WhatsApp and lose. */
  messages: {
    /** Every thread I am part of, newest first, with its unread count. */
    async threads() {
      await delay(90);
      const me = requireUser();
      return db().dms
        .filter((t) => t.pair.includes(me.id))
        .map((t) => {
          const otherId = t.pair.find((x) => x !== me.id);
          const last = t.messages[t.messages.length - 1] || null;
          return {
            withId: otherId,
            with: publicUser(userById(otherId)),
            online: isOnline(userById(otherId) || {}),
            lastText: last?.text || '',
            /* Who spoke last, so the list can say "You: …" the way every
               messaging app does. */
            lastMine: !!last && last.fromId === me.id,
            lastAt: last?.at || null,
            unread: t.messages.filter((m) => m.fromId !== me.id && !m.readAt).length,
          };
        })
        .filter((t) => t.with)
        .sort((a, b) => new Date(b.lastAt || 0) - new Date(a.lastAt || 0));
    },

    /** The conversation with one person. Opening it marks it read. */
    async with(userId) {
      await delay(80);
      const me = requireUser();
      const other = userById(Number(userId));
      if (!other) throw new ApiError('That person is no longer on the team', 404);

      const t = findThread(me.id, other.id);
      let changed = false;
      (t?.messages || []).forEach((m) => {
        if (m.fromId !== me.id && !m.readAt) { m.readAt = nowIso(); changed = true; }
      });
      if (changed) saveDb();

      return {
        withId: other.id,
        with: publicUser(other),
        online: isOnline(other),
        lastSeenAt: other.lastSeenAt || null,
        messages: (t?.messages || []).map((m) => ({ ...m, mine: m.fromId === me.id })),
      };
    },

    async send(userId, text) {
      await delay(110);
      const me = requireUser();
      const other = userById(Number(userId));
      if (!other) throw new ApiError('That person is no longer on the team', 404);
      if (other.id === me.id) throw new ApiError('You cannot message yourself', 400);

      const clean = String(text || '').trim();
      if (!clean) throw new ApiError('Write something first', 400);

      let t = findThread(me.id, other.id);
      if (!t) {
        t = { id: nextId('dm'), pair: [me.id, other.id].sort((a, b) => a - b), messages: [] };
        db().dms.push(t);
      }
      t.messages.push({ id: nextId('dmMsg'), fromId: me.id, text: clean, at: nowIso(), readAt: null });

      notify({
        userIds: [other.id],
        icon: 'team',
        title: `Message from ${actorLabel(me)}`,
        link: null,
      });

      saveDb();
      return {
        withId: other.id,
        with: publicUser(other),
        online: isOnline(other),
        messages: t.messages.map((m) => ({ ...m, mine: m.fromId === me.id })),
      };
    },

    async unreadCount() {
      await delay(60);
      const me = requireUser();
      return db().dms
        .filter((t) => t.pair.includes(me.id))
        .reduce((n, t) => n + t.messages.filter((m) => m.fromId !== me.id && !m.readAt).length, 0);
    },
  },

  notifications: {
    async list(tab, q) {
      await delay();
      const me = requireUser();
      const needle = String(q || '').trim().toLowerCase();
      return db().notifs
        .filter((n) => n.userId === me.id)
        .filter((n) => {
          if (tab === 'unread') return n.unread;
          if (tab === 'reminders') return n.reminder;
          return true;
        })
        .filter((n) => !needle || n.title.toLowerCase().includes(needle))
        .sort((a, b) => new Date(b.at) - new Date(a.at))
        .map(toNotif);
    },

    async unreadCount() {
      await delay(60);
      const me = requireUser();
      return db().notifs.filter((n) => n.userId === me.id && n.unread).length;
    },

    async markAllRead() {
      await delay(140);
      const me = requireUser();
      db().notifs.forEach((n) => { if (n.userId === me.id) n.unread = false; });
      saveDb();
      return null;
    },

    async markRead(id) {
      await delay(100);
      requireUser();
      const n = db().notifs.find((x) => x.id === Number(id));
      if (!n) throw new ApiError('That notification no longer exists', 404);
      n.unread = false;
      saveDb();
      return toNotif(n);
    },
  },
};

/**
 * The implementation dates, as calendar entries.
 *
 * When the chairman schedules an idea, the people he shared the project with
 * need to see that date on their own calendar — it is the deadline the work
 * hangs off. Rather than copying a task record per person (two things to keep
 * in step, and one of them silently wrong the moment the date moves), the
 * entries are worked out from the idea every time the calendar is read. They
 * carry a string id so nothing mistakes one for a real, editable task.
 */
function milestonesFor(me) {
  return db().ideas
    /* Every published idea with a date, on everybody's calendar. A date the
       chairman has set is the company's deadline, not a private note to the
       two people carrying it — if it is on the calendar at all it has to be
       on the same day for everyone. */
    .filter((i) => i.implementationDate && i.status !== 'Draft')
    .map((i) => ({
      id: `impl-${i.id}`,
      milestone: true,
      ideaId: i.id,
      title: `${i.title} — implementation`,
      description: i.purpose || '',
      dept: i.dept || '',
      owner: me.name,
      ownerId: me.id,
      ownerRole: me.role,
      assignedBy: userById(i.ownerId)?.name || '',
      assignedByRole: userById(i.ownerId)?.role || 'chairman',
      logId: null,
      logTitle: '',
      at: i.updatedAt || i.createdAt,
      start: isoAt(i.implementationDate, 9, 0),
      date: i.implementationDate,
      time: fmtClock(isoAt(i.implementationDate, 9, 0)),
      due: i.implementationDate,
      status: 'In Progress',
      priority: 'High',
    }));
}

/** Flattens whichever description editor is active into plain text —
    the revision trail on the detail page is text, whatever the source. */
function describe(draft) {
  const c = draft.descriptionContent || {};
  switch (draft.descriptionType) {
    case 'paragraph':
      return c.paragraph || draft.purpose || '';
    case 'bulletPoints':
      return (c.bulletPoints || []).filter((x) => x && x.trim()).join('\n');
    case 'uploadFile':
      return (c.uploadFile || []).map((f) => f.name).join(', ') || draft.purpose || '';
    default:
      return (c.flowchart?.shapes || []).map((s) => s.label).join(' → ') || draft.purpose || '';
  }
}
