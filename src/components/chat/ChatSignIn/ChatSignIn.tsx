import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { authApi, useSession } from '../../../auth';
import type { Session } from '../../../auth';
import { useGoogleScript } from '../../../auth/useGoogleScript';
import { useUserContext } from '../../../context/UserContext';
import { ChatContext } from '../../../context';
import { useLanguage } from '../../../context/LanguageContext';
import styles from './ChatSignIn.module.css';

/**
 * The optional "sign in to keep your history" control for a chat header.
 *
 * Only renders where the Sign-In module is set to 'sync' for this agent — a
 * 'gate' client is handled by SignInGate in front of the whole surface, and a
 * client without the module gets nothing. The chat stays anonymous until the
 * person chooses to sign in; doing so re-parents the chats they already have
 * onto the account and the same history then follows them to any other device.
 */
interface Props {
  /** The auth tenant — the agent URL slug / dataset id (e.g. 'zolstock'). */
  tenant: string;
  /** The agent's display + DB name (e.g. 'ZolStock') — scopes the history merge. */
  agentName: string;
}

interface GoogleId {
  initialize(o: { client_id: string; callback: (r: { credential: string }) => void }): void;
  renderButton(el: HTMLElement, o: Record<string, unknown>): void;
}

const ANON_BEFORE_KEY = (tenant: string) => `aspect_anon_before_${tenant}`;

export function ChatSignIn({ tenant, agentName }: Props) {
  const { session, config, isSync, signIn, signOut } = useSession(tenant);
  const { userId, switchUser } = useUserContext();
  const { t } = useLanguage();
  // Present on the chat surfaces, absent on the Intelligence shell — this
  // control mounts in both, and outside a chat there is simply nothing to
  // refresh beyond the user id switch itself.
  const chat = useContext(ChatContext);

  const [modalOpen, setModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const menuWrap = useRef<HTMLDivElement>(null);
  const googleSlot = useRef<HTMLDivElement>(null);

  const script = useGoogleScript(Boolean(config?.google && modalOpen));

  const applySession = useCallback(async (next: Session) => {
    try { localStorage.setItem(ANON_BEFORE_KEY(tenant), userId ?? ''); } catch { /* private mode */ }
    signIn(next);
    setModalOpen(false);
    setEmail('');
    setPassword('');
    switchUser(next.userId);
    if (chat) {
      window.setTimeout(() => chat.loadConversations(), 400);
      window.setTimeout(() => chat.loadConversations(), 1200);
      const latest = next.conversations?.[0];
      if (latest) await chat.switchToChat(String(latest.externalId ?? latest.id));
    }
  }, [tenant, userId, signIn, switchUser, chat]);

  // Google's callback fires outside React — keep it pointed at the live handler.
  const onCredential = useRef<(t: string) => void>(() => {});
  useEffect(() => {
    onCredential.current = async (credential: string) => {
      setBusy(true);
      setError(null);
      try {
        await applySession(await authApi.withGoogle(credential, tenant, { anonUserId: userId, agentName }));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setBusy(false);
      }
    };
  }, [applySession, tenant, userId, agentName]);

  useEffect(() => {
    if (script !== 'ready' || !googleSlot.current || !config?.clientId) return;
    const google = (window as unknown as { google: { accounts: { id: GoogleId } } }).google;
    google.accounts.id.initialize({
      client_id: config.clientId,
      callback: r => onCredential.current(r.credential),
    });
    google.accounts.id.renderButton(googleSlot.current, {
      type: 'standard', theme: 'outline', size: 'large',
      text: 'continue_with', shape: 'pill', logo_alignment: 'left', width: 320,
    });
  }, [script, config?.clientId]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuWrap.current && !menuWrap.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password || busy) return;
    setBusy(true);
    setError(null);
    try {
      await applySession(await authApi.withPassword(email.trim(), password, tenant, {
        anonUserId: userId, agentName,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  const handleSignOut = useCallback(() => {
    setMenuOpen(false);
    signOut();
    let prev = '';
    try { prev = localStorage.getItem(ANON_BEFORE_KEY(tenant)) || ''; } catch { /* private mode */ }
    if (prev) {
      switchUser(prev);
      if (chat) window.setTimeout(() => chat.loadConversations(), 300);
    } else {
      chat?.createNewChat();
    }
  }, [tenant, signOut, switchUser, chat]);

  if (!isSync) return null;

  if (session) {
    const initial = (session.name || session.email || '?').trim().charAt(0).toUpperCase();
    return (
      <div className={styles.wrap} ref={menuWrap}>
        <button className={styles.chip} onClick={() => setMenuOpen(v => !v)} title={session.email}>
          <span className={styles.avatar}>{initial}</span>
          <span className={styles.chipName}>{session.name || session.email}</span>
          <svg className={styles.caret} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6" /></svg>
        </button>

        {menuOpen && (
          <div className={styles.menu} role="menu">
            <div className={styles.menuHead}>
              <span className={styles.avatarLg}>{initial}</span>
              <div className={styles.menuId}>
                <div className={styles.menuName}>{session.name}</div>
                <div className={styles.menuEmail}>{session.email}</div>
              </div>
            </div>
            <div className={styles.menuNote}>
              <SyncGlyph />
              <span>{t('signIn.syncNote')}</span>
            </div>
            <button className={styles.menuItem} onClick={handleSignOut} role="menuitem">{t('signIn.signOut')}</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <button className={styles.signIn} onClick={() => { setError(null); setModalOpen(true); }}>
        <UserGlyph />
        {t('signIn.button')}
      </button>

      {modalOpen && config && (
        <div className={styles.overlay} onClick={() => setModalOpen(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            <button className={styles.close} onClick={() => setModalOpen(false)} aria-label={t('signIn.close')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>

            <div className={styles.head}>
              <span className={styles.badge}><SyncGlyph /></span>
              <h2 className={styles.title}>{t('signIn.title')}</h2>
              <p className={styles.subtitle}>{t('signIn.subtitle')}</p>
            </div>

            {config.google && (
              <div className={styles.googleRow}>
                {config.clientId
                  ? <div ref={googleSlot} className={styles.googleSlot} />
                  : (
                    <button type="button" className={styles.googleBtn} disabled title={t('signIn.googleUnavailable')}>
                      <GoogleGlyph /> {t('signIn.google')}
                    </button>
                  )}
                {script === 'loading' && <span className={styles.hint}>{t('signIn.loadingGoogle')}</span>}
              </div>
            )}

            {config.google && config.password && <div className={styles.divider}><span>{t('signIn.or')}</span></div>}

            {config.password && (
              <form className={styles.form} onSubmit={submitPassword}>
                <label className={styles.field}>
                  <span className={styles.label}>{t('signIn.email')}</span>
                  <input
                    type="email" className={styles.input} value={email} autoComplete="username"
                    placeholder="you@company.com" onChange={e => setEmail(e.target.value)}
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>{t('signIn.password')}</span>
                  <input
                    type="password" className={styles.input} value={password} autoComplete="current-password"
                    onChange={e => setPassword(e.target.value)}
                  />
                </label>
                <button type="submit" className={styles.submit} disabled={busy || !email.trim() || !password}>
                  {busy ? t('signIn.submitting') : t('signIn.submit')}
                </button>
              </form>
            )}

            {error && <p className={styles.error}>{error}</p>}

            <p className={styles.foot}>{t('signIn.footer')}</p>
          </div>
        </div>
      )}
    </>
  );
}

function UserGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="7" r="4" />
    </svg>
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

function SyncGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
    </svg>
  );
}
