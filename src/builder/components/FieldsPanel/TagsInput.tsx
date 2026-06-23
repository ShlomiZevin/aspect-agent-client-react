/**
 * TagsInput — multi-select chips + text input with autocomplete.
 *
 * Similar to `DomainInput` but a field can have N tags. Renders the
 * current tags as removable chips on the left of the input; typing
 * filters the suggestions dropdown; Enter / comma / blur commits the
 * typed value as a new tag (creating it on the fly if it doesn't
 * exist in `options` yet). Esc clears the draft text.
 *
 * Normalization (matches the rest of the builder):
 *   - lowercased
 *   - trimmed
 *   - rejects spaces (substituted with `_`)
 *   - dedupes within this field's tags
 *
 * The parent gets the FULL next list via `onChange` after every
 * mutation — same shape as `DomainInput`'s `onChange(string)`, just
 * `onChange(string[])`.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './TagsInput.module.css';

interface Props {
  /** Current tags on the field. */
  value: string[];
  /** Called with the FULL next list whenever a tag is added or removed. */
  onChange: (next: string[]) => void;
  /** All known tags in the agent (declared + in-use, deduped by caller). */
  options: string[];
  placeholder?: string;
}

/** Normalise a typed tag the same way the rest of the builder
 *  normalises domain / field names. Returns '' when the input has
 *  no usable content (caller drops empties). */
function normaliseTag(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

export function TagsInput({ value, onChange, options, placeholder }: Props) {
  const [draft, setDraft] = useState('');
  const [focused, setFocused] = useState(false);
  // Highlighted index in the suggestion dropdown, or -1 to indicate
  // "no suggestion focused — Enter creates from the draft text". Same
  // model as the `/` mention picker so arrow keys behave the same way
  // here as they do everywhere else in the builder.
  const [highlight, setHighlight] = useState<number>(-1);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const lower = draft.trim().toLowerCase();

  // Suggestions = known tags NOT already on the field, optionally
  // filtered by the current draft. Cap at 8 to keep the dropdown
  // scannable — typing narrows quickly enough.
  const suggestions = useMemo(() => {
    const taken = new Set(value);
    const pool = options.filter(t => !taken.has(t));
    if (!lower) return pool.slice(0, 8);
    return pool.filter(t => t.toLowerCase().includes(lower)).slice(0, 8);
  }, [options, value, lower]);

  const exactMatch = useMemo(
    () => options.some(o => o.toLowerCase() === lower)
       || value.some(v => v.toLowerCase() === lower),
    [options, value, lower],
  );
  const showCreateHint = lower.length > 0 && !exactMatch;

  // Reset the highlight whenever the suggestion list changes (typing
  // narrows / widens it). Picks the first item when there's anything
  // to show, so plain Enter (without arrow keys first) lands on the
  // top hit — matches the `/` picker behaviour.
  useEffect(() => {
    setHighlight(suggestions.length > 0 ? 0 : -1);
  }, [suggestions]);

  const addTag = (raw: string) => {
    const next = normaliseTag(raw);
    if (!next) return;
    if (value.includes(next)) {
      // Already on the field — just clear the draft.
      setDraft('');
      return;
    }
    onChange([...value, next]);
    setDraft('');
  };

  const removeTag = (tag: string) => {
    onChange(value.filter(t => t !== tag));
  };

  return (
    <div className={styles.wrap}>
      <div
        className={`${styles.field} ${focused ? styles.fieldFocused : ''}`}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map(t => (
          <span key={t} className={styles.chip}>
            {t}
            <button
              type="button"
              className={styles.chipRemove}
              onClick={e => {
                e.stopPropagation();
                removeTag(t);
              }}
              title={`Remove "${t}"`}
              aria-label={`Remove ${t}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          className={styles.input}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            // Commit any in-progress draft on blur so a user can type
            // a tag and tab away. Defer so suggestion clicks (which
            // mouseDown before blur) still fire correctly.
            setTimeout(() => {
              setFocused(false);
              if (draft.trim()) addTag(draft);
            }, 120);
          }}
          onKeyDown={e => {
            // Arrow keys navigate the suggestion dropdown — same
            // semantics as the `/` mention picker in the rest of the
            // builder so users have one keyboard model to learn.
            if (e.key === 'ArrowDown' && suggestions.length > 0) {
              e.preventDefault();
              setHighlight(h => (h + 1) % suggestions.length);
              return;
            }
            if (e.key === 'ArrowUp' && suggestions.length > 0) {
              e.preventDefault();
              setHighlight(h => (h - 1 + suggestions.length) % suggestions.length);
              return;
            }
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              // Highlighted suggestion wins; otherwise commit the
              // typed draft as a new tag. Matches `/` picker UX.
              if (highlight >= 0 && highlight < suggestions.length) {
                addTag(suggestions[highlight]);
              } else if (draft.trim()) {
                addTag(draft);
              }
            } else if (e.key === 'Backspace' && !draft && value.length > 0) {
              // Quick-remove the last chip with Backspace on an empty
              // input — matches every chip-input UX (Slack, GitHub).
              removeTag(value[value.length - 1]);
            } else if (e.key === 'Escape') {
              e.preventDefault();
              setDraft('');
              setFocused(false);
              inputRef.current?.blur();
            }
          }}
          placeholder={value.length === 0 ? (placeholder ?? 'e.g. emotional_signals') : ''}
          spellCheck={false}
        />
      </div>

      {focused && (suggestions.length > 0 || showCreateHint) && (
        <div className={styles.menu}>
          {suggestions.map((t, i) => (
            <button
              key={t}
              type="button"
              className={`${styles.item} ${i === highlight ? styles.itemActive : ''}`}
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={e => {
                e.preventDefault();
                addTag(t);
                inputRef.current?.focus();
              }}
            >
              <span className={styles.itemDot} />
              <span className={styles.itemName}>{t}</span>
            </button>
          ))}
          {showCreateHint && (
            <div className={styles.createHint}>
              Press <kbd>Enter</kbd> to create <strong>{normaliseTag(draft)}</strong>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
