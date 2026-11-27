import type { ReactNode } from 'react';
import type { TopicThreads } from './commentModel';
import { CheckIcon, ChevronIcon, CommentIcon } from './icons';
import { textDir } from './textDir';
import type { Topic } from './topics';
import { sectionsOf } from './useSectionCollapse';
import type { SectionCollapse, SectionItem } from './useSectionCollapse';
import styles from './ManagementCenter.module.css';

/**
 * Action items in sections — shared by the center's ACTION ITEMS panel and
 * the /tasks/actions page, so both read the same way.
 *
 * A `**Section**` line in an action topic opens a section; the `- [ ]` lines
 * (and any text) after it belong to it until the next one. Each section is a
 * header row — chevron, name, its comment count, done/total like the agenda's
 * topics — that collapses / expands its items. Items before any section stand
 * at the top with no header (older topics), never hidden.
 *
 * Display only: blocks keep their parse order and indexes, so ticking (line
 * index) and comments (line key / index) work exactly as before.
 *
 * Which sections are folded: useSectionCollapse.ts.
 */

/** "פתח הכל / סגור הכל" for the panel head — only when there are sections to fold. */
export function SectionsToggle({ topics, collapse }: { topics: Topic[]; collapse: SectionCollapse }) {
  if (!collapse.hasSections(topics)) return null;
  const all = collapse.allOpen(topics);
  return (
    <button
      type="button"
      className={`${styles.allToggle} ${styles.allToggleFixed}`}
      onClick={() => collapse.setAll(topics, !all)}
      dir="rtl"
    >
      {all ? 'סגור הכל' : 'פתח הכל'}
    </button>
  );
}

export function ActionSections({
  topic,
  threads,
  collapse,
  listClass,
  renderItem,
}: {
  topic: Topic;
  threads: TopicThreads;
  collapse: SectionCollapse;
  /** The list's classes on this screen (center / shared page). */
  listClass: string;
  /** A line or text block → its <li>, exactly as the screen rendered it before. */
  renderItem: (block: SectionItem['block'], i: number) => ReactNode;
}) {
  return (
    <>
      {sectionsOf(topic).map(s => {
        const list = (extra = '') => (
          <ul className={`${listClass} ${extra}`}>
            {s.items.map(({ block, i }) => renderItem(block, i))}
          </ul>
        );
        if (s.name === null) return <div key={s.key} className={styles.sectionLead}>{list()}</div>;

        const name = s.name;
        const open = collapse.isOpen(topic, name);
        const done = s.total > 0 && s.ticked === s.total;
        const comments = s.items.reduce(
          (n, { block }) => n + (block.kind === 'line' ? threads.byIndex.get(block.index)?.length ?? 0 : 0), 0);
        const left = s.total - s.ticked;
        return (
          <div key={s.key} className={`${styles.section} ${done ? styles.sectionDone : ''}`}>
            <button
              type="button"
              className={styles.sectionRow}
              aria-expanded={open}
              onClick={() => collapse.setOpen(topic, name, !open)}
            >
              <span className={styles.sectionChev}><ChevronIcon dir={open ? 'down' : 'left'} size={18} /></span>
              <span className={styles.sectionName} dir={textDir(name)}>{name}</span>
              {done && <span className={styles.topicCheck} title="בוצע"><CheckIcon size={12} /></span>}
              <span className={styles.spacer} />
              {/* Fixed slot: the badge appears without moving the count. */}
              <span
                className={`${styles.sectionComments} ${!open && comments > 0 ? styles.sectionCommentsHidden : ''}`}
                title={comments ? `${comments} תגובות בקבוצה` : undefined}
              >
                {comments > 0 && <><CommentIcon size={15} /> {comments}</>}
              </span>
              <span className={styles.topicCount} dir="ltr" title={`${left} פתוחות מתוך ${s.total}`}>{s.ticked}/{s.total}</span>
            </button>
            {open && list(styles.sectionSubs)}
          </div>
        );
      })}
    </>
  );
}
