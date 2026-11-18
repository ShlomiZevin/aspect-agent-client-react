/**
 * The management center's frame (task #985), design round4/opt1:
 *   top bar     Lybi | מרכז הניהול · the signed-in address + sign out
 *   side panel  the SCOPE on top (a dropdown — every-agent: "כל הסוכנים" +
 *               every agent; 2+ agents: theirs; one agent: just its name),
 *               then the MENU — the pages of the registry (pages.ts)
 *   main        the page
 * On a phone the side panel folds into a bar under the top bar with the
 * same scope control and menu. Colours: src/manage/tokens.css.
 */

import { useState, type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import type { ManagePageDef } from '../../pages';
import type { ManageMe } from '../../../types/manage';
import { IconSignOut } from '../../icons';
import { ScopeDropdown } from '../ScopeDropdown/ScopeDropdown';
import { MANAGE_BASE, scopePath } from '../../links';
import { COPY } from '../../copy';
import styles from './ManageShell.module.css';

interface Props {
  me: ManageMe;
  scope: 'agent' | 'all';
  agentSlug: string | null;
  pages: ManagePageDef[];
  /** The page now open — a scope switch keeps it. */
  currentPage: string;
  onSignOut: () => void;
  children: ReactNode;
}

/** The scope control: a dropdown, or just the agent's name when there is nothing to choose. */
function ScopeControl({ me, current, currentPage, compact }: { me: ManageMe; current: string; currentPage: string; compact?: boolean }) {
  const navigate = useNavigate();
  // Archived agents stay out of the list unless one is open.
  const agents = me.agents.filter(a => !a.archived || a.slug === current);
  const options = [
    ...(me.all ? [{ value: 'all', label: COPY.allAgents }] : []),
    ...agents.map(a => ({ value: a.slug, label: a.name })),
  ];
  return (
    <div className={compact ? styles.scopeCompact : styles.scope}>
      <ScopeDropdown options={options} value={current} compact={compact} onChange={v => navigate(scopePath(v, currentPage))} />
    </div>
  );
}

/** Who is signed in (Google picture, or the first letter) — RTL: picture, address, then יציאה at the line's end. */
function UserArea({ me, onSignOut }: { me: ManageMe; onSignOut: () => void }) {
  const [broken, setBroken] = useState(false);
  const initial = (me.name || me.email).trim().charAt(0).toUpperCase();
  return (
    <div className={styles.user}>
      <span className={styles.avatar} aria-hidden>
        {me.picture && !broken
          ? <img src={me.picture} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
          : initial}
      </span>
      <span className={styles.userEmail} dir="ltr" title={me.name}>{me.email}</span>
      <span className={styles.userSep} aria-hidden />
      <button type="button" className={styles.signOut} onClick={onSignOut} title={COPY.signOutTitle}>
        <span>{COPY.signOut}</span>
        <IconSignOut size={15} />
      </button>
    </div>
  );
}

export function ManageShell({ me, scope, agentSlug, pages, currentPage, onSignOut, children }: Props) {
  const current = scope === 'all' ? 'all' : agentSlug || '';
  const base = current ? scopePath(current, '') : '';

  return (
    <div className={styles.root} data-manage-root dir="rtl" lang="he">
      <header className={styles.topbar}>
        <Link to={current ? scopePath(current, currentPage) : MANAGE_BASE} className={styles.brand}>
          <img className={styles.logo} src="/img/lybi-logo-white.png" alt={COPY.brandAlt} />
        </Link>
        <span className={styles.topSep} aria-hidden />
        <span className={styles.centerName}>{COPY.centerName}</span>
        <UserArea me={me} onSignOut={onSignOut} />
      </header>

      {/* Phone: the side panel folds into this bar. */}
      <div className={styles.mobileBar}>
        {current && <ScopeControl me={me} current={current} currentPage={currentPage} compact />}
        <nav className={styles.mobileNav} aria-label={COPY.menuLabel}>
          {base && pages.map(p => (
            <NavLink key={p.path} to={`${base}${p.path}`} className={({ isActive }) => `${styles.mobileNavItem} ${isActive ? styles.mobileNavActive : ''}`}>
              <p.Icon size={14} />
              {p.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className={styles.body}>
        <aside className={styles.panel}>
          {current && <ScopeControl me={me} current={current} currentPage={currentPage} />}
          <nav className={styles.nav} aria-label={COPY.menuLabel}>
            {base && pages.map(p => (
              <NavLink
                key={p.path}
                to={`${base}${p.path}`}
                className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
              >
                <span className={styles.navIcon}><p.Icon size={16} /></span>
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
