/**
 * "What should Aspect investigate for you?" hero. Starting an investigation
 * hands off to JobsContext — the running/completed/error state now lives as a
 * header badge (see jobs/JobBadges.tsx + jobs/JobSidebar.tsx), not inline here.
 */
import { useState } from 'react';
import { useJobs } from '../jobs/JobsContext';
import { useLanguage } from '../../../context/LanguageContext';
import { insightsService } from '../../../services/insightsService';
import { SimpleQueryHelper } from './SimpleQueryHelper';
import styles from './InvestigateHero.module.css';

// Cross-sell/basket-affinity prompts ("bundle opportunities hiding in
// baskets") are deliberately excluded: that analysis needs a self-join
// across ~2M rows with no supporting index and reliably times out with no
// canned fallback to land on anymore (see investigation.service.js) — every
// example chip here has been run for real and confirmed to actually work
// (translation keys, not hardcoded English — the plan step is an LLM call
// that turns either language into the same kind of concrete data question).
const EXAMPLE_PROMPT_KEYS = ['intel.hero.example1', 'intel.hero.example2', 'intel.hero.example3'];

const SKIP_HELPER_KEY = 'aspect_intel_skip_query_helper';

interface Props {
  datasetId: string;
  /** Opens the chat widget and sends a question — see IntelligenceShell.askFollowUp, reused here for "Ask in Data Chat". */
  onAskInChat: (question: string) => void;
}

export function InvestigateHero({ datasetId, onAskInChat }: Props) {
  const { t } = useLanguage();
  const [text, setText] = useState('');
  const [classifying, setClassifying] = useState(false);
  // Non-null = the gentle helper is showing for exactly this typed prompt.
  const [helperPrompt, setHelperPrompt] = useState<string | null>(null);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const { startJob } = useJobs();

  const runInvestigation = (prompt: string) => {
    startJob(datasetId, prompt);
    setText('');
    setHelperPrompt(null);
  };

  // Example chips are pre-vetted real investigations (see comment above) —
  // no need to classify something already known to be worth investigating.
  const startFromChip = (prompt: string) => runInvestigation(prompt);

  const submitTyped = async () => {
    const q = text.trim();
    if (!q || classifying) return;
    if (localStorage.getItem(SKIP_HELPER_KEY) === '1') {
      runInvestigation(q);
      return;
    }
    setClassifying(true);
    try {
      const { isSimpleQuery } = await insightsService.classifyPrompt(datasetId, q);
      if (isSimpleQuery) setHelperPrompt(q);
      else runInvestigation(q);
    } catch {
      // Classification failing shouldn't block a real investigation.
      runInvestigation(q);
    } finally {
      setClassifying(false);
    }
  };

  const persistSkipIfChecked = () => {
    if (dontShowAgain) localStorage.setItem(SKIP_HELPER_KEY, '1');
  };

  const askInChatFromHelper = () => {
    if (!helperPrompt) return;
    persistSkipIfChecked();
    onAskInChat(helperPrompt);
    setText('');
    setHelperPrompt(null);
  };

  const runAnywayFromHelper = () => {
    if (!helperPrompt) return;
    persistSkipIfChecked();
    runInvestigation(helperPrompt);
  };

  return (
    <div className={styles.wrap}>
      <div className={`${styles.box} ${helperPrompt ? styles.boxFlagged : ''}`}>
        <div className={styles.inputRow}>
          <span className={styles.sparkle}>✦</span>
          <input
            className={styles.input}
            placeholder={t('intel.hero.placeholder')}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submitTyped()}
          />
          <button className={styles.startBtn} onClick={submitTyped} disabled={classifying}>
            {classifying ? t('intel.hero.checking') : t('intel.hero.start')}
          </button>
        </div>

        <div className={styles.chipsBlock}>
          <div className={styles.chipsLabel}>{t('intel.hero.possible')}</div>
          <div className={styles.chips}>
            {EXAMPLE_PROMPT_KEYS.map(key => (
              <button key={key} className={styles.chip} onClick={() => startFromChip(t(key))}>{t(key)}</button>
            ))}
          </div>
        </div>
      </div>

      {helperPrompt && (
        <SimpleQueryHelper
          onAskInChat={askInChatFromHelper}
          onRunAnyway={runAnywayFromHelper}
          dontShowAgain={dontShowAgain}
          onDontShowAgainChange={setDontShowAgain}
        />
      )}
    </div>
  );
}
