/**
 * MentionTextarea — a plain textarea with a triggered picker for
 * inserting prompt placeholders.
 *
 * Typing one of the trigger prefixes (`@`, `!`, `#`) opens a small
 * floating menu of options. Each option carries an `insertion` string
 * — what actually lands in the textarea when the user picks it. This
 * way the storage stays a plain string (which is what `promptTemplate`
 * is) and what gets rendered to the LLM is byte-equal to what the user
 * sees in the box. No hidden state, no overlay parsing.
 *
 * Picker behaviour:
 *   - Opens when a trigger char is typed at a word boundary.
 *   - Filter updates as the user keeps typing letters after the prefix.
 *   - Arrow keys move focus, Enter picks, Esc / blur dismisses.
 *   - Picking replaces the partial token (prefix + filter text) with
 *     the chosen option's `insertion`.
 *   - Closes silently when the user hits space or moves the cursor
 *     elsewhere — partial tokens stay as plain text so a literal `@`
 *     in prose still works.
 *
 * Keyboard contract:
 *   - When the picker is open, arrow/Enter/Esc are captured for the
 *     picker. All other keystrokes go through to the textarea.
 *   - When the picker is closed, the component is just a textarea.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import styles from './MentionTextarea.module.css';

export interface MentionOption {
  /** Shown in the picker as the primary line. */
  label: string;
  /** The exact string that gets inserted into the textarea on pick. */
  insertion: string;
  /** Optional sub-line (e.g. "Field" / "Memory domain"). */
  group?: string;
  /** Optional hover description. */
  description?: string;
}

export interface MentionOptions {
  /** Memory content — fields, domains, whole section. */
  '@'?: MentionOption[];
  /** Thinking content — domains, whole section. */
  '!'?: MentionOption[];
  /** Static parameters. */
  '#'?: MentionOption[];
  /** Persona block (single option). */
  '^'?: MentionOption[];
  /** Dynamic Context switches (one entry per field with a DC attached). */
  '*'?: MentionOption[];
}

/**
 * Single-char triggers. `{{` and `/` are meta-triggers detected
 * separately (see detectTrigger); both surface every option from every
 * category in one combined picker — useful when the user doesn't
 * remember which sigil opens what.
 */
type SingleTrigger = '@' | '!' | '#' | '^' | '*';
type Trigger = SingleTrigger | '{{' | '/';
const SINGLE_TRIGGERS: SingleTrigger[] = ['@', '!', '#', '^', '*'];

/**
 * Human label for each trigger. Shown as the picker's header so the
 * user doesn't have to remember "what does @ stand for?" — the popup
 * spells it out the moment it opens. Same vocabulary the hint text
 * under the textarea uses.
 */
const TRIGGER_LABELS: Record<Trigger, string> = {
  '@':  'Memory',
  '!':  'Thinking',
  '#':  'Parameters',
  '^':  'Persona',
  '*':  'Dynamic context',
  '{{': 'All placeholders',
  '/':  'All placeholders',
};

interface PickerState {
  trigger: Trigger;
  /** Index in the textarea value of the trigger char. */
  startIdx: number;
  /** Filter text typed after the trigger (without the trigger itself). */
  filter: string;
  /** Coordinates anchoring the floating picker. */
  top: number;
  left: number;
}

interface Props {
  value: string;
  onChange: (next: string) => void;
  options: MentionOptions;
  placeholder?: string;
  rows?: number;
  className?: string;
  /** When true, picker shows even before user types after the trigger
   *  — i.e. typing `@` alone reveals the whole menu. Default true. */
  openOnPrefixOnly?: boolean;
  disabled?: boolean;
  spellCheck?: boolean;
  autoFocus?: boolean;
  onBlur?: () => void;
  onFocus?: () => void;
}

/**
 * Find the active trigger at the current caret position, if any.
 *
 * Walks the current "word" (the unbroken non-whitespace run ending at
 * the caret) and classifies it:
 *
 *   - starts with `{{` → meta-trigger (all options, one picker)
 *   - starts with `@` / `!` / `#` / `^` → single-category picker
 *   - anything else → no picker
 *
 * The trigger must sit at a word boundary (start-of-string or preceded
 * by whitespace) so a stray `@` mid-prose ("foo@bar") doesn't trigger.
 */
