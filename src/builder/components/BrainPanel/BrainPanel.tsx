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
 * + `agent.enums` via {@link useBrainSnapshot}, which
 * already updates correctly when conversations switch and after each
 * turn. Activity-detection (the unseen dot) lives in BrainContext.
 */

import { useMemo } from 'react';
import { useBuilder } from '../../state/BuilderContext';
import { useBrain } from '../../state/BrainContext';
import {
  formatBrainValue,
  useBrainSnapshot,
  type BrainDcHit,
  type BrainKbSlot,
  type BrainMemoryGroup,
  type BrainStaleRow,
  type BrainSummarizerCard,
  type BrainThinkingCard,
} from '../../state/useBrainSnapshot';
import type { EnumTypeDef, FieldDef } from '../../types';
import styles from './BrainPanel.module.css';

/* ────────────────────────────── DOCK SLOT ────────────────────── */

/** Pinned to the bottom of the chat column. Collapsed → just the bar.
 *  Docked → bar + body taking ~40% of the available height. Hidden
 *  when posture is `fullscreen` (overlay owns everything then). */
export function BrainDockSlot() {
  const { posture, setPosture, hasUnseen } = useBrain();
  const { previewConversationId } = useBuilder();
  if (posture === 'fullscreen') return null;

  const isDocked = posture === 'docked';
  return (
    <div
      className={styles.dockWrap}
      // Docked posture needs a real height — 50% of the containing
      // center cell gives the panel a substantial surface (small
      // enough to leave canvas visible above). Collapsed posture
      // keeps natural (just the bar).
      style={isDocked ? { height: '50%' } : undefined}
    >
      {isDocked && (
        <>
          {/* Top header — gives the docked panel an actual top edge so
              it reads as a contained surface, not as content bleeding
              into the canvas above. Title + convo number anchor the
              identity; ⤢ / × buttons mirror the fullscreen header so
              users have actions on both edges of the panel. */}
          <div className={styles.dockHeader}>
            <span className={styles.dockHeaderIcon} aria-hidden>🧠</span>
            <span className={styles.dockHeaderTitle}>Live Brain</span>
            {previewConversationId !== null && (
              <span className={styles.dockHeaderConvo}>#{previewConversationId}</span>
            )}
            <span style={{ flex: 1 }} />
            <button
              type="button"
              className={styles.barAction}
              onClick={() => setPosture('fullscreen')}
              title="Expand to fullscreen"
              aria-label="Expand to fullscreen"
            >⤢</button>
            <button
              type="button"
              className={styles.barAction}
              onClick={() => setPosture('collapsed')}
              title="Close brain panel"
              aria-label="Close brain panel"
            >×</button>
          </div>
          <div className={`${styles.body} ${styles.bodyDocked}`}>
            <BrainBodyContent />
          </div>
        </>
      )}
      <button
        type="button"
        className={`${styles.bar} ${isDocked ? styles.barDocked : styles.barCollapsed}`}
        onClick={() => setPosture(isDocked ? 'collapsed' : 'docked')}
        title={isDocked ? 'Collapse the brain panel' : 'Open the live brain panel'}
      >
        <span className={styles.barIcon} aria-hidden>🧠</span>
        <span className={styles.barTitle}>Live Brain</span>
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
    <div className={styles.fullscreenLayer} role="dialog" aria-label="Live brain — runtime view for this conversation">
      <div className={styles.fullscreenHeader}>
        <span className={styles.fullscreenTitle}>🧠 Live Brain</span>
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
  const { memoryGroups, staleRows, dcHits, thinkingCards, summarizerCards, kbSlots } = useBrainSnapshot();

  return (
    <>
      <MemorySection groups={memoryGroups} staleRows={staleRows} />
      <DynamicContextSection hits={dcHits} />
      <ThinkingSection cards={thinkingCards} />
      <SummarizerSection cards={summarizerCards} />
      <KnowledgeSection slots={kbSlots} />
    </>
  );
}

function MemorySection({
  groups, staleRows,
}: { groups: BrainMemoryGroup[]; staleRows: BrainStaleRow[] }) {
  const totalDeclared = groups.reduce((n, g) => n + g.rows.length, 0);
  const isEmpty = totalDeclared === 0 && staleRows.length === 0;
  const { doc, updateConversationMemoryField } = useBuilder();
  const agent = doc.agents[0];
  const enumsById = useMemo(() => {
    const map = new Map<string, EnumTypeDef>();
    for (const e of agent?.enums ?? []) map.set(e.id, e);
    return map;
  }, [agent?.enums]);

  const writePinned = async (
    field: FieldDef,
    next: string,
  ) => {
    await updateConversationMemoryField({
      field: field.name,
      value: next,
      domain: field.domain ?? null,
    });
  };

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
                const isPinned = r.fieldDef?.source === 'pinned';
                const kb = isPinned && r.fieldDef?.enumType
                  ? enumsById.get(r.fieldDef.enumType)
                  : undefined;
                const kbValues = (kb?.values ?? [])
                  .map(v => v?.value)
                  .filter((v): v is string => typeof v === 'string' && v.length > 0);
                return (
                  <div key={r.name} className={styles.memoryRow}>
                    <span className={styles.memoryRowName}>
                      {isPinned && (
                        <span
                          title="Pinned field — pre-set Targeted KB value"
                          style={{ marginRight: 4 }}
                        >
                          🎯
                        </span>
                      )}
                      {r.name}
                    </span>
                    {/* For pinned-enum fields with a KB, expose a value
                        picker right here so per-conversation overrides
                        are one click. Writes to conversation memory.

                        Pinned defaults are SEEDED by the server when
                        BuilderRunner.runOnce fires (on the first
                        message). Before that, conversation memory is
                        empty client-side. So when we have no live
                        value but the FieldDef has a `defaultValue`,
                        show it as the visually-selected option with a
                        small "(default)" tag — that's what the server
                        will seed it with, and the user can pre-swap
                        from here before sending a message. */}
                    {isPinned && r.fieldDef && kbValues.length > 0 ? (() => {
                      const pendingDefault = !hasValue && r.fieldDef.defaultValue
                        ? r.fieldDef.defaultValue
                        : '';
                      const selected = hasValue
                        ? String(r.value)
                        : pendingDefault;
                      const showingDefault = !hasValue && !!pendingDefault;
                      return (
                        <select
                          value={selected}
                          onChange={e => writePinned(r.fieldDef!, e.target.value)}
                          title={showingDefault
                            ? `Default value (will be seeded into memory on the first turn). Pick another to override before sending.`
                            : undefined}
                          style={{
                            fontFamily: 'inherit',
                            fontSize:   11.5,
                            padding:    '2px 6px',
                            border:     '1px solid #e5e7eb',
                            borderRadius: 4,
                            background: '#fff',
                            color:      showingDefault ? '#6b7280' : '#111827',
                            fontStyle:  showingDefault ? 'italic' : 'normal',
                          }}
                        >
                          {!selected && <option value="">— pick —</option>}
                          {kbValues.map(v => (
                            <option key={v} value={v}>
                              {v}
                              {showingDefault && v === pendingDefault ? ' (default)' : ''}
                            </option>
                          ))}
                          {hasValue && !kbValues.includes(String(r.value)) && (
                            <option value={String(r.value)}>{String(r.value)} (stale)</option>
                          )}
                        </select>
                      );
                    })() : hasValue ? (
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
        <span className={styles.sectionTitle}>Live enum lookups</span>
        <span className={styles.sectionCount}>
          {hits.length} {hits.length === 1 ? 'hit' : 'hits'}
        </span>
      </header>
      {hits.length === 0 ? (
        <div className={styles.sectionEmpty}>
          No enum-typed field has a live value that matches a declared
          value on its enum. {`{{dc:FIELD…}}`} tokens for those fields
          would resolve to empty right now.
        </div>
      ) : (
        hits.map(hit => <DcCard key={`${hit.enumDef.id}/${hit.fieldName}`} hit={hit} />)
      )}
    </section>
  );
}

function DcCard({ hit }: { hit: BrainDcHit }) {
  const { expandedBodies, toggleBody } = useBrain();
  const keyPrefix = `${hit.enumDef.id}/${hit.fieldName}`;
  const isExpanded = (key: string) => expandedBodies.has(`${keyPrefix}/${key}`);
  const toggle = (key: string) => toggleBody(`${keyPrefix}/${key}`);

  return (
    <article className={styles.dcCard}>
      <header className={styles.dcHeader}>
        <span className={styles.dcHeaderGlyph} aria-hidden>🎯</span>
        <span className={styles.dcHeaderField}>{hit.fieldName}</span>
        <span className={styles.dcHeaderOp}>=</span>
        <span className={styles.dcHeaderValue}>{hit.liveValue}</span>
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
              emptyHint={`no body for "${hit.matched!.value.value}"`}
            />
          ))}
        </>
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

/* ─────────────────────── THINKING SECTION ─────────────────────── */

/** Long-form plans the Thinker addon writes per turn. Hidden when
 *  there's no data (runtime view — no point rendering empty chrome).
 *  In the fullscreen 2-column grid this section is configured via
 *  `.thinkingSpan` to span both columns so its multi-line text gets
 *  full width. */
function ThinkingSection({ cards }: { cards: BrainThinkingCard[] }) {
  if (cards.length === 0) return null;
  return (
    <section className={`${styles.section} ${styles.thinkingSpan}`}>
      <header className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>💭 Thinking</span>
        <span className={styles.sectionCount}>
          {cards.length} {cards.length === 1 ? 'bucket' : 'buckets'}
        </span>
      </header>
      <div className={styles.thinkingCards}>
        {cards.map(card => (
          <article key={card.domain} className={styles.thinkingCard}>
            <header className={styles.thinkingCardHeader}>{card.domain}</header>
            <dl className={styles.thinkingEntries}>
              {card.entries.map(e => (
                <div key={e.field} className={styles.thinkingEntry}>
                  <dt className={styles.thinkingEntryLabel}>{e.field}</dt>
                  <dd className={styles.thinkingEntryValue}>{formatThinkingValue(e.value)}</dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}

/** Multi-line tolerant — strings render raw (white-space: pre-wrap on
 *  the dd handles wrapping); non-strings JSON-stringify so structured
 *  thoughts stay legible. */
function formatThinkingValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'string') return v;
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}

/** Summarizer section — one card per slot in `brain.summary`. Each
 *  card shows the slot name, the watermark + last-fired timestamp,
 *  and the current text. We reuse the thinking-card layout (same
 *  visual scale, same "block of authored prose under a labelled
 *  header") because a summarizer slot IS conceptually a thinking
 *  bucket — just one written by an offline-lane addon and rolling
 *  by name instead of by domain. */
function SummarizerSection({ cards }: { cards: BrainSummarizerCard[] }) {
  if (cards.length === 0) return null;
  return (
    <section className={`${styles.section} ${styles.thinkingSpan}`}>
      <header className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>📝 Summaries</span>
        <span className={styles.sectionCount}>
          {cards.length} {cards.length === 1 ? 'slot' : 'slots'}
        </span>
      </header>
      <div className={styles.thinkingCards}>
        {cards.map(card => (
          <article key={card.name} className={styles.thinkingCard}>
            <header className={styles.thinkingCardHeader}>
              {card.name}
              <span style={{ float: 'right', fontSize: 10, opacity: 0.6, fontWeight: 500 }}>
                {formatSummaryMeta(card)}
              </span>
            </header>
            <div className={styles.thinkingEntryValue} style={{ padding: '8px 12px', whiteSpace: 'pre-wrap' }}>
              {card.text || '(empty — the addon ran but had nothing to write)'}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

/** Knowledge section — one card per live `{{kb:NAME}}` slot. Ephemeral:
 *  the KB Retriever replaces/clears these every turn it runs, so the
 *  panel shows exactly what each token would inject right now. Reuses
 *  the thinking-card layout (labelled header + prose block) since a KB
 *  slot is conceptually the same shape — a named block of injected text.
 *  Hidden when no retriever has written a slot yet. */
function KnowledgeSection({ slots }: { slots: BrainKbSlot[] }) {
  if (slots.length === 0) return null;
  return (
    <section className={`${styles.section} ${styles.thinkingSpan}`}>
      <header className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>📚 Knowledge</span>
        <span className={styles.sectionCount}>
          {slots.length} {slots.length === 1 ? 'slot' : 'slots'}
        </span>
      </header>
      <div className={styles.thinkingCards}>
        {slots.map(slot => (
          <article key={slot.name} className={styles.thinkingCard}>
            <header className={styles.thinkingCardHeader}>
              {slot.name}
              <span style={{ float: 'right', fontSize: 10, opacity: 0.6, fontWeight: 500 }}>
                {slot.text.length} chars
              </span>
            </header>
            <div className={styles.thinkingEntryValue} style={{ padding: '8px 12px', whiteSpace: 'pre-wrap', maxHeight: 220, overflow: 'auto' }}>
              {slot.text}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

/** "watermark 42 · 12s ago" — minimal meta line on the summarizer
 *  card. Watermark = highest message id consumed; ranAt-derived
 *  relative time tells the author how fresh the checkpoint is. */
function formatSummaryMeta(card: BrainSummarizerCard): string {
  const wm = `watermark ${card.watermark || 0}`;
  if (!card.ranAt) return wm;
  const ageMs = Date.now() - card.ranAt;
  if (ageMs < 0) return wm;
  const s = Math.floor(ageMs / 1000);
  if (s < 60)       return `${wm} · ${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60)       return `${wm} · ${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)       return `${wm} · ${h}h ago`;
  return `${wm} · ${Math.floor(h / 24)}d ago`;
}
