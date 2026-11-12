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
  const [answeredAt, setAnsweredAt] = useState('');

  const ask = async (text: string) => {
    if (!text.trim() || busy) return;
    setQuestion(text);
    setBusy(true);
    setError(null);
    setAnswer(null);
    setCopied(false);
    try {
      setAnswer(await api.ask(text));
      setAnsweredAt(new Intl.DateTimeFormat('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' }).format(new Date()));
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
      <h1 className={styles.askTitle}>איך אפשר לעזור, {firstName(person.name)}?</h1>
      <form className={styles.askBox} onSubmit={e => { e.preventDefault(); void ask(question); }}>
        <button type="submit" className={styles.askSend} aria-label="שליחה" disabled={busy}><Icon name="send" size={24} stroke={2} /></button>
        <input
          className={styles.askInput}
          aria-label="השאלה שלך"
          value={question}
          onChange={e => setQuestion(e.target.value)}
        />
        <span className={styles.askSearch}><Icon name="search" size={26} /></span>
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
            <span className={styles.answerFrom}><Icon name="sparkle" size={22} /> תשובה מ-Aspect</span>
            <span>היום, {answeredAt}</span>
          </div>
          <p className={styles.answerText}>{answer}</p>
          <div className={styles.answerFoot}>
            <button type="button" className={styles.copyBtn} onClick={() => void copy()}>
              <Icon name="copy" size={20} /> {copied ? 'הועתק' : 'העתקה'}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
