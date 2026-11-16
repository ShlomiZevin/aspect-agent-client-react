import { useState } from 'react';
import { api } from '../api';
import { firstName, useText } from '../format';
import { Icon } from '../ui';
import type { Person } from '../types';
import styles from '../ledger.module.css';

const SUGGESTED = ['ask.suggest1', 'ask.suggest2', 'ask.suggest3'];

/** 6. שואלים את המערכת: a question, a short plain-Hebrew answer. */
export function AskPage({ person }: { person: Person }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [copied, setCopied] = useState(false);
  const [answeredAt, setAnsweredAt] = useState<Date | null>(null);
  const text = useText();
  const { t } = text;

  const ask = async (question: string) => {
    if (!question.trim() || busy) return;
    setQuestion(question);
    setBusy(true);
    setError(null);
    setAnswer(null);
    setCopied(false);
    try {
      setAnswer(await api.ask(question, text.language));
      setAnsweredAt(new Date());
    } catch (err) {
      setError(err);
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
      <h1 className={styles.askTitle}>{t('ask.title', { name: firstName(person.name) })}</h1>
      <form className={styles.askBox} onSubmit={e => { e.preventDefault(); void ask(question); }}>
        <button type="submit" className={styles.askSend} aria-label={t('ask.send')} disabled={busy}><Icon name="send" size={24} stroke={2} /></button>
        <input
          className={styles.askInput}
          aria-label={t('ask.question')}
          value={question}
          onChange={e => setQuestion(e.target.value)}
        />
        <span className={styles.askSearch}><Icon name="search" size={26} /></span>
      </form>
      <div className={styles.chips}>
        {SUGGESTED.map(key => (
          <button type="button" className={styles.chip} key={key} disabled={busy} onClick={() => void ask(t(key))}>{t(key)}</button>
        ))}
      </div>

      {busy && <p className={styles.quietLine}>{t('ask.checking')}</p>}
      {error !== null && <p className={styles.errorLine}>{text.error(error)}</p>}
      {answer && (
        <section className={styles.answer}>
          <div className={styles.answerHead}>
            <span className={styles.answerFrom}><Icon name="sparkle" size={22} /> {t('ask.from')}</span>
            {answeredAt && <span>{t('ask.today', { time: text.clock(answeredAt) })}</span>}
          </div>
          <p className={styles.answerText}>{answer}</p>
          <div className={styles.answerFoot}>
            <button type="button" className={styles.copyBtn} onClick={() => void copy()}>
              <Icon name="copy" size={20} /> {copied ? t('ask.copied') : t('ask.copy')}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
