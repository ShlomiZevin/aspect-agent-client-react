import type { ConversationListItem } from '../../builder/state/builderApi';
import type { Dict, Lang } from '../i18n';
import { IconClose, IconPlus } from '../icons';

interface Props {
  open: boolean;
  t: Dict;
  lang: Lang;
  conversations: ConversationListItem[];
  activeId: number | null;
  onClose: () => void;
  onPick: (id: number) => void;
  onNew: () => void;
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

export function HistoryDrawer({ open, t, lang, conversations, activeId, onClose, onPick, onNew }: Props) {
  const groups = groupByTime(conversations, t);
  return (
    <aside className={`drawer ${open ? 'open' : ''}`}>
      <div className="drawer-head">
        <h3>{t.history}</h3>
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
            {g.items.map(c => (
              <div
                key={c.id}
                className={`hist-item ${c.id === activeId ? 'active' : ''}`}
                onClick={() => onPick(c.id)}
              >
                <div className="ht">{c.name || (lang === 'he' ? 'שיחה ללא שם' : 'Untitled chat')}</div>
                <div className="hd">{relTime(c.updatedAt, lang)}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </aside>
  );
}
