import { useCallback, useContext } from 'react';
import { useSession } from '../../../auth';
import type { Session, SignInConfig, SignInContext } from '../../../auth';
import { useUserContext } from '../../../context/UserContext';
import { ChatContext } from '../../../context';

/**
 * Everything the header control needs, with the "what happens on sign-in / out"
 * orchestration in one testable place instead of inside the component.
 *
 * Signing in: remember the anonymous user id, adopt the account's id, and —
 * when this is mounted inside a chat — move the anon conversations across and
 * jump to the newest one. Signing out puts the person back on the anonymous
 * session they had, so they do not lose the thread they were on.
 *
 * `ChatContext` is optional: the same control sits in the Intelligence shell,
 * which has no chat provider. There, switching the user id is the whole job —
 * reports and history re-fetch from it on their own.
 */
const anonKey = (tenant: string) => `aspect_anon_before_${tenant}`;

function readLocal(key: string): string {
  try { return localStorage.getItem(key) ?? ''; } catch { return ''; }
}
function writeLocal(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* private mode */ }
}

export interface HistorySignIn {
  /** The Sign-In module is in 'sync' mode for this agent — show the control. */
  active: boolean;
  session: Session | null;
  config: SignInConfig | null;
  /** Passed to <SignInMethods> so the sign-in call carries the anon id + agent. */
  context: SignInContext;
  signIn: (session: Session) => void;
  signOut: () => void;
}

export function useHistorySignIn(tenant: string, agentName: string): HistorySignIn {
  const { session, config, isSync, signIn: persist, signOut: forget } = useSession(tenant);
  const { userId, switchUser } = useUserContext();
  const chat = useContext(ChatContext);

  const signIn = useCallback((next: Session) => {
    writeLocal(anonKey(tenant), userId ?? '');
    persist(next);
    switchUser(next.userId);

    if (!chat) return;
    // The user id change re-fetches the list on its own; this also opens the
    // newest thread so the person lands somewhere, not on an empty composer.
    const latest = next.conversations?.[0];
    if (latest) void chat.switchToChat(String(latest.externalId ?? latest.id));
    window.setTimeout(() => chat.loadConversations(), 400);
  }, [tenant, userId, persist, switchUser, chat]);

  const signOut = useCallback(() => {
    forget();
    const previous = readLocal(anonKey(tenant));
    if (previous) {
      switchUser(previous);
      if (chat) window.setTimeout(() => chat.loadConversations(), 300);
    } else {
      chat?.createNewChat();
    }
  }, [tenant, forget, switchUser, chat]);

  return {
    active: isSync,
    session,
    config,
    context: { anonUserId: userId, agentName },
    signIn,
    signOut,
  };
}
