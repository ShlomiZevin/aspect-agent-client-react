/**
 * "What should Aspect investigate for you?" hero. Starting an investigation
 * hands off to JobsContext — the running/completed/error state now lives as a
 * header badge (see jobs/JobBadges.tsx + jobs/JobSidebar.tsx), not inline here.
 */
import { useState } from 'react';
import { useJobs } from '../jobs/JobsContext';
import { insightsService } from '../../../services/insightsService';
import { SimpleQueryHelper } from './SimpleQueryHelper';
import styles from './InvestigateHero.module.css';

// Cross-sell/basket-affinity prompts ("bundle opportunities hiding in
// baskets") are deliberately excluded: that analysis needs a self-join
// across ~2M rows with no supporting index and reliably times out with no
// canned fallback to land on anymore (see investigation.service.js) — every
// example chip here has been run for real and confirmed to actually work.
const EXAMPLE_PROMPTS = [
  'Main risks for the next 6 months',
  'Which stores will miss Q3 target — and why',
  'Which product family has the steepest margin decline',
];

const SKIP_HELPER_KEY = 'aspect_intel_skip_query_helper';

interface Props {
  datasetId: string;
  /** Opens the chat widget and sends a question — see IntelligenceShell.askFollowUp, reused here for "Ask in Data Chat". */
  onAskInChat: (question: string) => void;
}

export function InvestigateHero({ datasetId, onAskInChat }: Props) {
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
      <div className={styles.title}>What should Aspect investigate for you?</div>

      <div className={`${styles.inputRow} ${helperPrompt ? styles.inputRowFlagged : ''}`}>
        <span className={styles.sparkle}>✦</span>
        <input
          className={styles.input}
          placeholder='Ask for an analysis — e.g. "What are the easiest ways to grow income next quarter?"'
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submitTyped()}
        />
        <button className={styles.startBtn} onClick={submitTyped} disabled={classifying}>
          {classifying ? 'Checking…' : 'Start analysis'}
        </button>
      </div>

      {helperPrompt && (
        <SimpleQueryHelper
          onAskInChat={askInChatFromHelper}
          onRunAnyway={runAnywayFromHelper}
          dontShowAgain={dontShowAgain}
          onDontShowAgainChange={setDontShowAgain}
        />
      )}

      <div className={styles.chips}>
        {EXAMPLE_PROMPTS.map(p => (
          <button key={p} className={styles.chip} onClick={() => startFromChip(p)}>{p}</button>
        ))}
      </div>
    </div>
  );
}
