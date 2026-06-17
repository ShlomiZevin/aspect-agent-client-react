/**
 * PersonasScreen — agent-level multi-persona editor.
 *
 * Mirrors the Enum Bible page pattern (own route, list + editor, writes
 * straight through `updateAgent`). Each persona has a unique name, free
 * text content, and an `appliesTo` set of plugin ids (`'*'` = all
 * addons). The bare `{{persona}}` token in an addon resolves to the
 * concatenation of every persona applicable to that addon, in this
 * page's list order (drag the ▲▼ arrows to reorder). `{{persona:NAME}}`
 * pulls one specific persona.
 *
 *   URL routing
 *     /<agent>/builder/personas
 *     /<agent>/builder/personas/<name>
 */

import { useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useBuilder } from '../../state/BuilderContext';
import { useConfirm } from '../Confirm/Confirm';
import { MentionTextarea } from '../MentionTextarea/MentionTextarea';
import { useMentionOptions } from '../MentionTextarea/useMentionOptions';
import { listPlugins } from '../../registry/plugins';
import { sanitiseName } from '../DynamicContextScreen/helpers';
import type { ID, PersonaDef } from '../../types';
import styles from './PersonasScreen.module.css';

function newPersonaId(): ID {
  return `persona_${Math.random().toString(36).slice(2, 10)}`;
}

/** The "applies to" options: All addons (`'*'`) then every prompt-bearing
 *  plugin. Transition Router has no LLM prompt → excluded. */
function useAppliesToOptions(): Array<{ id: string; name: string; icon: string }> {
  return useMemo(() => {
    const plugins = listPlugins()
      .filter(p => p.id !== 'transition-router')
      .map(p => ({ id: p.id, name: p.name, icon: p.icon || '🔌' }));
    return [{ id: '*', name: 'All addons', icon: '✳️' }, ...plugins];
  }, []);
}