function detectTrigger(value: string, caret: number): {
  trigger: Trigger;
  startIdx: number;
  filter: string;
} | null {
  let wordStart = caret;
  while (wordStart > 0 && !/\s/.test(value[wordStart - 1])) wordStart--;
  if (wordStart >= caret) return null;
  // Word boundary check — guard against `foo{{bar` lighting up. Picker
  // only opens when the run begins right after whitespace / start.
  const before = wordStart === 0 ? '' : value[wordStart - 1];
  if (wordStart !== 0 && !/\s/.test(before)) return null;
  const word = value.slice(wordStart, caret);

  // `{{` meta-trigger comes first so e.g. `{{` doesn't get misread as
  // a single `{` (which isn't a trigger anyway, but keeps the logic clean).
  if (word.startsWith('{{') || word.startsWith('/')) {
    // Suppress the picker when the caret is sitting inside an
    // already-completed `{{...}}` token. Two checks: a `}}` BEFORE
    // the caret (within the word) means the token closed already; a
    // `}}` AFTER the caret (before the next whitespace) means the
    // closer is just ahead. Either way the user is editing a token
    // that already shipped — they don't want a new one inserted.
    if (word.startsWith('{{') && word.indexOf('}}', 2) !== -1) return null;
    if (word.startsWith('{{')) {
      let j = caret;
      while (j < value.length && !/\s/.test(value[j])) {
        if (value[j] === '}' && value[j + 1] === '}') return null;
        j++;
      }
    }
    return {
      trigger: word[0] === '/' ? '/' : '{{',
      startIdx: wordStart,
      filter: word.startsWith('{{') ? word.slice(2) : word.slice(1),
    };
  }
  const first = word[0] as SingleTrigger;
  if (SINGLE_TRIGGERS.includes(first)) {
    return {
      trigger: first,
      startIdx: wordStart,
      filter: word.slice(1),
    };
  }
  return null;
}

/**
 * Compute where the picker should float relative to the textarea. We
 * use a hidden mirror div that shadows the textarea's exact style so
 * we can find the caret's screen position without measuring inside the
 * textarea (browsers expose no API for that).
 */
function caretCoordsInTextarea(
  textarea: HTMLTextAreaElement,
  caret: number,
): { top: number; left: number } {
  const style = window.getComputedStyle(textarea);
  const mirror = document.createElement('div');
  // Copy every layout-affecting property so the mirror wraps identically.
  const properties = [
    'boxSizing', 'width', 'height', 'overflowX', 'overflowY',
    'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
    'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'fontStyle', 'fontVariant', 'fontWeight', 'fontStretch', 'fontSize',
    'fontFamily', 'lineHeight', 'letterSpacing', 'wordSpacing',
    'tabSize', 'whiteSpace', 'wordWrap', 'wordBreak',
  ];
  for (const prop of properties) {
    (mirror.style as unknown as Record<string, string>)[prop] = (style as unknown as Record<string, string>)[prop];
  }
  mirror.style.position = 'absolute';
  mirror.style.top = '0';
  mirror.style.left = '-9999px';
  mirror.style.visibility = 'hidden';
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.wordWrap = 'break-word';

  const before = textarea.value.slice(0, caret).replace(/\n$/, '\n​');
  mirror.textContent = before;
  const caretMarker = document.createElement('span');
  caretMarker.textContent = '​';
  mirror.appendChild(caretMarker);
  document.body.appendChild(mirror);

  const taRect = textarea.getBoundingClientRect();
  const markerRect = caretMarker.getBoundingClientRect();
  const mirrorRect = mirror.getBoundingClientRect();
  const top  = (markerRect.top  - mirrorRect.top)  + taRect.top  - textarea.scrollTop;
  const left = (markerRect.left - mirrorRect.left) + taRect.left - textarea.scrollLeft;
  document.body.removeChild(mirror);
  return { top, left };
}

