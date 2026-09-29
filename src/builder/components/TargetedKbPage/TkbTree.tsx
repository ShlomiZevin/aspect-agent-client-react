/**
 * The Targeted KB page's left tree (task #830 / #863).
 *
 *   Targeted KB | Choices              ← tabs
 *   [ + New Targeted KB ]              ← fixed-height action row
 *   ▾ 📁 Products                      ← folder (collapsible)
 *     ▾ ▤ products                     ← KB
 *         ▸ 🏷️ basic account           ← values: only under the SELECTED KB
 *         ▾ 🏷️ premium account
 *             ☂ Umbrella               ← the value's main text (special)
 *             📄 pitch · 📄 fees       ← its sections
 *
 * The label selects; the chevron opens/closes — so the branch you are on
 * can always be folded away. It opens only along what you're looking at,
 * so the same section names never repeat down the page. In whole-KB mode
 * every value lists its texts: the tree is the document's contents.
 *
 * Only the deepest selected row is filled; its parents are just tinted,
 * so it's always clear exactly what the main panel is showing.
 */

import { useState } from 'react';
import type { EnumTypeDef } from '../../types';
import styles from './TargetedKbPage.module.css';

export const UMBRELLA_TAB = '~umbrella';
export const ALL_TAB = '~all';

interface Props {
  agentId: string;
  enums: EnumTypeDef[];
  listMode: 'kb' | 'choice';
  onListMode: (m: 'kb' | 'choice') => void;
  activeEnumId: string | null;
  activeValueId: string | null;
  /** ALL_TAB, UMBRELLA_TAB or a section name. */
  activeTab: string;
  onPickKb: (e: EnumTypeDef) => void;
  onPickValue: (e: EnumTypeDef, valueId: string) => void;
  onPickTab: (e: EnumTypeDef, valueId: string, tab: string) => void;
  onNewKb: () => void;
  /** Whole-KB mode: every value of the selected KB lists its texts. */
  toc?: boolean;
}

