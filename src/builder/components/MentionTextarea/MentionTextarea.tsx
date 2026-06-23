/**
 * MentionTextarea — a plain textarea with a triggered picker for
 * inserting prompt placeholders.
 *
 * Typing one of the trigger prefixes (`@`, `!`, `#`, `^`, `*`, `%`, `+`)
 * opens a small floating menu of options. Each option carries an `insertion` string
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
import { autoDir } from '../../../utils/textDirection';
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
  /** Optional short badge rendered as a pill to the right of the
   *  label (e.g. "SYS" for system fields). Drives row-level styling
   *  so the eye spots platform-defined entries at a glance. */
  badge?: string;
  /** When set, pick fires this callback INSTEAD of inserting `insertion`.
   *  Used for action-style entries like "+ New snippet" that open an
   *  authoring modal rather than dropping text. The partial trigger
   *  token under the caret is cleaned up before the callback runs so
   *  the textarea content stays tidy. */
  onPick?: () => void;
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
  /** Summarizer slots — one entry per declared summarizer name plus
   *  an "all summaries" whole-section entry. Written by offline-lane
   *  Summarizer addons; read by any addon via `{{summary:NAME}}`. */
  '%'?: MentionOption[];
  /** Agent-level snippets — reusable, optionally-gated chunks of
   *  prompt content. Inserts `{{snippet:NAME}}` tokens; see
   *  `docs/guides/BUILDER_V2_SNIPPETS.md`. The picker may also surface
   *  a `+ New snippet` quick-add entry whose `insertion` is empty
   *  (the host catches that and opens the SnippetModal). */
  '+'?: MentionOption[];
  /** Field tags — cross-domain groupings used in
   *  `{{tag:NAME}}` / `{{tag:NAME:values}}` / `{{tag:NAME:names}}`.
   *  Three entries per tag (schema block, inline values, bare names).
   *  See `docs/guides/BUILDER_V2_FIELD_TAGS.md`. */
  '&'?: MentionOption[];
}

/**
 * Single-char triggers. `{{` and `/` are meta-triggers detected
 * separately (see detectTrigger); both surface every option from every
 * category in one combined picker — useful when the user doesn't
 * remember which sigil opens what.
 */
type SingleTrigger = '@' | '!' | '#' | '^' | '*' | '%' | '+' | '&';
type Trigger = SingleTrigger | '{{' | '/';
const SINGLE_TRIGGERS: SingleTrigger[] = ['@', '!', '#', '^', '*', '%', '+', '&'];

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
  '%':  'Summary',
  '+':  'Snippets',
  '&':  'Tags',
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
  /** When set, the textarea persists per-key state to localStorage and
   *  restores it on mount:
   *
   *    - Vertical height — drag-to-resize is remembered.
   *    - Manual direction override — Ctrl+Shift+R pins RTL,
   *      Ctrl+Shift+L pins LTR, Ctrl+Shift+A clears the pin (back to
   *      Hebrew-share auto-detection).
   *
   *  Pass a stable, prompt-specific key (e.g. `addon:<instanceId>`)
   *  so each prompt remembers its own choice. Multiple textareas
   *  sharing the same key share state — that's a feature when the
   *  surfaces are interchangeable (same kind of editor), not when
   *  they're distinct prompts. */
  storageKey?: string;
}

/** localStorage namespaces for MentionTextarea remembered state.
 *  Bumped if we ever change the storage shape. */
const HEIGHT_STORAGE_PREFIX = 'mta:height:';
/** Per-key manual RTL/LTR override — set by Ctrl+Shift+R / Ctrl+Shift+L
 *  on the textarea. Overrides the Hebrew-share auto-detection. Absent
 *  key (or unset entry) → auto-detect via `autoDir(value)`. */
const DIR_STORAGE_PREFIX = 'mta:dir:';

type ManualDir = 'rtl' | 'ltr' | null;

function readManualDir(storageKey: string | undefined): ManualDir {
  if (!storageKey) return null;
  try {
    const raw = localStorage.getItem(`${DIR_STORAGE_PREFIX}${storageKey}`);
    return raw === 'rtl' || raw === 'ltr' ? raw : null;
  } catch {
    return null;
  }
}

