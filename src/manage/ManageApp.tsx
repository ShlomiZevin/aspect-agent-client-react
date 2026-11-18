/**
 * The management center for non-technical users (task #985).
 *
 * Signed in with Google (useManageMe → /api/manage/me); the server says
 * which agents the address may open:
 *   every agent (Lybi team)  /manage/all/<page> + /manage/<any agent>/<page>
 *   some agents              /manage/<one of theirs>/<page>
 * The bare /manage lands on "all" or on the person's first agent. A page is
 * built for one scope at a time; the side panel switches scope and lists
 * the pages (the registry in pages.ts).
 *
 * Admin (/:agent/builder/admin) stays the technical tool; this is the simple
 * one, Hebrew and RTL.
 */

import { useEffect } from 'react';
import { Link, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { ManageShell } from './components/ManageShell/ManageShell';
import { SignInPage } from './components/SignInPage/SignInPage';
import { MANAGE_PAGES } from './pages';
import { useManageMe } from './useManageMe';
import { scopePath } from './links';
import { COPY } from './copy';
import type { ManageMe } from '../types/manage';
import styles from './components/ManageShell/ManageShell.module.css';
import './tokens.css';

/** Where a person lands: "all" for the Lybi team, else their first live agent. */
function defaultScope(me: ManageMe): string | null {
  if (me.all) return 'all';
  const live = me.agents.find(a => !a.archived) || me.agents[0];
  return live ? live.slug : null;
}

function SignedIn({ me, onSignOut }: { me: ManageMe; onSignOut: () => void }) {
  const params = useParams<{ agentSlug?: string; '*'?: string }>();
  const agentSlug = params.agentSlug || '';
  const rest = params['*'] || '';
  const fallback = defaultScope(me);
  const first = MANAGE_PAGES[0].path;

  if (!agentSlug || (agentSlug === 'all' && !me.all)) {
    return fallback ? <Navigate to={scopePath(fallback, first)} replace /> : (
      <ManageShell me={me} scope="agent" agentSlug={null} pages={MANAGE_PAGES} currentPage={first} onSignOut={onSignOut}>
        <div className={styles.notice}>{COPY.noAgents}</div>
      </ManageShell>
    );
  }

  const isAll = agentSlug === 'all';
  const scope = isAll ? 'all' : 'agent';
  const slug = isAll ? null : agentSlug;
  const currentPage = (MANAGE_PAGES.find(p => rest === p.path || rest.startsWith(`${p.path}/`)) || MANAGE_PAGES[0]).path;
  // Not one of theirs (the server would refuse it too — this says it plainly).
  const mine = me.all || me.agents.some(a => a.slug === agentSlug);

  return (
    <ManageShell me={me} scope={scope} agentSlug={slug} pages={MANAGE_PAGES} currentPage={currentPage} onSignOut={onSignOut}>
      {!mine ? (
        <div className={styles.notice}>
          {COPY.noAgentAccess}
          {fallback && <Link to={scopePath(fallback, first)} className={styles.noticeLink}>{COPY.backToMine}</Link>}
        </div>
      ) : (
        <Routes>
          <Route index element={<Navigate to={first} replace />} />
          {MANAGE_PAGES.map(p => (
            <Route key={p.path} path={p.path} element={<p.Component key={agentSlug} scope={scope} agentSlug={slug} me={me} />} />
          ))}
          <Route path="*" element={<Navigate to={first} replace />} />
        </Routes>
      )}
    </ManageShell>
  );
}

export function ManageApp() {
  const { auth, signIn, signOut, retry } = useManageMe();

  useEffect(() => { document.title = COPY.pageTitle; }, []);

  switch (auth.state) {
    case 'ready':
      return <SignedIn me={auth.me} onSignOut={signOut} />;
    case 'signed-out':
      return <SignInPage mode="sign-in" onCredential={signIn} />;
    case 'no-access':
      return <SignInPage mode="no-access" email={auth.email} onCredential={signIn} />;
    case 'error':
      return <SignInPage mode="error" onCredential={signIn} onRetry={retry} />;
    default:
      return <SignInPage mode="loading" onCredential={signIn} />;
  }
}
