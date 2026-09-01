import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './ModulesPage.module.css';
import { modulesService } from '../../../services/modulesService';
import { useDialogChrome } from '../../../hooks/useDialogChrome';
import type {
  ClientModule, LocalizedText, ModuleRun, ModuleProgress, ModuleSettingField,
} from '../../../types/modules';

/**
 * Admin — the Modules tab (super-user only).
 *
 * Fully generic: it renders whatever descriptors the server's registry
 * returns. A second module is a new card and a new settings form with zero
 * changes here — every label, field and event comes from the descriptor.
 *
 * ── Why this does NOT call useLanguage() ──
 * `useLanguage()` THROWS outside a LanguageProvider, and the dashboard admin
 * routes have none (the provider is mounted only inside IntelligenceShell).
 * Calling it here would unmount the whole admin page — the same hazard
 * CLAUDE.md documents for useAgentContext(). The descriptor's bilingual
 * strings are still carried end-to-end and rendered through `localized()`
 * below, so when the dashboard does gain a provider this becomes a one-line
 * change rather than a re-translation.
 */

interface ModulesPageProps {
  /** Dataset id — the same value as the agent's schema name. */
  datasetId: string;
  baseURL?: string;
}

/** Pick the label to show. See the note above about the missing provider. */
function localized(text: LocalizedText | undefined): string {
  if (!text) return '';
  return text.en || text.he || '';
}

const STATUS_LABEL: Record<string, string> = {
  not_initialized: 'Not initialized',
  initializing: 'Initializing',
  ready: 'Ready',
  failed: 'Failed',
  degraded: 'Degraded',
};