export function PersonasScreen() {
  const navigate = useNavigate();
  const { doc, updateAgent } = useBuilder();
  const confirm = useConfirm();
  const agent = doc.agents[0];
  const agentSlug = agent?.slug ?? '';
  const mentionOptions = useMentionOptions(agent?.id ?? '');
  const appliesToOptions = useAppliesToOptions();

  const { personaName: paramName } = useParams<{ personaName?: string }>();
  const personas = useMemo<PersonaDef[]>(() => agent?.personas ?? [], [agent?.personas]);

  const active = useMemo<PersonaDef | null>(
    () => (paramName ? personas.find(p => p.name === paramName) ?? null : null),
    [personas, paramName],
  );

  const urlPersona = (name: string) =>
    `/${agentSlug}/builder/personas/${encodeURIComponent(name)}`;

  const writePersonas = useCallback((next: PersonaDef[]) => {
    if (!agent) return;
    updateAgent(agent.id, { personas: next });
  }, [agent, updateAgent]);

  const upsert = useCallback((next: PersonaDef) => {
    if (!agent) return;
    const cur = agent.personas ?? [];
    const i = cur.findIndex(p => p.id === next.id);
    writePersonas(i === -1 ? [...cur, next] : cur.map(p => (p.id === next.id ? next : p)));
  }, [agent, writePersonas]);

  // ── Create / rename / delete / reorder ──────────────────────────
  const handleCreate = useCallback(() => {
    if (!agent) return;
    const base = 'persona';
    let name = base;
    let i = 2;
    while ((agent.personas ?? []).some(p => p.name === name)) { name = `${base}_${i}`; i += 1; }
    const fresh: PersonaDef = { id: newPersonaId(), name, content: '', appliesTo: [] };
    writePersonas([...(agent.personas ?? []), fresh]);
    navigate(urlPersona(name));
  }, [agent, agentSlug, navigate, writePersonas]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRename = useCallback((p: PersonaDef, raw: string): boolean => {
    const next = sanitiseName(raw);
    if (!next || next === p.name) return false;
    if ((agent?.personas ?? []).some(x => x.name === next)) return false;
    upsert({ ...p, name: next });
    navigate(urlPersona(next));
    return true;
  }, [agent, agentSlug, navigate, upsert]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = useCallback(async (p: PersonaDef) => {
    const ok = await confirm({
      title:        `Delete persona "${p.name}"?`,
      message:      `Any prompt using {{persona:${p.name}}} will resolve to empty, and it will no longer be appended by {{persona}} on the addons it applied to.`,
      confirmLabel: 'Delete',
      danger:       true,
    });
    if (!ok) return;
    writePersonas((agent?.personas ?? []).filter(x => x.id !== p.id));
    navigate(`/${agentSlug}/builder/personas`);
  }, [agent, agentSlug, confirm, navigate, writePersonas]);

  const move = useCallback((p: PersonaDef, dir: -1 | 1) => {
    const cur = [...(agent?.personas ?? [])];
    const i = cur.findIndex(x => x.id === p.id);
    const j = i + dir;
    if (i === -1 || j < 0 || j >= cur.length) return;
    [cur[i], cur[j]] = [cur[j], cur[i]];
    writePersonas(cur);
  }, [agent, writePersonas]);

  // "All addons" (`*`) is mutually exclusive with specific addons:
  //   - clicking All when off  → selection becomes just ['*'].
  //   - clicking All when on   → clears it (→ []).
  //   - clicking any specific  → drops '*' first, then toggles that one.
  const toggleAppliesTo = useCallback((p: PersonaDef, key: string) => {
    const set = new Set(p.appliesTo ?? []);
    if (key === '*') {
      if (set.has('*')) { upsert({ ...p, appliesTo: [] }); }
      else              { upsert({ ...p, appliesTo: ['*'] }); }
      return;
    }
    set.delete('*');
    if (set.has(key)) set.delete(key); else set.add(key);
    upsert({ ...p, appliesTo: [...set] });
  }, [upsert]);

  /** Short, human label for an appliesTo id (plugin name, or "All addons"). */
  const labelFor = useCallback(
    (id: string) => appliesToOptions.find(o => o.id === id)?.name ?? id,
    [appliesToOptions],
  );

  const handleContentChange = useCallback((text: string) => {
    if (!active) return;
    upsert({ ...active, content: text });
  }, [active, upsert]);

  if (!agent) return null;

  return (
    <div className={styles.root}>
      <div className={styles.topBar}>
        <div className={styles.breadcrumb}>
          <button
            type="button"
            className={`${styles.crumb} ${!paramName ? styles.crumbCurrent : ''}`}
            onClick={() => navigate(`/${agentSlug}/builder/personas`)}
          >
            🎭 Personas
          </button>
          {active && (
            <>
              <span> / </span>
              <span className={`${styles.crumb} ${styles.crumbCurrent}`}>{active.name}</span>
            </>
          )}
        </div>
        <div className={styles.hintLine}>
          <code>{'{{persona}}'}</code> appends every persona applicable to that addon, in list order ·
          <code>{'{{persona:NAME}}'}</code> pulls one
        </div>
      </div>

      <div className={styles.grid}>
        {/* ── Left: persona list ──────────────────────────────── */}
        <div className={styles.column}>
          <div className={styles.columnHead}>
            <span className={styles.columnTitle}>Personas</span>
            <button type="button" className={styles.addBtn} onClick={handleCreate}>+ Add</button>
          </div>
          {personas.length === 0 ? (
            <div className={styles.empty}>No personas yet. Add one — tick “All addons” to make it the general persona.</div>
          ) : (
            <div className={styles.list}>
              {personas.map((p, idx) => {
                const applies = p.appliesTo ?? [];
                const all = applies.includes('*');
                const fullList = applies.map(labelFor).join(', ');
                // Short → names; busy (3+) → a count. Tooltip always full.
                const summary = all
                  ? 'All addons'
                  : applies.length === 0
                    ? 'No addons'
                    : applies.length <= 2
                      ? fullList
                      : `${applies.length} addons`;
                const tip = all ? 'All addons' : applies.length === 0 ? 'No addons' : fullList;
                return (
                <div
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  className={`${styles.row} ${p.id === active?.id ? styles.rowActive : ''}`}
                  onClick={() => navigate(urlPersona(p.name))}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(urlPersona(p.name)); } }}
                >
                  <span className={styles.rowIcon} aria-hidden>🎭</span>
                  <span className={styles.rowMain}>
                    <span className={styles.rowName}>{p.name}</span>
                    <span
                      className={`${styles.rowApplies} ${all ? styles.rowAppliesAll : ''} ${applies.length === 0 ? styles.rowAppliesEmpty : ''}`}
                      title={tip}
                    >
                      {summary}
                    </span>
                  </span>
                  <span className={styles.rowReorder}>
                    <button type="button" className={styles.reBtn} title="Move up" disabled={idx === 0}
                      onClick={e => { e.stopPropagation(); move(p, -1); }}>▲</button>
                    <button type="button" className={styles.reBtn} title="Move down" disabled={idx === personas.length - 1}
                      onClick={e => { e.stopPropagation(); move(p, 1); }}>▼</button>
                  </span>
                  <button type="button" className={styles.rowDelete} title="Delete"
                    onClick={e => { e.stopPropagation(); handleDelete(p); }}>✕</button>
                </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Right: editor ───────────────────────────────────── */}
        <div className={styles.editor}>
          {!active ? (
            <div className={styles.hint}>Pick a persona on the left, or add one.</div>
          ) : (
            <>
              <div className={styles.fieldLabel}>Name</div>
              <input
                key={active.name}
                defaultValue={active.name}
                spellCheck={false}
                className={styles.nameInput}
                onBlur={e => { const ok = handleRename(active, e.currentTarget.value); if (!ok) e.currentTarget.value = active.name; }}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
                  if (e.key === 'Escape') { e.preventDefault(); e.currentTarget.value = active.name; e.currentTarget.blur(); }
                }}
              />

              <div className={styles.fieldLabel}>Applies to <span className={styles.fieldSub}>— which addons get this persona via <code>{'{{persona}}'}</code></span></div>
              <div className={styles.chips}>
                {appliesToOptions.map(opt => {
                  const on = (active.appliesTo ?? []).includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      className={`${styles.applyChip} ${on ? styles.applyChipOn : ''} ${opt.id === '*' ? styles.applyChipAll : ''}`}
                      onClick={() => toggleAppliesTo(active, opt.id)}
                    >
                      <span aria-hidden>{opt.icon}</span> {opt.name}
                    </button>
                  );
                })}
              </div>

              <div className={styles.fieldLabel}>Persona text</div>
              <MentionTextarea
                key={active.id}
                value={active.content ?? ''}
                onChange={handleContentChange}
                options={mentionOptions}
                placeholder="Voice, tone, role — how this agent should come across. Reference fields/params with @, #, etc."
                rows={16}
                storageKey={`persona:${active.id}`}
              />

              <div className={styles.editorFooter}>
                <button type="button" className={styles.dangerBtn} onClick={() => handleDelete(active)}>
                  Delete this persona
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