export function MentionTextarea({
  value,
  onChange,
  options,
  placeholder,
  rows = 6,
  className,
  openOnPrefixOnly = true,
  disabled = false,
  spellCheck = true,
  autoFocus,
  onBlur,
  onFocus,
}: Props) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [picker, setPicker] = useState<PickerState | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  const visibleOptions = useMemo<MentionOption[]>(() => {
    if (!picker) return [];
    // `{{` and `/` both show the union of every category in a single
    // picker — they're aliases for the "show me everything" flow.
    // Single-char triggers stay scoped.
    const isMeta = picker.trigger === '{{' || picker.trigger === '/';
    const pool = isMeta
      ? SINGLE_TRIGGERS.flatMap(t => options[t] ?? [])
      : (options[picker.trigger as SingleTrigger] ?? []);
    const f = picker.filter.toLowerCase();
    if (f.length === 0) return openOnPrefixOnly ? pool : [];
    return pool.filter(o =>
      o.label.toLowerCase().includes(f) ||
      o.insertion.toLowerCase().includes(f) ||
      (o.group ?? '').toLowerCase().includes(f),
    );
  }, [picker, options, openOnPrefixOnly]);

  // Reset the highlighted option to the top whenever the visible list
  // changes (filter typed, picker opened) so arrow navigation always
  // starts from a sensible place.
  useEffect(() => {
    setActiveIdx(0);
  }, [picker?.trigger, picker?.filter]);

  const closePicker = useCallback(() => setPicker(null), []);

  const refreshPickerFromCaret = useCallback(() => {
    const ta = taRef.current;
    if (!ta) return;
    const caret = ta.selectionStart ?? 0;
    const found = detectTrigger(value, caret);
    if (!found) {
      closePicker();
      return;
    }
    const { top, left } = caretCoordsInTextarea(ta, found.startIdx);
    // Anchor the picker just below the trigger char. Approximate line
    // height fall-back keeps it from sitting on top of the typed token.
    const lineHeight = parseInt(window.getComputedStyle(ta).lineHeight || '20', 10) || 20;
    setPicker({
      trigger: found.trigger,
      startIdx: found.startIdx,
      filter:   found.filter,
      top:  top + lineHeight + 2,
      left,
    });
  }, [value, closePicker]);

  // Re-evaluate the picker on every value change so typing/deleting
  // updates the filter or dismisses the picker when the trigger goes away.
  useLayoutEffect(() => {
    if (!taRef.current) return;
    refreshPickerFromCaret();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const insertOption = useCallback((opt: MentionOption) => {
    const ta = taRef.current;
    if (!ta || !picker) return;
    const caret = ta.selectionStart ?? 0;
    const next =
      value.slice(0, picker.startIdx) +
      opt.insertion +
      value.slice(caret);
    onChange(next);
    closePicker();
    // Restore caret to just after the inserted token on the next tick
    // (after React re-renders the textarea with the new value).
    queueMicrotask(() => {
      const el = taRef.current;
      if (!el) return;
      const nextCaret = picker.startIdx + opt.insertion.length;
      el.selectionStart = nextCaret;
      el.selectionEnd   = nextCaret;
      el.focus();
    });
  }, [value, onChange, picker, closePicker]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!picker || visibleOptions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => (i + 1) % visibleOptions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => (i - 1 + visibleOptions.length) % visibleOptions.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      const opt = visibleOptions[activeIdx];
      if (opt) insertOption(opt);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closePicker();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  const handleKeyUp = () => {
    // Track caret movement (arrow keys, home/end) so the picker dismisses
    // when the cursor leaves the active token.
    refreshPickerFromCaret();
  };

  const handleClick = () => {
    refreshPickerFromCaret();
  };

  return (
    <div className={`${styles.wrap} ${className ?? ''}`}>
      <textarea
        ref={taRef}
        className={styles.textarea}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onClick={handleClick}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        spellCheck={spellCheck}
        autoFocus={autoFocus}
        onBlur={() => {
          // Defer close so a click on the picker fires before the close.
          window.setTimeout(closePicker, 120);
          onBlur?.();
        }}
        onFocus={onFocus}
      />
      {picker && visibleOptions.length > 0 && (
        <div
          className={styles.picker}
          style={{ top: picker.top, left: picker.left }}
          // Prevent the blur-close from firing when the user clicks the menu.
          onMouseDown={e => e.preventDefault()}
        >
          <div className={styles.pickerHint}>
            <span className={styles.pickerHintLabel}>{TRIGGER_LABELS[picker.trigger]}</span>
            <span className={styles.pickerHintTrigger}>typed {picker.trigger}</span>
          </div>
          <PickerList
            options={visibleOptions}
            activeIdx={activeIdx}
            onPick={insertOption}
            onHover={setActiveIdx}
          />
        </div>
      )}
    </div>
  );
}

function PickerList({
  options, activeIdx, onPick, onHover,
}: {
  options: MentionOption[];
  activeIdx: number;
  onPick: (opt: MentionOption) => void;
  onHover: (idx: number) => void;
}) {
  // Group items by their `group` label so the picker reads as a
  // categorised menu (Fields / Domains / Section) instead of a flat list.
  const grouped = useMemo(() => {
    const byGroup = new Map<string, { idx: number; opt: MentionOption }[]>();
    options.forEach((opt, idx) => {
      const key = opt.group ?? '';
      if (!byGroup.has(key)) byGroup.set(key, []);
      byGroup.get(key)!.push({ idx, opt });
    });
    return Array.from(byGroup.entries());
  }, [options]);

  return (
    <div className={styles.pickerList}>
      {grouped.map(([group, items]) => (
        <div key={group || '_default'}>
          {group && <div className={styles.pickerGroup}>{group}</div>}
          {items.map(({ idx, opt }) => (
            <button
              key={`${opt.insertion}-${idx}`}
              type="button"
              className={`${styles.pickerItem} ${idx === activeIdx ? styles.pickerItemActive : ''}`}
              onMouseEnter={() => onHover(idx)}
              onClick={() => onPick(opt)}
              title={opt.description}
            >
              <span className={styles.pickerLabel}>{opt.label}</span>
              <span className={styles.pickerInsertion}>{opt.insertion}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