export function ModulesPage({ datasetId, baseURL }: ModulesPageProps) {
  // Every hook is declared before the early returns below — adding one after
  // them changes the hook count between renders, which React treats as fatal.
  const [modules, setModules] = useState<ClientModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyModule, setBusyModule] = useState<string | null>(null);
  // The id, not the module. Holding the object froze whatever the card looked
  // like at the moment it was clicked: a run that finished while its modal was
  // open updated the list behind it and left the modal describing a state that
  // no longer existed. Deriving it from the list on every render means the
  // modal cannot disagree with the card underneath, and a module that vanishes
  // from the list closes its modal instead of stranding it.
  const [settingsForId, setSettingsForId] = useState<string | null>(null);
  const [runForId, setRunForId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ text: string; onYes: () => void } | null>(null);
  const loadedFor = useRef<string | null>(null);

  const settingsFor = settingsForId ? modules.find(m => m.id === settingsForId) ?? null : null;
  const runFor = runForId ? modules.find(m => m.id === runForId) ?? null : null;

  const load = useCallback(async () => {
    try {
      const list = await modulesService.list(datasetId, baseURL);
      setModules(list);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [datasetId, baseURL]);

  useEffect(() => {
    // Dedupe by key rather than a per-closure `cancelled` flag: React 19
    // StrictMode double-invokes effects, and the naive version leaves the UI
    // stuck on a skeleton (worked example: intelligence/useInsightsFeed.ts).
    if (loadedFor.current === datasetId) return;
    loadedFor.current = datasetId;
    void load();
  }, [datasetId, load]);

  const toggleEnabled = async (mod: ClientModule) => {
    const turningOn = !mod.enabled;
    const apply = async () => {
      setBusyModule(mod.id);
      try {
        const updated = await modulesService.setEnabled(datasetId, mod.id, turningOn, baseURL);
        setModules(prev => prev.map(m => (m.id === updated.id ? updated : m)));
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusyModule(null);
      }
    };

    // Turning a live module OFF removes its client-facing surfaces, so it gets
    // a confirm. Turning one on does not — an uninitialized module going on is
    // harmless, it still is not live.
    if (!turningOn && mod.live) {
      setConfirm({
        text: `Turn off "${localized(mod.name)}" for ${datasetId}? Its screen, chat tool and report will stop appearing for this client. The binding is kept, so turning it back on does not require re-initializing.`,
        onYes: () => { setConfirm(null); void apply(); },
      });
      return;
    }
    await apply();
  };

  if (loading) {
    return <div className={styles.page}><div className={styles.muted}>Loading modules…</div></div>;
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Modules</h1>
          <p className={styles.subtitle}>
            Optional capabilities that can be switched on per client. A module does nothing
            until it is both <strong>enabled</strong> and <strong>initialized</strong> —
            a dataset with no module enabled behaves exactly as it does today.
          </p>
        </div>
        <span className={styles.superBadge}>Super-admin</span>
      </header>

      {/* Fixed-height slot: the layout must not jump when a message appears. */}
      <div className={styles.noticeSlot}>
        {error && <div className={styles.noticeError}>{error}</div>}
      </div>

      {modules.length === 0 && (
        <div className={styles.empty}>No modules are registered for this platform build.</div>
      )}

      {modules.map(mod => (
        <ModuleCard
          key={mod.id}
          mod={mod}
          busy={busyModule === mod.id}
          onToggle={() => void toggleEnabled(mod)}
          onSettings={() => setSettingsForId(mod.id)}
          onRunReport={() => setRunForId(mod.id)}
        />
      ))}

      {settingsFor && (
        <SettingsModal
          datasetId={datasetId}
          baseURL={baseURL}
          mod={settingsFor}
          onClose={() => setSettingsForId(null)}
          onSaved={updated => {
            setModules(prev => prev.map(m => (m.id === updated.id ? updated : m)));
            setSettingsForId(null);
          }}
        />
      )}

      {runFor && (
        <RunModal
          datasetId={datasetId}
          baseURL={baseURL}
          mod={runFor}
          onClose={() => setRunForId(null)}
          onModuleChanged={updated =>
            setModules(prev => prev.map(m => (m.id === updated.id ? updated : m)))}
        />
      )}

      {/* House rule: a custom confirm modal, never browser confirm(). */}
      {confirm && (
        <ConfirmOverlay onClose={() => setConfirm(null)}>
          <p className={styles.confirmText}>{confirm.text}</p>
          <div className={styles.modalActions}>
            <button type="button" className={styles.btnGhost} onClick={() => setConfirm(null)}>
              Cancel
            </button>
            <button type="button" className={styles.btnDanger} onClick={confirm.onYes}>
              Turn off
            </button>
          </div>
        </ConfirmOverlay>
      )}
    </div>
  );
}

/**
 * A number field that lets you type a number.
 *
 * The box used to render `String(value)` straight from the parsed number, so
 * every keystroke round-tripped through `Number()`. Typing "1.5" got as far as
 * "1." — which parses to 1, renders back as "1", and eats the decimal point as
 * you type it. Anything fractional was simply unreachable, and the field it
 * matters most for is a delivery time in days.
 *
 * So the TEXT is the state and the number is derived from it. Empty stays empty
 * rather than collapsing to 0: clearing a field means "use the default", and 0
 * is a real value a buyer might mean.
 */
function NumberInput({ value, onChange }: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const [text, setText] = useState(value === null || value === undefined ? '' : String(value));

  // Re-seed only when the value changed OUTSIDE this box -- a reset, a reload.
  // Comparing against what the text already parses to is what keeps a half-typed
  // "1." alive: the parent holds 1, the box holds "1.", and they agree.
  //
  // Done during render rather than in an effect: React supports adjusting state
  // when a prop changes this way, and it re-renders before committing, so the
  // box never paints the stale text for a frame.
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    const asNumber = text.trim() === '' ? null : Number(text);
    if (value !== asNumber) setText(value === null || value === undefined ? '' : String(value));
  }

  return (
    <input
      className={styles.input}
      type="text"
      inputMode="decimal"
      value={text}
      onChange={e => {
        const raw = e.target.value;
        if (raw !== '' && !/^-?\d*[.,]?\d*$/.test(raw)) return;
        // A comma is what an Israeli keyboard puts under the thumb; Number()
        // reads it as NaN, so it is normalised rather than rejected.
        const normalised = raw.replace(',', '.');
        setText(raw);
        if (normalised === '' || normalised === '-') onChange(null);
        else if (!Number.isNaN(Number(normalised))) onChange(Number(normalised));
      }}
    />
  );
}

