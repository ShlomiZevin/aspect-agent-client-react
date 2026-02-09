import { useState, useEffect, useCallback } from 'react';
import {
  getFields,
  updateFields,
  deleteFields,
  type FieldDefinition,
  type CrewMemberInfo,
} from '../../../services/fieldsService';
import styles from './FieldsEditorPanel.module.css';

interface FieldsEditorPanelProps {
  conversationId: string;
  baseURL: string;
  isDebugMode?: boolean;
  onClose: () => void;
  onFieldsUpdated?: () => void;
}

type StatusType = 'success' | 'error' | 'info' | null;

interface Status {
  type: StatusType;
  message: string;
}

export function FieldsEditorPanel({
  conversationId,
  baseURL,
  isDebugMode = false,
  onClose,
  onFieldsUpdated,
}: FieldsEditorPanelProps) {
  // Fields data
  const [collectedFields, setCollectedFields] = useState<Record<string, string>>({});
  const [fieldDefinitions, setFieldDefinitions] = useState<FieldDefinition[]>([]);
  const [crewMember, setCrewMember] = useState<CrewMemberInfo | null>(null);
  const [totalFieldsToCurrentCrew, setTotalFieldsToCurrentCrew] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Edit state - track pending edits before save
  const [editedFields, setEditedFields] = useState<Record<string, string>>({});
  const [/* editingField */, setEditingField] = useState<string | null>(null);

  // Status message
  const [status, setStatus] = useState<Status>({ type: null, message: '' });

  // Loading state for operations
  const [isSaving, setIsSaving] = useState(false);

  // Load fields
  const loadFields = useCallback(async () => {
    if (!conversationId) return;

    setIsLoading(true);
    try {
      const data = await getFields(conversationId, baseURL);
      setCollectedFields(data.collectedFields);
      setFieldDefinitions(data.fieldDefinitions);
      setCrewMember(data.currentCrewMember);
      setTotalFieldsToCurrentCrew(data.totalFieldsToCurrentCrew || 0);
      setEditedFields({}); // Clear pending edits on reload
    } catch (error) {
      console.error('Failed to load fields:', error);
      setStatus({ type: 'error', message: 'Failed to load fields' });
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, baseURL]);

  // Load fields on mount
  useEffect(() => {
    loadFields();
  }, [loadFields]);

  // Get the value to display (edited or original)
  const getDisplayValue = (fieldName: string): string => {
    if (fieldName in editedFields) {
      return editedFields[fieldName];
    }
    return collectedFields[fieldName] || '';
  };

  // Check if a field has been modified
  const isFieldDirty = (fieldName: string): boolean => {
    if (!(fieldName in editedFields)) return false;
    return editedFields[fieldName] !== (collectedFields[fieldName] || '');
  };

  // Check if there are any unsaved changes
  const hasUnsavedChanges = Object.keys(editedFields).some(
    key => editedFields[key] !== (collectedFields[key] || '')
  );

  // Handle field value change
  const handleFieldChange = (fieldName: string, value: string) => {
    setEditedFields(prev => ({ ...prev, [fieldName]: value }));
  };

  // Handle field focus
  const handleFieldFocus = (fieldName: string) => {
    setEditingField(fieldName);
  };

  // Handle field blur - auto-save single field
  const handleFieldBlur = async (fieldName: string) => {
    setEditingField(null);

    if (isFieldDirty(fieldName)) {
      await saveField(fieldName);
    }
  };

  // Save a single field
  const saveField = async (fieldName: string) => {
    const value = editedFields[fieldName];
    if (value === undefined) return;

    setIsSaving(true);
    try {
      await updateFields(conversationId, { [fieldName]: value }, baseURL);

      // Update local state
      setCollectedFields(prev => ({ ...prev, [fieldName]: value }));
      setEditedFields(prev => {
        const next = { ...prev };
        delete next[fieldName];
        return next;
      });

      setStatus({ type: 'success', message: `Saved "${fieldName}"` });
      onFieldsUpdated?.();
    } catch (error) {
      console.error('Failed to save field:', error);
      setStatus({ type: 'error', message: `Failed to save "${fieldName}"` });
    } finally {
      setIsSaving(false);
    }
  };

  // Save all pending changes
  const handleSaveAll = async () => {
    if (!hasUnsavedChanges) return;

    setIsSaving(true);
    try {
      await updateFields(conversationId, editedFields, baseURL);

      // Update local state
      setCollectedFields(prev => ({ ...prev, ...editedFields }));
      setEditedFields({});

      setStatus({ type: 'success', message: 'All changes saved' });
      onFieldsUpdated?.();
    } catch (error) {
      console.error('Failed to save fields:', error);
      setStatus({ type: 'error', message: 'Failed to save changes' });
    } finally {
      setIsSaving(false);
    }
  };

  // Clear a field
  const handleClearField = async (fieldName: string) => {
    setIsSaving(true);
    try {
      await deleteFields(conversationId, [fieldName], baseURL);

      // Update local state
      setCollectedFields(prev => {
        const next = { ...prev };
        delete next[fieldName];
        return next;
      });
      setEditedFields(prev => {
        const next = { ...prev };
        delete next[fieldName];
        return next;
      });

      setStatus({ type: 'success', message: `Cleared "${fieldName}"` });
      onFieldsUpdated?.();
    } catch (error) {
      console.error('Failed to clear field:', error);
      setStatus({ type: 'error', message: `Failed to clear "${fieldName}"` });
    } finally {
      setIsSaving(false);
    }
  };

  // Discard pending changes
  const handleDiscardChanges = () => {
    setEditedFields({});
    setStatus({ type: 'info', message: 'Changes discarded' });
  };

  // Clear status after delay
  useEffect(() => {
    if (status.type) {
      const timer = setTimeout(() => {
        setStatus({ type: null, message: '' });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  // Build list of fields to display
  // Show all field definitions + any collected fields not in definitions
  const allFieldNames = new Set([
    ...fieldDefinitions.map(f => f.name),
    ...Object.keys(collectedFields),
  ]);

  const fieldsList = Array.from(allFieldNames).map(name => ({
    name,
    description: fieldDefinitions.find(f => f.name === name)?.description || '',
    value: getDisplayValue(name),
    isCollected: name in collectedFields || name in editedFields,
    isDirty: isFieldDirty(name),
  }));

  // Count collected fields for current crew (only fields in fieldDefinitions)
  const currentCrewFieldNames = new Set(fieldDefinitions.map(f => f.name));
  const currentCrewCollected = Object.keys(collectedFields).filter(
    name => currentCrewFieldNames.has(name)
  ).length;
  const currentCrewTotal = fieldDefinitions.length;

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <h3>Collected Fields</h3>
          {isDebugMode && <span className={styles.debugBadge}>DEBUG</span>}
        </div>
        <button
          className={styles.closeButton}
          onClick={onClose}
          title="Close panel"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Crew Info & Progress */}
      {crewMember && (
        <div className={styles.crewInfo}>
          <div className={styles.crewHeader}>
            <span className={styles.crewName}>{crewMember.displayName}</span>
            <span className={styles.crewMode}>{crewMember.extractionMode}</span>
          </div>
          <div className={styles.progressRow}>
            <div className={styles.progressItem}>
              <span className={styles.progressLabel}>This step:</span>
              <span className={styles.progressBadge}>
                {currentCrewCollected}/{currentCrewTotal}
              </span>
            </div>
            <div className={styles.progressItem}>
              <span className={styles.progressLabel}>Overall:</span>
              <span className={styles.progressBadge}>
                {Object.keys(collectedFields).length}/{totalFieldsToCurrentCrew}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>...</div>
          <p className={styles.emptyText}>Loading fields...</p>
        </div>
      ) : fieldsList.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>-</div>
          <p className={styles.emptyText}>
            No fields to collect for this crew member.
          </p>
        </div>
      ) : (
        /* Fields List */
        <div className={styles.fieldsSection}>
          {fieldsList.map(field => (
            <div
              key={field.name}
              className={`${styles.fieldRow} ${field.isCollected ? styles.collected : ''} ${field.isDirty ? styles.dirty : ''}`}
            >
              <div className={styles.fieldHeader}>
                <label className={styles.fieldName} title={field.description}>
                  {field.name}
                </label>
                {field.isCollected && (
                  <button
                    className={styles.clearButton}
                    onClick={() => handleClearField(field.name)}
                    disabled={isSaving}
                    title="Clear this field"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
              {field.description && (
                <p className={styles.fieldDescription}>{field.description}</p>
              )}
              <input
                type="text"
                className={styles.fieldInput}
                value={field.value}
                onChange={e => handleFieldChange(field.name, e.target.value)}
                onFocus={() => handleFieldFocus(field.name)}
                onBlur={() => handleFieldBlur(field.name)}
                placeholder="Not collected"
                disabled={isSaving}
              />
            </div>
          ))}
        </div>
      )}

      {/* Actions Section */}
      <div className={styles.actionsSection}>
        <div className={styles.actionButtons}>
          <button
            className={styles.refreshButton}
            onClick={loadFields}
            disabled={isLoading || isSaving}
            title="Refresh fields from server"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            Refresh
          </button>
          {hasUnsavedChanges && (
            <>
              <button
                className={styles.discardButton}
                onClick={handleDiscardChanges}
                disabled={isSaving}
              >
                Discard
              </button>
              <button
                className={styles.saveAllButton}
                onClick={handleSaveAll}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save All'}
              </button>
            </>
          )}
        </div>

        {/* Status Message */}
        {status.type && (
          <div className={`${styles.statusMessage} ${styles[status.type]}`}>
            {status.type === 'success' && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
            {status.type === 'error' && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            )}
            {status.type === 'info' && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            )}
            {status.message}
          </div>
        )}
      </div>
    </div>
  );
}
