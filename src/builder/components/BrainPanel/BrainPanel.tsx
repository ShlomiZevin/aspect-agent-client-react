/**
 * BrainPanel — live runtime view of the chat's memory + active
 * Dynamic Contexts.
 *
 * Exports:
 *   - `BrainDockSlot` — mounts at the bottom of the chat column.
 *     Renders a clickable bar when collapsed, and the same bar +
 *     the body above it when docked. Hides itself entirely when
 *     posture is `fullscreen` (the fullscreen layer owns the whole
 *     center area then).
 *   - `BrainFullscreenLayer` — absolute-positioned overlay anchored
 *     to the BuilderLayout's center cell. Mounted by BuilderShell so
 *     it sits inside the center grid cell only — sidebar / topbar /
 *     chat stay clickable around it.
 *
 * Both render the same body internally (`<BrainBody>`); the only
 * difference is the chrome around it.
 *
 * No SSE wiring here: the panel is derived from `conversationMemory`
 * + `agent.dynamicContexts` via {@link useBrainSnapshot}, which
 * already updates correctly when conversations switch and after each
 * turn. Activity-detection (the unseen dot) lives in BrainContext.
 */

import { useBuilder } from '../../state/BuilderContext';
import { useBrain } from '../../state/BrainContext';
import {
  formatBrainValue,
  useBrainSnapshot,
  type BrainDcHit,
  type BrainMemoryGroup,
  type BrainStaleRow,
} from '../../state/useBrainSnapshot';
import styles from './BrainPanel.module.css';

/* ────────────────────────────── DOCK SLOT ────────────────────── */

/** Pinned to the bottom of the chat column. Collapsed → just the bar.
 *  Docked → bar + body taking ~40% of the available height. Hidden
 *  when posture is `fullscreen` (overlay owns everything then). */
export function BrainDockSlot() {
  const { posture, setPosture, hasUnseen } = useBrain();
  if (posture === 'fullscreen') return null;

  const isDocked = posture === 'docked';
  return (
    <div
      className={styles.dockWrap}
      // Docked posture needs a real height — 40% of the containing
      // center cell reads as "useful surface, still leaves canvas
      // visible". Collapsed posture keeps natural (just the bar).
      style={isDocked ? { height: '40%' } : undefined}
    >
      {isDocked && (
        <div className={styles.body}>
          <BrainBodyContent />
        </div>
      )}
      <button
        type="button"
        className={`${styles.bar} ${isDocked ? styles.barDocked : styles.barCollapsed}`}
        onClick={() => setPosture(isDocked ? 'collapsed' : 'docked')}
        title={isDocked ? 'Collapse the brain panel' : 'Expand the brain panel'}
      >
        <span className={styles.barIcon} aria-hidden>🧠</span>
        <span className={styles.barTitle}>Brain</span>
        <BrainBarSummary />
        {!isDocked && hasUnseen && <span className={styles.barDot} aria-label="new activity" />}
        {/* Fullscreen toggle is always present so the user can jump
            straight to fullscreen from collapsed without an
            intermediate "docked" step. role=button + keyboard
            handler so it's a real interactive element nested inside
            the bar button. */}
        <span
          role="button"
          tabIndex={0}
          className={styles.barAction}
          onClick={e => { e.stopPropagation(); setPosture('fullscreen'); }}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              setPosture('fullscreen');
            }
          }}
          title="Expand to fullscreen"
          aria-label="Expand to fullscreen"
        >⤢</span>
        <span className={styles.barChevron} aria-hidden>{isDocked ? '▾' : '▴'}</span>
      </button>
    </div>
  );
}

/** Tiny mid-bar summary chip — quick "what's in the brain right now"
 *  glance without opening the panel. */
