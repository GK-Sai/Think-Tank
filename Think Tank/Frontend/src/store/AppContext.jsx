import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import { api, invalidateLocalCache } from '../lib/api';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

const AppContext = createContext(null);

/**
 * Everything the dashboard reads comes from the API. Each mutation calls the
 * server first and only then updates local state, so what you see is what the
 * database actually holds.
 */
export function AppProvider({ children }) {
  const { user, isChair } = useAuth();
  const toast = useToast();

  const [ideas, setIdeas] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [team, setTeam] = useState([]);
  const [thinkLogs, setThinkLogs] = useState([]);
  const [notifs, setNotifs] = useState([]);
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);

  const reportError = useCallback((err) => {
    toast(err?.message || 'Something went wrong');
    throw err;
  }, [toast]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      const [t, i, k, l, n, m] = await Promise.all([
        api.team.list(),
        api.ideas.list(),
        api.tasks.list(),
        api.thinkLogs.list(),
        api.notifications.list('all'),
        api.messages.threads(),
      ]);
      setTeam(t); setIdeas(i); setTasks(k); setThinkLogs(l); setNotifs(n); setThreads(m);
    } catch (err) {
      toast(err?.message || 'Could not load your data');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { if (user) refreshAll(); }, [user, refreshAll]);

  /* The demo database lives in localStorage, so a change the chairman makes
     in one tab is a `storage` event in the tab a team member is signed into.
     Reloading on that event — and when a tab is brought back to the front —
     is what makes "everyone is notified" true rather than a promise.
     Against the real API this is where a socket or a poll would sit. */
  useEffect(() => {
    if (!user) return undefined;

    let timer = null;
    const soon = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { refreshAll(); }, 250);
    };

    const onStorage = (e) => {
      if (!e.key || e.key.startsWith('thinktank.db')) {
        invalidateLocalCache();
        soon();
      }
    };
    const onFocus = () => { invalidateLocalCache(); soon(); };

    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onFocus);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onFocus);
    };
  }, [user, refreshAll]);

  /* The heartbeat.

     Who is online, what has been said and what has just been raised are all
     moving targets, and against a real server nothing tells this tab about
     them. A quiet poll keeps the online dots, the unread counts and — the
     one that matters — the notifications honest, which is what makes "the
     whole company is told" true rather than a promise: the pop-up beside the
     bell is driven by new rows appearing in this list.

     Deliberately narrow: team, threads, notifications and the ideas board.
     Tasks and think logs only change when somebody on this screen changes
     them, and refetching them would fight with what is being typed. */
  useEffect(() => {
    if (!user) return undefined;
    const id = setInterval(async () => {
      if (document.hidden) return;
      try {
        const [t, m, n, i] = await Promise.all([
          api.team.list(),
          api.messages.threads(),
          api.notifications.list('all'),
          api.ideas.list(),
        ]);
        setTeam(t);
        setThreads(m);
        setNotifs(n);
        setIdeas(i);
      } catch { /* offline or signed out — the next tick tries again */ }
    }, 20000);
    return () => clearInterval(id);
  }, [user]);

  /* ---------- messages ---------- */
  const openThread = useCallback(async (userId) => {
    const t = await api.messages.with(userId).catch(reportError);
    setThreads((prev) => prev.map((x) => (x.withId === t.withId ? { ...x, unread: 0 } : x)));
    return t;
  }, [reportError]);

  const sendMessage = useCallback(async (userId, text) => {
    const t = await api.messages.send(userId, text).catch(reportError);
    const fresh = await api.messages.threads().catch(() => null);
    if (fresh) setThreads(fresh);
    return t;
  }, [reportError]);

  const unreadMessages = useMemo(
    () => threads.reduce((n, t) => n + (t.unread || 0), 0),
    [threads]
  );

  /* The API already scopes rows by role, so these are just readable aliases. */
  const myIdeas = ideas;
  const myTasks = tasks;

  /* ---------- ideas ---------- */
  const saveIdea = useCallback(async (draft, status) => {
    const payload = { ...draft, status };
    const saved = draft.id
      ? await api.ideas.update(draft.id, payload).catch(reportError)
      : await api.ideas.create(payload).catch(reportError);

    setIdeas((prev) => (draft.id
      ? prev.map((i) => (i.id === saved.id ? saved : i))
      : [saved, ...prev]));
    return saved;
  }, [reportError]);

  const deleteIdea = useCallback(async (id) => {
    await api.ideas.remove(id).catch(reportError);
    setIdeas((prev) => prev.filter((i) => i.id !== id));
  }, [reportError]);

  /* Every detail-page mutation returns the whole idea back, so one helper
     folds the server's answer into the list and hands it to the caller. */
  const mergeIdea = useCallback((saved) => {
    setIdeas((prev) => {
      const hit = prev.some((i) => i.id === saved.id);
      return hit ? prev.map((i) => (i.id === saved.id ? saved : i)) : [saved, ...prev];
    });
    return saved;
  }, []);

  /** Reads one idea fresh from the server — the detail page's loader. */
  const getIdea = useCallback(async (id) => {
    const found = await api.ideas.get(id);
    return mergeIdea(found);
  }, [mergeIdea]);

  const addIdeaComment = useCallback(async (id, text) => {
    const saved = await api.ideas.addComment(id, text).catch(reportError);
    return mergeIdea(saved);
  }, [mergeIdea, reportError]);

  const removeIdeaComment = useCallback(async (id, commentId) => {
    const saved = await api.ideas.removeComment(id, commentId).catch(reportError);
    return mergeIdea(saved);
  }, [mergeIdea, reportError]);

  /** Appends a new description version instead of overwriting the old one. */
  const addIdeaRevision = useCallback(async (id, text) => {
    const saved = await api.ideas.addRevision(id, text).catch(reportError);
    return mergeIdea(saved);
  }, [mergeIdea, reportError]);

  const setImplementationDate = useCallback(async (id, date) => {
    const saved = await api.ideas.setImplementationDate(id, date).catch(reportError);
    return mergeIdea(saved);
  }, [mergeIdea, reportError]);

  const setIdeaStatus = useCallback(async (id, status) => {
    const saved = await api.ideas.setStatus(id, status).catch(reportError);
    return mergeIdea(saved);
  }, [mergeIdea, reportError]);

  /** Share = hand the finished project to the people who will carry it. */
  const shareIdea = useCallback(async (id, { memberIds = [] }) => {
    const saved = await api.ideas.share(id, { memberIds }).catch(reportError);
    return mergeIdea(saved);
  }, [mergeIdea, reportError]);

  const editIdeaComment = useCallback(async (id, commentId, text) => {
    const saved = await api.ideas.editComment(id, commentId, text).catch(reportError);
    return mergeIdea(saved);
  }, [mergeIdea, reportError]);

  /** Used by the Think Log's "Add to Idea". Same gesture as Add to Task: a
      line from the log becomes something the team can see and discuss. */
  const addIdeaFromLog = useCallback(async ({
    title, description, implementationDate, sharedWith = [], logId, logTitle,
  }) => {
    const draft = {
      tagline: title,
      purpose: description || 'Captured from the think log.',
      dept: user?.dept || 'Executive',
      status: 'Under Review',
      descriptionType: 'paragraph',
      descriptionContent: { paragraph: description || title },
      /* The think-log point it started as travels with the idea, as its id, so
         the idea page can say where the thought came from. The wording is
         looked up from the log itself rather than copied, so rewording the
         note does not leave the idea quoting an older version of it. */
      fromLog: logId ?? null,
      fromLogTitle: logTitle || title,
    };
    const saved = await api.ideas.create(draft, sharedWith).catch(reportError);

    /* The date the chairman picked here is the same implementation date the
       idea page sets, so it reaches the team's calendars the same way. */
    const withDate = implementationDate
      ? await api.ideas.setImplementationDate(saved.id, implementationDate).catch(() => saved)
      : saved;

    setIdeas((prev) => [withDate, ...prev]);
    return withDate;
  }, [user, reportError]);

  /* ---------- tasks ---------- */
  /**
   * Assign work to named people, to whole departments, or both.
   *
   * `ideaId` ties the task back to the idea it came out of — that is what
   * makes it appear in the Assigned Work panel on the idea's own page.
   */
  const addTasksForMembers = useCallback(async ({
    title, description, due, priority,
    members = [], deptNames = [], ideaId = null, logId = null, logTitle = '', startAt = null,
  }) => {
    const created = await api.tasks.create({
      title,
      description,
      due,
      priority,
      memberIds: members.map((m) => m.id),
      deptNames,
      ideaId,
      logId,
      logTitle,
      startAt,
    }).catch(reportError);
    setTasks((prev) => [...prev, ...created]);
    // A task raised against an idea changes that idea's page, so pull it back.
    if (ideaId) {
      try { mergeIdea(await api.ideas.get(ideaId)); } catch { /* the list refreshes anyway */ }
    }
    return created;
  }, [mergeIdea, reportError]);

  const updateTask = useCallback(async (id, body) => {
    const saved = await api.tasks.update(id, body).catch(reportError);
    setTasks((prev) => prev.map((t) => (t.id === id ? saved : t)));
    return saved;
  }, [reportError]);

  /* ---------- team ---------- */
  const addMember = useCallback(async (member) => {
    const saved = await api.team.invite(member).catch(reportError);
    setTeam((prev) => [...prev, saved]);
    return saved;
  }, [reportError]);

  const updateMember = useCallback(async (id, patchBody) => {
    const saved = await api.team.update(id, patchBody).catch(reportError);
    setTeam((prev) => prev.map((m) => (m.id === id ? saved : m)));
    return saved;
  }, [reportError]);

  const removeMember = useCallback(async (id) => {
    await api.team.remove(id).catch(reportError);
    setTeam((prev) => prev.filter((m) => m.id !== id));
  }, [reportError]);

  /* ---------- think logs ---------- */
  const addThinkLog = useCallback(async (log) => {
    const saved = await api.thinkLogs.create(
      log.points.map((p) => ({ text: p.text, states: p.states || [] })),
      log.title
    ).catch(reportError);
    setThinkLogs((prev) => [saved, ...prev]);
    return saved;
  }, [reportError]);

  /** Add to what a saved think-log point became: it can be a task and an idea
      at once, so this never replaces a state it already has. */
  const markLogPoint = useCallback(async (pointId, state) => {
    const saved = await api.thinkLogs.markPoint(pointId, state).catch(reportError);
    setThinkLogs((prev) => prev.map((l) => (l.id === saved.id ? saved : l)));
    return saved;
  }, [reportError]);

  /** Reword a point that has already been saved. The note autosaves itself
      now, so the first shape of a thought lands on the record before it is
      finished — this is how it gets tidied afterwards. */
  const editLogPoint = useCallback(async (pointId, text) => {
    const saved = await api.thinkLogs.editPoint(pointId, text).catch(reportError);
    setThinkLogs((prev) => prev.map((l) => (l.id === saved.id ? saved : l)));
    return saved;
  }, [reportError]);

  /* ---------- notifications ---------- */
  const markAllRead = useCallback(async () => {
    await api.notifications.markAllRead().catch(reportError);
    setNotifs((prev) => prev.map((n) => ({ ...n, unread: false })));
  }, [reportError]);

  const unreadCount = useMemo(() => notifs.filter((n) => n.unread).length, [notifs]);

  const value = useMemo(() => ({
    loading, refreshAll,
    ideas, myIdeas, saveIdea, deleteIdea, addIdeaFromLog,
    getIdea, addIdeaComment, removeIdeaComment, addIdeaRevision,
    setImplementationDate, setIdeaStatus, shareIdea, editIdeaComment,
    tasks, myTasks, addTasksForMembers, updateTask,
    team, addMember, updateMember, removeMember,
    thinkLogs, addThinkLog, markLogPoint, editLogPoint,
    notifs, markAllRead, unreadCount,
    threads, openThread, sendMessage, unreadMessages,
    isChair,
  }), [
    loading, refreshAll,
    ideas, myIdeas, saveIdea, deleteIdea, addIdeaFromLog,
    getIdea, addIdeaComment, removeIdeaComment, addIdeaRevision,
    setImplementationDate, setIdeaStatus, shareIdea, editIdeaComment,
    tasks, myTasks, addTasksForMembers, updateTask,
    team, addMember, updateMember, removeMember,
    thinkLogs, addThinkLog, markLogPoint, editLogPoint,
    notifs, markAllRead, unreadCount,
    threads, openThread, sendMessage, unreadMessages,
    isChair,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
};
