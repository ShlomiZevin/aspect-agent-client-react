import { useEffect, useRef, useState } from 'react';
import { authApi } from '../api';
import type { Session, SignInConfig, SignInContext } from '../api';
import { useGoogleScript } from '../useGoogleScript';
import { renderGoogleButton } from '../gsi';
import { translations } from '../../i18n/translations';
import styles from './SignInMethods.module.css';

/**
 * The credential form: a Google button, an email-and-password form, or both —
 * whichever `config` says this client offers. Shared by every surface that
 * signs someone in (the full-page gate and the in-chat dialog) so the Google
 * wiring and the "which methods show" logic exist once.
 *
 * `t` is injected rather than pulled from context: this renders both inside a
 * LanguageProvider (the chat) and outside one (the dashboard), and calling
 * `useLanguage()` in the second case throws. The default reads the English
 * strings straight from the translation table, so there is still only one copy.
 */
type Translate = (key: string) => string;
const englishT: Translate = (key) => translations.en[key] ?? key;

interface Props {
  tenant: string;
  config: SignInConfig;
  /** anonUserId / agentName carried into the sign-in call — see SignInContext. */
  context?: SignInContext;
  onSignedIn: (session: Session) => void;
  t?: Translate;
}

export function SignInMethods({ tenant, config, context = {}, onSignedIn, t = englishT }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Nearly everyone signs in with Google; email+password exists only for
  // pre-created accounts. So the form starts FOLDED behind a small text
  // label — unless Google is not offered at all, in which case the form is
  // the whole dialog and folding it would hide the only door.
  const googleOffered = Boolean(config.google && config.clientId);
  const [emailOpen, setEmailOpen] = useState(!googleOffered);

  const googleSlot = useRef<HTMLDivElement>(null);
  const script = useGoogleScript(config.google && Boolean(config.clientId));

  const { anonUserId = null, agentName = null } = context;

  // Google's callback fires outside React, so it reaches the current handler
  // through a ref rather than the closure from the render that registered it.
  const runSignIn = useRef<(call: () => Promise<Session>) => Promise<void>>(
    () => Promise.resolve(),
  );
  useEffect(() => {
    runSignIn.current = async (call) => {
      setBusy(true);
      setError(null);
      try {
        onSignedIn(await call());
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setBusy(false);
      }
    };
  }, [onSignedIn]);

  // The sign-in context reaches the callback through a ref for the same
  // reason: with anonUserId in the effect's dependencies, the anon user
  // resolving (null → id) re-ran the effect and APPENDED a second Google
  // iframe into the slot — the visible "blinking" and height jump on open.
  const ctxRef = useRef({ tenant, anonUserId, agentName });
  useEffect(() => { ctxRef.current = { tenant, anonUserId, agentName }; });

  useEffect(() => {
    if (script !== 'ready' || !googleSlot.current || !config.clientId) return;
    // Idempotent: clear the slot before rendering, so a re-run (StrictMode's
    // double-invoke included) redraws ONE button instead of stacking two.
    googleSlot.current.replaceChildren();
    renderGoogleButton(googleSlot.current, config.clientId, (idToken) => {
      const { tenant: tn, anonUserId: anon, agentName: agent } = ctxRef.current;
      void runSignIn.current(() => authApi.withGoogle(idToken, tn, { anonUserId: anon, agentName: agent }));
    });
  }, [script, config.clientId]);

  const submitPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password || busy) return;
    void runSignIn.current(() =>
      authApi.withPassword(email.trim(), password, tenant, { anonUserId, agentName }));
  };

  return (
    <div className={styles.methods}>
      {config.google && (
        <div className={styles.googleRow}>
          {config.clientId
            ? <div ref={googleSlot} className={styles.googleSlot} />
            : (
              <button type="button" className={styles.googleBtn} disabled title={t('signIn.googleUnavailable')}>
                <GoogleGlyph />
                {t('signIn.google')}
              </button>
            )}
          {script === 'loading' && <span className={styles.hint}>{t('signIn.loadingGoogle')}</span>}
          {script === 'failed' && <span className={styles.hint}>{t('signIn.googleFailed')}</span>}
        </div>
      )}

      {/* The fold: a quiet text label, not a second button competing with
          Google. Opening it reveals the form and the OR divider together. */}
      {config.password && googleOffered && !emailOpen && (
        <button
          type="button"
          className={styles.emailToggle}
          onClick={() => setEmailOpen(true)}
        >
          {t('signIn.emailToggle')}
        </button>
      )}

      {config.google && config.password && emailOpen && (
        <div className={styles.divider}><span>{t('signIn.or')}</span></div>
      )}

      {config.password && emailOpen && (
        <form className={styles.form} onSubmit={submitPassword}>
          <label className={styles.field}>
            <span className={styles.label}>{t('signIn.email')}</span>
            <input
              type="email"
              className={styles.input}
              value={email}
              autoComplete="username"
              placeholder="you@company.com"
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>{t('signIn.password')}</span>
            <input
              type="password"
              className={styles.input}
              value={password}
              autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          <button type="submit" className={styles.submit} disabled={busy || !email.trim() || !password}>
            {busy ? t('signIn.submitting') : t('signIn.submit')}
          </button>
        </form>
      )}

      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 3-2.26 5.52-4.78 7.24l7.73 6c4.51-4.18 7.09-10.36 7.09-17.71z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
