/**
 * The management center's frame (task #985) — design D (round3):
 *   top bar      Lybi | מרכז הניהול  (+ the team-view state when unlocked)
 *   right panel  "מה להציג" — the WORLD: all agents, or one agent (top of the
 *                hierarchy) · "בתצוגה הזו" — that world's pages (the registry)
 *   main         the page
 * On a phone the panel folds into a bar under the top bar: a world switcher
 * and the page menu. Colour tokens for every manage page live on `.root`.
 */

import type { ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import type { ManagePageDef } from '../../pages';
import type { ManageAgentSummary } from '../../../types/manage';
import { IconBuilding, IconChevronDown, IconGrid, IconUnlock } from '../../icons';
import { COPY } from '../../copy';
import styles from './ManageShell.module.css';

interface Props {
  scope: 'agent' | 'all';
  agentSlug: string | null;
  /** Agents the chooser offers (null while loading). Locked: just the current one. */
  worlds: ManageAgentSummary[] | null;
  unlocked: boolean;
  pages: ManagePageDef[];
  /** The page now open — a world switch keeps it. */
  currentPage: string;
  onLock: () => void;
  children: ReactNode;
}

const worldPath = (world: string, page: string) => `/manage/${encodeURIComponent(world)}/${page}`;

function Status({ need, light }: { need: number; light: boolean }) {
  return need > 0
    ? <span className={`${styles.status} ${styles.statusAct} ${light ? styles.statusOnDark : ''}`}>{COPY.statusAct(need)}</span>
    : <span className={`${styles.status} ${styles.statusOk} ${light ? styles.statusOnDark : ''}`}>{COPY.statusOk}</span>;
}

export function ManageShell({ scope, agentSlug, worlds, unlocked, pages, currentPage, onLock, children }: Props) {
  const navigate = useNavigate();
  const base = worldPath(scope === 'all' ? 'all' : agentSlug || '', '');
  // Locked: only the agent in the address. Unlocked: every agent.
  const agents: ManageAgentSummary[] = worlds && worlds.length
    ? worlds
    : agentSlug ? [{ slug: agentSlug, name: agentSlug, archived: false, conversations: 0, problems: 0, needsAction: 0 }] : [];
  const statusKnown = worlds !== null;
  const allNeed = agents.reduce((n, a) => n + a.needsAction, 0);
  const current = scope === 'all' ? 'all' : agentSlug || '';

  return (
    <div className={styles.root} dir="rtl" lang="he">
      <header className={styles.topbar}>
        <Link to={worldPath(current, currentPage)} className={styles.brand}>
          <img className={styles.logo} src="/img/lybi-logo-white.png" alt={COPY.brandAlt} />
        </Link>
        <span className={styles.topSep} aria-hidden />
        <span className={styles.centerName}>{COPY.centerName}</span>
        {unlocked && (
          <div className={styles.team}>
            <span className={styles.teamPill}><IconUnlock size={17} />{COPY.teamView}</span>
            <button type="button" className={styles.teamExit} onClick={onLock}>{COPY.teamViewExit}</button>
          </div>
        )}
      </header>

      {/* Phone: the world stays visible at the top, with a switcher and the page menu. */}
      <div className={styles.mobileBar}>
        <label className={styles.mobileWorld}>
          <span className={styles.srOnly}>{COPY.switchWorld}</span>
          <select value={current} onChange={e => navigate(worldPath(e.target.value, currentPage))}>
            <option value="all">{COPY.allAgents}</option>
            {agents.map(a => <option key={a.slug} value={a.slug}>{a.name}</option>)}
          </select>
          <IconChevronDown size={18} className={styles.mobileChevron} />
        </label>
        <nav className={styles.mobileNav}>
          {pages.map(p => (
            <NavLink key={p.path} to={`${base}${p.path}`} className={({ isActive }) => `${styles.mobileNavItem} ${isActive ? styles.mobileNavActive : ''}`}>
              {p.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className={styles.body}>
        <aside className={styles.panel}>
          <div className={styles.sectionTitle}>{COPY.worldsTitle}</div>
          <div className={styles.worlds}>
            <Link to={worldPath('all', currentPage)} className={`${styles.world} ${scope === 'all' ? styles.worldOn : ''}`}>
              <span className={styles.worldIcon}><IconGrid size={28} /></span>
              <span className={styles.worldText}>
                <span className={styles.worldName}>{COPY.allAgents}</span>
                <span className={styles.worldSub}>{COPY.allAgentsSub}</span>
              </span>
              {unlocked && statusKnown && <Status need={allNeed} light={scope === 'all'} />}
            </Link>
            {(unlocked || scope === 'agent') && agents.map(a => (
              <Link key={a.slug} to={worldPath(a.slug, currentPage)} className={`${styles.world} ${a.slug === agentSlug ? styles.worldOn : ''}`}>
                <span className={styles.worldIcon}><IconBuilding size={28} /></span>
                <span className={styles.worldText}>
                  <span className={styles.worldName} dir="auto">{a.name}</span>
                  <span className={styles.worldSub} dir="ltr">{a.slug}</span>
                </span>
                {statusKnown && <Status need={a.needsAction} light={a.slug === agentSlug} />}
              </Link>
            ))}
          </div>

          <div className={styles.divider} />

          <div className={styles.sectionTitle}>{COPY.thisViewTitle}</div>
          <nav className={styles.nav}>
            {pages.map(p => (
              <NavLink
                key={p.path}
                to={`${base}${p.path}`}
                className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
              >
                <span className={styles.navIcon}><p.Icon size={24} /></span>
                <span className={styles.navLabel}>{p.label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}
