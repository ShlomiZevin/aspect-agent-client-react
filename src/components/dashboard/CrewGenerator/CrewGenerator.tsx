/**
 * CrewGenerator Component
 *
 * A wizard-style component for generating crew members from natural language descriptions.
 * Flow: Input description -> Generating (loading) -> Review/Edit -> Save
 */
import { useState } from 'react';
import { generateCrewMember, createCrewMember } from '../../../services/crewService';
import type { CrewMemberConfig, CrewGeneratorState } from '../../../types/crew';
import styles from './CrewGenerator.module.css';

interface CrewGeneratorProps {
  agentName: string;
  baseURL: string;
  onCrewCreated: (crew: CrewMemberConfig) => void;
  onCancel: () => void;
}

export function CrewGenerator({ agentName, baseURL, onCrewCreated, onCancel }: CrewGeneratorProps) {
  const [state, setState] = useState<CrewGeneratorState>({
    step: 'input',
    description: '',
    generatedConfig: null,
    error: null,
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleDescriptionChange = (value: string) => {
    setState(prev => ({ ...prev, description: value }));
  };

  const handleGenerate = async () => {
    if (!state.description.trim()) return;

    setState(prev => ({ ...prev, step: 'generating', error: null }));

    try {
      const result = await generateCrewMember(agentName, state.description, baseURL);

      if (result.success && result.config) {
        setState(prev => ({
          ...prev,
          step: 'review',
          generatedConfig: result.config,
        }));
      } else {
        setState(prev => ({
          ...prev,
          step: 'error',
          error: result.error || 'Failed to generate crew member',
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        step: 'error',
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }));
    }
  };

  const handleSave = async () => {
    if (!state.generatedConfig) return;

    setIsSaving(true);

    try {
      const created = await createCrewMember(
        agentName,
        {
          name: state.generatedConfig.name,
          displayName: state.generatedConfig.displayName,
          description: state.generatedConfig.description,
          isDefault: state.generatedConfig.isDefault,
          guidance: state.generatedConfig.guidance,
          model: state.generatedConfig.model,
          maxTokens: state.generatedConfig.maxTokens,
          knowledgeBase: state.generatedConfig.knowledgeBase,
          fieldsToCollect: state.generatedConfig.fieldsToCollect,
          transitionTo: state.generatedConfig.transitionTo,
          transitionSystemPrompt: state.generatedConfig.transitionSystemPrompt,
          tools: state.generatedConfig.tools,
        },
        baseURL
      );

      if (created) {
        onCrewCreated(created);
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        step: 'error',
        error: error instanceof Error ? error.message : 'Failed to save crew member',
      }));
    } finally {
      setIsSaving(false);
    }
  };

  const handleRetry = () => {
    setState(prev => ({ ...prev, step: 'input', error: null }));
  };

  const handleBack = () => {
    if (state.step === 'review' || state.step === 'error') {
      setState(prev => ({ ...prev, step: 'input', error: null }));
    } else {
      onCancel();
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Create Crew Member</h2>
        <button className={styles.backButton} onClick={handleBack}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back
        </button>
      </div>

      {state.step === 'input' && (
        <div className={styles.inputStep}>
          <p className={styles.description}>
            Describe the crew member you want to create in natural language.
            Include details about their role, personality, what they should help with,
            any specific knowledge they should have, and how they should interact with users.
          </p>

          <div className={styles.textareaWrapper}>
            <textarea
              className={styles.textarea}
              placeholder="Example: I need a friendly intake specialist who greets new users and collects their basic information like name, email, and what they're looking for. They should be warm and professional, ask one question at a time, and once they have all the info, hand off to the main support agent."
              value={state.description}
              onChange={e => handleDescriptionChange(e.target.value)}
              maxLength={5000}
            />
            <div className={styles.charCount}>
              {state.description.length} / 5000
            </div>
          </div>

          <button
            className={styles.generateButton}
            onClick={handleGenerate}
            disabled={!state.description.trim()}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            Generate Crew Member
          </button>
        </div>
      )}

      {state.step === 'generating' && (
        <div className={styles.generatingStep}>
          <div className={styles.spinner} />
          <div className={styles.generatingText}>
            <h3 className={styles.generatingTitle}>Generating Crew Member</h3>
            <p className={styles.generatingSubtitle}>
              Claude is analyzing your description and creating a configuration...
            </p>
          </div>
        </div>
      )}

      {state.step === 'review' && state.generatedConfig && (
        <div className={styles.reviewStep}>
          <div className={styles.successBanner}>
            <svg className={styles.successIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span className={styles.successText}>
              Crew member configuration generated successfully!
            </span>
          </div>

          <div className={styles.configPreview}>
            <div className={styles.configSection}>
              <div className={styles.configLabel}>Name</div>
              <div className={styles.configValue}>{state.generatedConfig.displayName}</div>
              <div className={styles.configValue} style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                ID: {state.generatedConfig.name}
              </div>
            </div>

            <div className={styles.configSection}>
              <div className={styles.configLabel}>Description</div>
              <div className={state.generatedConfig.description ? styles.configValue : styles.configValueMuted}>
                {state.generatedConfig.description || 'No description'}
              </div>
            </div>

            <div className={styles.configSection}>
              <div className={styles.configLabel}>Model</div>
              <div className={styles.configValue}>
                {state.generatedConfig.model} (max {state.generatedConfig.maxTokens} tokens)
              </div>
            </div>

            <div className={styles.configSection}>
              <div className={styles.configLabel}>Guidance / System Prompt</div>
              <div className={styles.guidancePreview}>
                {state.generatedConfig.guidance}
              </div>
            </div>

            {state.generatedConfig.fieldsToCollect.length > 0 && (
              <div className={styles.configSection}>
                <div className={styles.configLabel}>Fields to Collect</div>
                <div className={styles.tagList}>
                  {state.generatedConfig.fieldsToCollect.map((field, i) => (
                    <span key={i} className={styles.tag}>{field.name}</span>
                  ))}
                </div>
              </div>
            )}

            {state.generatedConfig.tools.length > 0 && (
              <div className={styles.configSection}>
                <div className={styles.configLabel}>Tools</div>
                <div className={styles.tagList}>
                  {state.generatedConfig.tools.map((tool, i) => (
                    <span key={i} className={styles.tag}>{tool}</span>
                  ))}
                </div>
              </div>
            )}

            {state.generatedConfig.transitionTo && (
              <div className={styles.configSection}>
                <div className={styles.configLabel}>Transitions To</div>
                <div className={styles.configValue}>{state.generatedConfig.transitionTo}</div>
              </div>
            )}
          </div>

          <div className={styles.reviewActions}>
            <button className={styles.secondaryButton} onClick={handleRetry}>
              Regenerate
            </button>
            <button
              className={styles.primaryButton}
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Crew Member'}
            </button>
          </div>
        </div>
      )}

      {state.step === 'error' && (
        <div className={styles.errorStep}>
          <div className={styles.errorBanner}>
            <svg className={styles.errorIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div className={styles.errorContent}>
              <h4 className={styles.errorTitle}>Generation Failed</h4>
              <p className={styles.errorMessage}>{state.error}</p>
            </div>
          </div>

          <button className={styles.retryButton} onClick={handleRetry}>
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