export function TkbTree({
  agentId, enums, listMode, onListMode, activeEnumId, activeValueId, activeTab,
  onPickKb, onPickValue, onPickTab, onNewKb, toc = false,
}: Props) {
  const kbs = enums.filter(e => !e.ownedByFieldId);
  const choices = enums.filter(e => e.ownedByFieldId);
  const storageKey = `builder:tkbClosedFolders:${agentId}`;
  // A deep link into a closed folder opens that folder once, on arrival;
  // after that every folder — the current one too — folds freely.
  const [closed, setClosed] = useState<string[]>(() => {
    let saved: string[] = [];
    try { saved = JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch { /* none */ }
    const here = (enums.find(e => e.id === activeEnumId)?.folder ?? '').trim();
    return saved.filter(f => f !== here);
  });
  const saveClosed = (next: string[]) => {
    setClosed(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* private mode */ }
  };
  // Folded branches (KB / value ids). Picking something unfolds it again.
  const [folded, setFolded] = useState<string[]>([]);
  const fold = (id: string, on: boolean) => setFolded(f => (on ? [...f.filter(x => x !== id), id] : f.filter(x => x !== id)));
  const isFolded = (id: string) => folded.includes(id);

  const folderOf = (e: EnumTypeDef) => (e.folder ?? '').trim();
  const folders = Array.from(new Set(kbs.map(folderOf).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  const loose = kbs.filter(e => !folderOf(e));
  const isOpen = (f: string) => !closed.includes(f);
  const toggleFolder = (f: string) => saveClosed(isOpen(f) ? [...closed, f] : closed.filter(x => x !== f));

  const chevron = (open: boolean, onClick: () => void) => (
    <button type="button" className={styles.treeChevronBtn} aria-expanded={open}
      aria-label={open ? 'Fold' : 'Unfold'} title={open ? 'Fold' : 'Unfold'}
      onClick={ev => { ev.stopPropagation(); onClick(); }}>
      {open ? '▾' : '▸'}
    </button>
  );

  const kbRow = (e: EnumTypeDef) => {
    const selected = e.id === activeEnumId;
    const open = selected && !isFolded(e.id);
    const deepest = selected && !activeValueId;
    const owned = !!e.ownedByFieldId;
    return (
      <li key={e.id}>
        <div className={`${styles.treeRow} ${styles.treeKb} ${deepest ? styles.treeSelected : selected ? styles.treeAncestor : ''}`}>
          {chevron(open, () => { if (selected) fold(e.id, open); else { fold(e.id, false); onPickKb(e); } })}
          <button type="button" className={styles.treeLabel} onClick={() => { fold(e.id, false); onPickKb(e); }} title={e.name}>
            <span className={styles.treeIcon} aria-hidden>{owned ? '☰' : '▤'}</span>
            <span className={styles.treeText}>{e.name}</span>
            <span className={styles.treeCount}>{e.values.length}</span>
          </button>
        </div>
        {open && (
          <ul className={styles.treeChildren}>
            {e.values.map(v => {
              const valueSelected = v.id === activeValueId;
              const off = v.enabled === false;
              const textsOpen = !owned && (valueSelected || toc) && !isFolded(v.id);
              const valueDeepest = valueSelected && activeTab === ALL_TAB;
              return (
                <li key={v.id}>
                  <div className={`${styles.treeRow} ${styles.treeValue} ${valueDeepest ? styles.treeSelected : valueSelected ? styles.treeAncestor : ''} ${off ? styles.treeOff : ''}`}>
                    {owned
                      ? <span className={styles.treeChevronSpace} />
                      : chevron(textsOpen, () => {
                        if (valueSelected || toc) fold(v.id, textsOpen);
                        else { fold(v.id, false); onPickValue(e, v.id); }
                      })}
                    <button type="button" className={styles.treeLabel}
                      onClick={() => { fold(v.id, false); onPickValue(e, v.id); }}
                      title={off ? `${v.value} — switched off` : v.value}>
                      <span className={styles.treeIcon} aria-hidden>🏷️</span>
                      <span className={styles.treeText}>{v.value}</span>
                    </button>
                  </div>
                  {textsOpen && (
                    <ul className={styles.treeChildren}>
                      {[UMBRELLA_TAB, ...(e.sections ?? []).map(s => s.name)].map(tab => {
                        const umbrella = tab === UMBRELLA_TAB;
                        const sel = valueSelected && !toc && activeTab === tab;
                        return (
                          <li key={tab}>
                            <div className={`${styles.treeRow} ${umbrella ? styles.treeUmbrella : styles.treeSection} ${sel ? styles.treeSelected : ''}`}>
                              <span className={styles.treeChevronSpace} />
                              <button type="button" className={styles.treeLabel} onClick={() => onPickTab(e, v.id, tab)}
                                title={umbrella ? "Umbrella — the value's main text" : `Section: ${tab}`}>
                                <span className={styles.treeIcon} aria-hidden>{umbrella ? '☂' : '📄'}</span>
                                <span className={styles.treeText}>{umbrella ? 'Umbrella' : tab}</span>
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
            {e.values.length === 0 && <li className={styles.treeEmpty}>No values yet</li>}
          </ul>
        )}
      </li>
    );
  };

  return (
    <nav className={styles.tree} aria-label="Targeted KBs">
      <div role="tablist" className={styles.seg}>
        {(['kb', 'choice'] as const).map(m => (
          <button key={m} type="button" role="tab" aria-selected={listMode === m}
            className={`${styles.segBtn} ${listMode === m ? styles.segOn : ''}`} onClick={() => onListMode(m)}>
            {m === 'kb' ? 'Targeted KB' : 'Choices'}
            <span className={styles.segCount}>{m === 'kb' ? kbs.length : choices.length}</span>
          </button>
        ))}
      </div>

      {/* Same height on both tabs. */}
      <div className={styles.treeActions}>
        {listMode === 'kb' ? (
          <button type="button" className={styles.newBtn} onClick={onNewKb}>+ New Targeted KB</button>
        ) : (
          <span className={styles.treeHint}>Lists made by fields. Their values are edited here.</span>
        )}
      </div>
      <div className={styles.treeTools}>
        {listMode === 'kb' ? (
          <>
            <span className={styles.treeToolsLabel}>Folders</span>
            <button type="button" className={styles.textBtn} disabled={!folders.length} onClick={() => saveClosed([])}>Open all</button>
            <button type="button" className={styles.textBtn} disabled={!folders.length} onClick={() => saveClosed(folders)}>Close all</button>
          </>
        ) : (
          <span className={styles.treeToolsLabel}>Choice lists</span>
        )}
      </div>

      <div className={styles.treeScroll}>
        {listMode === 'choice' ? (
          choices.length === 0
            ? <p className={styles.treeEmpty}>No choice lists yet — one is made whenever a field gets a fixed list of values.</p>
            : <ul className={styles.treeList}>{choices.map(kbRow)}</ul>
        ) : kbs.length === 0 ? (
          <p className={styles.treeEmpty}>No Targeted KBs yet.</p>
        ) : (
          <ul className={styles.treeList}>
            {folders.map(f => {
              const open = isOpen(f);
              const inFolder = kbs.filter(e => folderOf(e) === f);
              return (
                <li key={`f:${f}`}>
                  <div className={`${styles.treeRow} ${styles.treeFolder}`}>
                    {chevron(open, () => toggleFolder(f))}
                    <button type="button" className={styles.treeLabel} onClick={() => toggleFolder(f)}>
                      <span className={styles.treeIcon} aria-hidden>📁</span>
                      <span className={styles.treeText}>{f}</span>
                      <span className={styles.treeCount}>{inFolder.length}</span>
                    </button>
                  </div>
                  {open && <ul className={styles.treeChildren}>{inFolder.map(kbRow)}</ul>}
                </li>
              );
            })}
            {loose.length > 0 && folders.length > 0 && <li className={styles.treeGroupLabel}>No folder</li>}
            {loose.map(kbRow)}
          </ul>
        )}
      </div>
    </nav>
  );
}
