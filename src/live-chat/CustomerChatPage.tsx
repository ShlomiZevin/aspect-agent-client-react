/**
 * CustomerChatPage — the login-gated customer surface at `/:agent/go`.
 * (`/:agent/chat` is still the V1 authenticated chat — do not shadow it.)
 *
 * This is the link we send business/test users (task #715). Same
 * user+password model as V1: users are created in the agent's admin
 * (Users tab → Add User) with the phone number doubling as the
 * password; `POST /api/auth/login` matches name+phone within the
 * agent's tenant (= the URL slug).
 *
 * Once signed in, it renders LiveChatPage in `restricted` mode —
 * normal chat + "new chat" only, no history / debug / settings — with
 * the user's externalId as the conversation owner, so their chats
 * appear under their user in the admin drill-down.
 *
 * Demo-grade auth by design: session in localStorage, no tokens.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  clearSession,
  getSession,
  login,
  type AgentAuthSession,
} from '../services/agentAuthService';
import { I18N, dirOf, type Lang } from './i18n';
import { LiveChatPage } from './LiveChatPage';
import './liveChat.css';

/** Chat language from the shared live-chat settings (Hebrew default). */
function storedLang(): Lang {
  try {
    const raw = localStorage.getItem('lybi-live:settings');
    return raw && JSON.parse(raw).lang === 'en' ? 'en' : 'he';
  } catch {
    return 'he';
  }
}

export function CustomerChatPage() {
  const { agent } = useParams<{ agent: string }>();
  const slug = agent ?? 'lybi';

  const [session, setSessionState] = useState<AgentAuthSession | null>(() => getSession(slug));
  const [name, setName] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const lang = storedLang();
  const t = I18N[lang];
  const dir = dirOf(lang);
  // "Sign in to Cardly", not "sign in to chat" — the link is per-agent,
  // so name it. Prettified slug ("banking-v2" → "Banking V2").
  const agentTitle = slug
    .split('-')
    .map(w => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');

  // Slug can change without a remount (client-side nav) — re-read the
  // per-agent session.
  useEffect(() => { setSessionState(getSession(slug)); }, [slug]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !name.trim() || !pass.trim()) return;
    setBusy(true);
    setError(false);
    try {
      const s = await login(slug, name.trim(), pass.trim());
      setSessionState(s);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const onLogout = () => {
    clearSession(slug);
    setSessionState(null);
    setName('');
    setPass('');
  };

  if (session) {
    return (
      <LiveChatPage
        restricted
        ownerUserIdOverride={session.userId}
        onLogout={onLogout}
      />
    );
  }

  return (
    <div className="lybi-chat" dir={dir} data-theme="light">
      <div className="login-wrap">
        <form className="login-card" onSubmit={submit}>
          <div className="login-logo">
            <img src="/img/lybi-logo-transparent.png" alt="Lybi" />
          </div>
          <h2>{t.loginTitle.replace('{agent}', agentTitle)}</h2>
          <div className="field">
            <label>{t.loginName}</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
              autoComplete="username"
            />
          </div>
          <div className="field">
            <label>
              {t.loginPass}
              <span className="login-info" title={t.loginSub} aria-label={t.loginSub}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4M12 8h.01" />
                </svg>
              </span>
            </label>
            <input
              type="password"
              value={pass}
              onChange={e => setPass(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          {error && <div className="login-error">{t.loginError}</div>}
          <button
            type="submit"
            className="btn primary login-btn"
            disabled={busy || !name.trim() || !pass.trim()}
          >
            {busy ? '…' : t.loginBtn}
          </button>
        </form>
      </div>
    </div>
  );
}