function BrainBarSummary() {
  const { memoryGroups, dcHits, staleRows } = useBrainSnapshot();
  const filled = memoryGroups.reduce(
    (n, g) => n + g.rows.filter(r => r.value !== undefined && r.value !== null).length,
    0,
  );
  const total = memoryGroups.reduce((n, g) => n + g.rows.length, 0) + staleRows.length;
  return (
    <span className={styles.barCount}>
      {filled}/{total} fields · {dcHits.length} DC {dcHits.length === 1 ? 'hit' : 'hits'}
    </span>
  );
}

/* ───────────────────────── FULLSCREEN LAYER ──────────────────── */

/** Absolute-positioned overlay anchored to the center cell of
 *  BuilderLayout (sidebar / topbar / chat stay visible around it).
 *  Mounted by BuilderShell so it sits at the right scope; uses a
 *  CSS `position: absolute; inset: 0` against the relatively-
 *  positioned `.center` cell. */
export function BrainFullscreenLayer() {
  const { posture, setPosture } = useBrain();
  const { previewConversationId } = useBuilder();
  if (posture !== 'fullscreen') return null;
  return (
    <div className={styles.fullscreenLayer} role="dialog" aria-label="Brain — runtime view">
      <div className={styles.fullscreenHeader}>
        <span className={styles.fullscreenTitle}>🧠 Brain</span>
        {previewConversationId !== null && (
          <span className={styles.fullscreenConvo}>convo #{previewConversationId}</span>
        )}
        <span style={{ flex: 1 }} />
        <button
          type="button"
          className={styles.barAction}
          onClick={() => setPosture('docked')}
          title="Collapse to dock"
          aria-label="Collapse to dock"
        >⤡</button>
        <button
          type="button"
          className={styles.barAction}
          onClick={() => setPosture('collapsed')}
          title="Close brain panel"
          aria-label="Close brain panel"
        >×</button>
      </div>
      <div className={`${styles.body} ${styles.bodyFullscreen}`}>
        <BrainBodyContent />
      </div>
    </div>
  );
}

/* ──────────────────────────── BODY ───────────────────────────── */

/** Shared body content — used by both dock and fullscreen postures.
 *  Two top-level sections (Memory, Dynamic Context). In dock posture
 *  they stack; in fullscreen the body class flips to grid via
 *  `.bodyFullscreen` so they sit side-by-side. */
function BrainBodyContent() {
  const { memoryGroups, staleRows, dcHits } = useBrainSnapshot();

  return (
    <>
      <MemorySection groups={memoryGroups} staleRows={staleRows} />
      <DynamicContextSection hits={dcHits} />
    </>
  );
}

