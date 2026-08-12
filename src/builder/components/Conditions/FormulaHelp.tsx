/**
 * FormulaHelp — a tiny "?" button that opens a plain-English guide to
 * writing a formula. Used on both formula inputs:
 *   - WHEN  (a condition → must come out true/false)
 *   - THEN  (a Set action → calculates a value)
 *
 * Aimed at non-coders: short intro, copy-pasteable examples of the most
 * common things, a small operator cheat-sheet, and a couple of tips.
 */

import { useState } from 'react';
import { Modal } from '../Modal/Modal';
import styles from './FormulaHelp.module.css';

interface Example { code: string; desc: string; }

const WHEN_EXAMPLES: Example[] = [
  { code: '{{age}} >= 18',                                  desc: 'the customer is 18 or older' },
  { code: '{{country}} === "IL"',                          desc: 'the country is exactly “IL” (text goes in quotes)' },
  { code: '{{age}} >= 18 && {{country}} === "IL"',         desc: 'BOTH are true  (&& = and)' },
  { code: '{{plan}} === "pro" || {{plan}} === "team"',     desc: 'EITHER is true  (|| = or)' },
  { code: '{{status}} !== "closed"',                       desc: 'the status is anything except “closed”' },
  { code: '{{email}} !== ""',                              desc: 'the field has some value (not empty)' },
];

const THEN_EXAMPLES: Example[] = [
  { code: '{{price}} * 1.17',                              desc: 'add 17% tax' },
  { code: '{{firstName}} + " " + {{lastName}}',            desc: 'join two fields into a full name' },
  { code: '{{count}} + 1',                                 desc: 'add one to a counter' },
  { code: '{{done}} / {{total}} * 100',                    desc: 'percent complete' },
  { code: '{{name}}.trim().toUpperCase()',                desc: 'tidy up and upper-case text' },
];

export function FormulaHelpButton({ mode }: { mode: 'when' | 'then' }) {
  const [open, setOpen] = useState(false);
  const examples = mode === 'when' ? WHEN_EXAMPLES : THEN_EXAMPLES;
  const intro = mode === 'when'
    ? 'A WHEN formula is a yes / no question written as a line of JavaScript. If the answer is true, the rule fires.'
    : 'A THEN formula works out a value and saves it into the field. Write it as one line of JavaScript.';

  return (
    <>
      <button
        type="button"
        className={styles.helpBtn}
        title="How do I write a formula?"
        aria-label="How to write a formula"
        onClick={e => { e.stopPropagation(); e.preventDefault(); setOpen(true); }}
      >
        ?
      </button>

      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          width={580}
          title={mode === 'when' ? '❓ Writing a WHEN formula' : '❓ Writing a THEN formula'}
          footer={<button type="button" className={styles.doneBtn} onClick={() => setOpen(false)}>Got it</button>}
        >
          <div className={styles.body}>
            <p className={styles.intro}>{intro}</p>

            <div className={styles.tip}>
              💡 Type <code>{'{{'}</code> to drop in one of your fields —
              {' '}<code>{'{{age}}'}</code> becomes that field’s current value.
            </div>

            <div className={styles.h}>Common examples</div>
            <div className={styles.examples}>
              {examples.map((ex, i) => (
                <div key={i} className={styles.exRow}>
                  <code className={styles.exCode}>{ex.code}</code>
                  <span className={styles.exDesc}>{ex.desc}</span>
                </div>
              ))}
            </div>

            <div className={styles.h}>Building blocks</div>
            <div className={styles.ops}>
              <div><code>{'==='}</code> is equal · <code>{'!=='}</code> is not equal</div>
              <div><code>{'>'}</code> <code>{'>='}</code> <code>{'<'}</code> <code>{'<='}</code> compare numbers</div>
              <div><code>{'&&'}</code> and · <code>{'||'}</code> or · <code>{'!'}</code> not</div>
              <div><code>{'+ - * /'}</code> math · <code>{'+'}</code> also joins text together</div>
            </div>

            <div className={styles.tips}>
              <div>• Text needs quotes: <code>"open"</code>, <code>"IL"</code>. Numbers don’t: <code>18</code>, <code>1.17</code>.</div>
              <div>• Keep it to one line — a single expression (no <code>if</code>, no loops).</div>
              {mode === 'when'
                ? <div>• The answer is always true or false. Leave the box empty to “always fire”.</div>
                : <div>• Whatever the line works out to is what gets saved into the field.</div>}
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
