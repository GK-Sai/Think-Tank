import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { safeLocal } from '../lib/storage';
import { ApiError } from '../lib/api';
import {
  DEMO_USERNAMES, DEMO_TEAM_PASSWORD, DEMO_CHAIR,
  MIN_PW_LENGTH, REMEMBER_KEY, isValidEmail,
} from '../data/demoUsers';

/* Decorative dot grids — 32 spans each, same as the original. */
const DOTS = Array.from({ length: 32 });

const EyeOpen = () => (
  <>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </>
);

const EyeClosed = () => (
  <>
    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.6 21.6 0 0 1 5.06-6.06M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a21.65 21.65 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </>
);

export default function Login() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({ email: '', password: '' });
  const [note, setNote] = useState(null);          // { text, kind }
  const [logoFailed, setLogoFailed] = useState(false);

  const emailRef = useRef(null);
  const pwRef = useRef(null);

  /* Remembered email. The checkbox starts unchecked and only JS ticks it,
     so it never flashes or lies when storage is unavailable. */
  useEffect(() => {
    const saved = safeLocal.get(REMEMBER_KEY);
    if (!saved) return;
    setEmail(saved);
    setRemember(true);
    // The email is already filled, so send focus to the password box.
    if (!('ontouchstart' in window)) pwRef.current?.focus();
  }, []);

  if (user) return <Navigate to="/" replace />;

  const clearNote = () => setNote(null);

  const checkCaps = (e) => {
    if (typeof e.getModifierState !== 'function') return;
    setCapsOn(e.getModifierState('CapsLock'));
  };

  const togglePw = () => {
    const input = pwRef.current;
    const caret = input?.selectionStart;
    setShowPw((v) => !v);
    // Preserve the caret so revealing the password doesn't jump the cursor.
    requestAnimationFrame(() => {
      input?.focus();
      try { input?.setSelectionRange(caret, caret); } catch { /* ignore */ }
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (submitting) return;                       // guard against double-submit
    clearNote();

    const value = email.trim();
    setEmail(value);                              // normalise trailing spaces

    const next = { email: '', password: '' };
    // A value containing "@" is treated as an email and must look valid;
    // anything else is treated as a username.
    if (!value) next.email = 'Username or email is required.';
    else if (value.includes('@') && !isValidEmail(value)) next.email = 'Please enter a valid email address.';

    if (!password) next.password = 'Password is required.';
    else if (password.length < MIN_PW_LENGTH) {
      next.password = `Password must be at least ${MIN_PW_LENGTH} characters.`;
    }

    setErrors(next);
    if (next.email) { emailRef.current?.focus(); return; }
    if (next.password) { pwRef.current?.focus(); return; }

    setSubmitting(true);

    try {
      // The server verifies the password, decides the role, and returns a
      // token the API client stores. Nothing sensitive is compared here.
      const me = await signIn(value, password);

      if (remember) safeLocal.set(REMEMBER_KEY, value);
      else safeLocal.remove(REMEMBER_KEY);

      setNote({ text: `Signed in as ${me.label}. Redirecting…`, kind: 'success' });
      navigate('/', { replace: true });
    } catch (err) {
      setSubmitting(false);
      if (err instanceof ApiError && err.status === 401) {
        setErrors({ email: '', password: 'Incorrect password.' });
        setNote({ text: err.message, kind: 'error' });
      } else {
        setNote({ text: err.message || 'Could not sign in.', kind: 'error' });
      }
      pwRef.current?.focus();
    }
  };

  return (
    <div className="login-page">
      <div className="bg" aria-hidden="true">
        <div className="bg-dots top-left">{DOTS.map((_, i) => <span key={i} />)}</div>
        <div className="bg-dots bottom-right">{DOTS.map((_, i) => <span key={i} />)}</div>
        <div className="bg-circle c1" />
        <div className="bg-wave" />
      </div>

      <main className="login-card">
        <div className={`logo-wrap${logoFailed ? ' no-image' : ''}`}>
          {/* logo.png lives in public/. If it is missing the wordmark shows instead. */}
          <img
            src="/logo.png"
            alt="Think Tank — Ideas, Insights, Impact"
            width="640"
            height="466"
            onError={() => setLogoFailed(true)}
          />
          <span className="logo-fallback" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="#1a56db" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18h6" /><path d="M10 22h4" />
              <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
            </svg>
            Think Tank
          </span>
        </div>

        <h1 className="welcome">Welcome Back!</h1>
        <p className="subtitle">Sign in to continue to Think Tank</p>

        <form onSubmit={submit} noValidate autoComplete="on">
          <div className="field">
            <label htmlFor="email">Username or Email</label>
            <div className="input-group">
              <svg className="field-icon" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <input
                type="text"
                id="email"
                name="username"
                ref={emailRef}
                className={errors.email ? 'invalid' : undefined}
                placeholder="Enter your username or email"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
                aria-describedby="emailError"
                aria-invalid={errors.email ? 'true' : undefined}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((x) => ({ ...x, email: '' }));
                  clearNote();
                }}
                required
              />
            </div>
            <p className={`error-msg${errors.email ? ' show' : ''}`} id="emailError" role="alert">
              {errors.email || 'Please enter your username or email.'}
            </p>
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <div className="input-group">
              <svg className="field-icon" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <input
                type={showPw ? 'text' : 'password'}
                id="password"
                name="password"
                ref={pwRef}
                className={errors.password ? 'invalid' : undefined}
                placeholder="Enter your password"
                autoComplete="current-password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
                aria-describedby="pwError capsHint"
                aria-invalid={errors.password ? 'true' : undefined}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors((x) => ({ ...x, password: '' }));
                  clearNote();
                }}
                onKeyUp={checkCaps}
                onKeyDown={checkCaps}
                onBlur={() => setCapsOn(false)}
                required
              />
              <button
                type="button"
                className="toggle-pw"
                onClick={togglePw}
                aria-label={showPw ? 'Hide password' : 'Show password'}
                aria-pressed={showPw}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {showPw ? <EyeClosed /> : <EyeOpen />}
                </svg>
              </button>
            </div>
            <p className={`error-msg${errors.password ? ' show' : ''}`} id="pwError" role="alert">
              {errors.password || `Password must be at least ${MIN_PW_LENGTH} characters.`}
            </p>
            <p className={`hint-msg${capsOn ? ' show' : ''}`} id="capsHint">Caps Lock is on.</p>
          </div>

          <div className="row-between">
            <label className="remember" htmlFor="rememberMe">
              <input
                type="checkbox"
                id="rememberMe"
                name="remember"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              Remember me
            </label>
            <a
              href="#forgot"
              className="forgot"
              onClick={(e) => {
                e.preventDefault();
                setNote({ text: 'Password reset isn’t wired up yet — point this link at your reset flow.' });
              }}
            >
              Forgot Password?
            </a>
          </div>

          <button
            type="submit"
            className="login-btn"
            disabled={submitting}
            aria-busy={submitting || undefined}
          >
            {submitting ? 'Signing in…' : 'Login'}
          </button>
        </form>

        <p className={`form-note${note ? ` show ${note.kind || ''}` : ''}`} role="status" aria-live="polite">
          {note?.text || ''}
        </p>

        <div className="divider">or</div>

        <button
          type="button"
          className="google-btn"
          onClick={() => setNote({ text: 'Google sign-in isn’t wired up yet — connect this button to your OAuth flow.' })}
        >
          <svg viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.9-2.26 5.36-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
          </svg>
          Continue with Google
        </button>

        <p className="signup-text">
          Don&apos;t have an account?{' '}
          <a
            href="#signup"
            onClick={(e) => {
              e.preventDefault();
              setNote({ text: 'Sign-up isn’t wired up yet — point this link at your registration page.' });
            }}
          >
            Sign up
          </a>
        </p>

        {/* Demo helper — delete this block once real accounts exist. */}
        <details className="demo-accounts">
          <summary>Demo accounts</summary>
          <ul>
            <li>
              <b>{DEMO_CHAIR.username}</b> / {DEMO_CHAIR.password}
              <span>— Chairman, sees everything</span>
            </li>
            <li>
              {DEMO_USERNAMES.map((k, i, arr) => (
                <span key={k}><b>{k}</b>{i < arr.length - 1 ? ' · ' : ''}</span>
              ))}
              {' '}/ {DEMO_TEAM_PASSWORD} <span>— team members</span>
            </li>
          </ul>
        </details>
      </main>
    </div>
  );
}
