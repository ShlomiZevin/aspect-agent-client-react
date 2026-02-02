/**
 * Feedback Types
 *
 * Types for the agent feedback/review system.
 * Mirrors the message_feedback table structure.
 *
 * DB schema (planned):
 *   message_feedback
 *   ├── id                    (PK, serial)
 *   ├── external_id           (UUID)
 *   ├── assistant_message_id  (FK → messages.id)
 *   ├── user_message_id       (FK → messages.id, nullable, auto-resolved)
 *   ├── feedback_text         (text)
 *   ├── tags                  (jsonb, array of { name, color })
 *   ├── crew_member           (varchar, nullable, denormalized)
 *   ├── created_by            (FK → users.id, nullable)
 *   ├── created_at            (timestamp)
 *   ├── updated_at            (timestamp)
 */

export interface FeedbackTag {
  name: string;
  color: string;
}

export interface FeedbackMessage {
  id: string;
  /** The assistant message that received feedback */
  assistantMessageId: string;
  /** The preceding user message (auto-resolved) */
  userMessageId: string | null;
  /** The assistant response content */
  messageContent: string;
  /** The user message that prompted this response */
  userMessage: string;
  /** Free-text feedback left by reviewer */
  feedbackText: string;
  /** Tags stored as JSON array */
  tags: FeedbackTag[];
  /** Which crew member handled this message (denormalized) */
  crewMember: string | null;
  /** When the feedback was created */
  createdAt: Date;
}

export interface TagAggregation {
  tag: FeedbackTag;
  count: number;
}

export interface CrewAggregation {
  crewMember: string;
  count: number;
}

export interface FeedbackStats {
  totalFeedback: number;
  tagAggregations: TagAggregation[];
  crewAggregations: CrewAggregation[];
}
