/**
 * Crew map (task #855) — how a conversation can travel between crews,
 * drawn from the agent itself (see crewGraph.ts), read-only.
 *
 * Built for non-technical builders: its own full-width page, crews as
 * painted cards laid out top to bottom from the start crew (it scrolls
 * down, at full size), every move an arrow with its rule in plain words
 * and when it happens, problems listed beside the map. Clicking a crew
 * shows what brings a conversation in and where it can go next; "Edit"
 * opens the rule in the usual add-on modal.
 *
 * Layout math lives in crewLayout.ts, icons in crewIcons.tsx.
 * Design: lybi-website/art-source/ui/crew-map/ (options 4F + 1F + 3S).
 */

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useBuilder } from '../../state/BuilderContext';
import { useAutoSave } from '../../hooks/useAutoSave';
import { AddonModal } from '../AddonModal/AddonModal';
import { TopBar } from '../TopBar/TopBar';
import layoutStyles from '../BuilderLayout/BuilderLayout.module.css';
import type { CrewDoc, ID } from '../../types';
import { ANY_CREW, buildCrewMap, type CrewMove } from './crewGraph';
import { CARD_H, CARD_W, layoutCrewMap, moreText, timingText } from './crewLayout';
import { Icon, crewIconFor, type IconName } from './crewIcons';
import styles from './CrewMapScreen.module.css';

const FIT_FLOOR = 0.8;  // "Fit" never shrinks below this — the rules stay readable; the map scrolls instead

type Tint = 'green' | 'rose' | 'grey' | 'blue' | 'violet' | 'amber' | 'teal';
const CYCLE: Tint[] = ['blue', 'violet', 'amber', 'teal'];

function whenText(m: CrewMove): string {
  return m.when.length ? m.when.join(' and ') : 'always';
}

function TimingChip({ sameTurn, small }: { sameTurn: boolean; small?: boolean }) {
  return (
    <span
      className={`${styles.chip} ${sameTurn ? styles.chipNow : styles.chipNext} ${small ? styles.chipSmall : ''}`}
      title={sameTurn ? 'The new crew answers this same message' : 'The new crew answers from the next message'}
    >
      <Icon name={sameTurn ? 'bolt' : 'clock'} size={11} />
      {timingText(sameTurn)}
    </span>
  );
}

