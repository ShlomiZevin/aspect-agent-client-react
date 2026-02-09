import { useState } from 'react';
import type { DebugPromptData } from '../../../types';
import styles from './DebugPanel.module.css';

interface DebugPanelProps {
  data: DebugPromptData;
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

  const sections = [
    // Show transition system prompt first if it was injected (most important for debugging)
    ...(data.transitionSystemPrompt && data.transitionPromptInjected ? [{
      key: 'transitionPrompt',
      label: '** TRANSITION PROMPT (INJECTED) **',
      content: data.transitionSystemPrompt,
    }] : []),
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
    <div className={styles.container}>
      <button className={styles.header} onClick={() => setIsExpanded(!isExpanded)}>
        <span className={styles.badge}>DEBUG</span>
        <span className={styles.meta}>
          {data.crewDisplayName} | {data.model} | {data.maxTokens} tokens
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
