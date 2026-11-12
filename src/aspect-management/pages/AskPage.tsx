import { useState } from 'react';
import { api } from '../api';
import { firstName } from '../format';
import { Card, Icon, Page, adminUi } from '../ui';
import type { Person } from '../types';
import styles from '../management.module.css';

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
    <Page title={`איך אפשר לעזור, ${firstName(person.name)}?`} sub="שאלה בעברית פשוטה, על הדיווחים, הפרויקטים והלקוחות.">
      <Card>
        <form className={styles.askBox} onSubmit={e => { e.preventDefault(); void ask(question); }}>
          <input
            className={styles.askInput}
            aria-label="השאלה שלך"
            placeholder="למשל: מי עבד על קבוצת אלון השבוע?"
            value={question}
            onChange={e => setQuestion(e.target.value)}
          />
          <button type="submit" className={`${adminUi.btn} ${adminUi.btnPrimary}`} disabled={busy || !question.trim()}>
            <Icon name="send" size={16} /> {busy ? 'בודק…' : 'שאלה'}
          </button>
        </form>
        <div className={styles.chips}>
          {SUGGESTED.map(text => (
            <button type="button" className={styles.chip} key={text} disabled={busy} onClick={() => void ask(text)}>{text}</button>
          ))}
        </div>
      </Card>

      {error && <p className={styles.errorLine}>{error}</p>}
      {answer && (
        <Card
          title="תשובה"
          action={<button type="button" className={adminUi.btn} onClick={() => void copy()}><Icon name="copy" size={16} /> {copied ? 'הועתק' : 'העתקה'}</button>}
        >
          <div className={styles.cardBody}><p className={styles.answerText}>{answer}</p></div>
        </Card>
      )}
    </Page>
  );
}
