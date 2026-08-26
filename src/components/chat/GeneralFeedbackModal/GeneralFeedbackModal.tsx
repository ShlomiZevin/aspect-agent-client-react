import { useEffect, useState } from 'react';
import styles from './GeneralFeedbackModal.module.css';
import { useLanguage } from '../../../context/LanguageContext';
import { RichTextEditor } from '../../tasks/RichTextEditor/RichTextEditor';
import { createFeedback, createGeneralFeedback } from '../../../services/feedbackService';
import type { FeedbackTag } from '../../../types/feedback';

/**
 * Feedback a user can leave at any moment, about the product rather than about
 * one reply. It lands in the same inbox as message-scoped feedback, so
 * reviewers keep one place to look.
 *
 * The composer is the same RichTextEditor the task board uses, which already
 * intercepts clipboard images, compresses them and inlines them — so pasting a
 * screenshot works here for free. Whatever it produces is sanitised server-side
 * before storage; nothing typed here is trusted.
 */

/** Fixed starter tags, so feedback arrives pre-sorted without the user inventing labels. */
const QUICK_TAGS: FeedbackTag[] = [
  { name: 'wrong-numbers', color: '#ef4444' },
  { name: 'missing-data', color: '#f59e0b' },
  { name: 'confusing', color: '#8b5cf6' },
  { name: 'idea', color: '#10b981' },
];

interface Props {
  /**
   * Passed in rather than read from AgentContext. The Intelligence portal
   * renders no AgentProvider, and useAgentContext() THROWS when there is none
   * — which unmounted the whole tree and showed a blank page the first time
   * this was opened from the reports rail.
   */
  agentName: string;
  baseURL: string;
  onClose: () => void;
  /**
   * Reject mode (Stage: feedback & accuracy). The same modal doubles as the
   * "Reject answer" flow from chat messages and insight pages: the disputed
   * request is prefilled read-only-ish as the first paragraph, the
   * wrong-numbers tag comes preselected, labels switch to the reject wording,
   * and — when `assistantMessageId` is present — the feedback attaches to
   * that message instead of landing as general feedback. Structure is
   * generic for every client; colors ride the token system.
   */
  mode?: 'general' | 'reject';
  /** Prefilled first paragraph (e.g. `Data for request: "…" is incorrect.`). */
  initialText?: string;
  /** Tag names preselected on open (e.g. ['wrong-numbers']). */
  initialTags?: string[];
  /** When set, submit via the message-scoped feedback API. */
  assistantMessageId?: number;
}

function isBlank(html: string): boolean {
  // The editor emits markup even when empty; an image alone is valid content.
  if (/<img\b/i.test(html)) return false;
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim().length === 0;
}

/** Escape user text before seeding it into the rich editor as HTML. */
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function GeneralFeedbackModal({ agentName, baseURL, onClose, mode = 'general', initialText, initialTags, assistantMessageId }: Props) {
  const { t } = useLanguage();
  const reject = mode === 'reject';
  const [text, setText] = useState(() =>
    initialText ? `<p><strong>${esc(initialText)}</strong></p><p><br></p>` : '');
  const [contact, setContact] = useState('');
  const [selected, setSelected] = useState<string[]>(initialTags ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  const toggleTag = (name: string) =>
    setSelected(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);

  const submit = async () => {
    if (isBlank(text) || saving) return;
    setSaving(true);
    setError(null);
    try {
      const tags = QUICK_TAGS.filter(tag => selected.includes(tag.name));
      if (assistantMessageId) {
        // Reject of a specific chat answer — lands linked to that message so
        // the reviewer sees question + answer + complaint in one place.
        await createFeedback(assistantMessageId, text, tags, baseURL);
      } else {
        await createGeneralFeedback(
          agentName,
          {
            feedbackText: text,
            tags,
            contact: contact.trim() || undefined,
            contextUrl: window.location.href,
          },
          baseURL
        );
      }
      setSent(true);
      // Held briefly so the confirmation is actually seen — closing instantly
      // reads as the click having done nothing.
      setTimeout(onClose, 900);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={() => !saving && onClose()} role="presentation">
      <div
        className={styles.modal}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('feedback.general.title')}
      >
        <div className={styles.header}>
          <div>
            <h3>{t(reject ? 'feedback.reject.title' : 'feedback.general.title')}</h3>
            <p className={styles.subtitle}>{t(reject ? 'feedback.reject.subtitle' : 'feedback.general.subtitle')}</p>
          </div>
          <button className={styles.close} onClick={onClose} aria-label={t('common.close')} disabled={saving}>×</button>
        </div>

        <div className={styles.body}>
          <div className={styles.field}>
            <span className={styles.label}>{t(reject ? 'feedback.reject.commentsLabel' : 'feedback.general.whatLabel')}</span>
            <div className={styles.editorWrap}>
              <RichTextEditor
                value={text}
                onChange={setText}
                placeholder={t('feedback.general.placeholder')}
              />
            </div>
            <span className={styles.hint}>{t('feedback.general.pasteHint')}</span>
          </div>

          <div className={styles.field}>
            <span className={styles.label}>{t('feedback.general.tagsLabel')}</span>
            <div className={styles.tags}>
              {QUICK_TAGS.map(tag => {
                const on = selected.includes(tag.name);
                return (
                  <button
                    key={tag.name}
                    type="button"
                    className={styles.tag}
                    aria-pressed={on}
                    onClick={() => toggleTag(tag.name)}
                    style={on ? { background: tag.color } : undefined}
                  >
                    {!on && <span className={styles.tagDot} style={{ background: tag.color }} />}
                    {t(`feedback.general.tag.${tag.name}`)}
                  </button>
                );
              })}
            </div>
          </div>

          {!reject && (
            <div className={styles.field}>
              <span className={styles.label}>
                {t('feedback.general.contactLabel')} <span className={styles.optional}>{t('feedback.general.optional')}</span>
              </span>
              <input
                className={styles.input}
                value={contact}
                onChange={e => setContact(e.target.value)}
                placeholder={t('feedback.general.contactPlaceholder')}
              />
            </div>
          )}
        </div>

        <div className={styles.footer}>
          {error && <span className={styles.error}>{error}</span>}
          {sent && <span className={styles.sent}>{t('feedback.general.sent')}</span>}
          <button className={styles.cancel} onClick={onClose} disabled={saving}>{t('common.cancel')}</button>
          <button className={styles.submit} onClick={submit} disabled={saving || sent || isBlank(text)}>
            {saving ? t('feedback.general.sending') : t('feedback.general.send')}
          </button>
        </div>
      </div>
    </div>
  );
}