/**
 * The confirm dialog's own chrome.
 *
 * A component rather than a ref on the markup above, because the hook has to
 * run on mount and this dialog only exists while `confirm` is set -- mounting
 * it IS the open event.
 */
function ConfirmOverlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const dialogRef = useDialogChrome<HTMLDivElement>(onClose);
  return (
    <div className={styles.overlay}>
      <div className={styles.confirmBox} ref={dialogRef} role="dialog" aria-modal="true">
        {children}
      </div>
    </div>
  );
}

// ── one module card ──────────────────────────────────────────────────────

function ModuleCard({ mod, busy, onToggle, onSettings, onRunReport }: {
  mod: ClientModule;
  busy: boolean;
  onToggle: () => void;
  onSettings: () => void;
  onRunReport: () => void;
}) {
  // An app module owns its own storage: no init pipeline, no binding, no
  // nightly build. Several controls below exist only for data modules.
  const isApp = mod.kind === 'app';
  const hasBinding = Boolean(mod.binding);
  // "Never initialized" and "initialized and it failed" are different
  // situations and must not share a message — a failed module was showing
  // "Configure settings, then run Init infrastructure to begin", which reads
  // as though nothing had been attempted.
  const everRun = mod.status !== 'not_initialized';
  return (
    <section className={styles.card}>
      <div className={styles.cardTop}>
        <div className={styles.cardIdentity}>
          <span className={`${styles.dot} ${styles[`dot_${mod.status}`] || ''}`} />
          <span className={styles.moduleName}>{localized(mod.name)}</span>
          <span className={`${styles.pill} ${styles[`pill_${mod.status}`] || ''}`}>
            {STATUS_LABEL[mod.status] || mod.status}
          </span>
          {mod.live && <span className={styles.pillLive}>Live for this client</span>}
        </div>

        <label className={styles.toggleWrap}>
          <span className={styles.toggleLabel}>Enabled</span>
          <input
            type="checkbox"
            className={styles.toggle}
            checked={mod.enabled}
            disabled={busy}
            onChange={onToggle}
          />
        </label>
      </div>

      <div className={styles.meta}>
        {isApp ? (
          mod.live
            ? 'Switched on. This module brings its own storage, so there is nothing to initialize.'
            : 'Switch it on to make it available for this client. There is nothing to initialize.'
        ) : hasBinding ? (
          <>
            Binding stored
            {mod.initModel ? ` · model ${mod.initModel}` : ''}
            {mod.updatedAt ? ` · updated ${new Date(mod.updatedAt).toLocaleString('en-GB')}` : ''}
          </>
        ) : everRun ? (
          'Initialization has run but stored no binding — open the run report to see which checks failed.'
        ) : (
          'Configure settings, then run Init infrastructure to begin.'
        )}
      </div>

      {/* Enabled but not ready is a legitimate, and confusing, state — say so
          rather than leaving the operator to infer it from two controls. It
          cannot happen to an app module, whose switch sets both at once. */}
      {!isApp && mod.enabled && mod.status !== 'ready' && (
        <div className={styles.inlineHint}>
          Enabled, but not live yet — initialization has not completed successfully.
        </div>
      )}
      {mod.missingRequired.length > 0 && (
        <div className={styles.inlineHint}>
          Required settings missing: {mod.missingRequired.join(', ')}
        </div>
      )}

      <div className={styles.cardActions}>
        <button type="button" className={styles.btnGhost} onClick={onSettings}>Settings</button>
        {/* No init for an app module: the server refuses it, so offering the
            button would only ever produce an error. */}
        {!isApp && (
          <button type="button" className={styles.btnGhost} onClick={onRunReport}>
            {everRun ? 'Re-init / run report' : 'Init infrastructure'}
          </button>
        )}
      </div>
    </section>
  );
}

// ── settings modal ───────────────────────────────────────────────────────

