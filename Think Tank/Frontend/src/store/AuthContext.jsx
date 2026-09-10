import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';

const AuthContext = createContext(null);

/**
 * Where the session actually lives is the API client's business — a token in
 * localStorage against the real backend, a row in the demo database against
 * the mock. Either way, on boot we ask the API who we are; a 401 simply means
 * "not signed in".
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.auth.me()
      .then((me) => { if (!cancelled) setUser(me); })
      .catch(() => { /* not signed in, or the API is down */ })
      .finally(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, []);

  const signIn = useCallback(async (username, password) => {
    const me = await api.auth.login(username, password);
    setUser(me);
    return me;
  }, []);

  const signOut = useCallback(async () => {
    try { await api.auth.logout(); } catch { /* clear locally regardless */ }
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, ready, signIn, signOut, isChair: user?.role === 'chairman' }),
    [user, ready, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};
