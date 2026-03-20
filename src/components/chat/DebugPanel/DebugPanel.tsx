import { useState } from 'react';
import type { DebugPromptData, TransitionLogicData } from '../../../types';
import styles from './DebugPanel.module.css';

interface DebugPanelProps {
  data: DebugPromptData;
}

function TransitionLogicSection({ logic }: { logic: TransitionLogicData }) {
  const { hasStructuredRules, evaluatedRules, rawCode, collectedFields, transitionTo, oneShot, hasPreTransfer, hasPostTransfer } = logic;

  return (
    <div className={styles.transitionContent}>
      {/* Meta info */}
      <div className={styles.transitionMeta}>
        <span>Target: <strong>{transitionTo || 'none'}</strong></span>
        {oneShot && <span className={styles.transitionTag}>oneShot</span>}
        {hasPreTransfer && <span className={styles.transitionTag}>pre</span>}
        {hasPostTransfer && <span className={styles.transitionTag}>post</span>}
      </div>

      {/* Mode 1: Structured rules */}
      {hasStructuredRules && evaluatedRules && (
        <>
          {evaluatedRules.pre.length > 0 && (
            <div className={styles.ruleGroup}>
              <div className={styles.ruleType}>preMessageTransfer</div>
              {evaluatedRules.pre.map(rule => (
                <div key={rule.id} className={`${styles.rule} ${rule.passed ? styles.rulePassed : styles.ruleFailed}`}>
                  <span className={styles.ruleStatus}>{rule.passed ? '\u2713' : '\u2717'}</span>
                  <span className={styles.ruleDesc}>{rule.description}</span>
                  {rule.fields.length > 0 && (
                    <span className={styles.ruleFields}>({rule.fields.join(', ')})</span>
                  )}
                  {rule.passed && rule.result?.target && (
                    <span className={styles.ruleTarget}>{'\u2192'} {rule.result.target}</span>
                  )}
                </div>
              ))}
            </div>
          )}
          {evaluatedRules.post.length > 0 && (
            <div className={styles.ruleGroup}>
              <div className={styles.ruleType}>postMessageTransfer</div>
              {evaluatedRules.post.map(rule => (
                <div key={rule.id} className={`${styles.rule} ${rule.passed ? styles.rulePassed : styles.ruleFailed}`}>
                  <span className={styles.ruleStatus}>{rule.passed ? '\u2713' : '\u2717'}</span>
                  <span className={styles.ruleDesc}>{rule.description}</span>
                  {rule.fields.length > 0 && (
                    <span className={styles.ruleFields}>({rule.fields.join(', ')})</span>
                  )}
                  {rule.passed && rule.result?.target && (
                    <span className={styles.ruleTarget}>{'\u2192'} {rule.result.target}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Mode 2: Raw code fallback */}
      {!hasStructuredRules && rawCode && (
        <>
          {rawCode.pre && (
            <div className={styles.codeGroup}>
              <div className={styles.ruleType}>preMessageTransfer</div>
              <pre className={styles.codeBlock}>{rawCode.pre}</pre>
            </div>
          )}
          {rawCode.post && (
            <div className={styles.codeGroup}>
              <div className={styles.ruleType}>postMessageTransfer</div>
              <pre className={styles.codeBlock}>{rawCode.post}</pre>
            </div>
          )}
        </>
      )}

      {/* One-shot info */}
      {oneShot && !hasPreTransfer && !hasPostTransfer && (
        <div className={styles.codeGroup}>
          <div className={styles.ruleType}>oneShot</div>
          <pre className={styles.codeBlock}>Delivers one response, then auto-transitions to &quot;{transitionTo}&quot; on next message.</pre>
        </div>
      )}

      {/* Current fields state */}
      {Object.keys(collectedFields).length > 0 && (
        <div className={styles.codeGroup}>
          <div className={styles.ruleType}>Collected Fields</div>
          <pre className={styles.codeBlock}>{JSON.stringify(collectedFields, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

export function DebugPanel({ data }: DebugPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const post = data.postExtractionContext;
  const transition = data.transitionLogic;

  const sections = [
    // Show transition system prompt first if it was injected (most important for debugging)
    ...(data.transitionSystemPrompt && data.transitionPromptInjected ? [{
      key: 'transitionPrompt',
      label: '** TRANSITION PROMPT (INJECTED) **',
      content: data.transitionSystemPrompt,
    }] : []),
    // Show persona separately when available
    ...(data.persona ? [{
      key: 'persona',
      label: `Agent Persona${data.personaSource === 'session_override' ? ' (OVERRIDE)' : ''}`,
      content: data.persona,
    }] : []),
    {
      key: 'model',
      label: 'Model',
      content: [
        `Configured: ${data.model}${data.modelSource === 'session_override' ? ' (session override)' : ''}`,
        `Fallback: ${data.fallbackModel || 'gpt-4o (default)'}${data.fallbackModelSource === 'session_override' ? ' (session override)' : ''}`,
        ...(data.modelUsed ? [`Actually used: ${data.modelUsed}${data.fallbackUsed ? ' *** FALLBACK (primary failed) ***' : ''}`] : []),
      ].join('\n'),
    },
    { key: 'instructions', label: 'Full Instructions (Sent to LLM)', content: data.fullInstructions },
    { key: 'message', label: 'Processed Message (User Input)', content: data.processedMessage },
    { key: 'tools', label: `Tools (${data.tools.length})`, content: JSON.stringify(data.tools, null, 2) },
    { key: 'kb', label: 'Knowledge Base', content: JSON.stringify(data.knowledgeBase, null, 2) },
    ...(post ? [{
      key: 'postExtraction',
      label: `Actual Context (Post-Extraction)${Object.keys(post.extractedFields).length > 0 ? ' *NEW*' : ''}`,
      content: [
        `Newly Extracted: ${JSON.stringify(post.extractedFields, null, 2)}`,
        `All Collected: ${JSON.stringify(post.allCollectedFields, null, 2)}`,
        `Remaining: ${JSON.stringify(post.remainingFields)}`,
      ].join('\n\n'),
    }] : []),
  ];

  return (
    <div className={styles.container} dir="ltr">
      <button className={styles.header} onClick={() => setIsExpanded(!isExpanded)}>
        <span className={styles.badge}>DEBUG</span>
        <span className={styles.meta}>
          {data.crewDisplayName} | {data.model}
          {data.modelSource === 'session_override' && ' (OVERRIDE)'}
          {data.modelSource === 'crew_default' && data.defaultModel && data.defaultModel !== data.model && ` (was: ${data.defaultModel})`}
          {data.fallbackUsed && data.modelUsed && ` → FALLBACK: ${data.modelUsed}`}
          {' '}| {data.maxTokens} tokens
        </span>
        <svg
          className={`${styles.chevron} ${isExpanded ? styles.expanded : ''}`}
          width="14" height="14" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {isExpanded && (
        <div className={styles.body}>
          {/* Transition Logic section (custom rendering) */}
          {transition && (
            <div className={styles.section}>
              <button className={styles.sectionHeader} onClick={() => toggleSection('transitionLogic')}>
                <span>
                  Transition Logic
                  {transition.transitionTo ? ` \u2192 ${transition.transitionTo}` : ''}
                  {transition.hasStructuredRules ? ' (rules)' : ' (code)'}
                </span>
                <svg
                  className={`${styles.chevron} ${expandedSections.has('transitionLogic') ? styles.expanded : ''}`}
                  width="12" height="12" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {expandedSections.has('transitionLogic') && (
                <TransitionLogicSection logic={transition} />
              )}
            </div>
          )}

          {/* Thinking Advice section */}
          {data.thinkingAdvice && (
            <div className={styles.section}>
              <button className={styles.sectionHeader} onClick={() => toggleSection('thinkingAdvice')}>
                <span>Thinking Advice</span>
                <svg
                  className={`${styles.chevron} ${expandedSections.has('thinkingAdvice') ? styles.expanded : ''}`}
                  width="12" height="12" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {expandedSections.has('thinkingAdvice') && (
                <pre className={styles.content}>{JSON.stringify(data.thinkingAdvice, null, 2)}</pre>
              )}
            </div>
          )}

          {/* Standard text sections */}
          {sections.map(({ key, label, content }) => (
            <div key={key} className={styles.section}>
              <button className={styles.sectionHeader} onClick={() => toggleSection(key)}>
                <span>{label}</span>
                <svg
                  className={`${styles.chevron} ${expandedSections.has(key) ? styles.expanded : ''}`}
                  width="12" height="12" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {expandedSections.has(key) && (
                <pre className={styles.content}>{content}</pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
