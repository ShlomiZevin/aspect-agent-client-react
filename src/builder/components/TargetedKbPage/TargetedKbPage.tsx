/**
 * Targeted KB — the full-screen page (task #830, redesign of #863's screen).
 *
 * Route: /:agent/builder/targeted-kb[/:kb[/:value]] with query
 *   ?tab=~umbrella|<section>   one text of the value (none = all of them)
 *   ?view=whole                the whole KB as one document
 *   ?list=choices              the Choices side of the tree
 *
 * Layout: the builder's own top bar (← goes back to the builder; "Save all"
 * stays one click away), a tree on the left, and one centred workspace:
 *
 *   KB header      name · kind/folder/counts · [One value | Whole KB] [Notes] [⋯]
 *   Values         value buttons + "+ Add value"
 *   ─ no value picked → an overview grid: which texts each value has
 *   ─ a value picked  → its bar (On/Off, ⋯) + text tabs + readable cards
 *
 * The three kinds of text are told apart everywhere, tree and tabs alike:
 * "All texts" is a VIEW (not a text), ☂ Umbrella is the value's main text,
 * 📄 sections are the named extras. Rarely used actions (rename, move,
 * delete) live in ⋯ menus, not as scattered links.
 *
 * Built next to the old screen (/enums), which stays until this one is
 * approved. Client-only; same data. Nothing shifts on click: menus float,
 * the switch has a fixed width.
 */

import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useBuilder } from '../../state/BuilderContext';
import { useAutoSave } from '../../hooks/useAutoSave';
import { TopBar } from '../TopBar/TopBar';
import { Modal } from '../Modal/Modal';
import { useMentionOptions } from '../MentionTextarea/useMentionOptions';
import { TkbNotes } from '../DynamicContextScreen/TkbNotes';
import type { EnumTypeDef, EnumValueDef } from '../../types';
import { TkbTree, ALL_TAB, UMBRELLA_TAB } from './TkbTree';
import { TextCard } from './TextCard';
import { MoreMenu, Switch } from './MoreMenu';
import { useTkbActions } from './useTkbActions';
import layoutStyles from '../BuilderLayout/BuilderLayout.module.css';
import styles from './TargetedKbPage.module.css';

type Dialog =
  | { kind: 'renameKb' }
  | { kind: 'folder' }
  | { kind: 'notes' }
  | { kind: 'renameValue'; value: EnumValueDef }
  | { kind: 'renameSection'; section: string };

const UMBRELLA_HINT = "Umbrella — the value's main text. {{targetedkb:KB=value}} brings it into a prompt.";
const SECTION_HINT = (s: string) => `Section "${s}" — an extra text each value can have. {{targetedkb:KB=value:${s}}} brings just this one.`;

