/**
 * "What should Aspect investigate for you?" hero. Starting an investigation
 * hands off to JobsContext — the running/completed/error state now lives as a
 * header badge (see jobs/JobBadges.tsx + jobs/JobSidebar.tsx), not inline here.
 */
import { useEffect, useState } from 'react';
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
// The FALLBACK only. Each dataset configures its own in the Intelligence admin
// (registry defaultExamplePrompts -> provider_config), and these generic three
// are what a dataset that has not been given any still shows.
//
// They were the only thing on offer until 2026-09-02, identical for every
// client — so an online grocery with no branches and no cost data was inviting
// its buyer to ask "which stores will miss Q3 target" and "which product family
// has the steepest margin decline". Its own manifest refuses both. A chip the
// product then declines teaches a client to distrust the rest of the screen.
const FALLBACK_PROMPT_KEYS = ['intel.hero.example1', 'intel.hero.example2', 'intel.hero.example3'];

const SKIP_HELPER_KEY = 'aspect_intel_skip_query_helper';

interface Props {
  datasetId: string;
  /** Anon session id (see IntelligenceShell's UserProvider) — null until the async create finishes. */
  userId: string | null;
  /** Opens the chat widget and sends a question — see IntelligenceShell.askFollowUp, reused here for "Ask in Data Chat". */
  onAskInChat: (question: string) => void;
}

export function InvestigateHero({ datasetId, userId, onAskInChat }: Props) {
  const { t } = useLanguage();
  const [text, setText] = useState('');
  const [classifying, setClassifying] = useState(false);
  // Non-null = the gentle helper is showing for exactly this typed prompt.
  const [helperPrompt, setHelperPrompt] = useState<string | null>(null);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const { startJob, jobs } = useJobs();

  // This dataset's own suggestions, empty until they arrive; the generic three
  // stand in meanwhile and for any dataset that configures none.
  const [configured, setConfigured] = useState<string[]>([]);
  useEffect(() => {
    let alive = true;
    insightsService.getExamplePrompts(datasetId)
      .then(p => { if (alive && p.length) setConfigured(p); })
      .catch(() => { /* the fallback is already on screen */ });
    return () => { alive = false; };
  }, [datasetId]);

  // Same question already running for this dataset — used to grey out its
  // chip and block resubmitting it, rather than silently letting a
  // double-click/double-Enter fire a second, fully redundant investigation
  // (JobsContext.startJob also guards this server-side of the click, but the
  // disabled state here is the visible half of that fix).
  const isRunning = (prompt: string) => {
    const normalized = prompt.trim();
    return !!normalized && jobs.some(j => j.datasetId === datasetId && j.status === 'running' && j.prompt.trim() === normalized);
  };

  const runInvestigation = (prompt: string) => {
    if (!userId) return; // anon session still being created — practically instant, shouldn't be reachable
    startJob(datasetId, userId, prompt);
    setText('');
    setHelperPrompt(null);
  };

  // Example chips are pre-vetted real investigations (see comment above) —
  // no need to classify something already known to be worth investigating.
  const startFromChip = (prompt: string) => {
    if (isRunning(prompt)) return;
    runInvestigation(prompt);
  };

  const submitTyped = async () => {
    const q = text.trim();
    if (!q || !userId || classifying || isRunning(q)) return;
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
          <button className={styles.startBtn} onClick={submitTyped} disabled={!userId || classifying || isRunning(text)}>
            {classifying ? t('intel.hero.checking') : t('intel.hero.start')}
          </button>
        </div>

        <div className={styles.chipsBlock}>
          <div className={styles.chipsLabel}>{t('intel.hero.possible')}</div>
          <div className={styles.chips}>
            {(configured.length ? configured : FALLBACK_PROMPT_KEYS.map(k => t(k))).map(prompt => {
              const running = isRunning(prompt);
              return (
                <button key={prompt} className={styles.chip} onClick={() => startFromChip(prompt)} disabled={running} title={running ? t('intel.hero.alreadyRunning') : undefined}>
                  {prompt}
                </button>
              );
            })}
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
