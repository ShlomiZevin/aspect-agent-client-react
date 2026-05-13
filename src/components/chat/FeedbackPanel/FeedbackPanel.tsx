import { useState, useRef, useEffect, useCallback } from 'react';
import { useAgentContext } from '../../../context';
import { useLanguage } from '../../../context/LanguageContext';
import { searchTags, createFeedback, deleteFeedback, getFeedbackForMessage } from '../../../services/feedbackService';
import type { FeedbackTag } from '../../../types/feedback';
import styles from './FeedbackPanel.module.css';

// Predefined color palette for new tags
const TAG_COLORS = [
  '#10b981', // green
  '#3b82f6', // blue
  '#ef4444', // red
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#f97316', // orange
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#64748b', // slate
];

function getRandomColor(): string {
  return TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
}

interface FeedbackPanelProps {
  messageDbId: number;
  onClose: () => void;
  onSaved?: () => void;
}

export function FeedbackPanel({ messageDbId, onClose, onSaved }: FeedbackPanelProps) {
  const { config } = useAgentContext();
  const { t } = useLanguage();
  const [feedbackText, setFeedbackText] = useState('');
  const [tags, setTags] = useState<FeedbackTag[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [suggestions, setSuggestions] = useState<FeedbackTag[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [existingFeedbackId, setExistingFeedbackId] = useState<number | null>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Load existing feedback
  useEffect(() => {
    async function loadExisting() {
      setIsLoading(true);
      try {
        const feedback = await getFeedbackForMessage(messageDbId, config.baseURL);
        if (feedback) {
          setFeedbackText(feedback.feedbackText || '');
          setTags(feedback.tags || []);
          setExistingFeedbackId(feedback.id);
        }
      } catch {
        // No existing feedback, that's fine
      }
      setIsLoading(false);
    }
    loadExisting();
  }, [messageDbId, config.baseURL]);

  // Search tags as user types (after 3 chars)
  useEffect(() => {
    if (tagInput.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const results = await searchTags(config.agentName, tagInput, config.baseURL);
        // Filter out already-added tags
        const filtered = results.filter(t => !tags.some(existing => existing.name === t.name));
        setSuggestions(filtered);
        setShowSuggestions(filtered.length > 0);
        setSelectedIndex(-1);
      } catch {
        setSuggestions([]);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [tagInput, config.agentName, config.baseURL, tags]);

  // Close suggestions on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAddTag = useCallback((tag: FeedbackTag) => {
    if (!tags.some(t => t.name === tag.name)) {
      setTags(prev => [...prev, tag]);
    }
    setTagInput('');
    setSuggestions([]);
    setShowSuggestions(false);
    tagInputRef.current?.focus();
  }, [tags]);

  const handleTagInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (showSuggestions && suggestions.length > 0) {
        setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (showSuggestions && suggestions.length > 0) {
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1));
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (showSuggestions && selectedIndex >= 0 && suggestions[selectedIndex]) {
        // Select highlighted suggestion
        handleAddTag(suggestions[selectedIndex]);
      } else if (tagInput.trim()) {
        // Check if there's a matching suggestion or create new tag
        const match = suggestions.find(s => s.name.toLowerCase() === tagInput.trim().toLowerCase());
        if (match) {
          handleAddTag(match);
        } else {
          handleAddTag({ name: tagInput.trim(), color: getRandomColor() });
        }
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setSelectedIndex(-1);
    } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      // Remove last tag on backspace when input is empty
      setTags(prev => prev.slice(0, -1));
    }
  };

  const handleRemoveTag = (tagName: string) => {
    setTags(prev => prev.filter(t => t.name !== tagName));
  };

  const handleSave = async () => {
    if (!feedbackText.trim() && tags.length === 0) {
      onClose();
      return;
    }

    setIsSaving(true);
    try {
      await createFeedback(messageDbId, feedbackText.trim(), tags, config.baseURL, existingFeedbackId ?? undefined);
      onSaved?.();
      onClose();
    } catch (err) {
      console.error('Failed to save feedback:', err);
    }
    setIsSaving(false);
  };

  const handleDelete = async () => {
    if (!existingFeedbackId) return;

    setIsDeleting(true);
    try {
      await deleteFeedback(existingFeedbackId, config.baseURL);
      onSaved?.();
      onClose();
    } catch (err) {
      console.error('Failed to delete feedback:', err);
    }
    setIsDeleting(false);
  };

  if (isLoading) {
    return (
      <div className={styles.panel}>
        <div className={styles.loading}>{t('common.loading')}...</div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>{t('feedback.title')}</span>
        <button className={styles.closeButton} onClick={onClose} type="button" aria-label={t('common.close')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <textarea
        className={styles.textarea}
        placeholder={t('feedback.placeholder')}
        value={feedbackText}
        onChange={(e) => setFeedbackText(e.target.value)}
        rows={3}
      />

      <div className={styles.tagsSection}>
        <div className={styles.tagsContainer}>
          {tags.map(tag => (
            <span
              key={tag.name}
              className={styles.tag}
              style={{ '--tag-color': tag.color, '--tag-bg': `${tag.color}20` } as React.CSSProperties}
            >
              {tag.name}
              <button
                className={styles.tagRemove}
                onClick={() => handleRemoveTag(tag.name)}
                type="button"
                aria-label={`Remove ${tag.name}`}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </span>
          ))}
          <div className={styles.tagInputWrapper}>
            <input
              ref={tagInputRef}
              type="text"
              className={styles.tagInput}
              placeholder={tags.length === 0 ? t('feedback.addTags') : ''}
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagInputKeyDown}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            />
            {showSuggestions && (
              <div ref={suggestionsRef} className={styles.suggestions}>
                {suggestions.map((suggestion, index) => (
                  <button
                    key={suggestion.name}
                    className={`${styles.suggestion} ${index === selectedIndex ? styles.suggestionSelected : ''}`}
                    onClick={() => handleAddTag(suggestion)}
                    type="button"
                  >
                    <span
                      className={styles.suggestionDot}
                      style={{ backgroundColor: suggestion.color }}
                    />
                    {suggestion.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={styles.footer}>
        {existingFeedbackId && (
          <button
            className={styles.deleteButton}
            onClick={handleDelete}
            disabled={isDeleting}
            type="button"
          >
            {isDeleting ? `${t('feedback.deleting')}...` : t('common.delete')}
          </button>
        )}
        <div className={styles.footerSpacer} />
        <button className={styles.cancelButton} onClick={onClose} type="button">
          {t('common.cancel')}
        </button>
        <button
          className={styles.saveButton}
          onClick={handleSave}
          disabled={isSaving}
          type="button"
        >
          {isSaving ? `${t('feedback.saving')}...` : existingFeedbackId ? t('feedback.update') : t('common.save')}
        </button>
      </div>
    </div>
  );
}