export function TargetedKbPage() {
  useAutoSave();
  const navigate = useNavigate();
  const location = useLocation();
  const [search] = useSearchParams();
  const { doc } = useBuilder();
  const agent = doc.agents[0];
  const slug = agent?.slug ?? '';
  const actions = useTkbActions();
  const enums = actions.enums;
  const mentionOptions = useMentionOptions(agent?.id ?? '');

  // ── Where we are (path after /targeted-kb, then the query) ──
  const base = `/${slug}/builder/targeted-kb`;
  const rest = (location.pathname.split('/targeted-kb')[1] ?? '').split('/').filter(Boolean)
    .map(p => { try { return decodeURIComponent(p); } catch { return p; } });
  const activeEnum = enums.find(e => e.name === rest[0]) ?? null;
  const owned = !!activeEnum?.ownedByFieldId;
  const activeValue = activeEnum?.values.find(v => v.value === rest[1]) ?? null;
  const sections = useMemo(() => (activeEnum?.sections ?? []).map(s => s.name), [activeEnum]);
  const rawTab = search.get('tab') || ALL_TAB;
  const tab = rawTab === UMBRELLA_TAB || sections.includes(rawTab) ? rawTab : ALL_TAB;
  const whole = search.get('view') === 'whole' && !!activeEnum && !owned;
  const listMode: 'kb' | 'choice' = activeEnum
    ? (owned ? 'choice' : 'kb')
    : (search.get('list') === 'choices' ? 'choice' : 'kb');

  const url = (kb?: string, value?: string, q: Record<string, string> = {}) => {
    const path = [base, kb, value].filter(Boolean).map((p, i) => (i === 0 ? p : encodeURIComponent(p as string))).join('/');
    const qs = new URLSearchParams(q).toString();
    return qs ? `${path}?${qs}` : path;
  };
  const go = (kb?: string, value?: string, q: Record<string, string> = {}) => navigate(url(kb, value, q));
  const tabQ = (t: string): Record<string, string> => (t === ALL_TAB ? {} : { tab: t });

  // Editing belongs to the view it started in — moving anywhere else
  // returns every card to reading.
  const viewKey = `${activeEnum?.id}|${activeValue?.id}|${tab}|${whole}`;
  const [editing, setEditing] = useState<{ view: string; key: string } | null>(null);
  const editingKey = editing?.view === viewKey ? editing.key : null;
  const setEditingKey = (key: string | null) => setEditing(key ? { view: viewKey, key } : null);
  const [dialog, setDialog] = useState<Dialog | null>(null);

  const ownedField = owned ? agent?.fields.find(f => f.id === activeEnum?.ownedByFieldId) ?? null : null;
  const folderOptions = useMemo(
    () => Array.from(new Set(enums.map(e => (e.folder ?? '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [enums],
  );

  if (!agent) return null;

  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // ── One text card ──
  const card = (e: EnumTypeDef, v: EnumValueDef, t: string, anchor?: string, variant: 'card' | 'doc' = 'card') => {
    const key = `${v.id}:${t}`;
    const isUmbrella = t === UMBRELLA_TAB;
    return (
      <TextCard
        key={key}
        id={anchor}
        variant={variant}
        kind={isUmbrella ? 'umbrella' : 'section'}
        label={isUmbrella ? 'Umbrella' : t}
        hint={isUmbrella ? UMBRELLA_HINT : SECTION_HINT(t)}
        text={isUmbrella ? (v.umbrellaText ?? '') : (v.sectionTexts?.[t] ?? '')}
        onChange={next => (isUmbrella ? actions.setUmbrella(e, v.id, next) : actions.setSectionText(e, v.id, t, next))}
        mentionOptions={mentionOptions}
        editing={editingKey === key}
        onEditingChange={on => setEditingKey(on ? key : null)}
        storageKey={`tkb:${e.id}:${isUmbrella ? 'umbrella' : t}`}
        menu={isUmbrella ? undefined : (
          <MoreMenu title="Section actions" items={[
            { label: 'Rename section…', onClick: () => setDialog({ kind: 'renameSection', section: t }) },
            {
              label: 'Delete section', danger: true, divider: true,
              onClick: async () => { if (await actions.deleteSection(e, t) && tab === t) go(e.name, v.value); },
            },
          ]} />
        )}
      />
    );
  };

  const filled = (v: EnumValueDef, t: string) =>
    !!(t === UMBRELLA_TAB ? v.umbrellaText : v.sectionTexts?.[t])?.trim();

  return (
    <div className={layoutStyles.root}>
      <div className={layoutStyles.topBar}>
        <TopBar back={{ to: `/${slug}/builder`, title: 'Back to the builder' }} place="Targeted KB" />
      </div>
      <div className={styles.page}>
        <TkbTree
          agentId={agent.id}
          enums={enums}
          listMode={listMode}
          onListMode={m => { if (m !== listMode) go(undefined, undefined, m === 'choice' ? { list: 'choices' } : {}); }}
          activeEnumId={activeEnum?.id ?? null}
          activeValueId={whole ? null : activeValue?.id ?? null}
          activeTab={tab}
          onPickKb={e => go(e.name, undefined, whole && e.id === activeEnum?.id ? { view: 'whole' } : {})}
          onPickValue={(e, id) => {
            const v = e.values.find(x => x.id === id);
            if (!v) return;
            if (whole) { jump(`tkb-${v.id}`); return; }
            go(e.name, v.value);
          }}
          onPickTab={(e, id, t) => {
            const v = e.values.find(x => x.id === id);
            if (!v) return;
            if (whole) { jump(`tkb-${v.id}-${t}`); return; }
            go(e.name, v.value, tabQ(t));
          }}
          onNewKb={() => { const name = actions.createKb(); go(name); }}
          toc={whole}
        />

        <main className={styles.main}>
          <div className={`${styles.content} ${owned ? styles.contentNarrow : ''}`}>
            {!activeEnum ? (
              <div className={styles.emptyPage}>
                <h2>{listMode === 'choice' ? 'Choice lists' : 'Targeted KB'}</h2>
                <p>{listMode === 'choice'
                  ? 'Pick a list on the left. Each one belongs to a field with a fixed list of values.'
                  : 'Knowledge the agent pulls in by value. Pick one on the left, or create one.'}</p>
                {listMode === 'kb' && (
                  <div className={styles.legend}>
                    <span className={styles.legendItem}><b>▤</b> Targeted KB</span>
                    <span className={styles.legendArrow}>→</span>
                    <span className={styles.legendItem}><b>🏷️</b> its values</span>
                    <span className={styles.legendArrow}>→</span>
                    <span className={`${styles.legendItem} ${styles.legendUmbrella}`}><b>☂</b> Umbrella</span>
                    <span className={styles.legendPlus}>+</span>
                    <span className={styles.legendItem}><b>📄</b> sections</span>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* ── KB header ── */}
                <header className={styles.kbHead}>
                  <div className={styles.kbTitleBlock}>
                    <h1 className={styles.kbTitle} title={activeEnum.name}>
                      <span className={styles.kbTitleIcon} aria-hidden>{owned ? '☰' : '▤'}</span>
                      {activeEnum.name}
                    </h1>
                    <div className={styles.kbMeta}>
                      {owned ? (
                        <>
                          <span className={styles.badge}>Choice list</span>
                          {ownedField && (
                            <span>of the field <Link to={`/${slug}/builder/fields/${encodeURIComponent(ownedField.name)}`}>{ownedField.name}</Link></span>
                          )}
                        </>
                      ) : (
                        <>
                          <span className={styles.badge}>Targeted KB</span>
                          <button type="button" className={styles.metaBtn} onClick={() => setDialog({ kind: 'folder' })} title="Move to a folder">
                            📁 {activeEnum.folder || 'No folder'}
                          </button>
                          <span>{activeEnum.values.length} values · {sections.length} sections</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className={styles.kbActions}>
                    {!owned && (
                      <>
                        <div className={styles.viewSeg} role="tablist" aria-label="View">
                          <button type="button" role="tab" aria-selected={!whole}
                            className={`${styles.viewSegBtn} ${!whole ? styles.viewSegOn : ''}`}
                            onClick={() => { if (whole) go(activeEnum.name); }}>By value</button>
                          <button type="button" role="tab" aria-selected={whole}
                            className={`${styles.viewSegBtn} ${whole ? styles.viewSegOn : ''}`}
                            onClick={() => { if (!whole) go(activeEnum.name, undefined, { view: 'whole' }); }}
                            title="The whole KB as one document">Whole KB</button>
                        </div>
                        <button type="button" className={styles.btn} onClick={() => setDialog({ kind: 'notes' })}
                          title="Your notes and source files — never sent to the agent">📝 Notes &amp; files</button>
                      </>
                    )}
                    <MoreMenu title={owned ? 'List actions' : 'KB actions'} items={owned ? [
                      {
                        label: 'Delete list', danger: true,
                        onClick: async () => { if (await actions.deleteKb(activeEnum)) go(undefined, undefined, { list: 'choices' }); },
                      },
                    ] : [
                      { label: 'Rename…', onClick: () => setDialog({ kind: 'renameKb' }) },
                      { label: 'Move to folder…', onClick: () => setDialog({ kind: 'folder' }) },
                      {
                        label: 'Delete Targeted KB', danger: true, divider: true,
                        onClick: async () => { if (await actions.deleteKb(activeEnum)) go(); },
                      },
                    ]} />
                  </div>
                </header>

                {owned ? (
                  <ChoiceValues e={activeEnum} actions={actions} onRename={v => setDialog({ kind: 'renameValue', value: v })} />
                ) : whole ? (
                  /* ── The whole KB as one document — the agent's bible ── */
                  <div className={styles.paper}>
                    {activeEnum.values.length === 0 && <p className={styles.emptyText}>No values yet.</p>}
                    {activeEnum.values.map(v => (
                      <article key={v.id} id={`tkb-${v.id}`} className={`${styles.docValue} ${v.enabled === false ? styles.docOff : ''}`}>
                        <h2 className={styles.docValueTitle}>
                          <span className={styles.valueIcon} aria-hidden>🏷️</span>
                          {v.value}
                          {v.enabled === false && <span className={styles.offTag}>Off — never reaches a prompt</span>}
                        </h2>
                        {[UMBRELLA_TAB, ...sections].map(t => card(activeEnum, v, t, `tkb-${v.id}-${t}`, 'doc'))}
                      </article>
                    ))}
                  </div>
                ) : (
                  <>
                    {/* ── Values ── */}
                    <div className={styles.blockLabel}>Values</div>
                    <div className={styles.valueRow}>
                      {activeEnum.values.map(v => (
                        <button key={v.id} type="button"
                          className={`${styles.valuePill} ${v.id === activeValue?.id ? styles.valueOn : ''} ${v.enabled === false ? styles.valueOff : ''}`}
                          onClick={() => (v.id === activeValue?.id ? go(activeEnum.name) : go(activeEnum.name, v.value, tabQ(tab)))}
                          title={v.id === activeValue?.id ? 'Back to the overview' : v.enabled === false ? `${v.value} — switched off` : v.value}>
                          {v.value}
                        </button>
                      ))}
                      <button type="button" className={styles.addPill}
                        onClick={() => { const name = actions.addValue(activeEnum); go(activeEnum.name, name); }}>+ Add value</button>
                    </div>

                    {!activeValue ? (
                      /* ── Overview: which texts each value has ── */
                      activeEnum.values.length === 0 ? (
                        <p className={styles.emptyText}>No values yet — add the first one above.</p>
                      ) : (
                        <section className={styles.overview}>
                          <div className={styles.overviewHead}>
                            <span className={styles.blockLabel}>Overview</span>
                            <span className={styles.overviewHint}>Pick a value — or click a cell to open that text.</span>
                            <span className={styles.flex} />
                            <button type="button" className={styles.btnSmall}
                              onClick={() => { const name = actions.addSection(activeEnum); go(activeEnum.name, activeEnum.values[0].value, { tab: name }); }}>
                              + Section
                            </button>
                          </div>
                          <div className={styles.gridScroll}>
                            <table className={styles.grid}>
                              <thead>
                                <tr>
                                  <th className={styles.gridValueCol}>Value</th>
                                  <th className={styles.gridUmbrella} title={UMBRELLA_HINT}>☂ Umbrella</th>
                                  {sections.map(s => <th key={s} title={SECTION_HINT(s)}>📄 {s}</th>)}
                                </tr>
                              </thead>
                              <tbody>
                                {activeEnum.values.map(v => (
                                  <tr key={v.id} className={v.enabled === false ? styles.valueOff : ''}>
                                    <td className={styles.gridValueCol}>
                                      <button type="button" className={styles.gridValueBtn} onClick={() => go(activeEnum.name, v.value)}>
                                        <span aria-hidden>🏷️</span>{v.value}
                                      </button>
                                    </td>
                                    {[UMBRELLA_TAB, ...sections].map(t => (
                                      <td key={t} className={t === UMBRELLA_TAB ? styles.gridUmbrella : ''}>
                                        <button type="button" className={`${styles.cell} ${filled(v, t) ? styles.cellFilled : ''}`}
                                          onClick={() => go(activeEnum.name, v.value, tabQ(t))}
                                          title={filled(v, t) ? 'Written — open it' : 'Empty — write it'}>
                                          {filled(v, t) ? '✓' : '—'}
                                        </button>
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </section>
                      )
                    ) : (
                      <section className={styles.valuePanel}>
                        {/* ── The selected value ── */}
                        <div className={styles.valueBar}>
                          <h2 className={styles.valueName}>
                            <span className={styles.valueIcon} aria-hidden>🏷️</span>
                            {activeValue.value}
                          </h2>
                          <span className={styles.flex} />
                          <Switch on={activeValue.enabled !== false} onToggle={() => actions.toggleValue(activeEnum, activeValue)}
                            title="A switched-off value stays here but never reaches a prompt" />
                          <MoreMenu title="Value actions" items={[
                            { label: 'Rename value…', onClick: () => setDialog({ kind: 'renameValue', value: activeValue }) },
                            {
                              label: 'Delete value', danger: true, divider: true,
                              onClick: async () => { if (await actions.deleteValue(activeEnum, activeValue)) go(activeEnum.name); },
                            },
                          ]} />
                        </div>

                        {/* ── Which text: All (a view) | ☂ Umbrella | 📄 sections ── */}
                        <div role="tablist" className={styles.tabs}>
                          <button type="button" role="tab" aria-selected={tab === ALL_TAB}
                            className={`${styles.tab} ${styles.tabAll} ${tab === ALL_TAB ? styles.tabOn : ''}`}
                            onClick={() => go(activeEnum.name, activeValue.value)} title="Show every text of this value">
                            All texts
                          </button>
                          <span className={styles.tabSep} aria-hidden />
                          <button type="button" role="tab" aria-selected={tab === UMBRELLA_TAB}
                            className={`${styles.tab} ${styles.tabUmbrella} ${tab === UMBRELLA_TAB ? styles.tabOn : ''}`}
                            onClick={() => go(activeEnum.name, activeValue.value, { tab: UMBRELLA_TAB })} title={UMBRELLA_HINT}>
                            <span className={styles.tabIcon} aria-hidden>☂</span> Umbrella
                          </button>
                          <span className={styles.tabSep} aria-hidden />
                          {sections.map(s => (
                            <button key={s} type="button" role="tab" aria-selected={tab === s}
                              className={`${styles.tab} ${tab === s ? styles.tabOn : ''}`}
                              onClick={() => go(activeEnum.name, activeValue.value, { tab: s })} title={SECTION_HINT(s)}>
                              <span className={`${styles.tabIcon} ${filled(activeValue, s) ? '' : styles.tabIconEmpty}`} aria-hidden>📄</span> {s}
                            </button>
                          ))}
                          <button type="button" className={styles.tabAdd} title="Add a section to every value of this KB"
                            onClick={() => { const name = actions.addSection(activeEnum); go(activeEnum.name, activeValue.value, { tab: name }); }}>
                            + Section
                          </button>
                        </div>

                        <div className={styles.cards}>
                          {(tab === ALL_TAB ? [UMBRELLA_TAB, ...sections] : [tab]).map(t => card(activeEnum, activeValue, t))}
                        </div>
                      </section>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {/* ── Dialogs ── */}
      {activeEnum && dialog?.kind === 'notes' && (
        <Modal open onClose={() => setDialog(null)} title={<>📝 Notes &amp; files — {activeEnum.name}</>} width={680}>
          <TkbNotes agentId={agent.id} enumId={activeEnum.id} />
        </Modal>
      )}
      {activeEnum && dialog && dialog.kind !== 'notes' && (
        <NameDialog
          title={dialog.kind === 'renameKb' ? 'Rename Targeted KB'
            : dialog.kind === 'folder' ? 'Move to folder'
              : dialog.kind === 'renameValue' ? 'Rename value' : 'Rename section'}
          hint={dialog.kind === 'folder'
            ? 'Groups KBs in the tree — only for your view. Leave empty for no folder.'
            : dialog.kind === 'renameKb' ? 'Prompts that use this KB are updated to the new name.'
              : dialog.kind === 'renameSection' ? 'Prompts that use this section are updated to the new name.'
                : undefined}
          initial={dialog.kind === 'renameKb' ? activeEnum.name
            : dialog.kind === 'folder' ? (activeEnum.folder ?? '')
              : dialog.kind === 'renameValue' ? dialog.value.value : dialog.section}
          options={dialog.kind === 'folder' ? folderOptions : undefined}
          allowEmpty={dialog.kind === 'folder'}
          onClose={() => setDialog(null)}
          onSave={raw => {
            const q = Object.fromEntries(search);
            if (dialog.kind === 'folder') { actions.setFolder(activeEnum, raw); return true; }
            if (dialog.kind === 'renameKb') {
              const n = actions.renameKb(activeEnum, raw);
              if (n) go(n, activeValue?.value, q);
              return !!n;
            }
            if (dialog.kind === 'renameValue') {
              const n = actions.renameValue(activeEnum, dialog.value, raw);
              if (n && dialog.value.id === activeValue?.id) go(activeEnum.name, n, q);
              return !!n;
            }
            const n = actions.renameSection(activeEnum, dialog.section, raw);
            if (n && activeValue && tab === dialog.section) go(activeEnum.name, activeValue.value, { tab: n });
            return !!n;
          }}
        />
      )}
    </div>
  );
}

/** A choice list: just its values — on/off, rename, delete, add. */
function ChoiceValues({ e, actions, onRename }: {
  e: EnumTypeDef;
  actions: ReturnType<typeof useTkbActions>;
  onRename: (v: EnumValueDef) => void;
}) {
  return (
    <section className={styles.choiceCard}>
      <div className={styles.choiceHead}>
        <span className={styles.blockLabel}>Values</span>
        <span className={styles.choiceCount}>{e.values.length}</span>
      </div>
      <ul className={styles.choiceList}>
        {e.values.map(v => (
          <li key={v.id} className={styles.choiceRow}>
            <span className={`${styles.choiceName} ${v.enabled === false ? styles.valueOff : ''}`}>{v.value}</span>
            <Switch on={v.enabled !== false} onToggle={() => actions.toggleValue(e, v)}
              title="A switched-off value stays in the list but can't be chosen" />
            <MoreMenu title="Value actions" items={[
              { label: 'Rename…', onClick: () => onRename(v) },
              { label: 'Delete', danger: true, divider: true, onClick: () => { void actions.deleteValue(e, v); } },
            ]} />
          </li>
        ))}
        {e.values.length === 0 && <li className={styles.emptyText}>No values yet.</li>}
      </ul>
      <button type="button" className={styles.choiceAdd} onClick={() => actions.addValue(e)}>+ Add value</button>
    </section>
  );
}

/** Small name / folder dialog. Returns false from onSave to keep it open (name taken). */
function NameDialog({ title, hint, initial, options, allowEmpty, onClose, onSave }: {
  title: string;
  hint?: string;
  initial: string;
  options?: string[];
  allowEmpty?: boolean;
  onClose: () => void;
  onSave: (value: string) => boolean;
}) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState('');
  const submit = () => {
    if (!allowEmpty && !value.trim()) { setError('A name is needed.'); return; }
    if (onSave(value)) onClose();
    else setError('That name is already taken, or unchanged.');
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      width={460}
      footer={
        <>
          <span style={{ flex: 1 }} />
          <button type="button" className={styles.btn} onClick={onClose}>Cancel</button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={submit}>Save</button>
        </>
      }
    >
      <input
        className={styles.nameInput}
        value={value}
        autoFocus
        list={options ? 'tkb-folder-options' : undefined}
        onChange={e => { setValue(e.target.value); setError(''); }}
        onKeyDown={e => { if (e.key === 'Enter') submit(); }}
      />
      {options && (
        <datalist id="tkb-folder-options">{options.map(o => <option key={o} value={o} />)}</datalist>
      )}
      {/* Reserved line: hint, or the error in its place. */}
      <p className={error ? styles.dialogError : styles.dialogHint}>{error || hint || ' '}</p>
    </Modal>
  );
}
