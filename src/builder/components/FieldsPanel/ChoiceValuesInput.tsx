/**
 * ChoiceValuesInput — chips editor for a Choice field's allowed values.
 *
 * Type a value, Enter (or comma) adds it; × removes. Purely controlled;
 * the parent decides where the values land (an owned enum on save).
 */

import { useState } from 'react';
import { normalizeChoiceValue } from '../../state/choiceList';
import { autoDir } from '../../../utils/textDirection';
import styles from './ChoiceValuesInput.module.css';

interface Props {
  values: string[];
  onChange: (values: string[]) => void;
  autoFocus?: boolean;
}

export function ChoiceValuesInput({ values, onChange, autoFocus }: Props) {
  const [draft, setDraft] = useState('');

  const commit = () => {
    const v = normalizeChoiceValue(draft);
    if (!v) return;
    if (!values.includes(v)) onChange([...values, v]);
    setDraft('');
  };

  const removeAt = (i: number) => onChange(values.filter((_, j) => j !== i));

  return (
    <div className={styles.wrap}>
      {values.length > 0 && (
        <div className={styles.chips}>
          {values.map((v, i) => (
            <span key={v} className={styles.chip} dir="auto">
              {v}
              <button
                type="button"
                className={styles.chipRemove}
                onClick={() => removeAt(i)}
                aria-label={`Remove ${v}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        className={styles.input}
        value={draft}
        dir={autoDir(draft)}
        autoFocus={autoFocus}
        placeholder={values.length === 0 ? 'Type a value, Enter to add…' : 'Add another value…'}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Backspace' && draft === '' && values.length > 0) {
            removeAt(values.length - 1);
          }
        }}
        onBlur={commit}
      />
    </div>
  );
}