function MemorySection({
  groups, staleRows,
}: { groups: BrainMemoryGroup[]; staleRows: BrainStaleRow[] }) {
  const totalDeclared = groups.reduce((n, g) => n + g.rows.length, 0);
  const isEmpty = totalDeclared === 0 && staleRows.length === 0;
  return (
    <section className={styles.section}>
      <header className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>Memory</span>
      </header>
      {isEmpty ? (
        <div className={styles.sectionEmpty}>
          No fields declared on this agent yet. Add a field in the
          schema panel, then a turn here will surface its captured value.
        </div>
      ) : (
        <>
          {groups.map((g, idx) => (
            <div key={g.domain ?? `__ungrouped__${idx}`}>
              {/* Ungrouped fields render header-less at the top —
                  domain-bearing groups get a small caps header. */}
              {g.domain !== null && (
                <div className={styles.domainHeader}>{g.domain}</div>
              )}
              {g.rows.map(r => {
                const hasValue = r.value !== undefined && r.value !== null;
                return (
                  <div key={r.name} className={styles.memoryRow}>
                    <span className={styles.memoryRowName}>{r.name}</span>
                    {hasValue ? (
                      <span className={styles.memoryRowValue} title={formatBrainValue(r.value)}>
                        {formatBrainValue(r.value)}
                      </span>
                    ) : (
                      <span className={styles.memoryRowValueEmpty}>—</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          {staleRows.length > 0 && (
            <>
              <div className={styles.staleDivider}>
                <span className={styles.staleGlyph} aria-hidden>⚠</span>
                removed from schema
              </div>
              {staleRows.map(r => (
                <div
                  key={`${r.domain ?? '_general'}.${r.name}`}
                  className={`${styles.memoryRow} ${styles.memoryRowStale}`}
                >
                  <span className={styles.memoryRowName}>{r.name}</span>
                  <span className={styles.memoryRowValue} title={formatBrainValue(r.value)}>
                    {formatBrainValue(r.value)}
                  </span>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </section>
  );
}

function DynamicContextSection({ hits }: { hits: BrainDcHit[] }) {
  return (
    <section className={styles.section}>
      <header className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>Dynamic Context</span>
        <span className={styles.sectionCount}>
          {hits.length} {hits.length === 1 ? 'hit' : 'hits'}
        </span>
      </header>
      {hits.length === 0 ? (
        <div className={styles.sectionEmpty}>
          No dynamic contexts are active right now. Capture a field
          value that matches a declared case to see what loads.
        </div>
      ) : (
        hits.map(hit => <DcCard key={hit.dc.id} hit={hit} />)
      )}
    </section>
  );
}

function DcCard({ hit }: { hit: BrainDcHit }) {
  const { expandedBodies, toggleBody } = useBrain();
  const isExpanded = (key: string) => expandedBodies.has(`${hit.dc.id}/${key}`);
  const toggle = (key: string) => toggleBody(`${hit.dc.id}/${key}`);

  return (
    <article className={styles.dcCard}>
      <header className={styles.dcHeader}>
        <span className={styles.dcHeaderGlyph} aria-hidden>🎯</span>
        <span className={styles.dcHeaderField}>{hit.fieldName}</span>
        <span className={styles.dcHeaderOp}>=</span>
        <span className={styles.dcHeaderValue}>{hit.liveValue}</span>
        {hit.matched === null && (
          <span className={styles.dcHeaderFallback}>↳ fallback (no case matched)</span>
        )}
      </header>

      {hit.matched && (
        <>
          {hit.matched.umbrella.trim().length > 0 && (
            <DcBodyRow
              label="umbrella"
              body={hit.matched.umbrella}
              expanded={isExpanded('__umbrella__')}
              onToggle={() => toggle('__umbrella__')}
            />
          )}
          {hit.matched.sections.map(s => (
            <DcBodyRow
              key={s.name}
              label={s.name}
              body={s.body}
              expanded={isExpanded(s.name)}
              onToggle={() => toggle(s.name)}
              emptyHint={`no body for "${hit.matched!.caseValue}"`}
            />
          ))}
        </>
      )}
      {hit.matched === null && hit.fallback && (
        <DcBodyRow
          label="fallback"
          body={hit.fallback}
          expanded={isExpanded('__fallback__')}
          onToggle={() => toggle('__fallback__')}
        />
      )}
    </article>
  );
}

function DcBodyRow({
  label, body, expanded, onToggle, emptyHint,
}: {
  label: string;
  body: string;
  expanded: boolean;
  onToggle: () => void;
  emptyHint?: string;
}) {
  const filled = body.trim().length > 0;
  return (
    <div className={styles.dcBody}>
      <button
        type="button"
        className={styles.dcBodyHeader}
        onClick={filled ? onToggle : undefined}
        disabled={!filled}
        title={filled ? 'Toggle preview' : emptyHint ?? 'no body authored'}
      >
        <span className={styles.dcBodyCaret} aria-hidden>
          {filled ? (expanded ? '▾' : '▸') : '○'}
        </span>
        <span className={`${styles.dcBodyLabel} ${!filled ? styles.dcBodyLabelEmpty : ''}`}>
          {label}
        </span>
        {filled ? (
          <span className={styles.dcBodyHint}>loaded</span>
        ) : (
          <span className={styles.dcBodyHintEmpty}>{emptyHint ?? 'empty'}</span>
        )}
      </button>
      {filled && expanded && (
        <div className={styles.dcBodyText}>{body}</div>
      )}
    </div>
  );
}
