import { useState, useEffect, useMemo, useCallback } from 'react';
import { CrewFilter } from '../CrewFilter';
import { TagCloud } from '../TagCloud';
import { FeedbackFilters } from '../FeedbackFilters';
import { FeedbackMessageCard } from '../FeedbackMessageCard';
import { getFeedbackMessages, getFeedbackStats, deleteFeedback } from '../../../services/feedbackService';
import type { FeedbackMessage, FeedbackStats } from '../../../types/feedback';
import styles from './FeedbackPage.module.css';

interface FeedbackPageProps {
  agentName: string;
  baseURL: string;
}

export function FeedbackPage({ agentName, baseURL }: FeedbackPageProps) {
  const [feedbackMessages, setFeedbackMessages] = useState<FeedbackMessage[]>([]);
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filter state
  const [searchText, setSearchText] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedCrew, setSelectedCrew] = useState<string | null>(null);

  // Load data
  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const [messages, feedbackStats] = await Promise.all([
          getFeedbackMessages(agentName, baseURL),
          getFeedbackStats(agentName, baseURL),
        ]);
        setFeedbackMessages(messages);
        setStats(feedbackStats);
      } catch (err) {
        console.error('Failed to load feedback:', err);
        setFeedbackMessages([]);
        setStats({ totalFeedback: 0, tagAggregations: [], crewAggregations: [] });
      }
      setIsLoading(false);
    }
    load();
  }, [agentName, baseURL]);

  // Tag toggle
  const handleTagToggle = useCallback((tagName: string) => {
    setSelectedTags(prev =>
      prev.includes(tagName)
        ? prev.filter(t => t !== tagName)
        : [...prev, tagName]
    );
  }, []);

  // Delete feedback
  const handleDelete = useCallback(async (feedbackId: string) => {
    try {
      await deleteFeedback(parseInt(feedbackId), baseURL);
      // Remove from local state
      setFeedbackMessages(prev => prev.filter(fb => fb.id !== feedbackId));
      // Update stats
      setStats(prev => prev ? { ...prev, totalFeedback: prev.totalFeedback - 1 } : null);
    } catch (err) {
      console.error('Failed to delete feedback:', err);
    }
  }, [baseURL]);

  // Filtered messages
  const filteredMessages = useMemo(() => {
    return feedbackMessages.filter(fb => {
      // Text search (searches feedback text, message content, user message)
      if (searchText) {
        const query = searchText.toLowerCase();
        const matchesText =
          fb.feedbackText.toLowerCase().includes(query) ||
          (fb.messageContent ?? '').toLowerCase().includes(query) ||
          fb.userMessage.toLowerCase().includes(query);
        if (!matchesText) return false;
      }

      // Tag filter (message must have ALL selected tags)
      if (selectedTags.length > 0) {
        const fbTagNames = fb.tags.map(t => t.name);
        const hasAllTags = selectedTags.every(tag => fbTagNames.includes(tag));
        if (!hasAllTags) return false;
      }

      // Crew member filter
      if (selectedCrew !== null) {
        if (fb.crewMember !== selectedCrew) return false;
      }

      return true;
    });
  }, [feedbackMessages, searchText, selectedTags, selectedCrew]);

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        Loading feedback...
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Feedback</h1>
        <p className={styles.subtitle}>Review and analyse agent response feedback</p>
      </div>

      <div className={styles.body}>
        <div className={styles.sidebar}>
          {stats && (
            <CrewFilter
              crewAggregations={stats.crewAggregations}
              selectedCrew={selectedCrew}
              onCrewChange={setSelectedCrew}
              totalCount={stats.totalFeedback}
            />
          )}
          {stats && (
            <TagCloud
              aggregations={stats.tagAggregations}
              selectedTags={selectedTags}
              onTagToggle={handleTagToggle}
            />
          )}
        </div>

        <div className={styles.main}>
          <FeedbackFilters
            searchText={searchText}
            onSearchChange={setSearchText}
            resultCount={filteredMessages.length}
          />

          <div className={styles.messageList}>
            {filteredMessages.length === 0 ? (
              <div className={styles.empty}>
                <p>No feedback matches your filters.</p>
                {(searchText || selectedTags.length > 0 || selectedCrew !== null) && (
                  <button
                    className={styles.clearFiltersButton}
                    onClick={() => {
                      setSearchText('');
                      setSelectedTags([]);
                      setSelectedCrew(null);
                    }}
                    type="button"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            ) : (
              filteredMessages.map(fb => (
                <FeedbackMessageCard
                  key={fb.id}
                  feedback={fb}
                  onDelete={handleDelete}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
