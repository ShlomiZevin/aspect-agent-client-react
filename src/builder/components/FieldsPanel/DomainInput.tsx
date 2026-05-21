/**
 * DomainInput — free-text input with autocomplete on existing domain
 * names, and a "Press enter to create 'foo'" hint when typing a new
 * value. Empty string = "(no domain)".
 *
 * Implementation is a controlled input + a small dropdown list of
 * filtered suggestions. We avoid <datalist> so we can render the
 * "create" hint explicitly.
 */

import { useMemo, useRef, useState } from 'react';
import styles from './DomainInput.module.css';

interface Props {
  value: string;
  onChange: (next: string) => void;
  /** All known domains in the crew. */
  options: string[];
  placeholder?: string;
  autoFocus?: boolean;
  /**
   * Optional callback fired when the user hits Enter. Useful for
   * parents that want Enter to commit and submit the surrounding
   * form (e.g. AddFieldModal). Always called *after* the dropdown
   * is dismissed so the visible state matches the commit.
   */
  onSubmit?: () => void;
}

export function DomainInput({ value, onChange, options, placeholder, autoFocus, onSubmit }: Props) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();

  const suggestions = useMemo(() => {
    if (!lower) return options.slice(0, 8);
    return options
      .filter(d => d.toLowerCase().includes(lower))
      .slice(0, 8);
  }, [options, lower]);

  const exactMatch = useMemo(
    () => options.some(d => d.toLowerCase() === lower),
    [options, lower],
  );
  const showCreateHint = trimmed.length > 0 && !exactMatch;

  const pick = (next: string) => {
    onChange(next);
    inputRef.current?.blur();
    setFocused(false);
  };

  return (
    <div className={styles.wrap}>
      <input
        ref={inputRef}
        className={styles.input}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          // Defer so clicks on suggestions fire first.
          setTimeout(() => setFocused(false), 120);
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            // Whether the user typed a new domain name or picked an
            // existing one, the value is already in state via onChange.
            // Enter just commits and dismisses the dropdown — and lets
            // the parent submit if it wants to.
            e.preventDefault();
            setFocused(false);
            inputRef.current?.blur();
            onSubmit?.();
          } else if (e.key === 'Escape') {
            setFocused(false);
            inputRef.current?.blur();
          }
        }}
        placeholder={placeholder ?? 'e.g. customer_profile (leave blank for no domain)'}
        autoFocus={autoFocus}
      />
      {focused && (suggestions.length > 0 || showCreateHint) && (
        <div className={styles.menu}>
          {suggestions.map(d => (
            <button
              key={d}
              type="button"
              className={styles.item}
              onMouseDown={e => {
                // mouseDown so we fire before the input's onBlur clears focus.
                e.preventDefault();
                pick(d);
              }}
            >
              <span className={styles.itemDot} />
              <span className={styles.itemName}>{d}</span>
            </button>
          ))}
          {showCreateHint && (
            <div className={styles.createHint}>
              Press <kbd>Enter</kbd> to create <strong>{trimmed}</strong>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
