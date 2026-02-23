import { useState, useEffect, useCallback } from 'react';
import {
  getContext,
  updateContext,
  deleteContext,
  type ContextResponse,
} from '../../../services/contextService';
import styles from './ContextEditorPanel.module.css';

interface ContextEditorPanelProps {
  conversationId: string;
  baseURL: string;
  isDebugMode?: boolean;
  onClose: () => void;
  refreshKey?: number;
}

type StatusType = 'success' | 'error' | 'info' | null;

interface Status {
  type: StatusType;
  message: string;
}

type ContextLevel = 'user' | 'conversation';

interface NamespaceEdit {
  namespace: string;
  level: ContextLevel;
  value: string;
  isValid: boolean;
}

export function ContextEditorPanel({
  conversationId,
  baseURL,
  isDebugMode = false,
  onClose,
  refreshKey,
}: ContextEditorPanelProps) {
  const [contextData, setContextData] = useState<ContextResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<Status>({ type: null, message: '' });

  // Track which namespaces are expanded
  const [expandedNamespaces, setExpandedNamespaces] = useState<Set<string>>(new Set());

  // Track edits in progress
  const [editingNamespace, setEditingNamespace] = useState<NamespaceEdit | null>(null);

  // Load context
  const loadContext = useCallback(async () => {
    if (!conversationId) return;

    setIsLoading(true);
    try {
      const data = await getContext(conversationId, baseURL);
      setContextData(data);
      setEditingNamespace(null);
    } catch (error: unknown) {
      const is404 = error instanceof Error && error.message.includes('404');
      if (is404) {
        setContextData({
          conversationId,
          userLevel: {},
          conversationLevel: {}
        });
      } else {
        console.error('Failed to load context:', error);
        setStatus({ type: 'error', message: 'Failed to load context' });
      }
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, baseURL]);

  useEffect(() => {
    loadContext();
  }, [loadContext, refreshKey]);

  // Clear status after delay
  useEffect(() => {
    if (status.type) {
      const timer = setTimeout(() => {
        setStatus({ type: null, message: '' });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  const toggleNamespace = (key: string) => {
    setExpandedNamespaces(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const startEditing = (namespace: string, level: ContextLevel, data: unknown) => {
    setEditingNamespace({
      namespace,
      level,
      value: JSON.stringify(data, null, 2),
      isValid: true
    });
  };

  const handleEditChange = (value: string) => {
    if (!editingNamespace) return;

    let isValid = true;
    try {
      JSON.parse(value);
    } catch {
      isValid = false;
    }

    setEditingNamespace({
      ...editingNamespace,
      value,
      isValid
    });
  };

  const cancelEdit = () => {
    setEditingNamespace(null);
  };

  const saveEdit = async () => {
    if (!editingNamespace || !editingNamespace.isValid) return;

    setIsSaving(true);
    try {
      const data = JSON.parse(editingNamespace.value);
      await updateContext(
        conversationId,
        editingNamespace.namespace,
        data,
        editingNamespace.level,
        baseURL
      );

      setStatus({ type: 'success', message: `Saved "${editingNamespace.namespace}"` });
      setEditingNamespace(null);
      await loadContext();
    } catch (error) {
      console.error('Failed to save context:', error);
      setStatus({ type: 'error', message: `Failed to save "${editingNamespace.namespace}"` });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (namespace: string, level: ContextLevel) => {
    if (!confirm(`Delete "${namespace}" (${level}-level)?`)) return;

    setIsSaving(true);
    try {
      await deleteContext(conversationId, namespace, level, baseURL);
      setStatus({ type: 'success', message: `Deleted "${namespace}"` });
      await loadContext();
    } catch (error) {
      console.error('Failed to delete context:', error);
      setStatus({ type: 'error', message: `Failed to delete "${namespace}"` });
    } finally {
      setIsSaving(false);
    }
  };

  const renderNamespaceItem = (
    namespace: string,
    data: unknown,
    level: ContextLevel
  ) => {
    const key = `${level}:${namespace}`;
    const isExpanded = expandedNamespaces.has(key);
    const isEditing = editingNamespace?.namespace === namespace &&
                      editingNamespace?.level === level;

    return (
      <div key={key} className={styles.namespaceItem}>
        <div className={styles.namespaceHeader} onClick={() => toggleNamespace(key)}>
          <div className={styles.namespaceInfo}>
            <svg
              className={`${styles.chevron} ${isExpanded ? styles.expanded : ''}`}
              width="12" height="12" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            <span className={styles.namespaceName}>{namespace}</span>
            <span className={`${styles.levelBadge} ${styles[level]}`}>
              {level}
            </span>
          </div>
          <div className={styles.namespaceActions} onClick={e => e.stopPropagation()}>
            {!isEditing && (
              <>
                <button
                  className={styles.editButton}
                  onClick={() => startEditing(namespace, level, data)}
                  disabled={isSaving}
                  title="Edit"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
                <button
                  className={styles.deleteButton}
                  onClick={() => handleDelete(namespace, level)}
                  disabled={isSaving}
                  title="Delete"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>

        {isExpanded && (
          <div className={styles.namespaceContent}>
            {isEditing ? (
              <div className={styles.editContainer}>
                <textarea
                  className={`${styles.editTextarea} ${!editingNamespace.isValid ? styles.invalid : ''}`}
                  value={editingNamespace.value}
                  onChange={(e) => handleEditChange(e.target.value)}
                  disabled={isSaving}
                  rows={10}
                />
                {!editingNamespace.isValid && (
                  <span className={styles.invalidHint}>Invalid JSON</span>
                )}
                <div className={styles.editActions}>
                  <button
                    className={styles.cancelButton}
                    onClick={cancelEdit}
                    disabled={isSaving}
                  >
                    Cancel
                  </button>
                  <button
                    className={styles.saveButton}
                    onClick={saveEdit}
                    disabled={isSaving || !editingNamespace.isValid}
                  >
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              <pre className={styles.jsonContent}>
                {JSON.stringify(data, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    );
  };

  const userNamespaces = contextData ? Object.keys(contextData.userLevel) : [];
  const convNamespaces = contextData ? Object.keys(contextData.conversationLevel) : [];
  const hasAnyContext = userNamespaces.length > 0 || convNamespaces.length > 0;

  return (
    <div className={styles.panel} dir="ltr">
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <h3>Context Data</h3>
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

      {/* Loading State */}
      {isLoading ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>...</div>
          <p className={styles.emptyText}>Loading context...</p>
        </div>
      ) : !hasAnyContext ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>{ }</div>
          <p className={styles.emptyText}>No context data yet.</p>
          <p className={styles.emptyHint}>Context will appear here as the conversation progresses.</p>
        </div>
      ) : (
        <div className={styles.contextSection}>
          {/* User-level context */}
          {userNamespaces.length > 0 && (
            <div className={styles.levelSection}>
              <h4 className={styles.levelHeader}>
                <span className={styles.levelIcon}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </span>
                User-Level
                <span className={styles.countBadge}>{userNamespaces.length}</span>
              </h4>
              {userNamespaces.map(ns =>
                renderNamespaceItem(ns, contextData!.userLevel[ns], 'user')
              )}
            </div>
          )}

          {/* Conversation-level context */}
          {convNamespaces.length > 0 && (
            <div className={styles.levelSection}>
              <h4 className={styles.levelHeader}>
                <span className={styles.levelIcon}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </span>
                Conversation-Level
                <span className={styles.countBadge}>{convNamespaces.length}</span>
              </h4>
              {convNamespaces.map(ns =>
                renderNamespaceItem(ns, contextData!.conversationLevel[ns], 'conversation')
              )}
            </div>
          )}
        </div>
      )}

      {/* Actions Section */}
      <div className={styles.actionsSection}>
        <div className={styles.actionButtons}>
          <button
            className={styles.refreshButton}
            onClick={loadContext}
            disabled={isLoading || isSaving}
            title="Refresh context from server"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            Refresh
          </button>
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
