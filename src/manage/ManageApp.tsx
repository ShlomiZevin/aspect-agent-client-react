/**
 * The management center for non-technical users (task #985).
 *
 * Two worlds, chosen at the TOP of the hierarchy (the right panel's
 * "מה להציג"), above the menu and the page:
 *   /manage/all/<page>            every agent, agent filter inside the page —
 *                                 Lybi team only: the same super-admin unlock as /users
 *   /manage/<agentSlug>/<page>    one agent (open, like the per-agent Admin)
 * The bare address opens the first page of the registry (pages.ts).
 *
 * Admin (/:agent/builder/admin) stays the technical tool; this is the simple
 * one, Hebrew and RTL. Design: round3/D-agent-sunburst.jpg + D-all-sunburst.jpg
 * in C:\Users\shazbak\Downloads\customer-errors-designs\.
 */

import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { isSuperAdminUnlocked, lockSuperAdmin } from '../services/superAdminService';
import { ManageShell } from './components/ManageShell/ManageShell';
import { AllGate } from './components/AllGate/AllGate';
import { MANAGE_PAGES } from './pages';
import { useWorlds } from './useWorlds';
import { COPY } from './copy';

export function ManageApp() {
  const params = useParams<{ agentSlug: string; '*': string }>();
  const agentSlug = params.agentSlug || '';
  const rest = params['*'] || '';
  const isAll = agentSlug === 'all';
  const [unlocked, setUnlocked] = useState(isSuperAdminUnlocked());
  const worlds = useWorlds(isAll ? null : agentSlug, unlocked);

  useEffect(() => { document.title = COPY.pageTitle; }, []);

  const scope = isAll ? 'all' : 'agent';
  const slug = isAll ? null : agentSlug;
  const first = MANAGE_PAGES[0].path;
  const currentPage = (MANAGE_PAGES.find(p => rest === p.path || rest.startsWith(`${p.path}/`)) || MANAGE_PAGES[0]).path;

  return (
    <ManageShell
      scope={scope}
      agentSlug={slug}
      worlds={worlds}
      unlocked={unlocked}
      pages={MANAGE_PAGES}
      currentPage={currentPage}
      onLock={() => { lockSuperAdmin(); setUnlocked(false); }}
    >
      {isAll && !unlocked ? (
        <AllGate onUnlocked={() => setUnlocked(true)} />
      ) : (
        <Routes>
          <Route index element={<Navigate to={first} replace />} />
          {MANAGE_PAGES.map(p => (
            <Route
              key={p.path}
              path={p.path}
              element={<p.Component key={agentSlug} scope={scope} agentSlug={slug} />}
            />
          ))}
          <Route path="*" element={<Navigate to={first} replace />} />
        </Routes>
      )}
    </ManageShell>
  );
}
