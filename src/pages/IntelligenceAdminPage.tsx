/**
 * Hidden admin panel for Aspect Intelligence (`/intelligence/admin/*`) — lets
 * Kosta/Shlomi enable it per dataset, edit its per-dataset config, and
 * monitor generated insights, without touching code or waiting for a
 * deploy. Cross-dataset (all 6 registered datasets at once), so it's a
 * standalone top-level route rather than nested under one agent's
 * `/:agent/dashboard/*`. Gated by the same shared internal key as the
 * existing hidden `/users` (SuperAdminUsersPage) page — presented as a
 * normal username+password sign-in rather than a bare code.
 *
 * Structure (split by meaning, not one flat page):
 *  - Overview (index route) — every dataset, enable/disable only.
 *  - Per-dataset group (sidebar expands to a submenu once you're inside one)
 *    — focused sub-pages instead of one long form:
 *    `/intelligence/admin/:datasetId/config`   — brand label + data model description
 *    `/intelligence/admin/:datasetId/prompts`  — example prompt chips
 *    `/intelligence/admin/:datasetId/insights` — generated-insight monitor + delete
 *    (there's deliberately no "run bootstrap/investigate" admin page — that
 *    duplicated what's already available directly in the product itself)
 */
import { useEffect, useState, type FormEvent } from 'react';
import { Routes, Route, Navigate, NavLink, Outlet, useParams, useNavigate, useLocation, useOutletContext } from 'react-router-dom';
import { ThemeProvider } from '../context/ThemeContext';
import { isSuperAdminUnlocked, unlockSuperAdmin, lockSuperAdmin } from '../services/superAdminService';
import { intelligenceAdminService, type IntelligenceAdminDataset, type IntelligenceConfigVersion } from '../services/intelligenceAdminService';
import type { InsightDetail } from '../types/insights';
import { useDocumentMeta } from '../hooks';
import styles from './IntelligenceAdminPage.module.css';

function LoginGate({ onUnlocked }: { onUnlocked: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Same shared internal key as every other admin surface in this app
  // (superAdminService — used by /users too), just presented as a normal
  // username + password sign-in instead of a bare PIN code. The username
  // isn't separately checked against anything (there's no multi-admin
  // account system) — it only needs to be filled in, matching the visual
  // shape of a real login without pretending there's per-person auth here.
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Enter a username');
      return;
    }
    if (unlockSuperAdmin(password.trim())) {
      onUnlocked();
    } else {
      setError('Wrong password');
      setPassword('');
    }
  };

  return (
    <div className={styles.gate}>
      <form className={styles.gateCard} onSubmit={handleSubmit}>
        <div className={styles.gateMark}>✦</div>
        <h1 className={styles.gateTitle}>Aspect Intelligence</h1>
        <p className={styles.gateSubtitle}>Sign in to manage datasets</p>
        <div className={styles.gateField}>
          <label htmlFor="ia-username">Username</label>
          <input
            id="ia-username"
            type="text"
            value={username}
            onChange={e => { setUsername(e.target.value); setError(null); }}
            autoFocus
            autoComplete="username"
            placeholder="admin"
          />
        </div>
        <div className={styles.gateField}>
          <label htmlFor="ia-password">Password</label>
          <input
            id="ia-password"
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(null); }}
            autoComplete="current-password"
            placeholder="••••••"
          />
        </div>
        {error && <div className={styles.gateError}>{error}</div>}
        <button type="submit" className={styles.gateSubmit}>Sign in</button>
      </form>
    </div>
  );
}