function SettingsModal({ datasetId, baseURL, mod, onClose, onSaved }: {
  datasetId: string;
  baseURL?: string;
  mod: ClientModule;
  onClose: () => void;
  onSaved: (m: ClientModule) => void;
}) {
  const [draft, setDraft] = useState<Record<string, unknown>>(() => ({ ...mod.settings }));
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const setField = (key: string, value: unknown) =>
    setDraft(prev => ({ ...prev, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      const updated = await modulesService.saveSettings(datasetId, mod.id, draft, baseURL);
      onSaved(updated);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  const dialogRef = useDialogChrome<HTMLDivElement>(onClose);

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} ref={dialogRef} role="dialog" aria-modal="true">
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{localized(mod.name)} — Settings</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className={styles.formGrid}>
          {mod.settingsSchema.map(field => (
            <SettingField
              key={field.key}
              field={field}
              value={draft[field.key]}
              source={mod.settingsSources[field.key]}
              events={mod.notificationEvents}
              onChange={v => setField(field.key, v)}
            />
          ))}
        </div>

        {/* Fixed-height slot so the modal never resizes when a message appears. */}
        <div className={styles.noticeSlot}>
          {notice
            ? <div className={styles.noticeError}>{notice}</div>
            : (
              <div className={styles.noticeInfo}>
                {mod.kind === 'app'
                  ? 'Saved settings take effect immediately.'
                  : 'Saved settings apply from the next init or nightly build.'}
              </div>
            )}
        </div>

        <div className={styles.modalActions}>
          <button type="button" className={styles.btnGhost} onClick={onClose}>Cancel</button>
          <button type="button" className={styles.btnPrimary} disabled={saving} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingField({ field, value, source, events, onChange }: {
  field: ModuleSettingField;
  value: unknown;
  source: string | null;
  events?: string[];
  onChange: (v: unknown) => void;
}) {
  const isBool = field.type === 'boolean';

  // Per-event toggles: a checkbox per event the module declares it can emit,
  // so the list cannot drift from what the module actually sends. Absent or
  // undefined means ON — the server treats a missing toggle as enabled, and
  // the UI must agree or the two would disagree about the default.
  if (field.type === 'event_toggles') {
    const map = (value && typeof value === 'object' ? value : {}) as Record<string, boolean>;
    return (
      <div className={`${styles.field} ${styles.fieldWide}`}>
        <span className={styles.fieldLabel}>{localized(field.label)}</span>
        <div className={styles.toggleRow}>
          {(events || []).map(ev => (
            <label key={ev} className={styles.eventToggle}>
              <input
                type="checkbox"
                checked={map[ev] !== false}
                onChange={e => onChange({ ...map, [ev]: e.target.checked })}
              />
              <span>{ev.replace(/_/g, ' ')}</span>
            </label>
          ))}
          {!(events || []).length && <span className={styles.fieldHint}>This module emits no events.</span>}
        </div>
        {field.hint && <span className={styles.fieldHint}>{localized(field.hint)}</span>}
      </div>
    );
  }

  // Multi-value email field — stored as an array, edited as one line.
  if (field.type === 'emails') {
    return <EmailsField field={field} value={value} onChange={onChange} />;
  }

/**
 * Emails, edited as one line.
 *
 * The raw text is the state; the array is derived on blur. Deriving it on every
 * keystroke — `value={list.join(', ')}` with a parse-on-change — made the field
 * impossible to type a second address into: the comma you type is split away,
 * React re-renders without it, and the next character merges into the first
 * address (a@b.comc…). Addresses could only be pasted in as a finished list,
 * and this is a REQUIRED setting.
 *
 * Seeded once from the stored value, like the LeadTimeModal in this same build
 * already does. Re-seeding on every render would put the bug straight back.
 */
function EmailsField({ field, value, onChange }: {
  field: ModuleSettingField;
  value: unknown;
  onChange: (next: string[]) => void;
}) {
  const stored = Array.isArray(value) ? (value as string[]) : [];
  const [text, setText] = useState(() => stored.join(', '));

  const commit = (raw: string) => {
    const list = raw.split(/[,;]/).map(x => x.trim()).filter(Boolean);
    // Normalised back into the box so what is shown is what will be saved.
    setText(list.join(', '));
    onChange(list);
  };

  return (
    <label className={`${styles.field} ${styles.fieldWide}`}>
      <span className={styles.fieldLabel}>
        {localized(field.label)}
        {field.required && <span className={styles.req}> *</span>}
      </span>
      <input
        className={styles.input}
        type="text"
        value={text}
        placeholder="name@example.com, other@example.com"
        onChange={e => setText(e.target.value)}
        onBlur={e => commit(e.target.value)}
        // Enter commits too: a dialog whose save button is a click away should
        // not need the field to lose focus first.
        onKeyDown={e => { if (e.key === 'Enter') commit((e.target as HTMLInputElement).value); }}
      />
      {field.hint && <span className={styles.fieldHint}>{localized(field.hint)}</span>}
    </label>
  );
}

  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>
        {localized(field.label)}
        {field.required && <span className={styles.req}> *</span>}
        {/* Where the current value came from — an operator must be able to
            tell a value they set from one that was assumed for them. */}
        {source && source !== 'module' && (
          <span className={styles.sourceTag}>{source === 'code' ? 'default' : 'platform default'}</span>
        )}
      </span>

      {isBool ? (
        <input
          type="checkbox"
          className={styles.toggle}
          checked={Boolean(value)}
          onChange={e => onChange(e.target.checked)}
        />
      ) : (
        field.type === 'number' ? (
          <NumberInput value={value as number | null} onChange={onChange} />
        ) : (
          <input
            className={styles.input}
            type="text"
            value={value === null || value === undefined ? '' : String(value)}
            onChange={e => onChange(e.target.value)}
          />
        )
      )}

      {field.hint && <span className={styles.fieldHint}>{localized(field.hint)}</span>}
    </label>
  );
}

// ── init run modal ───────────────────────────────────────────────────────

function RunModal({ datasetId, baseURL, mod, onClose, onModuleChanged }: {
  datasetId: string;
  baseURL?: string;
  mod: ClientModule;
  onClose: () => void;
  onModuleChanged: (m: ClientModule) => void;
}) {
  const [run, setRun] = useState<ModuleRun | null>(null);
  const [progress, setProgress] = useState<ModuleProgress | null>(null);
  const inFlight = useRef(false);
  const dialogRef = useDialogChrome<HTMLDivElement>(onClose);
  const [notice, setNotice] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [building, setBuilding] = useState(false);
  const fetchedFor = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await modulesService.latestRun(datasetId, mod.id, baseURL);
      setRun(r.run);
      setProgress(r.progress || null);
      return r.run;
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e));
      return null;
    }
  }, [datasetId, mod.id, baseURL]);

  useEffect(() => {
    const key = `${datasetId}/${mod.id}`;
    if (fetchedFor.current === key) return;
    fetchedFor.current = key;
    void refresh();
  }, [datasetId, mod.id, refresh]);

  // Poll only while a run is actually in flight, and stop the moment it is
  // not — a permanent interval against a finished run is pure noise.
  useEffect(() => {
    if (run?.status !== 'running') return;
    const id = setInterval(() => {
      // A tick that arrives while the previous one is still out is DROPPED,
      // not queued. Without this, a refresh slower than the interval put two
      // requests in the air at once and whichever answered last won -- so the
      // progress bar could walk backwards on a run that was moving forwards.
      // One request at a time makes the order the server's, not the network's.
      if (inFlight.current) return;
      inFlight.current = true;
      void refresh().finally(() => { inFlight.current = false; });
    }, 1500);
    return () => clearInterval(id);
  }, [run?.status, refresh]);

  // When a run finishes, the module's own status changed too — pull it so the
  // card behind the modal stops showing a stale pill.
  useEffect(() => {
    if (!run || run.status === 'running') return;
    let alive = true;
    modulesService.get(datasetId, mod.id, baseURL)
      .then(updated => { if (alive) onModuleChanged(updated); })
      .catch(() => { /* the card just stays as it was */ });
    return () => { alive = false; };
    // onModuleChanged is a parent closure recreated on every render; including
    // it would re-fire this effect on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.status, run?.id, datasetId, mod.id, baseURL]);

  const start = async () => {
    setStarting(true);
    setNotice(null);
    try {
      await modulesService.startInit(datasetId, mod.id, baseURL);
      await refresh();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e));
    } finally {
      setStarting(false);
    }
  };

  /**
   * Rebuild into the live schema on demand.
   *
   * Deliberately synchronous and blocking: it is the same scan the nightly
   * reload does (tens of seconds), and an operator who pressed this needs to
   * see whether it actually worked, not a fire-and-forget toast.
   */
  const buildNow = async () => {
    setBuilding(true);
    setNotice(null);
    try {
      const res = await modulesService.buildNow(datasetId, mod.id, baseURL);
      if (res.failed?.length) {
        setNotice(res.failed.map(f => f.error).join('; '));
      } else {
        const secs = res.built?.[0]?.seconds;
        setNotice(secs ? `Rebuilt into the live schema in ${secs}s.` : 'Rebuilt into the live schema.');
      }
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e));
    } finally {
      setBuilding(false);
    }
  };

  const running = run?.status === 'running';
  // Only a LIVE module has something to rebuild: the views are rendered from a
  // stored binding, and a module that never converged has none.
  const isLive = mod.enabled && mod.status === 'ready';

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} ref={dialogRef} role="dialog" aria-modal="true">
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            {localized(mod.name)} — Init infrastructure
            {run ? <span className={styles.runId}> · run #{run.id}</span> : null}
          </h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">✕</button>
        </div>

        {progress && run && (
          <>
            <div className={styles.progressRow}>
              <span className={styles.progressLabel}>{progress.label}</span>
              <span className={styles.progressPct}>{progress.percent}%</span>
            </div>
            <div className={styles.progressTrack}>
              {/* Width comes from the server's computed, monotonic percentage —
                  never animated against a guessed duration. A FAILED run also
                  ends at 100%, so it must not be drawn in the success colour:
                  a full blue bar reads as "done, fine". */}
              <div
                className={`${styles.progressBar} ${run.status === 'failed' ? styles.progressBarFailed : ''}`}
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </>
        )}

        {run?.rounds && run.rounds.length > 0 && (
          <div className={styles.rounds}>
            <div className={styles.sectionLabel}>Round history</div>
            {run.rounds.map(r => (
              <div key={r.round} className={styles.round}>
                <span className={r.passed ? styles.roundOk : styles.roundBad}>
                  Round {r.round} {r.passed ? '✓' : '✗'}
                </span>
                <span className={styles.roundDetail}>
                  {r.passed
                    ? `all ${r.probes.length} probes passed`
                    : r.probes.filter(p => !p.passed).map(p => `${p.probe} — ${p.detail || 'failed'}`).join('; ')}
                </span>
              </div>
            ))}
          </div>
        )}

        {run && !running && run.report?.reason && (
          <div className={styles.reportReason}>{run.report.reason}</div>
        )}

        {!run && <div className={styles.muted}>This module has never been initialized.</div>}

        <div className={styles.noticeSlot}>
          {notice
            ? <div className={styles.noticeError}>{notice}</div>
            : <div className={styles.noticeInfo}>
                Initialization verifies in a scratch schema, then builds into the live
                schema so the module works immediately. The nightly reload rebuilds it
                again — module views cannot survive the schema swap on their own.
              </div>}
        </div>

        <div className={styles.modalActions}>
          <button type="button" className={styles.btnGhost} onClick={onClose}>Close</button>
          {isLive && (
            <button
              type="button"
              className={styles.btnGhost}
              disabled={building || running || starting}
              onClick={() => void buildNow()}
              title="Re-create this module's views in the live schema now, without waiting for the nightly reload"
            >
              {building ? 'Rebuilding…' : 'Rebuild now'}
            </button>
          )}
          <button
            type="button"
            className={styles.btnPrimary}
            disabled={starting || running}
            onClick={() => void start()}
          >
            {running ? 'Running…' : (run ? 'Re-init infrastructure' : 'Init infrastructure')}
          </button>
        </div>
      </div>
    </div>
  );
}
