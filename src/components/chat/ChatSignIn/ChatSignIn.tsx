import { useEffect, useRef, useState } from 'react';
import type { Session, SignInConfig, SignInContext } from '../../../auth';
import { SignInMethods } from '../../../auth';
import { useLanguage } from '../../../context/LanguageContext';
import { useHistorySignIn } from './useHistorySignIn';
import { CaretIcon, CloseIcon, DevicesIcon, PersonIcon } from './icons';
import styles from './ChatSignIn.module.css';

/**
 * The optional "sign in to keep your history" control for a chat header.
 *
 * Renders only where the Sign-In module is in 'sync' mode for this agent: a
 * 'gate' client is handled by <SignInGate> in front of the whole surface, and a
 * client without the module gets nothing. The chat stays anonymous until the
 * person signs in; doing so moves the chats they already have onto the account,
 * and the same history then follows them to any device they sign in on.
 *
 * Mounts in both the retail chat header and the Intelligence shell header — see
 * {@link useHistorySignIn} for how the two differ.
 */
interface Props {
  /** Auth tenant — the agent URL slug / dataset id (e.g. 'zolstock'). */
  tenant: string;
  /** Agent display + DB name (e.g. 'ZolStock') — scopes the history it merges. */
  agentName: string;
}

export function ChatSignIn({ tenant, agentName }: Props) {
  const { t } = useLanguage();
  const { active, session, config, context, signIn, signOut } = useHistorySignIn(tenant, agentName);
  const [dialogOpen, setDialogOpen] = useState(false);

  if (!active) return null;

  if (session) {
    return <AccountMenu session={session} onSignOut={signOut} t={t} />;
  }

  return (
    <>
      <button className={styles.trigger} onClick={() => setDialogOpen(true)}>
        <PersonIcon />
        {t('signIn.button')}
      </button>

      {dialogOpen && config && (
        <SignInDialog
          tenant={tenant}
          config={config}
          context={context}
          onClose={() => setDialogOpen(false)}
          onSignedIn={(next) => { setDialogOpen(false); signIn(next); }}
          t={t}
        />
      )}
    </>
  );
}

// ── the signed-in chip + menu ──────────────────────────────────────────────

interface AccountMenuProps {
  session: Session;
  onSignOut: () => void;
  t: (key: string) => string;
}

function AccountMenu({ session, onSignOut, t }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  // First letter of the first two name words ("Konstantin Ziben" → "KZ"), so
  // the chip can shrink to just this circle on a phone without losing who.
  const initial = (session.name || session.email || '?')
    .trim().split(/\s+/).slice(0, 2).map(w => w.charAt(0).toUpperCase()).join('') || '?';

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div className={styles.wrap} ref={wrap}>
      <button className={styles.chip} onClick={() => setOpen((v) => !v)} title={session.email}>
        <span className={styles.avatar}>{initial}</span>
        <span className={styles.chipName}>{session.name || session.email}</span>
        <span className={styles.caret}><CaretIcon /></span>
      </button>

      {open && (
        <div className={styles.menu} role="menu">
          <div className={styles.menuHead}>
            <span className={styles.avatarLg}>{initial}</span>
            <div className={styles.menuId}>
              <div className={styles.menuName}>{session.name}</div>
              <div className={styles.menuEmail}>{session.email}</div>
            </div>
          </div>
          <div className={styles.menuNote}>
            <DevicesIcon />
            <span>{t('signIn.syncNote')}</span>
          </div>
          <button className={styles.menuItem} role="menuitem" onClick={onSignOut}>
            {t('signIn.signOut')}
          </button>
        </div>
      )}
    </div>
  );
}

// ── the sign-in dialog ─────────────────────────────────────────────────────

interface SignInDialogProps {
  tenant: string;
  config: SignInConfig;
  context: SignInContext;
  onClose: () => void;
  onSignedIn: (session: Session) => void;
  t: (key: string) => string;
}

function SignInDialog({ tenant, config, context, onClose, onSignedIn, t }: SignInDialogProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button className={styles.close} onClick={onClose} aria-label={t('signIn.close')}>
          <CloseIcon />
        </button>

        <div className={styles.head}>
          <span className={styles.badge}><DevicesIcon size={22} /></span>
          <h2 className={styles.title}>{t('signIn.title')}</h2>
          <p className={styles.subtitle}>{t('signIn.subtitle')}</p>
        </div>

        <SignInMethods
          tenant={tenant}
          config={config}
          context={context}
          onSignedIn={onSignedIn}
          t={t}
        />

        <p className={styles.foot}>{t('signIn.footer')}</p>
      </div>
    </div>
  );
}
