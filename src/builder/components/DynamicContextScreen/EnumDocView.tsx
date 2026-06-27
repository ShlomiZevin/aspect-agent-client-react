/**
 * EnumDocView — alternative "doc-shaped" renderer for one Targeted KB
 * (the entity formerly known as an enum). Same data, second view.
 *
 *   Layout
 *     # KB name                      ← header (read-only)
 *
 *     ## value_a                     ← inline-rename value
 *        <umbrella body>             ← click-to-edit textarea
 *
 *        ### section_x               ← inline-rename section
 *        <section body>              ← click-to-edit textarea
 *
 *        ### section_y               ← shown even if empty
 *        (empty — click to add)
 *
 *     ## value_b
 *        ...
 *
 * Every declared section appears under EVERY value as a "fixed
 * template" — empty bodies render as a faded placeholder so the
 * structure is always visible. This is the chief difference from the
 * existing list view, which only renders sections that already have
 * content for the active value.
 *
 * Editing semantics:
 *   - Body click → in-place MentionTextarea (mention picker + tokens
 *     work normally). Commit on blur.
 *   - Header click → inline rename. Cascades fire through the existing
 *     `applyTokenRenameCascade('enum', …)` /
 *     `applyEnumSectionRenameCascade` paths (no new cascade code).
 *
 * Sticky left-side TOC for navigation between values. Rest of the
 * Targeted KB editor is unchanged — this is a toggleable second
 * renderer.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBuilder } from '../../state/BuilderContext';
import { useConfirm } from '../Confirm/Confirm';
import { MentionTextarea } from '../MentionTextarea/MentionTextarea';
import { useMentionOptions } from '../MentionTextarea/useMentionOptions';
import { TableEditorModalV1 } from '../TableEditor/TableEditorModalV1';
import { MarkdownWithTables } from '../TableEditor/MarkdownWithTables';
import { sanitiseName, isReservedSectionName, newEnumValueId } from './helpers';
import type { EnumTypeDef, EnumValueDef, ID } from '../../types';
import styles from './EnumDocView.module.css';

interface Props {
  agentId: ID;
  enumDef: EnumTypeDef;
}

export function EnumDocView({ agentId, enumDef }: Props) {
  const {
    doc, updateAgent, applyEnumSectionRenameCascade,
  } = useBuilder();
  const confirm = useConfirm();
  const mentionOptions = useMentionOptions(agentId);
  const agent = doc.agents.find(a => a.id === agentId);

  const sections = enumDef.sections ?? [];

  /** Push a new revision of the active EnumTypeDef back into the agent. */
  const writeEnum = useCallback((next: EnumTypeDef) => {
    if (!agent) return;
    const enums = (agent.enums ?? []).map(e => e.id === next.id ? next : e);
    updateAgent(agentId, { enums });
  }, [agent, agentId, updateAgent]);

  // ── Value-level mutations ───────────────────────────────────────
  const addValue = () => {
    const base = 'new_value';
    let value = base;
    let i = 2;
    while (enumDef.values.some(v => v.value === value)) {
      value = `${base}_${i}`;
      i += 1;
    }
    const fresh: EnumValueDef = { id: newEnumValueId(), value, sectionTexts: {} };
    writeEnum({ ...enumDef, values: [...enumDef.values, fresh] });
  };

  const renameValue = (v: EnumValueDef, raw: string): boolean => {
    const next = sanitiseName(raw);
    if (!next || next === v.value) return false;
    if (enumDef.values.some(x => x.value === next)) return false;
    writeEnum({
      ...enumDef,
      values: enumDef.values.map(x => (x.id === v.id ? { ...x, value: next } : x)),
    });
    return true;
  };

  const removeValue = async (v: EnumValueDef) => {
    const ok = await confirm({
      title:        `Delete value "${v.value}"?`,
      message:      `The umbrella prompt and every section body under this value will be removed.`,
      confirmLabel: 'Delete',
      danger:       true,
    });
    if (!ok) return;
    writeEnum({ ...enumDef, values: enumDef.values.filter(x => x.id !== v.id) });
  };

  const setUmbrella = (v: EnumValueDef, text: string) => {
    writeEnum({
      ...enumDef,
      values: enumDef.values.map(x => x.id === v.id ? { ...x, umbrellaText: text } : x),
    });
  };

  const setSectionBody = (v: EnumValueDef, sectionName: string, body: string) => {
    writeEnum({
      ...enumDef,
      values: enumDef.values.map(x => {
        if (x.id !== v.id) return x;
        const nextSt = { ...(x.sectionTexts ?? {}), [sectionName]: body };
        return { ...x, sectionTexts: nextSt };
      }),
    });
  };

  // ── Section-level mutations ─────────────────────────────────────
  const addSection = () => {
    const base = 'new_section';
    let name = base;
    let i = 2;
    while (sections.some(s => s.name === name) || isReservedSectionName(name)) {
      name = `${base}_${i}`;
      i += 1;
    }
    writeEnum({ ...enumDef, sections: [...sections, { name }] });
  };

  const renameSection = (oldName: string, raw: string): boolean => {
    const next = sanitiseName(raw);
    if (!next || next === oldName) return false;
    if (isReservedSectionName(next)) return false;
    if (sections.some(s => s.name === next)) return false;
    // Cascade token references + sectionTexts keys first so the token
    // rewrite sees the doc with the OLD section name in place.
    applyEnumSectionRenameCascade(agentId, enumDef.id, enumDef.name, oldName, next);
    const renamedValues = enumDef.values.map(v => {
      if (!v.sectionTexts) return v;
      if (!(oldName in v.sectionTexts)) return v;
      const { [oldName]: body, ...rest } = v.sectionTexts;
      return { ...v, sectionTexts: { ...rest, [next]: body } };
    });
    writeEnum({
      ...enumDef,
      sections: sections.map(s => s.name === oldName ? { name: next } : s),
      values:   renamedValues,
    });
    return true;
  };

  const removeSection = async (name: string) => {
    const ok = await confirm({
      title:        `Delete section "${name}"?`,
      message:      `Removes the declaration and every body authored under this section across all values.`,
      confirmLabel: 'Delete',
      danger:       true,
    });
    if (!ok) return;
    const renamedValues = enumDef.values.map(v => {
      if (!v.sectionTexts || !(name in v.sectionTexts)) return v;
      const { [name]: _drop, ...rest } = v.sectionTexts;
      return { ...v, sectionTexts: rest };
    });
    writeEnum({
      ...enumDef,
      sections: sections.filter(s => s.name !== name),
      values:   renamedValues,
    });
  };

  // ── Sticky TOC ──────────────────────────────────────────────────
  const tocRef = useRef<HTMLDivElement | null>(null);
  // Hash anchors are too messy with arbitrary value names. Scroll
  // imperatively via a click handler instead.
  const scrollToValue = (valueName: string) => {
    const el = document.getElementById(`enumdoc-value-${valueName}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const orderedSections = useMemo(() => sections, [sections]);

  return (
    <div className={styles.layout}>
      <aside className={styles.toc} ref={tocRef}>
        <div className={styles.tocTitle}>Values</div>
        {enumDef.values.length === 0 ? (
          <div className={styles.tocEmpty}>No values yet</div>
        ) : (
          <ul className={styles.tocList}>
            {enumDef.values.map(v => (
              <li key={v.id}>
                <button
                  type="button"
                  className={styles.tocItem}
                  onClick={() => scrollToValue(v.value)}
                  title={`Jump to ${v.value}`}
                >
                  {v.value || <em style={{ opacity: 0.5 }}>(unnamed)</em>}
                </button>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className={styles.tocAddBtn} onClick={addValue}>
          + Add value
        </button>
        {sections.length > 0 && (
          <>
            <div className={styles.tocTitle} style={{ marginTop: 14 }}>Sections</div>
            <ul className={styles.tocList}>
              {sections.map(s => (
                <li key={s.name}>
                  <span className={styles.tocSection}>{s.name}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        <button type="button" className={styles.tocAddBtn} onClick={addSection}>
          + Add section
        </button>
      </aside>

      <article className={styles.doc}>
        <h1 className={styles.docTitle}>
          <span>🎯 {enumDef.name}</span>
        </h1>

        {enumDef.values.length === 0 ? (
          <div className={styles.emptyDoc}>
            No values declared yet. Use <strong>+ Add value</strong> on the left
            to start populating this Targeted KB.
          </div>
        ) : (
          enumDef.values.map(v => (
            <ValueBlock
              key={v.id}
              value={v}
              sections={orderedSections}
              mentionOptions={mentionOptions}
              onRenameValue={raw => renameValue(v, raw)}
              onDeleteValue={() => removeValue(v)}
              onUmbrellaChange={text => setUmbrella(v, text)}
              onSectionBodyChange={(sec, text) => setSectionBody(v, sec, text)}
              onRenameSection={(oldName, raw) => renameSection(oldName, raw)}
              onDeleteSection={(name) => removeSection(name)}
            />
          ))
        )}
      </article>
    </div>
  );
}

/* ─── ValueBlock ─────────────────────────────────────────────────── */

interface ValueBlockProps {
  value: EnumValueDef;
  sections: Array<{ name: string }>;
  mentionOptions: ReturnType<typeof useMentionOptions>;
  onRenameValue: (raw: string) => boolean;
  onDeleteValue: () => void;
  onUmbrellaChange: (text: string) => void;
  onSectionBodyChange: (sectionName: string, text: string) => void;
  onRenameSection: (oldName: string, raw: string) => boolean;
  onDeleteSection: (name: string) => void;
}

function ValueBlock({
  value, sections, mentionOptions,
  onRenameValue, onDeleteValue, onUmbrellaChange,
  onSectionBodyChange, onRenameSection, onDeleteSection,
}: ValueBlockProps) {
  return (
    <section
      className={styles.valueBlock}
      id={`enumdoc-value-${value.value}`}
    >
      <header className={styles.valueHeader}>
        <span className={styles.valueHash}>##</span>
        <InlineRename
          value={value.value}
          onCommit={onRenameValue}
          className={styles.valueName}
        />
        <button
          type="button"
          className={styles.headerActionBtn}
          onClick={onDeleteValue}
          title={`Delete value "${value.value}"`}
        >
          Delete value
        </button>
      </header>

      <EditableBody
        text={value.umbrellaText ?? ''}
        placeholder="Empty — click to add the umbrella prompt for this value."
        mentionOptions={mentionOptions}
        onCommit={onUmbrellaChange}
      />

      {sections.length === 0 ? (
        <div className={styles.noSections}>
          No sections declared. <em>+ Add section</em> from the left rail to add one.
        </div>
      ) : (
        sections.map(s => (
          <SectionBlock
            key={s.name}
            sectionName={s.name}
            body={value.sectionTexts?.[s.name] ?? ''}
            mentionOptions={mentionOptions}
            onCommitBody={text => onSectionBodyChange(s.name, text)}
            onRenameSection={raw => onRenameSection(s.name, raw)}
            onDeleteSection={() => onDeleteSection(s.name)}
          />
        ))
      )}
    </section>
  );
}

/* ─── SectionBlock ───────────────────────────────────────────────── */

interface SectionBlockProps {
  sectionName: string;
  body: string;
  mentionOptions: ReturnType<typeof useMentionOptions>;
  onCommitBody: (text: string) => void;
  onRenameSection: (raw: string) => boolean;
  onDeleteSection: () => void;
}

function SectionBlock({
  sectionName, body, mentionOptions,
  onCommitBody, onRenameSection, onDeleteSection,
}: SectionBlockProps) {
  return (
    <div className={styles.sectionBlock}>
      <header className={styles.sectionHeader}>
        <span className={styles.sectionHash}>###</span>
        <InlineRename
          value={sectionName}
          onCommit={onRenameSection}
          className={styles.sectionName}
        />
        <button
          type="button"
          className={styles.headerActionBtnSubtle}
          onClick={onDeleteSection}
          title={`Delete section "${sectionName}"`}
        >
          Delete
        </button>
      </header>
      <EditableBody
        text={body}
        placeholder={`Empty — click to add the "${sectionName}" body for this value.`}
        mentionOptions={mentionOptions}
        onCommit={onCommitBody}
      />
    </div>
  );
}

/* ─── EditableBody — click-to-edit textarea with mention support ── */

interface EditableBodyProps {
  text: string;
  placeholder: string;
  mentionOptions: ReturnType<typeof useMentionOptions>;
  onCommit: (text: string) => void;
}

function EditableBody({ text, placeholder, mentionOptions, onCommit }: EditableBodyProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  // Captured viewer height in pixels. Set in the click handler that
  // flips to edit mode, then used as the textarea's `minHeight` so
  // entering edit mode doesn't jump the document — the editor renders
  // AT LEAST as tall as the view it replaced.
  const [viewerHeight, setViewerHeight] = useState<number | null>(null);
  // Scroll Y at the moment of click. Restored once edit mode mounts
  // so the user's eye doesn't lose its place if the textarea's grow-
  // by-content behavior happens to nudge the layout a few pixels.
  const scrollRestoreRef = useRef<{ y: number; scroller: Element | Window } | null>(null);
  const viewerRef = useRef<HTMLDivElement | null>(null);
  // Table modal state:
  //   - `tableOpen` true while the modal is showing.
  //   - `tableInitial` is the MD slice the modal opens on — empty
  //     string for "+ Table" (fresh insert), or the source MD when
  //     the user clicked a rendered table in read mode.
  //   - `tableRange` is the slice's position in the source body so
  //     "save" replaces the same range. null = append at end.
  const [tableOpen, setTableOpen] = useState(false);
  const [tableInitial, setTableInitial] = useState('');
  const [tableRange, setTableRange] = useState<{ start: number; end: number } | null>(null);

  // Keep the draft in sync with prop changes WHEN we're not editing
  // (so a memory swap doesn't clobber the user's mid-typing changes).
  if (!editing && draft !== text) setDraft(text);

  /** Walk up looking for the nearest scrollable ancestor. The page's
   *  scroll could live on `.root` of DynamicContextScreen, on
   *  `document.documentElement`, or anywhere in between — we don't
   *  hardcode which. Falls back to `window` if nothing closer matches. */
  const findScrollContainer = (el: HTMLElement | null): Element | Window => {
    let cur: HTMLElement | null = el?.parentElement ?? null;
    while (cur) {
      const oy = window.getComputedStyle(cur).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && cur.scrollHeight > cur.clientHeight) {
        return cur;
      }
      cur = cur.parentElement;
    }
    return window;
  };

  /** Capture viewer height + outer scroll position. Called from any
   *  affordance that flips into edit mode so the experience stays
   *  in-place regardless of where the click came from. */
  const enterEditing = () => {
    const v = viewerRef.current;
    if (v) {
      setViewerHeight(v.getBoundingClientRect().height);
    }
    const scroller = findScrollContainer(v);
    const y = scroller === window
      ? window.scrollY
      : (scroller as Element).scrollTop;
    scrollRestoreRef.current = { y, scroller };
    setDraft(text);
    setEditing(true);
  };

  // Restore the captured scroll position right after edit mode mounts.
  // Layout might have shifted by a pixel or two — same-height swap
  // keeps it tiny but explicit restore makes the transition flawless.
  useEffect(() => {
    if (!editing) return;
    const target = scrollRestoreRef.current;
    if (!target) return;
    if (target.scroller === window) {
      window.scrollTo({ top: target.y });
    } else {
      (target.scroller as Element).scrollTop = target.y;
    }
  }, [editing]);

  // ── Read mode: render MD with embedded HTML tables. Click on
  //    prose body switches to edit; click on a table opens the
  //    modal pre-loaded with that table's MD. ────────────────────
  if (!editing) {
    if (!text.trim()) {
      return (
        <div
          ref={viewerRef}
          className={styles.bodyEmpty}
          onClick={enterEditing}
          role="button"
          tabIndex={0}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') enterEditing();
          }}
        >
          {placeholder}
        </div>
      );
    }
    return (
      <>
        <div
          ref={viewerRef}
          className={styles.bodyRender}
          onClick={(e) => {
            // Only switch to edit if the click landed on PROSE, not on
            // a rendered table (tables have their own click handler).
            const t = e.target as HTMLElement;
            if (t.closest('table')) return;
            enterEditing();
          }}
        >
          <MarkdownWithTables
            text={text}
            proseClassName={styles.bodyPre}
            onEditTable={(md, range) => {
              setTableInitial(md);
              setTableRange(range);
              setTableOpen(true);
            }}
          />
        </div>
        <TableEditorModalV1
          open={tableOpen}
          initialMarkdown={tableInitial}
          onCancel={() => { setTableOpen(false); setTableRange(null); }}
          onSave={(nextMd) => {
            // Replace the original table range in the source body
            // with the edited MD, then commit straight to the host
            // (no edit-mode transition required — user was viewing).
            if (tableRange) {
              const nextBody = text.slice(0, tableRange.start) + nextMd + text.slice(tableRange.end);
              onCommit(nextBody);
            } else {
              const next = text.trim()
                ? `${text.trimEnd()}\n\n${nextMd}\n`
                : nextMd;
              onCommit(next);
            }
            setTableOpen(false);
            setTableRange(null);
          }}
        />
      </>
    );
  }

  // ── Edit mode: textarea with mention support + insert-table btn
  //   - `minHeight` matches the viewer's height (captured at click)
  //     so swapping from read → edit doesn't shift the layout.
  //   - The textarea itself takes `width: 100%; height: 100%` via
  //     `editFill` so it fills the wrapper that owns the min-height.
  return (
    <>
      <div
        className={styles.bodyEdit}
        style={viewerHeight ? { minHeight: viewerHeight } : undefined}
      >
        <div className={styles.editFill}>
          <MentionTextarea
            value={draft}
            onChange={setDraft}
            options={mentionOptions}
            placeholder={placeholder}
            rows={6}
            minHeight={viewerHeight ?? undefined}
            autoGrow
            autoFocus
            onBlur={() => {
              // Skip blur-commit while the table modal is open — opening
              // the modal naturally blurs the textarea but we want to
              // keep editing alive so the inserted MD lands in the draft.
              if (tableOpen) return;
              if (draft !== text) onCommit(draft);
              setEditing(false);
            }}
          />
        </div>
        <div className={styles.bodyEditFooter}>
          <button
            type="button"
            className={styles.bodyEditCancel}
            onMouseDown={e => {
              e.preventDefault();
              setTableInitial('');
              setTableRange(null);
              setTableOpen(true);
            }}
            title="Insert a table at the end of this body"
          >
            + Table
          </button>
          <span style={{ flex: 1 }} />
          <button
            type="button"
            className={styles.bodyEditCancel}
            onMouseDown={e => {
              // mousedown so we fire before the textarea's blur.
              e.preventDefault();
              setDraft(text);
              setEditing(false);
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.bodyEditSave}
            onMouseDown={e => {
              e.preventDefault();
              if (draft !== text) onCommit(draft);
              setEditing(false);
            }}
          >
            Save
          </button>
        </div>
      </div>
      <TableEditorModalV1
        open={tableOpen}
        initialMarkdown={tableInitial}
        onCancel={() => setTableOpen(false)}
        onSave={(nextMd) => {
          const next = draft.trim()
            ? `${draft.trimEnd()}\n\n${nextMd}\n`
            : nextMd;
          setDraft(next);
          setTableOpen(false);
        }}
      />
    </>
  );
}

/* ─── InlineRename — header rename that cascades on commit ──────── */

interface InlineRenameProps {
  value: string;
  onCommit: (raw: string) => boolean;
  className?: string;
}

function InlineRename({ value, onCommit, className }: InlineRenameProps) {
  return (
    <input
      key={value}
      defaultValue={value}
      spellCheck={false}
      className={`${styles.inlineRename} ${className ?? ''}`}
      onBlur={e => {
        const ok = onCommit(e.currentTarget.value);
        if (!ok) e.currentTarget.value = value;
      }}
      onKeyDown={e => {
        if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
        if (e.key === 'Escape') {
          e.preventDefault();
          e.currentTarget.value = value;
          e.currentTarget.blur();
        }
      }}
    />
  );
}