/** Best-effort creation time from the `investigate-<ms>` id shape — there's no separate createdAt field on generated insights. */
function insightCreatedLabel(id: string): string {
  const ms = Number(id.split('-')[1]);
  if (!ms) return '—';
  return new Date(ms).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

interface DatasetsState {
  datasets: IntelligenceAdminDataset[] | null;
  reload: () => void;
}

function useDatasetsState(): DatasetsState {
  const [datasets, setDatasets] = useState<IntelligenceAdminDataset[] | null>(null);
  const reload = () => {
    intelligenceAdminService.listDatasets().then(setDatasets).catch(() => setDatasets([]));
  };
  useEffect(reload, []);
  return { datasets, reload };
}

/** Small colored dot: green = enabled, grey = disabled — same signal shown in the sidebar and the overview table. */
function EnabledDot({ enabled }: { enabled: boolean }) {
  return <span className={`${styles.dot} ${enabled ? styles.dotOn : ''}`} />;
}

const SUB_PAGES = [
  { path: 'config', label: 'Config', icon: <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /> },
  { path: 'prompts', label: 'Prompts', icon: <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /> },
  { path: 'insights', label: 'Insights', icon: <path d="M18 20V10 M12 20V4 M6 20v-6" /> },
];

function Sidebar({ datasets, onSignOut }: { datasets: IntelligenceAdminDataset[] | null; onSignOut: () => void }) {
  const location = useLocation();

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarHeader}>
        <div className={styles.mark}>✦</div>
        <div>
          <div className={styles.brandName}>Aspect Intelligence</div>
          <div className={styles.dashboardLabel}>Admin</div>
        </div>
      </div>
      <nav className={styles.nav}>
        <NavLink to="/intelligence/admin" end className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" />
          </svg>
          <span>Overview</span>
        </NavLink>
        <div className={styles.navDivider} />
        <div className={styles.navGroupLabel}>Datasets</div>
        {datasets?.map(d => {
          const prefix = `/intelligence/admin/${d.id}`;
          const groupActive = location.pathname === prefix || location.pathname.startsWith(`${prefix}/`);
          return (
            <div key={d.id}>
              <NavLink to={prefix} className={`${styles.navItem} ${groupActive ? styles.navItemActive : ''}`}>
                <EnabledDot enabled={d.config.enabled} />
                <span>{d.name}</span>
              </NavLink>
              {/* Nothing to configure while disabled — no submenu until it's turned on. */}
              {d.config.enabled && groupActive && (
                <div className={styles.subNav}>
                  {SUB_PAGES.map(sp => (
                    <NavLink
                      key={sp.path}
                      to={`${prefix}/${sp.path}`}
                      className={({ isActive }) => `${styles.subNavItem} ${isActive ? styles.subNavItemActive : ''}`}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        {sp.icon}
                      </svg>
                      <span>{sp.label}</span>
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
      <div className={styles.sidebarFooter}>
        <button className={styles.signOutBtn} onClick={onSignOut}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}

function OverviewPage({ datasets, reload }: DatasetsState) {
  const navigate = useNavigate();
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useDocumentMeta({ title: 'Aspect Intelligence — admin' });

  const toggleEnabled = async (e: React.MouseEvent, dataset: IntelligenceAdminDataset) => {
    e.stopPropagation();
    setTogglingId(dataset.id);
    try {
      await intelligenceAdminService.updateConfig(dataset.id, { enabled: !dataset.config.enabled });
      reload();
    } finally {
      setTogglingId(null);
    }
  };

  const enabledCount = datasets?.filter(d => d.config.enabled).length ?? 0;
  const totalInsights = datasets?.reduce((sum, d) => sum + d.insightCount, 0) ?? 0;
  const totalTracked = datasets?.reduce((sum, d) => sum + d.trackedCount, 0) ?? 0;

  return (
    <div className={styles.contentInner}>
      <h1 className={styles.title}>Overview</h1>
      <p className={styles.subtitle}>Turn Aspect Intelligence on or off per dataset. Open a dataset in the sidebar to edit its config, run bootstrap, or manage its insights.</p>

      {datasets !== null && (
        <div className={styles.statGrid}>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{enabledCount} / {datasets.length}</div>
            <div className={styles.statLabel}>Datasets enabled</div>
          </div>
          <div className={styles.statCard}>
            <div className={`${styles.statValue} ${styles.statValueAccent}`}>{totalInsights}</div>
            <div className={styles.statLabel}>Insights generated</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{totalTracked}</div>
            <div className={styles.statLabel}>Tracked by users</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{datasets.length}</div>
            <div className={styles.statLabel}>Total datasets</div>
          </div>
        </div>
      )}

      {datasets === null ? (
        <div className={styles.statusLine}>Loading…</div>
      ) : (
        <div className={styles.card}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Dataset</th>
                <th>Enabled</th>
                <th>Insights</th>
                <th>Tracked</th>
              </tr>
            </thead>
            <tbody>
              {datasets.map(d => (
                <tr key={d.id} className={styles.row} onClick={() => navigate(`/intelligence/admin/${d.id}/config`)}>
                  <td>
                    <div className={styles.datasetCell}>
                      <div className={styles.avatar} style={{ background: `linear-gradient(135deg, ${d.gradientFrom}, ${d.gradientTo})` }}>
                        {d.logoText}
                      </div>
                      <div className={styles.datasetText}>
                        <div className={styles.datasetName}>{d.name}</div>
                        <div className={styles.datasetDescription}>{d.description}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className={styles.enabledCell}>
                      <button
                        className={`${styles.toggle} ${d.config.enabled ? styles.toggleOn : ''}`}
                        onClick={e => toggleEnabled(e, d)}
                        disabled={togglingId === d.id}
                        aria-label={d.config.enabled ? 'Disable' : 'Enable'}
                        title={d.config.enabled ? 'Enabled — click to disable' : 'Disabled — click to enable'}
                      >
                        <span className={`${styles.toggleKnob} ${d.config.enabled ? styles.toggleOnKnob : ''}`} />
                      </button>
                      <span className={`${styles.enabledLabel} ${d.config.enabled ? styles.enabledLabelOn : ''}`}>
                        {d.config.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                  </td>
                  <td><span className={styles.metricValue}>{d.insightCount}</span></td>
                  <td><span className={styles.metricValue}>{d.trackedCount}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface DatasetOutletContext {
  dataset: IntelligenceAdminDataset;
  reload: () => void;
}

function formatVersionDate(savedAt: number): string {
  return new Date(savedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/**
 * How to preview one version's content in the list, per section — each
 * section's entries only carry its own fields (see IntelligenceConfigVersion).
 * Two lines, not one: brandLabel alone repeats identically across most
 * config saves (it rarely changes), so the actual differentiator — the
 * data model description, or the prompt lists — needs its own visible line,
 * not to be dropped in favor of the field that looks the same every time.
 */
function versionPreviewLines(section: 'config' | 'prompts', v: IntelligenceConfigVersion): string[] {
  if (section === 'config') {
    const desc = v.dataModelDescription || '';
    return [
      v.brandLabel || '(no brand label)',
      desc.length > 140 ? `${desc.slice(0, 140)}…` : desc || '(no description)',
    ];
  }
  const bootstrap = v.bootstrapPrompts || [];
  const examples = v.examplePrompts || [];
  return [
    `Bootstrap (${bootstrap.length}): ${bootstrap[0] || '—'}${bootstrap.length > 1 ? ', …' : ''}`,
    `Examples (${examples.length}): ${examples[0] || '—'}${examples.length > 1 ? ', …' : ''}`,
  ];
}

/**
 * Version history — an inline panel (not a popup/modal), dropped right into
 * the page flow under the section header when "Versions" is toggled on.
 * Scoped to ONE section ('config' or 'prompts') — Config and Prompts each
 * have their own independent history, so restoring one never touches the
 * other.
 */
function VersionsPanel({
  dataset, section, onClose, onRestored,
}: { dataset: IntelligenceAdminDataset; section: 'config' | 'prompts'; onClose: () => void; onRestored: () => void }) {
  const [versions, setVersions] = useState<IntelligenceConfigVersion[] | null>(null);
  const [busyAt, setBusyAt] = useState<number | null>(null);

  const load = () => {
    intelligenceAdminService.listVersions(dataset.id, section).then(setVersions).catch(() => setVersions([]));
  };

  useEffect(load, [dataset.id, section]);

  const restore = async (savedAt: number) => {
    setBusyAt(savedAt);
    try {
      await intelligenceAdminService.restoreVersion(dataset.id, section, savedAt);
      onRestored();
      onClose();
    } finally {
      setBusyAt(null);
    }
  };

  const remove = async (savedAt: number) => {
    setBusyAt(savedAt);
    try {
      await intelligenceAdminService.deleteVersion(dataset.id, section, savedAt);
      setVersions(vs => vs?.filter(v => v.savedAt !== savedAt) ?? null);
    } finally {
      setBusyAt(null);
    }
  };

  return (
    <div className={styles.inlinePanel}>
      <div className={styles.inlinePanelHeader}>
        <h3>Version history</h3>
        <button className={styles.iconBtn} onClick={onClose} aria-label="Close">✕</button>
      </div>
      <p className={styles.inlinePanelHint}>
        Every Save on this section keeps the version right before it here automatically. Restoring one saves the
        version you're on right now too, so it's never a one-way trip. Delete just removes clutter from this list —
        it doesn't change your current, live config.
      </p>
      {versions === null && <div className={styles.statusLine}>Loading…</div>}
      {versions !== null && versions.length === 0 && (
        <div className={styles.statusLine}>No saved versions yet — they appear here the first time you change and Save this section.</div>
      )}
      {versions?.map(v => (
        <div key={v.savedAt} className={styles.versionRow}>
          <div className={styles.versionMeta}>
            <div className={styles.versionDate}>{formatVersionDate(v.savedAt)}</div>
            {versionPreviewLines(section, v).map((line, i) => (
              <div key={i} className={styles.versionPreview}>{line}</div>
            ))}
          </div>
          <div className={styles.versionActions}>
            <button className={styles.btn} onClick={() => restore(v.savedAt)} disabled={busyAt !== null}>
              {busyAt === v.savedAt ? '…' : 'Restore'}
            </button>
            <button className={styles.deleteBtn} onClick={() => remove(v.savedAt)} disabled={busyAt !== null} title="Remove this entry from the list">
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Small toolbar attached to ONE section's own card (Config or Prompts), not
 * shared globally — Kosta explicitly flagged that a single dataset-wide
 * toolbar was confusing ("I meant just for this block"). "Versions" opens
 * that section's own history; "Reset" discards unsaved edits on THIS
 * section only, restoring its fields from the last-saved server value.
 */
function SectionToolbar({ onVersions, onReset }: { onVersions?: () => void; onReset: () => void }) {
  return (
    <div className={styles.sectionToolbar}>
      {onVersions && (
        <button className={styles.btn} onClick={onVersions} title="Browse and restore earlier saved versions of this section">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v5h5M3.05 13a9 9 0 1 0 2.13-7.9L3 8" />
            <path d="M12 7v5l3 3" />
          </svg>
          Versions
        </button>
      )}
      <button className={styles.btn} onClick={onReset} title="Discard changes you haven't saved yet on this section">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />
        </svg>
        Reset
      </button>
    </div>
  );
}

/** Shared header (name + enable toggle) for every sub-page of one dataset — the sub-pages themselves only render their own focused content via <Outlet>. */
function DatasetLayout({ datasets, reload }: DatasetsState) {
  const { datasetId } = useParams<{ datasetId: string }>();
  const dataset = datasets?.find(d => d.id === datasetId) || null;
  const [toggling, setToggling] = useState(false);

  useDocumentMeta({ title: dataset ? `${dataset.name} — Aspect Intelligence admin` : 'Aspect Intelligence — admin' });

  if (datasets === null) return <div className={styles.contentInner}><div className={styles.statusLine}>Loading…</div></div>;
  if (!dataset) return <div className={styles.contentInner}><div className={styles.statusLine}>Unknown dataset.</div></div>;

  const toggleEnabled = async () => {
    setToggling(true);
    try {
      await intelligenceAdminService.updateConfig(dataset.id, { enabled: !dataset.config.enabled });
      reload();
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className={styles.contentInner}>
      <div className={styles.detailHeader}>
        <div>
          <h1 className={styles.title}>{dataset.name}</h1>
          <p className={styles.subtitle}>{dataset.description}</p>
        </div>
        <div className={styles.enabledCell}>
          <button
            className={`${styles.toggle} ${dataset.config.enabled ? styles.toggleOn : ''}`}
            onClick={toggleEnabled}
            disabled={toggling}
            aria-label={dataset.config.enabled ? 'Disable' : 'Enable'}
            title={dataset.config.enabled ? 'Enabled — click to disable' : 'Disabled — click to enable'}
          >
            <span className={`${styles.toggleKnob} ${dataset.config.enabled ? styles.toggleOnKnob : ''}`} />
          </button>
          <span className={`${styles.enabledLabel} ${dataset.config.enabled ? styles.enabledLabelOn : ''}`}>
            {dataset.config.enabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
      </div>
      {dataset.config.enabled ? (
        <Outlet context={{ dataset, reload } satisfies DatasetOutletContext} />
      ) : (
        <div className={styles.disabledNotice}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M8 8l8 8" />
          </svg>
          <div>
            <div className={styles.disabledNoticeTitle}>This dataset is disabled</div>
            <div className={styles.disabledNoticeText}>Turn it on above to edit its config, prompts, or review generated insights.</div>
          </div>
        </div>
      )}
    </div>
  );
}

function DatasetConfigPage() {
  const { dataset, reload } = useOutletContext<DatasetOutletContext>();
  const [brandLabel, setBrandLabel] = useState(dataset.config.brandLabel);
  const [dataModelDescription, setDataModelDescription] = useState(dataset.config.dataModelDescription);
  const [saving, setSaving] = useState(false);
  const [showVersions, setShowVersions] = useState(false);

  // Generate-from-data shows a side-by-side compare (current vs. the new
  // draft) instead of silently overwriting the field — `comparing` is true
  // from the moment Generate is clicked until Apply/Discard closes it.
  const [comparing, setComparing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generatedDraft, setGeneratedDraft] = useState<string | null>(null);

  const resetLocal = () => {
    setBrandLabel(dataset.config.brandLabel);
    setDataModelDescription(dataset.config.dataModelDescription);
    setComparing(false);
    setGeneratedDraft(null);
    setGenerateError(null);
  };

  useEffect(resetLocal, [dataset.id, dataset.config.brandLabel, dataset.config.dataModelDescription]);

  const save = async () => {
    setSaving(true);
    try {
      await intelligenceAdminService.updateConfig(dataset.id, { brandLabel, dataModelDescription });
      reload();
    } finally {
      setSaving(false);
    }
  };

  // Lets a non-technical client fill this in without knowing anything about
  // the database — reads the dataset's actual live schema and writes the
  // paragraph for them. Shows it next to what's there now rather than
  // overwriting silently; only Apply copies it into the real field (which
  // still needs its own Save afterward).
  const generate = async () => {
    setComparing(true);
    setGenerating(true);
    setGenerateError(null);
    setGeneratedDraft(null);
    try {
      const draft = await intelligenceAdminService.generateDescription(dataset.id);
      setGeneratedDraft(draft);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Could not generate a description');
    } finally {
      setGenerating(false);
    }
  };

  const applyDraft = () => {
    if (generatedDraft) setDataModelDescription(generatedDraft);
    setComparing(false);
    setGeneratedDraft(null);
  };

  const discardDraft = () => {
    setComparing(false);
    setGeneratedDraft(null);
    setGenerateError(null);
  };

  return (
    <>
      <div className={styles.sectionHeaderRow}>
        <div>
          <h2 className={styles.sectionTitle}>Configuration</h2>
          <p className={styles.subtitle}>
            These two fields tell Aspect what your business is and what its data can answer — this is what the AI
            reads before every investigation, so getting it right matters more than anything else on this page.
            You don't need to know anything about databases: click <strong>"✨ Generate from your data"</strong> below
            and Aspect will read your actual data and write the second field for you. Review the wording (fix names,
            tone, anything that reads wrong), then click <strong>Save config</strong> — nothing changes until you save.
          </p>
        </div>
        <SectionToolbar onVersions={() => setShowVersions(v => !v)} onReset={resetLocal} />
      </div>
      {showVersions && (
        <VersionsPanel dataset={dataset} section="config" onClose={() => setShowVersions(false)} onRestored={reload} />
      )}
      <div className={styles.card}>
        <div className={styles.editGrid}>
          <div className={styles.field}>
            <label>What's your business? (used when Aspect writes about your data)</label>
            <input
              value={brandLabel}
              onChange={e => setBrandLabel(e.target.value)}
              placeholder='e.g. "Acme Corp, an online electronics retailer"'
            />
            <div className={styles.fieldHint}>One short line — the name of the business plus what kind of business it is. Shown to no one but the AI.</div>
          </div>
          <div className={styles.field}>
            <div className={styles.fieldHeaderRow}>
              <label>What can your data answer?</label>
              {!comparing && (
                <button className={styles.generateBtn} onClick={generate} title="Reads your real database and writes this field for you — no technical knowledge needed">
                  ✨ Generate from your data
                </button>
              )}
            </div>

            {!comparing ? (
              <>
                <textarea rows={6} value={dataModelDescription} onChange={e => setDataModelDescription(e.target.value)} />
                <div className={styles.fieldHint}>A few sentences on what the data covers and what it measures (revenue, stores, products, dates, etc.) — plain language, no table or column names.</div>
              </>
            ) : (
              <div className={styles.compareGrid}>
                <div className={styles.comparePane}>
                  <div className={styles.comparePaneLabel}>Current</div>
                  <div className={styles.compareTextBox}>{dataModelDescription || <em>(empty)</em>}</div>
                </div>
                <div className={styles.comparePane}>
                  <div className={styles.comparePaneLabel}>Generated from your data</div>
                  {generating ? (
                    <div className={styles.compareLoading}>
                      <span className={styles.spinner} />
                      Reading your data… this can take a minute
                    </div>
                  ) : generateError ? (
                    <div className={styles.statusLineError}>{generateError}</div>
                  ) : (
                    <textarea
                      className={styles.compareTextArea}
                      rows={6}
                      value={generatedDraft || ''}
                      onChange={e => setGeneratedDraft(e.target.value)}
                    />
                  )}
                  <div className={styles.actionsRow}>
                    <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={applyDraft} disabled={generating || !generatedDraft}>
                      Apply
                    </button>
                    <button className={styles.btn} onClick={discardDraft} disabled={generating}>
                      Discard
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className={styles.actionsRow}>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={save} disabled={saving} title="Makes this the live version the AI uses">
              {saving ? 'Saving…' : 'Save config'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Example prompts as chips, not a raw textarea — each one is a real,
 * addressable item (delete, drag to reorder), matching how they actually
 * appear to end users (clickable hero chips), not lines of free text.
 * Reorder uses the same native HTML5 drag-and-drop already established for
 * this app's other reorderable list (see Insights/ManageTrackingModal.tsx) —
 * no extra library.
 */
function PromptChipList({
  datasetId, prompts, onChange,
}: { datasetId: string; prompts: string[]; onChange: (next: string[]) => void }) {
  const [newPrompt, setNewPrompt] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const addPrompt = () => {
    const text = newPrompt.trim();
    if (!text) return;
    onChange([...prompts, text]);
    setNewPrompt('');
  };

  const removePrompt = (index: number) => {
    onChange(prompts.filter((_, i) => i !== index));
  };

  const onDrop = (targetIndex: number) => {
    if (dragIndex === null || dragIndex === targetIndex) return;
    const next = [...prompts];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(targetIndex, 0, moved);
    onChange(next);
    setDragIndex(null);
  };

  // Drops the suggestion into the input for review, same as Config's
  // Generate-from-data — never adds it straight to the list unreviewed.
  const generate = async () => {
    setGenerating(true);
    setGenerateError(null);
    try {
      const prompt = await intelligenceAdminService.generateExamplePrompt(datasetId, prompts);
      setNewPrompt(prompt);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Could not generate a prompt');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <div className={styles.chipList}>
        {prompts.length === 0 && <div className={styles.statusLine}>No example prompts yet — add one below.</div>}
        {prompts.map((p, i) => (
          <div
            key={i}
            className={`${styles.chip} ${dragIndex === i ? styles.chipDragging : ''}`}
            draggable
            onDragStart={() => setDragIndex(i)}
            onDragOver={e => e.preventDefault()}
            onDrop={() => onDrop(i)}
            onDragEnd={() => setDragIndex(null)}
          >
            <span className={styles.chipHandle} aria-hidden="true">⠿</span>
            <span className={styles.chipText}>{p}</span>
            <button className={styles.chipRemove} onClick={() => removePrompt(i)} aria-label="Remove">✕</button>
          </div>
        ))}
      </div>
      <div className={styles.addRow}>
        <input
          placeholder="Add a new example prompt…"
          value={newPrompt}
          onChange={e => setNewPrompt(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addPrompt(); } }}
        />
        <button className={styles.btn} onClick={addPrompt} disabled={!newPrompt.trim()}>+ Add</button>
        <button className={styles.generateBtn} onClick={generate} disabled={generating} title="Aspect proposes a new one, different from what's already listed">
          {generating ? 'Thinking…' : '✨ Generate'}
        </button>
      </div>
      {generateError && <div className={styles.statusLineError}>{generateError}</div>}
    </>
  );
}

function DatasetPromptsPage() {
  const { dataset, reload } = useOutletContext<DatasetOutletContext>();
  const [examplePrompts, setExamplePrompts] = useState(dataset.config.examplePrompts);
  const [saving, setSaving] = useState(false);

  const resetLocal = () => {
    setExamplePrompts(dataset.config.examplePrompts);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(resetLocal, [dataset.id]);

  const save = async () => {
    setSaving(true);
    try {
      await intelligenceAdminService.updateConfig(dataset.id, { examplePrompts });
      reload();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <h2 className={styles.sectionTitle}>Prompts</h2>
      <p className={styles.subtitle}>
        The example prompts shown to end users as clickable suggestions on the "Ask a question" screen.
      </p>
      <div className={styles.card}>
        <div className={styles.editGrid}>
          <div className={styles.field}>
            <label>Example prompts / hero chips</label>
            <PromptChipList datasetId={dataset.id} prompts={examplePrompts} onChange={setExamplePrompts} />
            <div className={styles.fieldHint}>Drag the handle to reorder, ✕ to remove, "✨ Generate" to have Aspect suggest a new one. Keep these short and easy to click without typing.</div>
          </div>
          <div className={styles.actionsRow}>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={save} disabled={saving} title="Makes these the live prompts end users see">
              {saving ? 'Saving…' : 'Save prompts'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/** Same category → color mapping investigation.service.js uses for the real product's cards, reused here so a category reads the same way in admin. */
const CATEGORY_COLOR: Record<string, string> = {
  'cross-sell': '#C026D3',
  margin: '#C2410C',
  inventory: '#7C3AED',
  trend: '#7C3AED',
  risk: '#C2410C',
};

function CategoryBadge({ category, label }: { category: string; label: string }) {
  const color = CATEGORY_COLOR[category] || '#64748b';
  return (
    <span className={styles.categoryBadge} style={{ color, background: `${color}18`, borderColor: `${color}40` }}>
      {label}
    </span>
  );
}

function ImpactValue({ value, direction }: { value: string; direction: 'positive' | 'negative' | 'neutral' }) {
  const cls = direction === 'positive' ? styles.impactPositive : direction === 'negative' ? styles.impactNegative : styles.impactNeutral;
  return <span className={cls}>{value}</span>;
}

/** Bookmark toggle — the ONLY way an insight becomes "Tracked by you" in the real product too (see investigation.service.js's setTracked), so toggling it here has the exact same effect as the Track button end users see. */
function TrackToggle({ tracked, busy, onToggle }: { tracked: boolean; busy: boolean; onToggle: () => void }) {
  return (
    <button
      className={`${styles.trackBtn} ${tracked ? styles.trackBtnOn : ''}`}
      onClick={onToggle}
      disabled={busy}
      aria-label={tracked ? 'Untrack' : 'Track'}
      title={tracked ? 'Tracked by you — click to untrack' : 'Click to track'}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill={tracked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 3.5h12V21l-6-4.6L6 21z" />
      </svg>
    </button>
  );
}

function DatasetInsightsPage() {
  const { dataset, reload } = useOutletContext<DatasetOutletContext>();
  const [insights, setInsights] = useState<InsightDetail[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    intelligenceAdminService.listInsights(dataset.id).then(setInsights).catch(() => setInsights([]));
  };

  useEffect(load, [dataset.id]);

  const deleteInsight = async (insightId: string) => {
    setBusyId(insightId);
    try {
      await intelligenceAdminService.deleteInsight(dataset.id, insightId);
      setInsights(cur => cur?.filter(i => i.id !== insightId) ?? null);
      reload();
    } finally {
      setBusyId(null);
    }
  };

  const toggleTracked = async (insight: InsightDetail) => {
    setBusyId(insight.id);
    try {
      await intelligenceAdminService.setTracked(dataset.id, insight.id, !insight.tracked);
      setInsights(cur => cur?.map(i => i.id === insight.id ? { ...i, tracked: !i.tracked } : i) ?? null);
      reload();
    } finally {
      setBusyId(null);
    }
  };

  const trackedCount = insights?.filter(i => i.tracked).length ?? 0;

  return (
    <>
      <h2 className={styles.sectionTitle}>Generated insights</h2>
      <p className={styles.subtitle}>
        Everything Aspect has found for this dataset. Bookmark toggles "Tracked by you" — the exact same action end
        users get from the Track button on an insight's detail page.
        {insights && insights.length > 0 && ` ${insights.length} insight${insights.length === 1 ? '' : 's'}, ${trackedCount} tracked.`}
      </p>
      <div className={styles.tableContainer}>
        {insights === null ? (
          <div className={styles.tableEmpty}>Loading…</div>
        ) : insights.length === 0 ? (
          <div className={styles.tableEmpty}>No generated insights yet for this dataset.</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.iconCol}>Tracked</th>
                <th>Insight</th>
                <th>Category</th>
                <th>Impact</th>
                <th>Created</th>
                <th className={styles.actionsCol}></th>
              </tr>
            </thead>
            <tbody>
              {insights.map(i => (
                <tr key={i.id} className={busyId === i.id ? styles.rowBusy : ''}>
                  <td className={styles.iconCol}>
                    <TrackToggle tracked={!!i.tracked} busy={busyId === i.id} onToggle={() => toggleTracked(i)} />
                  </td>
                  <td className={styles.insightHeadline}>{i.headline}</td>
                  <td><CategoryBadge category={i.category} label={i.categoryLabel} /></td>
                  <td><ImpactValue value={i.impactValue} direction={i.impactDirection} /></td>
                  <td className={styles.mutedCell}>{insightCreatedLabel(i.id)}</td>
                  <td className={styles.actionsCol}>
                    <div className={styles.rowActions}>
                      <a
                        className={styles.rowViewBtn}
                        href={`/intelligence/${dataset.id}/insight/${i.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="View on site"
                        title="Open this insight on the live site (new tab)"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </a>
                      <button className={styles.rowDeleteBtn} onClick={() => deleteInsight(i.id)} disabled={busyId === i.id} aria-label="Delete" title="Delete this insight">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 7h16M9 7V5h6v2M6.5 7l1 13h9l1-13" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function IntelligenceAdminGated() {
  const [unlocked, setUnlocked] = useState(isSuperAdminUnlocked());
  const { datasets, reload } = useDatasetsState();

  if (!unlocked) {
    return <LoginGate onUnlocked={() => setUnlocked(true)} />;
  }

  return (
    <div className={styles.page}>
      <Sidebar datasets={datasets} onSignOut={() => { lockSuperAdmin(); setUnlocked(false); }} />
      <main className={styles.content}>
        <Routes>
          <Route index element={<OverviewPage datasets={datasets} reload={reload} />} />
          <Route path=":datasetId" element={<DatasetLayout datasets={datasets} reload={reload} />}>
            <Route index element={<Navigate to="config" replace />} />
            <Route path="config" element={<DatasetConfigPage />} />
            <Route path="prompts" element={<DatasetPromptsPage />} />
            <Route path="insights" element={<DatasetInsightsPage />} />
          </Route>
        </Routes>
      </main>
    </div>
  );
}

export function IntelligenceAdminPage() {
  return (
    <ThemeProvider>
      <IntelligenceAdminGated />
    </ThemeProvider>
  );
}
