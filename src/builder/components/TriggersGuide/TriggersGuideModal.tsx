/**
 * TriggersGuideModal — "How triggers work", for an author who does not
 * write code.
 *
 * Opened from the 📖 button on the Triggers screen and on Admin →
 * Triggers. Both are places someone lands wondering why nothing is
 * happening, which is the question this is really here to answer.
 *
 * ── Shape: ONE page, not a tree of details ─────────────────────────
 *
 * Everything is on a single scroll with a sticky contents rail beside
 * it. No accordions, no "read more", no nested modals. Someone who does
 * not yet have the vocabulary cannot know which collapsed heading holds
 * their answer, so hiding sections behind clicks is exactly backwards:
 * they need to be able to scroll past things and still absorb them.
 * (The trigger EDITOR does the opposite — help there is behind `?` dots,
 * because there the words compete with the controls you came to use.)
 *
 * The rail follows the scroll as well as driving it — a contents list
 * that only ever updates when clicked is lying about where you are the
 * moment you touch the wheel.
 *
 * The rail groups and numbers the sections rather than listing them
 * flat. Flat, it read as an undifferentiated pile of headings; grouped,
 * you can see that "Basics" is two sections long and that the answer to
 * "why is nothing happening" lives under its own heading. The numbers
 * are there to show the guide is finite.
 *
 * ── Height: the page scrolls, the modal does not ───────────────────
 *
 * `.wrap` takes a FIXED height and owns the overflow; the reading
 * column is the only scroller. The first version used `max-height` and
 * let the modal box scroll instead, which broke two things at once —
 * the sticky rail scrolled away with the text, and the last section was
 * cut off with nothing left to scroll.
 *
 * ── Where the words come from ──────────────────────────────────────
 *
 * The general sections are in `triggersGuideContent.ts`. The per-type
 * sections are NOT — each trigger type carries its own guide on its
 * descriptor, so this file loops over whatever types are registered and
 * never names one. Add a type and its section appears; remove one and
 * its section leaves with it.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { Modal } from '../Modal/Modal';
import { listTriggerTypes } from '../../triggers';
import { GUIDE_GROUPS, GUIDE_INTRO, GUIDE_SECTIONS } from './triggersGuideContent';
import styles from './TriggersGuideModal.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
}

const TYPES_GROUP = 'Trigger types';

export function TriggersGuideModal({ open, onClose }: Props) {
  // Which section the rail highlights — driven by the scroll position,
  // so clicking and scrolling stay in agreement.
  const [active, setActive] = useState<string>(GUIDE_SECTIONS[0]?.id ?? '');
  const pageRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLElement>(null);
  const rafRef = useRef<number | null>(null);

  const types = useMemo(() => listTriggerTypes().filter(t => t.guide), []);

  // Sections in group order, numbered across the whole guide so the
  // rail and the headings agree.
  const ordered = useMemo(() => {
    const byGroup = GUIDE_GROUPS.flatMap(g => GUIDE_SECTIONS.filter(s => s.group === g));
    // Anything with an unlisted group still renders, at the end, rather
    // than silently vanishing because someone typo'd a group name.
    const rest = GUIDE_SECTIONS.filter(s => !GUIDE_GROUPS.includes(s.group));
    return [...byGroup, ...rest].map((s, i) => ({ section: s, n: i + 1 }));
  }, []);

  // Every anchor in page order — what the spy walks.
  const sectionIds = useMemo(
    () => [...ordered.map(o => o.section.id), ...types.map(t => `type-${t.typeId}`)],
    [ordered, types],
  );

  const jump = (id: string) => {
    // No setActive here: the smooth scroll fires scroll events, and the
    // spy below sets it. Doing both makes the highlight jump twice.
    document.getElementById(`trg-guide-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /**
   * Which section is under the top of the reading column.
   *
   * A plain scroll handler rather than an IntersectionObserver: the
   * question here is "which heading did I last scroll past", which is
   * one comparison per section, not an intersection problem. It also
   * behaves correctly for the last section, which an observer with a
   * rootMargin famously does not (it never becomes the top-most
   * intersecting element, so the final item never highlights).
   *
   * rAF-throttled so a fast wheel does not measure on every event.
   */
  const onScroll = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const page = pageRef.current;
      if (!page) return;
      const pageTop = page.getBoundingClientRect().top;

      // At the very bottom, highlight the last section outright: a tail
      // section shorter than the viewport can never reach the top edge,
      // so it would otherwise be unreachable by scrolling.
      const atEnd = page.scrollTop + page.clientHeight >= page.scrollHeight - 4;
      const ids = sectionIds;
      let current = atEnd ? ids[ids.length - 1] : ids[0];

      if (!atEnd) {
        for (const id of ids) {
          const node = document.getElementById(`trg-guide-${id}`);
          if (!node) continue;
          if (node.getBoundingClientRect().top - pageTop <= 28) current = id;
        }
      }

      setActive(prev => {
        if (prev === current) return prev;
        // Keep the highlighted item visible in a rail taller than its
        // panel. `nearest` so it never yanks the list around.
        railRef.current
          ?.querySelector(`[data-rail-id="${current}"]`)
          ?.scrollIntoView({ block: 'nearest' });
        return current;
      });
    });
  }, [sectionIds]);

  const railGroups = [
    ...GUIDE_GROUPS.map(g => ({
      group: g,
      items: ordered
        .filter(o => o.section.group === g)
        .map(o => ({
          id: o.section.id,
          label: o.section.title,
          badge: String(o.n),
          advanced: !!o.section.advanced,
        })),
    })),
    {
      group: TYPES_GROUP,
      items: types.map(t => ({
        id: `type-${t.typeId}`,
        label: t.displayName,
        badge: t.icon,
        advanced: false,
      })),
    },
  ].filter(g => g.items.length > 0);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="How triggers work"
      badge={<span className={styles.badge}>Guide</span>}
      width={900}
      noBodyPadding
    >
      <div className={styles.wrap}>
        <nav className={styles.rail} aria-label="Sections" ref={railRef}>
          {railGroups.map(g => (
            <div key={g.group} className={styles.railGroup}>
              <span className={styles.railGroupName}>{g.group}</span>
              {g.items.map(it => (
                <button
                  key={it.id}
                  type="button"
                  data-rail-id={it.id}
                  className={active === it.id ? styles.railItemOn : styles.railItem}
                  onClick={() => jump(it.id)}
                >
                  <span className={styles.railBadge}>{it.badge}</span>
                  <span className={styles.railLabel}>{it.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className={styles.page} ref={pageRef} onScroll={onScroll}>
          <div className={styles.column}>
            <p className={styles.intro}>{GUIDE_INTRO}</p>

            {ordered.map(({ section: s, n }) => (
              <section key={s.id} id={`trg-guide-${s.id}`} className={styles.section}>
                <h3 className={styles.h3}>
                  <span className={styles.h3Num}>{n}</span>
                  {s.title}
                  {s.advanced && <span className={styles.advTag}>Advanced</span>}
                </h3>
                {s.body.map((p, i) => <p key={i} className={styles.p}>{p}</p>)}

                {s.points && (
                  <dl className={styles.points}>
                    {s.points.map((pt, i) => (
                      <div key={i} className={styles.point}>
                        <dt className={styles.pointLabel}>{pt.label}</dt>
                        <dd className={styles.pointText}>{pt.text}</dd>
                      </div>
                    ))}
                  </dl>
                )}

                {s.note && <p className={styles.note}>{s.note}</p>}
              </section>
            ))}

            {/* ── One section per registered type, from its own descriptor ── */}
            {types.map(t => {
              const g = t.guide!;
              return (
                <section
                  key={t.typeId}
                  id={`trg-guide-type-${t.typeId}`}
                  className={styles.section}
                  style={{ ['--type-color' as string]: t.color }}
                >
                  <h3 className={styles.h3}>
                    <span className={styles.typeIcon}>{t.icon}</span>
                    The {t.displayName} trigger
                  </h3>
                  <p className={styles.p}>{g.inOneLine}</p>

                  <div className={styles.forGrid}>
                    <div className={styles.forGood}>
                      <span className={styles.forHead}>Reach for it when</span>
                      <ul className={styles.list}>
                        {g.goodFor.map((x, i) => <li key={i}>{x}</li>)}
                      </ul>
                    </div>
                    <div className={styles.forBad}>
                      <span className={styles.forHead}>Not the right tool for</span>
                      <ul className={styles.list}>
                        {g.notFor.map((x, i) => <li key={i}>{x}</li>)}
                      </ul>
                    </div>
                  </div>

                  <h4 className={styles.h4}>The settings you fill in</h4>
                  <dl className={styles.points}>
                    {g.settings.map((st, i) => (
                      <div key={i} className={styles.point}>
                        <dt className={styles.pointLabel}>{st.label}</dt>
                        <dd className={styles.pointText}>
                          {st.what}
                          {st.tip && <span className={styles.tip}>{st.tip}</span>}
                        </dd>
                      </div>
                    ))}
                  </dl>

                  {g.alsoDoes && g.alsoDoes.length > 0 && (
                    <>
                      <h4 className={styles.h4}>What it also does on its own</h4>
                      <ul className={styles.list}>
                        {g.alsoDoes.map((x, i) => <li key={i}>{x}</li>)}
                      </ul>
                    </>
                  )}

                  {g.example && (
                    <p className={styles.example}>
                      <span className={styles.exampleTag}>For example</span>
                      {g.example}
                    </p>
                  )}
                </section>
              );
            })}

            {/* Breathing room under the last section, so the final
                paragraph can scroll clear of the modal's bottom edge
                instead of ending flush against it. */}
            <div className={styles.tail} />
          </div>
        </div>
      </div>
    </Modal>
  );
}
