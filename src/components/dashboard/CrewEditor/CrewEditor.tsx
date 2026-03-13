/**
 * CrewEditor Component
 *
 * Edit existing crew member configurations.
 * Supports editing string fields for DB-based crews.
 * File-based crews are displayed as read-only.
 */
import { useState, useEffect } from 'react';
import { updateCrewMember, deleteCrewMember, exportCrewMember } from '../../../services/crewService';
import { getKnowledgeBases } from '../../../services/kbService';
import type { CrewMemberConfig, CrewMemberUpdateRequest } from '../../../types/crew';
import type { KnowledgeBase } from '../../../types';
import styles from './CrewEditor.module.css';

const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  google: 'Google',
  both: 'OpenAI + Google',
};

interface CrewEditorProps {
  agentName: string;
  crew: CrewMemberConfig;
  baseURL: string;
  onSaved: (crew: CrewMemberConfig) => void;
  onDeleted: (crewName: string) => void;
  onCancel: () => void;
}

export function CrewEditor({ agentName, crew, baseURL, onSaved, onDeleted, onCancel }: CrewEditorProps) {
  const [formData, setFormData] = useState<CrewMemberUpdateRequest>({
    displayName: crew.displayName,
    description: crew.description,
    guidance: crew.guidance,
    model: crew.model,
    maxTokens: crew.maxTokens,
    isDefault: crew.isDefault,
    transitionTo: crew.transitionTo,
    transitionSystemPrompt: crew.transitionSystemPrompt,
    knowledgeBase: crew.knowledgeBase,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [availableKBs, setAvailableKBs] = useState<KnowledgeBase[]>([]);
  const [isLoadingKBs, setIsLoadingKBs] = useState(false);

  const isFileSource = crew.source === 'file';
  const isReadOnly = isFileSource;

  useEffect(() => {
    // Reset form when crew changes
    setFormData({
      displayName: crew.displayName,
      description: crew.description,
      guidance: crew.guidance,
      model: crew.model,
      maxTokens: crew.maxTokens,
      isDefault: crew.isDefault,
      transitionTo: crew.transitionTo,
      transitionSystemPrompt: crew.transitionSystemPrompt,
      knowledgeBase: crew.knowledgeBase,
    });
    setError(null);
    setSuccess(null);
  }, [crew]);

  useEffect(() => {
    const load = async () => {
      setIsLoadingKBs(true);
      try {
        const kbs = await getKnowledgeBases(agentName, baseURL);
        setAvailableKBs(kbs);
      } catch {
        // Non-critical — KB list just won't show
      } finally {
        setIsLoadingKBs(false);
      }
    };
    load();
  }, [agentName, baseURL]);

  const handleKBChange = (kbId: string) => {
    if (!kbId) {
      handleChange('knowledgeBase', null);
      return;
    }
    const kb = availableKBs.find(k => String(k.id) === kbId);
    if (!kb) return;
    handleChange('knowledgeBase', {
      enabled: true,
      kbId: kb.id,
      storeId: kb.vectorStoreId,
      googleCorpusId: kb.googleCorpusId,
    });
  };

  const handleChange = <K extends keyof CrewMemberUpdateRequest>(
    field: K,
    value: CrewMemberUpdateRequest[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
    setSuccess(null);
  };

  const handleSave = async () => {
    if (isReadOnly) return;

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const updated = await updateCrewMember(agentName, crew.name, formData, baseURL);
      if (updated) {
        setSuccess('Crew member saved successfully');
        onSaved(updated);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (isReadOnly) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete "${crew.displayName}"? This action cannot be undone.`
    );
    if (!confirmed) return;

    setIsDeleting(true);
    setError(null);

    try {
      const success = await deleteCrewMember(agentName, crew.name, baseURL);
      if (success) {
        onDeleted(crew.name);
      } else {
        setError('Failed to delete crew member');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);

    try {
      const result = await exportCrewMember(agentName, crew.name, baseURL);
      if (result.success && result.code) {
        // Create a download
        const blob = new Blob([result.code], { type: 'text/javascript' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.filename || `${crew.name}.crew.js`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setSuccess('File exported successfully');
      } else {
        setError(result.error || 'Failed to export');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.backButton} onClick={onCancel}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div className={styles.titleSection}>
            <h2 className={styles.title}>{crew.displayName}</h2>
            <span className={styles.subtitle}>ID: {crew.name}</span>
          </div>
        </div>
        <span className={`${styles.sourceTag} ${isFileSource ? styles.sourceFile : styles.sourceDatabase}`}>
          {isFileSource ? 'File-based' : 'Database'}
        </span>
      </div>

      {isReadOnly && (
        <div className={styles.form}>
          <div className={styles.readOnlyNotice}>
            <svg className={styles.readOnlyIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span>
              This crew member is file-based and can only be edited by modifying the source code.
              You can export DB-based crews to files using the Export button.
            </span>
          </div>
        </div>
      )}

      <div className={styles.form}>
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Basic Information</h3>

          <div className={styles.field}>
            <label className={styles.label}>
              Display Name <span className={styles.required}>*</span>
            </label>
            <input
              type="text"
              className={styles.input}
              value={formData.displayName || ''}
              onChange={e => handleChange('displayName', e.target.value)}
              disabled={isReadOnly}
              placeholder="Friendly name for the crew member"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Description</label>
            <textarea
              className={styles.textarea}
              value={formData.description || ''}
              onChange={e => handleChange('description', e.target.value)}
              disabled={isReadOnly}
              placeholder="Brief description of what this crew member does"
            />
          </div>

          <div className={styles.checkbox}>
            <input
              type="checkbox"
              id="isDefault"
              className={styles.checkboxInput}
              checked={formData.isDefault || false}
              onChange={e => handleChange('isDefault', e.target.checked)}
              disabled={isReadOnly}
            />
            <label htmlFor="isDefault" className={styles.checkboxLabel}>
              Default crew member (receives messages when no other crew is selected)
            </label>
          </div>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Model Configuration</h3>

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Model</label>
              {isReadOnly ? (
                <div className={styles.input} style={{ color: 'var(--text-primary)', cursor: 'default' }}>
                  {formData.model || 'gpt-4o'}
                </div>
              ) : (
                <select
                  className={styles.select}
                  value={formData.model || 'gpt-4o'}
                  onChange={e => handleChange('model', e.target.value)}
                >
                  <option value="gpt-5-chat-latest">GPT-5</option>
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="gpt-4o-mini">GPT-4o Mini</option>
                  <option value="gpt-4-turbo">GPT-4 Turbo</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                  <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
                </select>
              )}
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Max Tokens</label>
              <input
                type="number"
                className={styles.input}
                value={formData.maxTokens || 2048}
                onChange={e => handleChange('maxTokens', parseInt(e.target.value) || 2048)}
                disabled={isReadOnly}
                min={100}
                max={16000}
              />
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Knowledge Base</h3>

          {/* File-based crews: show sources[] as read-only tags */}
          {isFileSource && crew.knowledgeBase ? (
            <div className={styles.field}>
              <label className={styles.label}>KB Sources (file-configured)</label>
              <div className={styles.tagList}>
                {(crew.knowledgeBase.sources ?? []).length > 0 ? (
                  (crew.knowledgeBase.sources ?? []).map((src, i) => (
                    <span key={i} className={styles.tag}>{typeof src === 'string' ? src : src.name}</span>
                  ))
                ) : (
                  <span className={styles.emptyTag}>No KB sources configured</span>
                )}
              </div>
              <span className={styles.hint}>
                KB sources are defined in the crew file and resolved at runtime.
              </span>
            </div>
          ) : (
            /* DB-based crews: editable dropdown by kbId */
            <>
              <div className={styles.field}>
                <label className={styles.label}>Assign Knowledge Base</label>
                <select
                  className={styles.select}
                  value={formData.knowledgeBase?.kbId ? String(formData.knowledgeBase.kbId) : ''}
                  onChange={e => handleKBChange(e.target.value)}
                  disabled={isReadOnly || isLoadingKBs}
                >
                  <option value="">{isLoadingKBs ? 'Loading...' : 'None (no KB)'}</option>
                  {availableKBs.map(kb => (
                    <option key={kb.id} value={String(kb.id)}>
                      {kb.name} — {PROVIDER_LABELS[kb.provider] ?? kb.provider}
                    </option>
                  ))}
                </select>
                <span className={styles.hint}>
                  The crew member will search this knowledge base when answering questions.
                </span>
              </div>

              {formData.knowledgeBase && (
                <div className={styles.kbInfo}>
                  {formData.knowledgeBase.storeId && (
                    <div className={styles.kbIdRow}>
                      <span className={styles.kbIdLabel}>OpenAI Store:</span>
                      <code className={styles.kbIdValue}>{formData.knowledgeBase.storeId}</code>
                    </div>
                  )}
                  {formData.knowledgeBase.googleCorpusId && (
                    <div className={styles.kbIdRow}>
                      <span className={styles.kbIdLabel}>Google Corpus:</span>
                      <code className={styles.kbIdValue}>{formData.knowledgeBase.googleCorpusId}</code>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Guidance / System Prompt</h3>

          <div className={styles.field}>
            <textarea
              className={`${styles.textarea} ${styles.guidanceTextarea}`}
              value={formData.guidance || ''}
              onChange={e => handleChange('guidance', e.target.value)}
              disabled={isReadOnly}
              placeholder="The system prompt that defines this crew member's behavior..."
            />
            <span className={styles.hint}>
              This is the main instruction set that guides the crew member's behavior and responses.
            </span>
          </div>
        </div>

        {crew.persona && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Agent Persona</h3>
            <div className={styles.field}>
              <textarea
                className={`${styles.textarea} ${styles.guidanceTextarea}`}
                value={crew.persona}
                readOnly
                placeholder="No persona defined"
              />
              <span className={styles.hint}>
                Shared character &amp; voice injected into all crew members of this agent. Defined in the agent's persona file.
              </span>
            </div>
          </div>
        )}

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Transitions</h3>

          <div className={styles.field}>
            <label className={styles.label}>Transition To</label>
            <input
              type="text"
              className={styles.input}
              value={formData.transitionTo || ''}
              onChange={e => handleChange('transitionTo', e.target.value || null)}
              disabled={isReadOnly}
              placeholder="Name of the crew member to transition to (optional)"
            />
            <span className={styles.hint}>
              When this crew member completes its task, it can hand off to another crew member.
            </span>
          </div>

          {formData.transitionTo && (
            <div className={styles.field}>
              <label className={styles.label}>Transition System Prompt</label>
              <textarea
                className={styles.textarea}
                value={formData.transitionSystemPrompt || ''}
                onChange={e => handleChange('transitionSystemPrompt', e.target.value || null)}
                disabled={isReadOnly}
                placeholder="Additional context to pass to the next crew member..."
              />
            </div>
          )}
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Tools & Fields (Read-only)</h3>

          <div className={styles.field}>
            <label className={styles.label}>Tools</label>
            <div className={styles.tagList}>
              {crew.tools.length > 0 ? (
                crew.tools.map((tool, i) => (
                  <span key={i} className={styles.tag}>{tool}</span>
                ))
              ) : (
                <span className={styles.emptyTag}>No tools configured</span>
              )}
            </div>
            <span className={styles.hint}>
              Tools can only be configured via file-based crews or during generation.
            </span>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Fields to Collect</label>
            <div className={styles.tagList}>
              {crew.fieldsToCollect.length > 0 ? (
                crew.fieldsToCollect.map((field, i) => (
                  <span key={i} className={styles.tag} title={field.description}>
                    {field.name}
                  </span>
                ))
              ) : (
                <span className={styles.emptyTag}>No fields to collect</span>
              )}
            </div>
          </div>
        </div>

        {error && <div className={styles.error}>{error}</div>}
        {success && <div className={styles.success}>{success}</div>}
      </div>

      <div className={styles.actions}>
        <div className={styles.leftActions}>
          {!isReadOnly && (
            <button
              className={styles.deleteButton}
              onClick={handleDelete}
              disabled={isDeleting || isSaving}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          )}
          {!isFileSource && (
            <button
              className={styles.exportButton}
              onClick={handleExport}
              disabled={isExporting}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
              </svg>
              {isExporting ? 'Exporting...' : 'Export to File'}
            </button>
          )}
        </div>

        <div className={styles.rightActions}>
          <button
            className={styles.cancelButton}
            onClick={onCancel}
            disabled={isSaving}
          >
            Cancel
          </button>
          {!isReadOnly && (
            <button
              className={styles.saveButton}
              onClick={handleSave}
              disabled={isSaving || isDeleting}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
