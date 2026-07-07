import { useRef, useState } from 'react';
import type { ConversationListItem } from '../../builder/state/builderApi';
import type { Dict, Lang } from '../i18n';
import { IconClose, IconPlus, IconTrash } from '../icons';
import { ConfirmDelete } from './ConfirmDelete';

interface Props {
  open: boolean;
  t: Dict;
  lang: Lang;
  conversations: ConversationListItem[];
  activeId: number | null;
  onClose: () => void;
  onPick: (id: number) => void;
  onNew: () => void;
  onRename: (id: number, name: string) => Promise<void> | void;
  /** Delete one or more conversations (single 🗑 and select-mode both
   *  funnel through here). */
  onDelete: (ids: number[]) => Promise<void> | void;
}

interface Group { label: string; items: ConversationListItem[]; }

const DAY = 86_400_000;

function groupByTime(list: ConversationListItem[], t: Dict): Group[] {
  const now = Date.now();
  const today: ConversationListItem[] = [];
  const week: ConversationListItem[] = [];
  const older: ConversationListItem[] = [];
  for (const c of list) {
    const age = now - new Date(c.updatedAt).getTime();
    if (age < DAY) today.push(c);
    else if (age < 7 * DAY) week.push(c);
    else older.push(c);
  }
  return [
    { label: t.groupToday, items: today },
    { label: t.groupWeek, items: week },
    { label: t.groupOlder, items: older },
  ].filter(g => g.items.length > 0);
}

function relTime(iso: string, lang: Lang): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  const he = lang === 'he';
  if (mins < 1) return he ? 'הרגע' : 'just now';
  if (mins < 60) return he ? `לפני ${mins} דק׳` : `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return he ? `לפני ${hrs} שעות` : `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  return he ? `לפני ${days} ימים` : `${days}d ago`;
}

export function HistoryDrawer({ open, t, lang, conversations, activeId, onClose, onPick, onNew, onRename, onDelete }: Props) {
  const groups = groupByTime(conversations, t);

  // Multi-select delete + the pending-confirm id set (single delete is
  // a one-element set through the same modal).
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [pendingIds, setPendingIds] = useState<number[] | null>(null);

  const exitSelect = () => { setSelectMode(false); setSelected(new Set()); };
  const toggleSelected = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const confirmDelete = async () => {
    const ids = pendingIds ?? [];
    setPendingIds(null);
    if (ids.length === 0) return;
    await onDelete(ids);
    exitSelect();
  };

  // Inline rename: pencil → input → save on blur/Enter, Escape cancels.
  // Same interaction as the builder's HistoryPanel.
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const cancelRef = useRef(false);

  const untitled = lang === 'he' ? 'שיחה ללא שם' : 'Untitled chat';

  const startRename = (c: ConversationListItem) => {
    setRenamingId(c.id);
    setDraft(c.name || untitled);
  };

  const finishRename = (c: ConversationListItem) => {
    if (cancelRef.current) {
      cancelRef.current = false;
    } else {
      const next = draft.trim();
      if (next && next !== c.name) void onRename(c.id, next);
    }
    setRenamingId(null);
  };

  return (
    <aside className={`drawer ${open ? 'open' : ''}`}>
      <div className="drawer-head">
        <h3>{t.history}</h3>
        {conversations.length > 1 && !selectMode && (
          <button
            className="hist-select-toggle"
            onClick={() => { setSelectMode(true); setRenamingId(null); }}
          >
            {t.select}
          </button>
        )}
        <button className="icon-btn" onClick={onClose}><IconClose size={20} /></button>
      </div>
      <button className="new-chat" onClick={onNew}>
        <IconPlus />
        <span>{t.newChat}</span>
      </button>
      <div className="hist-list">
        {conversations.length === 0 && <div className="hist-empty">—</div>}
        {groups.map(g => (
          <div key={g.label}>
            <div className="hist-group">{g.label}</div>
            {g.items.map(c => {
              if (selectMode) {
                const isSelected = selected.has(c.id);
                return (
                  <div
                    key={c.id}
                    className={`hist-item selecting ${c.id === activeId ? 'active' : ''}`}
                    onClick={() => toggleSelected(c.id)}
                  >
                    <div className="ht">{c.name || untitled}</div>
                    <div className="hd">{relTime(c.updatedAt, lang)}</div>
                    <span className={`hist-tick ${isSelected ? 'on' : ''}`}>✓</span>
                  </div>
                );
              }
              return (
                <div
                  key={c.id}
                  className={`hist-item ${c.id === activeId ? 'active' : ''}`}
                  onClick={() => { if (renamingId !== c.id) onPick(c.id); }}
                >
                  {renamingId === c.id ? (
                    <input
                      className="hist-rename"
                      dir="auto"
                      value={draft}
                      autoFocus
                      onClick={e => e.stopPropagation()}
                      onChange={e => setDraft(e.target.value)}
                      onBlur={() => finishRename(c)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') e.currentTarget.blur();
                        else if (e.key === 'Escape') {
                          cancelRef.current = true;
                          e.currentTarget.blur();
                        }
                      }}
                    />
                  ) : (
                    <>
                      <div className="ht">{c.name || untitled}</div>
                      <div className="hd">{relTime(c.updatedAt, lang)}</div>
                      <span className="hist-acts">
                        <button
                          className="hist-act"
                          title={t.rename}
                          aria-label={t.rename}
                          onClick={e => { e.stopPropagation(); startRename(c); }}
                        >
                          ✏
                        </button>
                        <button
                          className="hist-act danger"
                          title={t.deleteChat}
                          aria-label={t.deleteChat}
                          onClick={e => { e.stopPropagation(); setPendingIds([c.id]); }}
                        >
                          <IconTrash />
                        </button>
                      </span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {selectMode && (
        <div className="hist-selbar">
          <button className="btn ghost" onClick={exitSelect}>{t.cancel}</button>
          <button
            className="btn danger"
            disabled={selected.size === 0}
            onClick={() => setPendingIds(Array.from(selected))}
          >
            {t.deleteN.replace('{n}', String(selected.size))}
          </button>
        </div>
      )}

      <ConfirmDelete
        open={pendingIds !== null}
        t={t}
        message={
          (pendingIds?.length ?? 0) > 1
            ? t.deleteManyConfirm.replace('{n}', String(pendingIds?.length ?? 0))
            : t.deleteChatConfirm
        }
        onCancel={() => setPendingIds(null)}
        onConfirm={confirmDelete}
      />
    </aside>
  );
}
