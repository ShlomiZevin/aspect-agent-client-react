/**
 * AdminDashboard — the V1 agent admin/dashboard, ported into the V2
 * builder as a full-screen view at `/:agent/builder/admin`.
 *
 * UX: the admin is a sibling of the builder shell (not nested in its
 * three-panel layout), so it gets the full viewport — the builder's
 * left rail effectively *swaps* to the admin menu, and "← Back to
 * builder" swaps it back. The preview-chat panel is intentionally gone
 * here: admin pages (user tables, billing, usage) want the width.
 *
 * The V1 dashboard pages are already fully prop-driven — they take
 * `(agentName, baseURL)` with no static `AgentConfig`/`AgentProvider`
 * dependency. Porting is just wiring: feed them the builder agent's
 * slug (== the runtime `agents.urlSlug`, how V2 runtime data is keyed)
 * and the shared `getBaseURL()`. No static registry — works for any
 * agent built in the V2 builder. See docs/guides/ADMIN_V2.md.
 *
 *   URL routing (nested under the `admin/*` splat in BuilderApp)
 *     /<agent>/builder/admin                 → redirect to feedback
 *     /<agent>/builder/admin/feedback
 *     /<agent>/builder/admin/users           (+ /:userId drill-down)
 *     /<agent>/builder/admin/conversations
 *     /<agent>/builder/admin/usage
 *     /<agent>/builder/admin/billing
 *     /<agent>/builder/admin/settings
 */

import { NavLink, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useBuilder } from '../../state/BuilderContext';
import { getBaseURL } from '../../../services/api';
import { FeedbackPage } from '../../../components/dashboard/FeedbackPage';
import { UsersPage } from '../../../components/dashboard/UsersPage';
import { LLMUsagePage } from '../../../components/dashboard/LLMUsagePage';
import { BillingPage } from '../../../components/dashboard/BillingPage';
import { SettingsPage } from '../../../components/dashboard/SettingsPage';
import { TestRunnerPage } from '../../../components/dashboard/TestRunnerPage';
import { ConversationsTab } from './ConversationsTab';
import { KBWorkbench } from './KBWorkbench';
import styles from './AdminDashboard.module.css';

/**
 * Users → "view conversations" drill-down, V2-native. The V1
 * UserConversationsPage keys off `conversation.externalId` (a string),
 * which V2 builder conversations don't have (they're numeric `id`) — so
 * it crashed. This reuses the V2 ConversationsTab scoped to one owner.
 */
function UserConversationsDrilldown({ agentSlug, basePath }: { agentSlug: string; basePath: string }) {
  const { userId } = useParams<{ userId: string }>();
  const idNum = userId ? Number(userId) : undefined;
  return (
    <ConversationsTab
      agentSlug={agentSlug}
      userId={idNum}
      backHref={`${basePath}/users`}
    />
  );
}

interface NavItem {
  /** Relative path under the admin splat (e.g. 'feedback'). */
  to: string;
  icon: string;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { to: 'feedback',      icon: '💬', label: 'Feedback' },
  { to: 'users',         icon: '👥', label: 'Users' },
  { to: 'conversations', icon: '🗨️', label: 'Conversations' },
  { to: 'knowledge-base', icon: '📚', label: 'Knowledge Base' },
  { to: 'usage',         icon: '📊', label: 'LLM Usage' },
  { to: 'billing',       icon: '💳', label: 'Billing' },
  { to: 'test-runner',   icon: '🧪', label: 'Test Runner' },
  { to: 'settings',      icon: '⚙',  label: 'Settings' },
];

export function AdminDashboard() {
  const { doc, selection } = useBuilder();
  // Mirror the Sidebar's agent resolution — selection-aware, with a
  // fallback to the first agent for the very first render.
  const agent = doc.agents.find(a => a.id === selection.agentId) ?? doc.agents[0];

  if (!agent) {
    return <div className={styles.bootEmpty}>No agent loaded.</div>;
  }

  // The builder slug IS the runtime agent key (agents.urlSlug). V2
  // runtime data (conversations, feedback, usage) is keyed off it.
  const slug = agent.slug;
  const baseURL = getBaseURL();
  const basePath = `/${slug}/builder/admin`;

  return (
    <div className={styles.root}>
      {/* ── Left rail: the swapped-in admin menu ─────────────── */}
      <aside className={styles.rail}>
        <div className={styles.railHeader}>
          <div className={styles.railTitle}>📊 Admin</div>
          <div className={styles.railAgent}>{agent.name}</div>
        </div>

        <nav className={styles.nav}>
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
              }
            >
              <span className={styles.navIcon} aria-hidden>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className={styles.railFooter}>
          <NavLink to={`/${slug}/builder`} className={styles.backLink}>
            ← Back to builder
          </NavLink>
        </div>
      </aside>

      {/* ── Main: the routed admin page (full width) ─────────── */}
      <main className={styles.main}>
        <Routes>
          <Route index element={<Navigate to="feedback" replace />} />
          <Route
            path="feedback"
            element={<FeedbackPage agentName={slug} baseURL={baseURL} />}
          />
          <Route
            path="users"
            element={<UsersPage baseURL={baseURL} agentName={slug} basePath={basePath} />}
          />
          <Route
            path="users/:userId"
            element={<UserConversationsDrilldown agentSlug={slug} basePath={basePath} />}
          />
          <Route
            path="conversations"
            element={<ConversationsTab agentSlug={slug} />}
          />
          <Route
            path="knowledge-base"
            element={<KBWorkbench agentSlug={slug} />}
          />
          <Route
            path="usage"
            element={<LLMUsagePage baseURL={baseURL} agentName={slug} agentSlug={slug} />}
          />
          <Route
            path="billing"
            element={<BillingPage baseURL={baseURL} />}
          />
          <Route
            path="test-runner"
            element={<TestRunnerPage baseURL={baseURL} agentName={slug} />}
          />
          <Route
            path="settings"
            element={<SettingsPage baseURL={baseURL} agentName={slug} />}
          />
          {/* Unknown sub-path → back to feedback. */}
          <Route path="*" element={<Navigate to="feedback" replace />} />
        </Routes>
      </main>
    </div>
  );
}
