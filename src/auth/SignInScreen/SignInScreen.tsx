import { useEffect, useRef, useState } from 'react';
import { authApi } from '../api';
import type { Session, SignInConfig } from '../api';
import { useGoogleScript } from '../useGoogleScript';
import styles from './SignInScreen.module.css';

/**
 * The sign-in screen: Google, an email and a password, or both — whichever the
 * client has been set to accept.
 *
 * Which of them appears is the server's answer, not a guess from the browser.
 * The Google button is rendered by Google's own script into the div below;
 * drawing our own and calling their API from it is against their brand rules
 * and breaks whenever they change the flow.
 */
interface Props {
  tenant: string;
  agentName: string;
  config: SignInConfig;
  onSignedIn: (session: Session) => void;
}

// Google's callback fires outside React, so the component hands it a ref.
interface GoogleId {
  initialize(options: { client_id: string; callback: (r: { credential: string }) => void }): void;
  renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
}

export function SignInScreen({ tenant, agentName, config, onSignedIn }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const googleSlot = useRef<HTMLDivElement>(null);
  const script = useGoogleScript(config.google);

  // Held in a ref so the callback Google keeps hold of always reaches the
  // current handler, rather than the one from the render that registered it.
  // Written in an effect, not during render: a ref assigned while rendering is
  // a side effect, and React may render without committing.
  const handleCredential = useRef<(token: string) => void>(() => {});
  useEffect(() => {
    handleCredential.current = async (idToken: string) => {
      setBusy(true);
      setError(null);
      try {
        onSignedIn(await authApi.withGoogle(idToken, tenant));
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setBusy(false);
      }
    };
  }, [onSignedIn, tenant]);

  useEffect(() => {
    if (script !== 'ready' || !googleSlot.current || !config.clientId) return;

    const google = (window as unknown as { google: { accounts: { id: GoogleId } } }).google;
    google.accounts.id.initialize({
      client_id: config.clientId,
      callback: r => handleCredential.current(r.credential),
    });
    google.accounts.id.renderButton(googleSlot.current, {
      theme: 'outline',
      size: 'large',
      width: 320,
      text: 'signin_with',
    });
  }, [script, config.clientId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password || busy) return;
    setBusy(true);
    setError(null);
    try {
      onSignedIn(await authApi.withPassword(email.trim(), password, tenant));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <h1 className={styles.title}>{agentName}</h1>
        <p className={styles.sub}>Sign in to continue</p>

        {config.google && (
          <div className={styles.googleArea}>
            <div ref={googleSlot} className={styles.googleSlot} />
            {script === 'loading' && <span className={styles.hint}>Loading Google…</span>}
            {script === 'failed' && (
              <span className={styles.hint}>
                Google sign-in could not load
                {config.password ? ' — use your email and password below.' : '.'}
              </span>
            )}
          </div>
        )}

        {config.google && config.password && (
          <div className={styles.divider}><span>or</span></div>
        )}

        {config.password && (
          <form className={styles.form} onSubmit={submit}>
            <label className={styles.field}>
              <span className={styles.label}>Email</span>
              <input
                type="email"
                className={styles.input}
                value={email}
                autoComplete="username"
                placeholder="you@company.com"
                onChange={e => setEmail(e.target.value)}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Password</span>
              <input
                type="password"
                className={styles.input}
                value={password}
                autoComplete="current-password"
                onChange={e => setPassword(e.target.value)}
              />
            </label>

            <button type="submit" className={styles.submit} disabled={busy || !email.trim() || !password}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        )}

        {error && <p className={styles.error}>{error}</p>}

        <p className={styles.foot}>
          Access is given ahead of time. If you cannot get in, ask whoever set this up
          to add your address.
        </p>
      </div>
    </div>
  );
}
