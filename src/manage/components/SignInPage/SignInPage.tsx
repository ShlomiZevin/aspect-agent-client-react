/**
 * The management center's door (task #985): sign in with Google, or — when
 * the address Google gave has no grant — say which address it was, so a
 * wrong account is obvious, and offer another one. Also the frame for
 * "checking…" and "could not load".
 *
 * Google's own button (auth/gsi.ts — their brand terms), drawn once per
 * slot (replaceChildren first, like auth/SignInMethods). The OAuth client
 * id comes from the server: GET /api/manage/auth/config.
 */

import { useEffect, useRef, useState } from 'react';
import { useGoogleScript } from '../../../auth/useGoogleScript';
import { renderGoogleButton } from '../../../auth/gsi';
import { manageService } from '../../../services/manageService';
import { COPY } from '../../copy';
import styles from './SignInPage.module.css';

type Mode = 'loading' | 'sign-in' | 'no-access' | 'error';

interface Props {
  mode: Mode;
  email?: string | null;
  /** Google's ID token → resolves to an error sentence, or null when it went through. */
  onCredential: (idToken: string) => Promise<string | null>;
  onRetry?: () => void;
}

export function SignInPage({ mode, email, onCredential, onRetry }: Props) {
  const wantsGoogle = mode === 'sign-in' || mode === 'no-access';
  const [clientId, setClientId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const slot = useRef<HTMLDivElement>(null);
  const script = useGoogleScript(wantsGoogle && Boolean(clientId));

  // Google's callback fires outside React: reach the current handler through a ref.
  const handler = useRef(onCredential);
  useEffect(() => { handler.current = onCredential; });

  useEffect(() => {
    if (!wantsGoogle || clientId !== null) return;
    let alive = true;
    manageService.getAuthConfig()
      .then(c => { if (alive) setClientId(c.clientId || ''); })
      .catch(() => { if (alive) setClientId(''); });
    return () => { alive = false; };
  }, [wantsGoogle, clientId]);

  useEffect(() => {
    if (!wantsGoogle || script !== 'ready' || !slot.current || !clientId) return;
    slot.current.replaceChildren();
    renderGoogleButton(slot.current, clientId, async (idToken) => {
      setBusy(true);
      setError(null);
      const message = await handler.current(idToken);
      if (message) setError(COPY.signInFailed);
      setBusy(false);
    }, 260, 'he');
  }, [wantsGoogle, script, clientId, mode]);

  return (
    <div className={styles.root} data-manage-root dir="rtl" lang="he">
      <header className={styles.topbar}>
        <img className={styles.logo} src="/img/lybi-logo-white.png" alt={COPY.brandAlt} />
        <span className={styles.topSep} aria-hidden />
        <span className={styles.centerName}>{COPY.centerName}</span>
      </header>

      <main className={styles.main}>
        <section className={styles.card} aria-busy={mode === 'loading' || busy}>
          {mode === 'loading' && <p className={styles.quiet}>{COPY.loading}</p>}

          {mode === 'error' && (
            <>
              <p className={styles.quiet}>{COPY.loadFailed}</p>
              {onRetry && <button type="button" className={styles.button} onClick={onRetry}>{COPY.tryAgain}</button>}
            </>
          )}

          {wantsGoogle && (
            <>
              {mode === 'sign-in' ? (
                <>
                  <h1 className={styles.title}>{COPY.signInTitle}</h1>
                  <p className={styles.sub}>{COPY.signInSub}</p>
                </>
              ) : (
                <>
                  <span className={styles.badge} aria-hidden>!</span>
                  <h1 className={styles.title}>
                    {email
                      ? <>{COPY.noAccessBefore} <bdi className={styles.email}>{email}</bdi> {COPY.noAccessAfter}</>
                      : COPY.noAccessTitleUnknown}
                  </h1>
                  <p className={styles.sub}>{COPY.noAccessSub}</p>
                  <p className={styles.other}>{COPY.otherAccount}</p>
                </>
              )}
              {/* Reserved height: nothing jumps when Google's button arrives. */}
              <div className={styles.googleArea}>
                {clientId === '' ? (
                  <p className={styles.hint}>{COPY.googleOff}</p>
                ) : (
                  <div ref={slot} className={`${styles.googleSlot} ${busy ? styles.busy : ''}`} />
                )}
              </div>
              <p className={styles.hint}>
                {error || (script === 'failed' ? COPY.googleFailed : script === 'loading' ? COPY.googleLoading : ' ')}
              </p>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
