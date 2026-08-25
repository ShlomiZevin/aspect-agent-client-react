import { useState } from 'react';
import styles from './GeneralFeedbackModal.module.css';
import { GeneralFeedbackModal } from './GeneralFeedbackModal';
import { useLanguage } from '../../../context/LanguageContext';

interface Props {
  /** Config is threaded through explicitly — see GeneralFeedbackModal for why. */
  agentName: string;
  baseURL: string;
  /**
   * 'row'  — full-width labelled row, for the chat history sidebar.
   * 'icon' — bare glyph, for the Intelligence header, which renders no sidebar
   *          of its own and has an icon group already.
   */
  variant?: 'row' | 'icon';
  /** Lets the host pass its own class so the control matches its neighbours —
   *  the Intelligence rail uses a separate --ai-* token set from the chat theme,
   *  so the shared default does not sit right there. */
  className?: string;
}

/**
 * Entry point to the feedback modal. Kept separate from the modal so the host
 * renders one element, and so nothing is mounted until it is actually opened.
 */
export function FeedbackTrigger({ agentName, baseURL, variant = 'row', className }: Props) {
  const [open, setOpen] = useState(false);
  const { t } = useLanguage();
  const label = t('feedback.general.trigger');

  const icon = (
    <svg width={variant === 'icon' ? 16 : 15} height={variant === 'icon' ? 16 : 15}
         viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.9-.9L3 21l1.9-5A8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4z" />
    </svg>
  );

  return (
    <>
      <button
        type="button"
        className={className || (variant === 'icon' ? styles.iconTrigger : styles.trigger)}
        onClick={() => setOpen(true)}
        aria-label={label}
        title={variant === 'icon' ? label : undefined}
      >
        {icon}
        {variant === 'row' && label}
      </button>
      {open && <GeneralFeedbackModal agentName={agentName} baseURL={baseURL} onClose={() => setOpen(false)} />}
    </>
  );
}
