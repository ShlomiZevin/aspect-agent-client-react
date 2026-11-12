import { useState } from 'react';
import { api } from '../api';
import { firstName } from '../format';
import { Icon } from '../ui';
import type { Person } from '../types';
import styles from '../ledger.module.css';

const SUGGESTED = ['מה עשו המפתחים אתמול?', 'מי חורג מהשעות?', 'מה מחכה להחלטה שלי?'];

/** 6. שואלים את המערכת: a question, a short plain-Hebrew answer. */
export function AskPage({ person }: { person: Person }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const ask = async (text: string) => {
    if (!text.trim() || busy) return;
    setQuestion(text);
    setBusy(true);
    setError(null);
    setAnswer(null);
    setCopied(false);
    try {
      setAnswer(await api.ask(text));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!answer) return;
    await navigator.clipboard.writeText(answer);
    setCopied(true);
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title} style={{ marginBottom: 12 }}>איך אפשר לעזור, {firstName(person.name)}?</h1>
      <form className={styles.askBox} onSubmit={e => { e.preventDefault(); void ask(question); }}>
        <input
          className={styles.askInput}
          aria-label="השאלה שלך"
          value={question}
          onChange={e => setQuestion(e.target.value)}
        />
        <button type="submit" className={styles.btnPrimary} aria-label="שליחה" disabled={busy}><Icon name="send" /></button>
      </form>
      <div className={styles.chips}>
        {SUGGESTED.map(text => (
          <button type="button" className={styles.chip} key={text} disabled={busy} onClick={() => void ask(text)}>{text}</button>
        ))}
      </div>

      {busy && <p className={styles.quietLine}>בודק…</p>}
      {error && <p className={styles.errorLine}>{error}</p>}
      {answer && (
        <section className={styles.answer}>
          <div className={styles.answerHead}>
            <span>תשובה</span>
            <button type="button" className={styles.linkBtn} onClick={() => void copy()}>{copied ? 'הועתק' : 'העתקה'}</button>
          </div>
          <p className={styles.answerText}>{answer}</p>
        </section>
      )}
    </div>
  );
}
