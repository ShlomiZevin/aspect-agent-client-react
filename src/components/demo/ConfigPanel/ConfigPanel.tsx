import { useRef, useState } from 'react';
import type { DemoConfig, ViewMode, ColorScheme } from '../../../types/demo';
import { uploadLogo } from '../../../services/demoService';
import styles from './ConfigPanel.module.css';

interface ConfigPanelProps {
  title: string;
  viewMode: ViewMode;
  config: DemoConfig;
  onTitleChange: (title: string) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onConfigChange: (config: Partial<DemoConfig>) => void;
  onSave: () => void;
  onParseClick: () => void;
  isSaving?: boolean;
  hasChanges?: boolean;
}

const colorSchemes: { id: ColorScheme; className: string; label: string; group: 'light' | 'dark' }[] = [
  // Light themes
  { id: 'light-blue', className: styles.lightBlue, label: 'Sky', group: 'light' },
  { id: 'light-green', className: styles.lightGreen, label: 'Mint', group: 'light' },
  { id: 'light-purple', className: styles.lightPurple, label: 'Lavender', group: 'light' },
  { id: 'light-coral', className: styles.lightCoral, label: 'Peach', group: 'light' },
  // Dark themes
  { id: 'dark-blue', className: styles.darkBlue, label: 'Ocean', group: 'dark' },
  { id: 'dark-green', className: styles.darkGreen, label: 'Forest', group: 'dark' },
  { id: 'dark-purple', className: styles.darkPurple, label: 'Cosmic', group: 'dark' },
  { id: 'dark-slate', className: styles.darkSlate, label: 'Slate', group: 'dark' },
];

export function ConfigPanel({
  title,
  viewMode,
  config,
  onTitleChange,
  onViewModeChange,
  onConfigChange,
  onSave,
  onParseClick,
  isSaving = false,
  hasChanges = false,
}: ConfigPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const url = await uploadLogo(file);
      onConfigChange({ agentLogoUrl: url });
    } catch (err) {
      console.error('Failed to upload logo:', err);
    } finally {
      setIsUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className={styles.container}>
      {/* Mockup Title */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Mockup</div>
        <div className={styles.field}>
          <label className={styles.label}>Title</label>
          <input
            type="text"
            className={styles.input}
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Enter mockup title"
          />
        </div>
      </div>

      <div className={styles.divider} />

      {/* View Mode */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>View Mode</div>
        <div className={styles.viewModeToggle}>
          <button
            type="button"
            className={`${styles.viewModeButton} ${
              viewMode === 'whatsapp' ? styles.viewModeButtonActive : ''
            }`}
            onClick={() => onViewModeChange('whatsapp')}
          >
            <div className={styles.viewModeIcon}>📱</div>
            <div className={styles.viewModeLabel}>WhatsApp</div>
          </button>
          <button
            type="button"
            className={`${styles.viewModeButton} ${
              viewMode === 'regular' ? styles.viewModeButtonActive : ''
            }`}
            onClick={() => onViewModeChange('regular')}
          >
            <div className={styles.viewModeIcon}>💬</div>
            <div className={styles.viewModeLabel}>Regular</div>
          </button>
        </div>
      </div>

      <div className={styles.divider} />

      {/* Names */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Names</div>
        <div className={styles.field}>
          <label className={styles.label}>Agent Name</label>
          <input
            type="text"
            className={styles.input}
            value={config.agentName}
            onChange={(e) => onConfigChange({ agentName: e.target.value })}
            placeholder="e.g., Support Agent"
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>User Name</label>
          <input
            type="text"
            className={styles.input}
            value={config.senderName}
            onChange={(e) => onConfigChange({ senderName: e.target.value })}
            placeholder="e.g., Customer"
          />
        </div>
      </div>

      <div className={styles.divider} />

      {/* Language */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Text Direction</div>
        <div className={styles.viewModeToggle}>
          <button
            type="button"
            className={`${styles.viewModeButton} ${
              config.language === 'en' ? styles.viewModeButtonActive : ''
            }`}
            onClick={() => onConfigChange({ language: 'en' })}
          >
            <div className={styles.viewModeLabel}>English (LTR)</div>
          </button>
          <button
            type="button"
            className={`${styles.viewModeButton} ${
              config.language === 'he' ? styles.viewModeButtonActive : ''
            }`}
            onClick={() => onConfigChange({ language: 'he' })}
          >
            <div className={styles.viewModeLabel}>Hebrew (RTL)</div>
          </button>
        </div>
      </div>

      <div className={styles.divider} />

      {/* Logo */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Logo</div>
        <div className={styles.field}>
          <label className={styles.label}>Upload Logo</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <button
            type="button"
            className={`${styles.button} ${styles.outlineButton}`}
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            style={{ width: '100%' }}
          >
            {isUploading ? 'Uploading...' : '📁 Choose Image'}
          </button>
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Or paste URL</label>
          <input
            type="text"
            className={styles.input}
            value={config.agentLogoUrl}
            onChange={(e) => onConfigChange({ agentLogoUrl: e.target.value })}
            placeholder="https://example.com/logo.png"
          />
        </div>
        {config.agentLogoUrl && (
          <div className={styles.logoPreview}>
            <div
              className={styles.logoImage}
              style={{ backgroundImage: `url(${config.agentLogoUrl})` }}
            />
            <button
              type="button"
              className={styles.clearButton}
              onClick={() => onConfigChange({ agentLogoUrl: '' })}
              title="Remove logo"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* Color Scheme (only for regular view) */}
      {viewMode === 'regular' && (
        <>
          <div className={styles.divider} />
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Theme</div>
            <div className={styles.schemeGroup}>
              <span className={styles.schemeGroupLabel}>Light</span>
              <div className={styles.colorSchemes}>
                {colorSchemes.filter(s => s.group === 'light').map((scheme) => (
                  <button
                    key={scheme.id}
                    type="button"
                    className={`${styles.colorSwatch} ${scheme.className} ${
                      config.colorScheme === scheme.id ? styles.colorSwatchActive : ''
                    }`}
                    onClick={() => onConfigChange({ colorScheme: scheme.id })}
                    title={scheme.label}
                    aria-label={`Select ${scheme.label} theme`}
                  />
                ))}
              </div>
            </div>
            <div className={styles.schemeGroup}>
              <span className={styles.schemeGroupLabel}>Dark</span>
              <div className={styles.colorSchemes}>
                {colorSchemes.filter(s => s.group === 'dark').map((scheme) => (
                  <button
                    key={scheme.id}
                    type="button"
                    className={`${styles.colorSwatch} ${scheme.className} ${
                      config.colorScheme === scheme.id ? styles.colorSwatchActive : ''
                    }`}
                    onClick={() => onConfigChange({ colorScheme: scheme.id })}
                    title={scheme.label}
                    aria-label={`Select ${scheme.label} theme`}
                  />
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Actions */}
      <div className={styles.actions}>
        <button
          type="button"
          className={`${styles.button} ${styles.outlineButton}`}
          onClick={onParseClick}
        >
          📋 Paste & Parse Text
        </button>
        <button
          type="button"
          className={`${styles.button} ${styles.primaryButton}`}
          onClick={onSave}
          disabled={isSaving || !hasChanges}
        >
          {isSaving ? 'Saving...' : hasChanges ? '💾 Save Mockup' : 'Saved'}
        </button>
      </div>
    </div>
  );
}
