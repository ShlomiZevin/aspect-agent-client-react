import { useState, useEffect } from 'react';
import styles from './ThinkingIndicator.module.css';
import type { ThinkingStep } from '../../../types';
import { useLanguage } from '../../../context/LanguageContext';

// Localize server-emitted thinking step descriptions.
// The server sends English-only strings (Message received, Routing to: X,
// Calling function: X, Fetching data: X, Accessing KB: X). We re-localize
// them here so the UI stays consistent with the user's language.
function localizeStepDescription(description: string, t: (key: string) => string): string {
  if (!description) return description;
  if (description === 'Message received') return t('thinking.messageReceived');
  if (description === 'Accessing knowledge base') return t('thinking.accessingKB');

  const prefixes: Array<[string, string]> = [
    ['Routing to: ',       'thinking.routingTo'],
    ['Calling function: ', 'thinking.callingFunction'],
    ['Fetching data: ',    'thinking.fetchingData'],
    ['Accessing KB: ',     'thinking.accessingKBNamed'],
  ];
  for (const [prefix, key] of prefixes) {
    if (description.startsWith(prefix)) {
      return `${t(key)}: ${description.slice(prefix.length)}`;
    }
  }
  return description;
}

interface FileResult {
  name: string;
  score?: number;
}

interface ThinkingIndicatorProps {
  currentStep: string;
  steps?: ThinkingStep[];
  isComplete?: boolean;
}

export function ThinkingIndicator({ currentStep, steps = [], isComplete = false }: ThinkingIndicatorProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
  const { t } = useLanguage();

  // Auto-collapse when complete
  useEffect(() => {
    if (isComplete) {
      setIsCollapsed(true);
    }
  }, [isComplete]);

  // Show nothing if no steps and no current step
  if (!currentStep && steps.length === 0) {
    return null;
  }

  const toggleStepExpand = (stepIndex: number) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(stepIndex)) {
        next.delete(stepIndex);
      } else {
        next.add(stepIndex);
      }
      return next;
    });
  };

  const hasFiles = (step: ThinkingStep): step is ThinkingStep & { metadata: { files: FileResult[] } } => {
    return step.stepType === 'file_search' &&
      Array.isArray((step.metadata as Record<string, unknown>)?.files) &&
      ((step.metadata as Record<string, unknown>).files as FileResult[]).length > 0;
  };

  const hasDataQuery = (step: ThinkingStep): step is ThinkingStep & { metadata: { params: { question: string; sql: string; explanation?: string } } } => {
    const metadata = step.metadata as Record<string, unknown>;
    const params = metadata?.params as Record<string, unknown>;
    return step.stepType === 'function_call' &&
      typeof params?.question === 'string' &&
      typeof params?.sql === 'string';
  };

  const isExpandable = (step: ThinkingStep) => hasFiles(step) || hasDataQuery(step);

  return (
    <div className={`${styles.container} ${isComplete ? styles.completed : ''} ${isCollapsed ? styles.collapsed : ''}`}>
      <button
        className={styles.header}
        onClick={() => setIsCollapsed(!isCollapsed)}
        aria-expanded={!isCollapsed}
      >
        <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
        <span className={styles.label}>
          {isComplete ? t('thinking.viewProcess') : `${t('thinking.thinking')}...`}
        </span>
        <svg
          className={`${styles.toggle} ${!isCollapsed ? styles.expanded : ''}`}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {!isCollapsed && (
        <div className={styles.steps}>
          {steps.length > 0 ? (
            steps.map((step, index) => (
              <div key={step.stepOrder || index}>
                <div
                  className={`${styles.step} ${isExpandable(step) ? styles.expandable : ''}`}
                  onClick={isExpandable(step) ? () => toggleStepExpand(index) : undefined}
                >
                  {!isComplete && index === steps.length - 1 && <span className={styles.dot} />}
                  {isComplete && <span className={styles.checkmark}>✓</span>}
                  <span>{localizeStepDescription(step.description, t)}</span>
                  {isExpandable(step) && (
                    <svg
                      className={`${styles.stepToggle} ${expandedSteps.has(index) ? styles.expanded : ''}`}
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  )}
                </div>
                {hasFiles(step) && expandedSteps.has(index) && (
                  <div className={styles.fileList}>
                    {(step.metadata.files as FileResult[]).map((file, fi) => (
                      <div key={fi} className={styles.fileItem}>
                        <span className={styles.fileName}>{file.name}</span>
                        {file.score != null && <span className={styles.fileScore}>{Math.round(file.score * 100)}%</span>}
                      </div>
                    ))}
                  </div>
                )}
                {hasDataQuery(step) && expandedSteps.has(index) && (
                  <div className={styles.dataQueryDetails}>
                    <div className={styles.querySection}>
                      <div className={styles.queryLabel}>{t('thinking.businessQuestion')}:</div>
                      <div className={styles.queryValue}>{step.metadata.params.question}</div>
                    </div>
                    <div className={styles.querySection}>
                      <div className={styles.queryLabel}>{t('thinking.sqlQuery')}:</div>
                      <pre className={styles.sqlCode}>{step.metadata.params.sql}</pre>
                    </div>
                    {step.metadata.params.explanation && (
                      <div className={styles.querySection}>
                        <div className={styles.queryLabel}>{t('thinking.explanation')}:</div>
                        <div className={styles.queryValue}>{step.metadata.params.explanation}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className={styles.step}>
              {!isComplete && <span className={styles.dot} />}
              {currentStep ? localizeStepDescription(currentStep, t) : t('thinking.processing')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
