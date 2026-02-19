import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DemoMockup, DemoMessage, DemoConfig, ViewMode } from '../../../types/demo';
import { DEFAULT_CONFIG } from '../../../types/demo';
import { getMockup, createMockup, updateMockup } from '../../../services/demoService';
import { WhatsAppView } from '../WhatsAppView';
import { RegularView } from '../RegularView';
import { ConfigPanel } from '../ConfigPanel';
import { MessageEditor, QuickAddMessage } from '../MessageEditor';
import { ParseModal } from '../ParseModal';
import { SpreadDatesModal } from '../SpreadDatesModal';
import styles from './DemoEditor.module.css';

type DisplayMode = 'framed' | 'fullscreen' | 'embedded';

interface DemoEditorProps {
  mockupId?: string;
  isViewOnly?: boolean;
  isEmbed?: boolean;
}

export function DemoEditor({ mockupId, isViewOnly = false, isEmbed = false }: DemoEditorProps) {
  const navigate = useNavigate();

  // State
  const [loading, setLoading] = useState(!!mockupId);
  const [error, setError] = useState<string | null>(null);
  const [mockup, setMockup] = useState<DemoMockup | null>(null);

  // Editable state (local until saved)
  const [title, setTitle] = useState('Untitled Mockup');
  const [viewMode, setViewMode] = useState<ViewMode>('regular');
  const [config, setConfig] = useState<DemoConfig>(DEFAULT_CONFIG);
  const [messages, setMessages] = useState<DemoMessage[]>([]);

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [editingMessage, setEditingMessage] = useState<DemoMessage | null>(null);
  const [showParseModal, setShowParseModal] = useState(false);
  const [showSpreadDatesModal, setShowSpreadDatesModal] = useState(false);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('framed');

  // Handle escape key to exit fullscreen in view mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && displayMode === 'fullscreen') {
        setDisplayMode('framed');
      }
    };
    if (isViewOnly) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [displayMode, isViewOnly]);

  // Load mockup if editing
  useEffect(() => {
    if (mockupId) {
      loadMockup(mockupId);
    }
  }, [mockupId]);

  const loadMockup = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMockup(id);
      setMockup(data);
      setTitle(data.title);
      setViewMode(data.viewMode);
      setConfig({ ...DEFAULT_CONFIG, ...data.config });
      setMessages(data.messages || []);
      setHasChanges(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load mockup');
    } finally {
      setLoading(false);
    }
  };

  // Mark changes
  const markChanged = useCallback(() => {
    setHasChanges(true);
  }, []);

  // Handlers
  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    markChanged();
  };

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    markChanged();
  };

  const handleConfigChange = (updates: Partial<DemoConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
    markChanged();
  };

  const handleAddMessage = (message: DemoMessage) => {
    setMessages((prev) => [...prev, message]);
    markChanged();
  };

  const handleUpdateMessage = (message: DemoMessage) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === message.id ? message : m))
    );
    setEditingMessage(null);
    markChanged();
  };

  const handleDeleteMessage = (id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
    setEditingMessage(null);
    markChanged();
  };

  const handleParsed = (parsedMessages: DemoMessage[]) => {
    setMessages(parsedMessages);
    markChanged();
  };

  const handleSpreadDates = (updatedMessages: DemoMessage[]) => {
    setMessages(updatedMessages);
    markChanged();
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const data = { title, viewMode, config, messages };

      if (mockup) {
        // Update existing
        const updated = await updateMockup(mockup.publicId, data);
        setMockup(updated);
      } else {
        // Create new
        const created = await createMockup(data);
        setMockup(created);
        // Navigate to edit URL with the new ID
        navigate(`/demo/${created.publicId}/edit`, { replace: true });
      }
      setHasChanges(false);
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyLink = () => {
    if (mockup) {
      const url = `${window.location.origin}/demo/${mockup.publicId}`;
      navigator.clipboard.writeText(url);
    }
  };

  // Loading state
  if (loading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  // Error state
  if (error) {
    return (
      <div className={styles.error}>
        <div className={styles.errorMessage}>{error}</div>
        <button className={styles.errorButton} onClick={() => navigate('/demo')}>
          Back to List
        </button>
      </div>
    );
  }

  // Embed mode - just the raw chat, no chrome
  if (isEmbed) {
    return (
      <div className={styles.embedContainer}>
        {viewMode === 'whatsapp' ? (
          <WhatsAppView messages={messages} config={config} />
        ) : (
          <RegularView messages={messages} config={config} />
        )}
      </div>
    );
  }

  // View-only mode with display options
  if (isViewOnly) {
    // Fullscreen view
    if (displayMode === 'fullscreen') {
      return (
        <div className={styles.fullscreenOverlay}>
          <button
            className={styles.fullscreenClose}
            onClick={() => setDisplayMode('framed')}
            aria-label="Exit fullscreen"
          >
            ✕
          </button>
          <div className={styles.fullscreenChat}>
            {viewMode === 'whatsapp' ? (
              <WhatsAppView messages={messages} config={config} />
            ) : (
              <RegularView messages={messages} config={config} />
            )}
          </div>
        </div>
      );
    }

    // Embedded view - shows chat as widget on a fake website
    if (displayMode === 'embedded') {
      return (
        <div className={styles.viewOnlyContainer}>
          <div className={styles.viewOnlyHeader}>
            <span className={styles.viewOnlyTitle}>{title}</span>
            <div className={styles.viewOnlyActions}>
              <div className={styles.displayModeToggle}>
                <button
                  className={styles.modeButton}
                  onClick={() => setDisplayMode('framed')}
                  title="Phone frame"
                >
                  📱
                </button>
                <button
                  className={styles.modeButton}
                  onClick={() => setDisplayMode('fullscreen')}
                  title="Fullscreen"
                >
                  ⛶
                </button>
                <button
                  className={`${styles.modeButton} ${styles.modeButtonActive}`}
                  onClick={() => setDisplayMode('embedded')}
                  title="Website embed"
                >
                  🌐
                </button>
              </div>
              <button
                className={styles.iconButton}
                onClick={() => navigate('/demo')}
              >
                ← Back
              </button>
            </div>
          </div>
          <div className={styles.fakeWebsite}>
            <div className={styles.fakeWebsiteNav}>
              <div className={styles.fakeNavLogo}>ACME Corp</div>
              <div className={styles.fakeNavLinks}>
                <span>Products</span>
                <span>Solutions</span>
                <span>Pricing</span>
                <span>Contact</span>
              </div>
            </div>
            <div className={styles.fakeWebsiteContent}>
              <div className={styles.fakeHero}>
                <h1>Welcome to Our Website</h1>
                <p>This is a preview of how your chat widget looks embedded on a customer site.</p>
              </div>
            </div>
            <div className={styles.embeddedWidget}>
              {viewMode === 'whatsapp' ? (
                <WhatsAppView messages={messages} config={config} />
              ) : (
                <RegularView messages={messages} config={config} />
              )}
            </div>
          </div>
        </div>
      );
    }

    // Framed view (default)
    return (
      <div className={styles.viewOnlyContainer}>
        <div className={styles.viewOnlyHeader}>
          <span className={styles.viewOnlyTitle}>{title}</span>
          <div className={styles.viewOnlyActions}>
            <div className={styles.displayModeToggle}>
              <button
                className={`${styles.modeButton} ${styles.modeButtonActive}`}
                onClick={() => setDisplayMode('framed')}
                title="Phone frame"
              >
                📱
              </button>
              <button
                className={styles.modeButton}
                onClick={() => setDisplayMode('fullscreen')}
                title="Fullscreen"
              >
                ⛶
              </button>
              <button
                className={styles.modeButton}
                onClick={() => setDisplayMode('embedded')}
                title="Website embed"
              >
                🌐
              </button>
            </div>
            <button
              className={styles.iconButton}
              onClick={() => navigate('/demo')}
            >
              ← Back
            </button>
          </div>
        </div>
        <div className={styles.viewOnlyContent}>
          <div className={styles.viewOnlyFrame}>
            {viewMode === 'whatsapp' ? (
              <WhatsAppView messages={messages} config={config} />
            ) : (
              <RegularView messages={messages} config={config} />
            )}
          </div>
        </div>
      </div>
    );
  }

  // Editor mode
  return (
    <div className={styles.container}>
      {/* Sidebar */}
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <button
            className={styles.backButton}
            onClick={() => navigate('/demo')}
            aria-label="Back to list"
          >
            ←
          </button>
          <span className={styles.sidebarTitle}>Demo Editor</span>
        </div>

        <div className={styles.sidebarContent}>
          <ConfigPanel
            title={title}
            viewMode={viewMode}
            config={config}
            onTitleChange={handleTitleChange}
            onViewModeChange={handleViewModeChange}
            onConfigChange={handleConfigChange}
            onSave={handleSave}
            onParseClick={() => setShowParseModal(true)}
            isSaving={isSaving}
            hasChanges={hasChanges}
          />
        </div>
      </div>

      {/* Preview area */}
      <div className={styles.preview}>
        <div className={styles.previewHeader}>
          <span className={styles.previewTitle}>Preview</span>
          <div className={styles.previewActions}>
            {messages.length > 0 && (
              <button
                className={styles.iconButton}
                onClick={() => setShowSpreadDatesModal(true)}
              >
                📅 Spread Dates
              </button>
            )}
            {mockup && (
              <button className={styles.iconButton} onClick={handleCopyLink}>
                🔗 Copy Link
              </button>
            )}
            {mockup && (
              <button
                className={styles.iconButton}
                onClick={() => window.open(`/demo/${mockup.publicId}`, '_blank')}
              >
                👁 View
              </button>
            )}
          </div>
        </div>

        <div className={styles.previewContent}>
          <div className={styles.previewFrame}>
            {viewMode === 'whatsapp' ? (
              <WhatsAppView
                messages={messages}
                config={config}
                onMessageClick={setEditingMessage}
                isEditable
              />
            ) : (
              <RegularView
                messages={messages}
                config={config}
                onMessageClick={setEditingMessage}
                isEditable
              />
            )}
          </div>
        </div>

        <div className={styles.quickAddBar}>
          <QuickAddMessage
            defaultSenderName={config.senderName}
            onAdd={handleAddMessage}
          />
        </div>
      </div>

      {/* Message editor modal */}
      {editingMessage && (
        <div className={styles.editorOverlay} onClick={() => setEditingMessage(null)}>
          <div className={styles.editorModal} onClick={(e) => e.stopPropagation()}>
            <MessageEditor
              message={editingMessage}
              defaultSenderName={config.senderName}
              language={config.language}
              onSave={handleUpdateMessage}
              onDelete={() => handleDeleteMessage(editingMessage.id)}
              onCancel={() => setEditingMessage(null)}
            />
          </div>
        </div>
      )}

      {/* Parse modal */}
      {showParseModal && (
        <ParseModal
          language={config.language}
          onParsed={handleParsed}
          onClose={() => setShowParseModal(false)}
        />
      )}

      {/* Spread dates modal */}
      {showSpreadDatesModal && (
        <SpreadDatesModal
          messages={messages}
          onApply={handleSpreadDates}
          onClose={() => setShowSpreadDatesModal(false)}
        />
      )}
    </div>
  );
}