export function CrewMapScreen() {
  // A full-screen sibling of the builder shell (like Targeted KB), so it
  // saves rule edits made from here the same way the shell does.
  useAutoSave();
  const { doc, setSelection } = useBuilder();
  const navigate = useNavigate();
  const { agent: urlAgentSlug } = useParams<{ agent: string }>();
  const agent = doc.agents[0];

  const map = useMemo(() => (agent ? buildCrewMap(agent) : null), [agent]);
  // Zoomed out (a laptop), the rules are measured and drawn a little larger
  // so they stay readable; 1 at full size.
  const [boost, setBoost] = useState(1);
  const layout = useMemo(() => (map ? layoutCrewMap(map, boost) : null), [map, boost]);
  const [selectedId, setSelectedId] = useState<ID | null>(null);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ crewId: ID | null; instanceId: ID } | null>(null);
  // Zoom: null = fit the map to the space it has (the default); a number
  // = the builder picked a size with − / +.
  const [zoom, setZoom] = useState<number | null>(null);
  const [wrapEl, setWrapEl] = useState<HTMLDivElement | null>(null);
  const [wrapW, setWrapW] = useState(0);
  useEffect(() => {
    if (!wrapEl) return;
    const ro = new ResizeObserver(([e]) => setWrapW(e.contentRect.width));
    ro.observe(wrapEl);
    return () => ro.disconnect();
  }, [wrapEl]);

  // Each crew's look: start green, last stops rose, never reached grey,
  // the rest take turns through four soft tints.
  const look = useMemo(() => {
    const out = new Map<ID, { tint: Tint; icon: IconName }>();
    if (!map) return out;
    let k = 0;
    map.crews.forEach((c, i) => {
      const never = !map.depth.has(c.id);
      const tint: Tint = c.id === map.startId ? 'green'
        : never ? 'grey'
        : map.noWayOut.includes(c.id) ? 'rose'
        : CYCLE[k++ % CYCLE.length];
      out.set(c.id, { tint, icon: never ? 'lock' : crewIconFor(c.name, i) });
    });
    return out;
  }, [map]);

  // When the map is wider than its pane, open it with the start crew in view (centred).
  const startX = map && layout && map.startId ? (layout.pos.get(map.startId)?.x ?? 0) : 0;
  const scaleNow = zoom ?? (wrapW && layout ? Math.max(FIT_FLOOR, Math.min(1, (wrapW - 2) / layout.width)) : 1);
  useEffect(() => {
    const want = Math.round(Math.min(1.2, Math.max(1, 1 / scaleNow)) * 20) / 20;
    if (want !== boost) setBoost(want);
  }, [scaleNow, boost]);
  useEffect(() => {
    if (!wrapEl || !layout) return;
    const over = layout.width * scaleNow - wrapEl.clientWidth;
    if (over > 0) wrapEl.scrollLeft = Math.max(0, Math.min(over, (startX + CARD_W / 2) * scaleNow - wrapEl.clientWidth / 2));
  }, [wrapEl, layout, scaleNow, startX]);

  if (!agent || !map || !layout) return null;

  const crewById = new Map(map.crews.map(c => [c.id, c]));
  const nameOf = (id: ID) => (id === ANY_CREW ? 'Any crew' : crewById.get(id)?.name ?? 'a deleted crew');
  const anyTargets = new Set(map.moves.filter(m => m.from === ANY_CREW && m.toExists).map(m => m.to));
  const selected = selectedId ? crewById.get(selectedId) ?? null : null;
  const incoming = selected ? map.moves.filter(m => m.to === selected.id && m.from !== selected.id) : [];
  const outgoing = selected ? map.moves.filter(m => m.from === selected.id && m.to !== selected.id) : [];
  const issueCount = map.unreachable.length + map.brokenMoves.length;
  const fit = wrapW ? Math.max(FIT_FLOOR, Math.min(1, (wrapW - 2) / layout.width)) : 1;
  const scale = zoom ?? fit;
  // Fits with room to spare: centre the spine (the start crew), as far as the room allows.
  const spare = wrapW - layout.width * scale;
  const offsetX = spare > 0 ? Math.max(0, Math.min(spare, wrapW / 2 - layout.axis * scale)) : 0;
  const zoomBy = (step: number) => setZoom(Math.round(Math.max(0.4, Math.min(1.5, scale + step)) * 10) / 10);
  const isNever = (id: ID) => !map.depth.has(id);
  const tintOf = (id: ID): Tint => look.get(id)?.tint ?? 'blue';

  const editingInstance = editing
    ? (editing.crewId ? crewById.get(editing.crewId)?.addons : agent.cortex)?.find(a => a.instanceId === editing.instanceId) ?? null
    : null;

  const openCrew = (crewId: ID) => {
    setSelection({ level: 'crew', agentId: agent.id, crewId });
    if (urlAgentSlug) navigate(`/${urlAgentSlug}/builder`);
  };

  const roleText = (id: ID) => {
    if (id === map.startId) return 'Start crew';
    if (isNever(id)) return 'Never reached';
    if (map.noWayOut.includes(id)) return 'Last stop';
    return 'Crew';
  };

  /** The line under the crew's name when it has no description: where it leads next. */
  const fallbackDesc = (c: CrewDoc): ReactNode => {
    const outs = [...new Set(map.moves.filter(m => m.from === c.id && m.toExists && m.to !== c.id).map(m => m.to))];
    if (!outs.length) {
      return isNever(c.id)
        ? <><span className={styles.descTag}>Alone</span>No moves in or out</>
        : <><span className={`${styles.descTag} ${styles.descTagEnd}`}>End</span>The conversation ends here</>;
    }
    // "+N more" stays on the line of the name before it.
    const names = outs.slice(0, 2).map(nameOf);
    const text = outs.length > 2 ? `${names.join(', ')}\u00a0+${outs.length - 2}\u00a0more` : names.join(' or ');
    return <><span className={styles.descTag}>Next</span>{text}</>;
  };

  const crewIcon = (id: ID, size = 18) => (
    <span className={`${styles.icon} ${styles[`t_${tintOf(id)}`]}`}>
      <Icon name={look.get(id)?.icon ?? 'sparkle'} size={size} />
    </span>
  );

  const moveRow = (m: CrewMove, other: 'from' | 'to') => {
    const otherId = m[other];
    const deleted = other === 'to' && !m.toExists;
    return (
      <li key={m.id} className={styles.move}>
        <div className={styles.moveHead}>
          {deleted
            ? <span className={styles.moveBroken}><Icon name="warning" size={15} /> a crew that was deleted</span>
            : (
              <button
                type="button"
                className={styles.moveCrew}
                onClick={() => setSelectedId(otherId === ANY_CREW ? selectedId : otherId)}
                disabled={otherId === ANY_CREW}
              >
                {otherId !== ANY_CREW && crewIcon(otherId, 14)}
                <span>{nameOf(otherId)}</span>
              </button>
            )}
          <TimingChip sameTurn={m.sameTurn} small />
        </div>
        <div className={styles.moveWhen}><span className={styles.whenWord}>When</span> {whenText(m)}</div>
        <button
          type="button"
          className={styles.linkBtn}
          onClick={() => setEditing({ crewId: m.source.crewId, instanceId: m.source.instanceId })}
          title={`Opens ${m.source.label}`}
        >
          <Icon name="pencil" size={13} /> Edit {m.source.label}
        </button>
      </li>
    );
  };

  const markers: [string, string][] = [
    ['now', '#4c63d2'], ['next', '#d08a16'], ['grey', '#a5aebb'], ['nowOn', '#2f45b5'], ['nextOn', '#b06f05'],
  ];

  return (
    <div className={layoutStyles.root}>
      <div className={layoutStyles.topBar}>
        <TopBar back={{ to: `/${urlAgentSlug ?? agent.slug}/builder`, title: 'Back to the builder' }} place="Crew map" />
      </div>
    <div className={styles.screen}>
      <div className={styles.head}>
        <div className={styles.titleBlock}>
          <span className={styles.titleIcon}><Icon name="compass" size={20} /></span>
          <div>
            <h1 className={styles.h1}>Crew map</h1>
            <p className={styles.sub}>How a conversation moves between {agent.name ? <b>{agent.name}</b> : 'the agent'}'s crews</p>
          </div>
        </div>
        <div className={styles.legend} aria-label="Legend">
          <span><i className={`${styles.lgDot} ${styles.t_green}`} /> Start</span>
          <span><i className={`${styles.lgDot} ${styles.t_blue}`} /> Crew</span>
          <span><i className={`${styles.lgDot} ${styles.t_rose}`} /> Last stop</span>
          <span><i className={`${styles.lgDot} ${styles.lgNever}`} /> Never reached</span>
          <span className={styles.lgSep} />
          <span>
            <svg width="30" height="10" aria-hidden><path d="M1 5 H22" stroke="#4c63d2" strokeWidth="2" /><path d="M21 1.5 L28 5 L21 8.5 L23 5 z" fill="#4c63d2" /></svg>
            Right away
          </span>
          <span>
            <svg width="30" height="10" aria-hidden><path d="M1 5 H22" stroke="#d08a16" strokeWidth="2" strokeDasharray="5 4" /><path d="M21 1.5 L28 5 L21 8.5 L23 5 z" fill="#d08a16" /></svg>
            Next message
          </span>
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.mapPane}>
          <div className={styles.canvasWrap} ref={setWrapEl} onClick={() => setSelectedId(null)}>
            <div style={{ width: layout.width * scale, height: layout.height * scale, marginLeft: offsetX }}>
            <div
              className={styles.canvas}
              style={{
                width: layout.width, height: layout.height, transform: `scale(${scale})`, transformOrigin: '0 0',
                '--lf': `${layout.metrics.textPx}px`, '--lh': `${layout.metrics.lineH}px`,
                '--cf': `${layout.metrics.chipPx}px`, '--ch': `${layout.metrics.chipH}px`, '--hf': `${layout.metrics.headPx}px`,
              } as CSSProperties}
            >
              {layout.band && (
                <div className={styles.band} style={{ left: layout.band.x, top: layout.band.y, width: layout.band.w, height: layout.band.h }}>
                  <span className={styles.bandTitle}><Icon name="lock" size={13} /> Never reached</span>
                  <span className={styles.bandSub}>No crew leads here</span>
                </div>
              )}

              <svg className={styles.edges} width={layout.width} height={layout.height} aria-hidden>
                <defs>
                  {markers.map(([id, color]) => (
                    <marker key={id} id={`cm-${id}`} viewBox="0 0 12 12" refX="10.5" refY="6" markerWidth="14" markerHeight="14" markerUnits="userSpaceOnUse" orient="auto">
                      <path d="M1 1.2 L11 6 L1 10.8 L3.6 6 z" fill={color} />
                    </marker>
                  ))}
                </defs>
                {layout.arrows.map(a => {
                  const on = (selectedId !== null && (a.from === selectedId || a.to === selectedId)) || hoverKey === a.key;
                  const dim = selectedId !== null && !on;
                  const next = a.moves.every(m => !m.sameTurn);
                  const grey = isNever(a.from);
                  const kind = grey ? 'grey' : next ? 'next' : 'now';
                  const marker = grey ? 'grey' : `${kind}${on ? 'On' : ''}`;
                  return (
                    <g key={a.key} className={`${styles.edgeG} ${on ? styles.edgeOn : ''} ${dim ? styles.edgeDim : ''}`}>
                      <path d={a.d} className={styles.halo} />
                      <path d={a.d} className={`${styles.edge} ${styles[`e_${kind}`]}`} markerEnd={`url(#cm-${marker})`} />
                    </g>
                  );
                })}
              </svg>

              {layout.arrows.map(a => {
                const on = (selectedId !== null && (a.from === selectedId || a.to === selectedId)) || hoverKey === a.key;
                const dim = selectedId !== null && !on;
                const grey = isNever(a.from);
                const more = moreText(a.moves);
                const box = a.label;
                return (
                  <button
                    key={a.key}
                    type="button"
                    className={`${styles.rule} ${on ? styles.ruleOn : ''} ${dim ? styles.ruleDim : ''} ${grey ? styles.ruleGrey : ''}`}
                    style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
                    title={`${nameOf(a.from)} → ${nameOf(a.to)}\n${a.moves.map(m => `When ${whenText(m)}`).join('\nor ')}`}
                    onClick={e => { e.stopPropagation(); setSelectedId(a.from); }}
                    onMouseEnter={() => setHoverKey(a.key)}
                    onMouseLeave={() => setHoverKey(k => (k === a.key ? null : k))}
                    onFocus={() => setHoverKey(a.key)}
                    onBlur={() => setHoverKey(k => (k === a.key ? null : k))}
                  >
                    {(() => {
                      const chips = (
                        <span className={styles.ruleChips}>
                          <TimingChip sameTurn={a.moves[0].sameTurn} />
                          {more && <span className={`${styles.chip} ${styles.chipMore}`}>{more}</span>}
                        </span>
                      );
                      const n = box.lines.length;
                      return (
                        <>
                          <span className={styles.ruleText}>
                            {box.head && <span className={`${styles.ruleHead} ${grey ? styles.ruleHeadGrey : a.moves.every(m => !m.sameTurn) ? styles.ruleHeadNext : ''}`}>{box.head}</span>}
                            {box.lines.map((ln, i) => (
                              <span key={i} className={styles.ruleLine}>
                                {ln}
                                {box.chipsInline && i === n - 1 && chips}
                              </span>
                            ))}
                          </span>
                          {!box.chipsInline && chips}
                        </>
                      );
                    })()}
                  </button>
                );
              })}

              {map.crews.map(c => {
                const p = layout.pos.get(c.id)!;
                const isStart = c.id === map.startId;
                const never = isNever(c.id);
                const lastStop = map.noWayOut.includes(c.id);
                const isSel = c.id === selectedId;
                const related = selectedId !== null && (isSel || [...incoming, ...outgoing].some(m => m.from === c.id || m.to === c.id));
                const desc = c.description?.trim();
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`${styles.card} ${styles[`t_${tintOf(c.id)}`]} ${never ? styles.cardNever : ''} ${isSel ? styles.cardSel : ''} ${selectedId && !related ? styles.cardDim : ''}`}
                    style={{ left: p.x, top: p.y, width: CARD_W, height: CARD_H } as CSSProperties}
                    onClick={e => { e.stopPropagation(); setSelectedId(isSel ? null : c.id); }}
                    onDoubleClick={() => openCrew(c.id)}
                    title="Click to see its moves · double-click to open the crew"
                  >
                    {isStart && (
                      <span className={`${styles.tabs} ${styles.tabsLeft}`}>
                        <span className={`${styles.tab} ${styles.tabStart}`}><Icon name="play" size={10} /> Start</span>
                      </span>
                    )}
                    {(lastStop || anyTargets.has(c.id)) && (
                      <span className={`${styles.tabs} ${styles.tabsBottom}`}>
                        {anyTargets.has(c.id) && <span className={`${styles.tab} ${styles.tabAny}`}>From any crew</span>}
                        {lastStop && <span className={`${styles.tab} ${styles.tabLast}`}><Icon name="flag" size={10} /> Last stop</span>}
                      </span>
                    )}
                    <span className={styles.cardTop}>
                      {crewIcon(c.id)}
                      <span className={styles.cardName} dir="auto">{c.name}</span>
                    </span>
                    {desc
                      ? <span className={styles.cardDesc} dir="auto">{desc}</span>
                      : <span className={`${styles.cardDesc} ${styles.cardDescAuto}`}>{fallbackDesc(c)}</span>}
                  </button>
                );
              })}
            </div>
            </div>
          </div>

          <div className={styles.zoom}>
            <button type="button" className={zoom === null ? styles.zoomOn : ''} onClick={() => setZoom(null)} title="Fit to width" aria-label="Fit to width">
              <Icon name="fit" size={15} />
            </button>
            <span className={styles.zoomSep} />
            <button type="button" onClick={() => zoomBy(-0.1)} aria-label="Zoom out">−</button>
            <span className={styles.zoomPct}>{Math.round(scale * 100)}%</span>
            <button type="button" onClick={() => zoomBy(0.1)} aria-label="Zoom in">+</button>
          </div>
        </div>

        <aside className={styles.panel}>
          <div className={styles.overview}>
            <div className={styles.overviewTitle}>Overview</div>
            <div className={styles.stats}>
              <div><b>{map.crews.length}</b><span>crews</span></div>
              <div><b>{map.moves.length}</b><span>moves</span></div>
              <div><b>{map.depth.size}</b><span>reachable</span></div>
              <div className={map.unreachable.length ? styles.statBad : ''}><b>{map.unreachable.length}</b><span>never reached</span></div>
            </div>
          </div>

          <div className={styles.panelBody}>
          {selected ? (
            <>
              <div className={styles.selHead}>
                <button type="button" className={styles.back} onClick={() => setSelectedId(null)} aria-label="Back to issues" title="Back to issues">
                  <Icon name="back" size={16} />
                </button>
                {crewIcon(selected.id, 20)}
                <div className={styles.selTitle}>
                  <h2 className={styles.h2} dir="auto">{selected.name}</h2>
                  <span className={`${styles.role} ${styles[`r_${tintOf(selected.id)}`]}`}>{roleText(selected.id)}</span>
                </div>
              </div>
              {selected.description?.trim() && <p className={styles.selDesc} dir="auto">{selected.description.trim()}</p>}
              <button type="button" className={styles.openBtn} onClick={() => openCrew(selected.id)}>
                Open crew <Icon name="chevron" size={14} />
              </button>

              <h3 className={styles.h3}><Icon name="arrowIn" size={14} /> Comes from <span className={styles.h3Count}>{incoming.length}</span></h3>
              {selected.id === map.startId && <p className={styles.noteGood}><Icon name="play" size={11} /> Every conversation starts here.</p>}
              {incoming.length ? <ul className={styles.moves}>{incoming.map(m => moveRow(m, 'from'))}</ul>
                : selected.id !== map.startId && <p className={styles.noteBad}><Icon name="warning" size={14} /> Nothing leads here. No conversation can reach this crew.</p>}

              <h3 className={styles.h3}><Icon name="arrowOut" size={14} /> Goes to <span className={styles.h3Count}>{outgoing.length}</span></h3>
              {outgoing.length ? <ul className={styles.moves}>{outgoing.map(m => moveRow(m, 'to'))}</ul>
                : <p className={styles.note}><Icon name="flag" size={13} /> Last stop. The conversation stays here.</p>}
            </>
          ) : (
            <>
              <h2 className={styles.h2}>
                <span className={styles.h2Icon}><Icon name="warning" size={16} /></span>
                Issues to fix
                {issueCount > 0 && <span className={styles.count}>{issueCount}</span>}
              </h2>
              {issueCount === 0 && <p className={styles.noteGood}><Icon name="check" size={14} /> Every crew can be reached.</p>}
              <ul className={styles.issues}>
                {map.unreachable.map(id => (
                  <li key={id}>
                    <button type="button" className={`${styles.issue} ${styles.issueBad}`} onClick={() => setSelectedId(id)}>
                      <span className={styles.issueIcon}><Icon name="lock" size={15} /></span>
                      <span className={styles.issueText}>
                        <b>{nameOf(id)}</b>
                        <span className={styles.issueWhat}>Can never be reached</span>
                        <span className={styles.issueWhy}>No crew leads here.</span>
                      </span>
                      <Icon name="chevron" size={16} className={styles.issueChevron} />
                    </button>
                  </li>
                ))}
                {map.brokenMoves.map(m => (
                  <li key={m.id}>
                    <button type="button" className={`${styles.issue} ${styles.issueBad}`} onClick={() => setEditing({ crewId: m.source.crewId, instanceId: m.source.instanceId })}>
                      <span className={styles.issueIcon}><Icon name="warning" size={15} /></span>
                      <span className={styles.issueText}>
                        <b>{nameOf(m.from)}</b>
                        <span className={styles.issueWhat}>Moves to a deleted crew</span>
                        <span className={styles.issueWhy}>{m.source.label}</span>
                      </span>
                      <Icon name="pencil" size={15} className={styles.issueChevron} />
                    </button>
                  </li>
                ))}
              </ul>

              {map.noWayOut.length > 0 && (
                <>
                  <h3 className={styles.h3} title="No next crew. Fine if the conversation should end there.">
                    <Icon name="flag" size={14} /> Last stops <span className={styles.h3Count}>{map.noWayOut.length}</span>
                  </h3>
                  <ul className={styles.issues}>
                    {map.noWayOut.map(id => (
                      <li key={id}>
                        <button type="button" className={`${styles.issue} ${styles.issueSlim}`} onClick={() => setSelectedId(id)} title="No next crew">
                          {crewIcon(id, 14)}
                          <span className={styles.issueText}>
                            <b>{nameOf(id)}</b>
                          </span>
                          <Icon name="chevron" size={16} className={styles.issueChevron} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <p className={styles.hint}><Icon name="bulb" size={16} /> Click a crew to see where conversations come from and go next.</p>
            </>
          )}
          </div>
        </aside>
      </div>

      <AddonModal
        open={editingInstance !== null}
        onClose={() => setEditing(null)}
        agentId={agent.id}
        crewId={editing?.crewId ?? null}
        instance={editingInstance}
      />
    </div>
    </div>
  );
}
