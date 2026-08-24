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
  /** 'message' = about one reply · 'general' = volunteered from the sidebar */
  source?: 'message' | 'general';
  /** Null for general feedback — there is no reply it refers to. */
  assistantMessageId: string | null;
  /** The preceding user message (auto-resolved) */
  userMessageId: string | null;
  /** The assistant response content. Null/empty for general feedback. */
  messageContent: string | null;
  /** The user message that prompted this response */
  userMessage: string;
  /** Feedback body. Plain text on legacy rows, sanitised HTML once screenshots were allowed. */
  feedbackText: string;
  /** True when feedbackText is HTML — set server-side so the two formats can coexist. */
  isHtml?: boolean;
  /** Optional contact left by the user, so someone can follow up. */
  contact?: string | null;
  /** The page the user was on when they wrote it. */
  contextUrl?: string | null;
  /** Tags stored as JSON array */
  tags: FeedbackTag[];
  /** Which crew member handled this message (denormalized) */
  crewMember: string | null;
  /** Conversation external ID for linking */
  conversationId: string;
  /** Agent URL slug for building conversation link */
  agentUrlSlug: string | null;
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