function writeManualDir(storageKey: string | undefined, dir: ManualDir): void {
  if (!storageKey) return;
  try {
    if (dir === null) localStorage.removeItem(`${DIR_STORAGE_PREFIX}${storageKey}`);
    else              localStorage.setItem(`${DIR_STORAGE_PREFIX}${storageKey}`, dir);
  } catch {
    /* private mode / quota — silently drop */
  }
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
  storageKey,
}: Props) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [picker, setPicker] = useState<PickerState | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  // Who owns the current highlight: keyboard or mouse. Arrow-key nav
  // sets this to `true`; the next real mousemove inside the picker
  // resets it. While true, hover events are suppressed — otherwise
  // scrolling the list (driven by arrow nav) drags new rows under the
  // stationary cursor, firing onMouseEnter and yanking the highlight
  // back to the top of whatever scrolled into view.
  const keyboardOwnsHighlight = useRef(false);

  // Manual RTL/LTR pin per `storageKey`. `null` → no override, the
  // textarea follows the Hebrew-share auto-detection. Persisted under
  // the `mta:dir:` namespace and read once at mount. Updated by the
  // Ctrl+Shift+R / Ctrl+Shift+L / Ctrl+Shift+A handlers in
  // `handleKeyDown`. We keep it in state (not just localStorage) so
  // the next render picks up the flip without an extra read.
  const [manualDir, setManualDir] = useState<ManualDir>(() => readManualDir(storageKey));
  // Resync the override when the host swaps to a different storageKey
  // (e.g. an addon-modal Cancel → reopen-on-other-instance). Without
  // this the override would stick to the wrong key.
  useEffect(() => {
    setManualDir(readManualDir(storageKey));
  }, [storageKey]);

  // Remembered vertical size for this surface. Read once at mount —
  // a saved value drives an inline `height:` on the textarea so it
  // overrides the CSS default. When the user resizes, ResizeObserver
  // catches it and writes the new height back. Stays a no-op when
  // `storageKey` is unset.
  const [savedHeight, setSavedHeight] = useState<number | null>(() => {
    if (!storageKey) return null;
    try {
      const raw = localStorage.getItem(`${HEIGHT_STORAGE_PREFIX}${storageKey}`);
      const n = raw ? Number(raw) : NaN;
      return Number.isFinite(n) && n > 0 ? n : null;
    } catch { return null; }
  });

  useEffect(() => {
    if (!storageKey) return;
    const el = taRef.current;
    if (!el) return;
    // The browser-native `resize: vertical` handle fires no JS event,
    // so we observe the actual rendered size. Persist on every change;
    // localStorage writes are cheap enough that no debouncing is
    // needed for a 4-byte string.
    const obs = new ResizeObserver(() => {
      const h = el.offsetHeight;
      if (h > 0 && h !== savedHeight) {
        setSavedHeight(h);
        try { localStorage.setItem(`${HEIGHT_STORAGE_PREFIX}${storageKey}`, String(h)); } catch {
          /* private mode / quota — silently drop */
        }
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [storageKey, savedHeight]);

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
    const filtered = f.length === 0
      ? (openOnPrefixOnly ? pool : [])
      : pool.filter(o =>
        o.label.toLowerCase().includes(f) ||
        o.insertion.toLowerCase().includes(f) ||
        (o.group ?? '').toLowerCase().includes(f),
      );
    // CRITICAL: sort by FIRST-OCCURRENCE group order so the flat
    // index used by arrow navigation matches the grouped visual
    // display. Without this, items inside the same group end up
    // scattered through the flat array (each `useMentionOptions`
    // section pushes per-field entries into different groups), and
    // arrow keys jump across groups while the eye follows the
    // grouped visual layout — the bug screenshot showed exactly that.
    const groupOrder = new Map<string, number>();
    let next = 0;
    for (const o of filtered) {
      const g = o.group ?? '';
      if (!groupOrder.has(g)) groupOrder.set(g, next++);
    }
    // Array.prototype.sort is stable in every modern engine, so equal
    // group keys preserve the original within-group order.
    return [...filtered].sort((a, b) =>
      (groupOrder.get(a.group ?? '') ?? Infinity) -
      (groupOrder.get(b.group ?? '') ?? Infinity),
    );
  }, [picker, options, openOnPrefixOnly]);

  // Reset the highlighted option to the top whenever the visible list
  // changes (filter typed, picker opened) so arrow navigation always
  // starts from a sensible place.
  useEffect(() => {
    setActiveIdx(0);
  }, [picker?.trigger, picker?.filter]);

  const closePicker = useCallback(() => setPicker(null), []);

  // When the user explicitly dismisses the picker (Esc), we record
  // which trigger they walked away from so the next `keyUp` →
  // `refreshPickerFromCaret` doesn't immediately reopen the picker
  // for the same trigger. Cleared when the trigger TEXT changes
  // (typing more characters into the filter — a clear "I want to
  // search more" signal) or the trigger position moves.
  const dismissedRef = useRef<{ startIdx: number; filter: string } | null>(null);

  const refreshPickerFromCaret = useCallback(() => {
    const ta = taRef.current;
    if (!ta) return;
    const caret = ta.selectionStart ?? 0;
    const found = detectTrigger(value, caret);
    if (!found) {
      closePicker();
      dismissedRef.current = null;
      return;
    }
    // User dismissed THIS exact trigger position + filter. Stay
    // closed until they type more (filter changes) or move the
    // cursor to a different trigger (startIdx changes).
    const dis = dismissedRef.current;
    if (dis !== null && dis.startIdx === found.startIdx && dis.filter === found.filter) {
      return;
    }
    dismissedRef.current = null;
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
    // Action entries (e.g. "+ New snippet") clean up the partial
    // trigger token first, then run their callback INSTEAD of inserting
    // text. Without the cleanup the textarea would keep `+`/`+foo`
    // hanging where the user typed the trigger.
    if (opt.onPick) {
      const next = value.slice(0, picker.startIdx) + value.slice(caret);
      onChange(next);
      closePicker();
      const targetCaret = picker.startIdx;
      queueMicrotask(() => {
        const el = taRef.current;
        if (el) {
          el.selectionStart = targetCaret;
          el.selectionEnd   = targetCaret;
        }
        opt.onPick!();
      });
      return;
    }
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
    // Manual direction override — Ctrl + the RIGHT Shift pins RTL,
    // Ctrl + the LEFT Shift pins LTR. We rely on `e.code` to
    // distinguish the two physical Shift keys (`ShiftLeft` vs
    // `ShiftRight`) — `key` is just `"Shift"` for both. The picked
    // combo is one neither the browser nor the task-board RTE binds
    // to (Ctrl+Shift+R is browser hard-refresh, Ctrl+Shift+L is the
    // task-board log shortcut, etc.). `!e.repeat` keeps held keys
    // from re-firing. Handled BEFORE the picker guard so the
    // shortcuts work whether the picker is open or not.
    if (e.ctrlKey && !e.altKey && !e.metaKey && !e.repeat) {
      if (e.code === 'ShiftRight') {
        e.preventDefault();
        setManualDir('rtl');
        writeManualDir(storageKey, 'rtl');
        return;
      }
      if (e.code === 'ShiftLeft') {
        e.preventDefault();
        setManualDir('ltr');
        writeManualDir(storageKey, 'ltr');
        return;
      }
    }

    if (!picker || visibleOptions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      keyboardOwnsHighlight.current = true;
      setActiveIdx(i => (i + 1) % visibleOptions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      keyboardOwnsHighlight.current = true;
      setActiveIdx(i => (i - 1 + visibleOptions.length) % visibleOptions.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      const opt = visibleOptions[activeIdx];
      if (opt) insertOption(opt);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      // Stop propagation so the containing Modal's Esc-to-close handler
      // doesn't also fire — Esc with an open picker means "close the
      // picker", not "close the modal under it". Modal attaches a NATIVE
      // `document.addEventListener('keydown', …)`, so the React synthetic
      // stopPropagation isn't enough; we have to stop the native event
      // from bubbling all the way up to document.
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation();
      // Record the dismissal so the subsequent `keyUp` →
      // `refreshPickerFromCaret` doesn't immediately reopen for the
      // same trigger. Cleared when the trigger text/position changes.
      if (picker) {
        dismissedRef.current = { startIdx: picker.startIdx, filter: picker.filter };
      }
      closePicker();
    }
  };

  /** Picker-internal mousemove re-arms hover. Until the cursor
   *  actually moves, hover events from scroll-induced reflows are
   *  ignored. */
  const handlePickerMouseMove = useCallback(() => {
    keyboardOwnsHighlight.current = false;
  }, []);

  /** Wraps the raw onMouseEnter from PickerList so we can suppress
   *  it during keyboard-owned highlight ownership. */
  const handlePickerHover = useCallback((idx: number) => {
    if (keyboardOwnsHighlight.current) return;
    setActiveIdx(idx);
  }, []);

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
        style={savedHeight !== null ? { height: savedHeight } : undefined}
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
        // Direction priority: manual Ctrl+Shift override (per
        // storageKey) wins; otherwise we auto-flip to RTL when the
        // prompt is mostly Hebrew. The browser handles caret +
        // alignment + bidi resolution once `dir` is set.
        dir={manualDir ?? autoDir(value)}
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
          // Re-arm hover after any real cursor movement inside the
          // picker. While the user is arrow-keying, scrolling drags
          // items under the stationary cursor; we ignore those
          // pseudo-hovers until the mouse actually moves again.
          onMouseMove={handlePickerMouseMove}
        >
          <div className={styles.pickerHint}>
            <span className={styles.pickerHintLabel}>{TRIGGER_LABELS[picker.trigger]}</span>
            <span className={styles.pickerHintTrigger}>typed {picker.trigger}</span>
          </div>
          <div className={styles.pickerScroll}>
            <PickerList
              options={visibleOptions}
              activeIdx={activeIdx}
              onPick={insertOption}
              onHover={handlePickerHover}
            />
          </div>
          {visibleOptions[activeIdx] && (
            <div className={styles.pickerFooter}>
              <span className={styles.pickerFooterLabel}>
                {visibleOptions[activeIdx].label}
              </span>
              <span className={styles.pickerFooterInsertion}>
                {visibleOptions[activeIdx].insertion}
              </span>
              {visibleOptions[activeIdx].description && (
                <span className={styles.pickerFooterDescription}>
                  {visibleOptions[activeIdx].description}
                </span>
              )}
            </div>
          )}
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

  // Keep the highlighted row visible while the user arrow-keys
  // through a long list. The manual scrollTop math we used before
  // worked for ArrowDown but not always for ArrowUp (the `.pickerHint`
  // header above the list eats into the scroller's top edge and the
  // condition `bRect.top < sRect.top + pad` would miss the case where
  // the active row sat just under the hint). `scrollIntoView` with
  // `block: 'nearest'` handles both directions symmetrically AND
  // accounts for in-flow headers automatically.
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    const btn = itemRefs.current[activeIdx];
    if (!btn) return;
    btn.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  return (
    <div className={styles.pickerList}>
      {grouped.map(([group, items]) => (
        <div key={group || '_default'}>
          {group && <div className={styles.pickerGroup}>{group}</div>}
          {items.map(({ idx, opt }) => (
            <button
              key={`${opt.insertion}-${idx}`}
              ref={(el) => { itemRefs.current[idx] = el; }}
              type="button"
              className={`${styles.pickerItem} ${idx === activeIdx ? styles.pickerItemActive : ''} ${opt.badge ? styles.pickerItemBadged : ''}`}
              onMouseEnter={() => onHover(idx)}
              onClick={() => onPick(opt)}
              title={opt.description}
            >
              <span className={styles.pickerLabel}>
                {opt.label}
                {opt.badge && (
                  <span className={styles.pickerBadge}>{opt.badge}</span>
                )}
              </span>
              <span className={styles.pickerInsertion}>{opt.insertion}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
