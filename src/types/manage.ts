/**
 * The management center for non-technical users (task #985).
 * Mirrors aspect-agent-server/builder/routes/manageRoute.js +
 * builder/services/customerProblems.js — the server writes every sentence.
 */

/** 'custom' = a from–to period of Israel days (#1001). */
export type ProblemRange = 'today' | 'week' | 'custom';

/** What the page asks for: today, this week, or a from–to period ("YYYY-MM-DD", inclusive). */
export type ProblemPeriod =
  | { range: 'today' | 'week' }
  | { range: 'custom'; from: string; to: string };

/** The row's picture — chosen by the server from the kind of problem. */
export type ProblemIcon = 'message' | 'clock' | 'busy' | 'alert' | 'bell' | 'sparkle';

export interface ProblemAction {
  /** Which chip — picks its little icon. */
  id: 'customer' | 'shlomi' | 'auto' | 'answered' | 'unnoticed';
  /** e.g. "כדאי לפנות ללקוח", "תוקן אוטומטית" */
  text: string;
  /** 'act' = someone should act (pink) · 'ok' = nothing to do (green) */
  tone: 'act' | 'ok';
}

export interface CustomerProblem {
  id: string;
  type: 'error' | 'no_reply' | 'slow_reply';
  at: string;
  agentSlug: string;
  agentName: string;
  conversationId: number | null;
  customerName: string | null;
  lastCustomerMessage: string | null;
  answered: boolean;
  /** 'real' = a customer marked "Real customer" (#968); 'test' = a teammate trying the chat. Null without a conversation. */
  audience: 'real' | 'test' | null;
  /** Slow reply: how long the reply took (ms); null otherwise. */
  replyMs: number | null;
  /** What happened, one plain sentence. */
  title: string;
  /** Errors: which part failed and why, one plain line (#1001) — never empty on an error; null otherwise. */
  detail: string | null;
  /** The message it happened on (the turn's reply, or the unanswered customer message); null when unknown. */
  messageId?: number | null;
  action: ProblemAction;
  /** How it ended, one line under the customer's message. */
  outcome: string;
  icon: ProblemIcon;
  /** In the last 24 hours. */
  isNew: boolean;
}

export interface ManageAgentSummary {
  slug: string;
  name: string;
  archived: boolean;
  /** Customer conversations with customer activity in the range. */
  conversations: number;
  problems: number;
  /** Rows whose chip says someone should act. */
  needsAction: number;
}

/**
 * One conversation of the period (#1001) — every customer conversation, plus
 * any conversation-less problem as its own row (conversationId null).
 */
export interface ManageConversationRow {
  /** "c<conversation id>" or "p<problem id>". */
  id: string;
  conversationId: number | null;
  agentSlug: string;
  agentName: string;
  customerName: string | null;
  audience: 'real' | 'test' | null;
  /** The latest of: its last customer message in the period, its newest problem. */
  at: string | null;
  lastCustomerMessage: string | null;
  /** 'act' = a problem someone should act on · 'info' = a problem, nothing to do · 'ok' = no problem. */
  status: 'act' | 'info' | 'ok';
  /** Its problems (ids into `problems`), the one that speaks for it first. */
  problemIds: string[];
}

/** The tiles, in conversations — each number = the rows that tile opens on the conversations page. */
export interface ConversationCounts {
  all: number;
  act: number;
  ok: number;
  problems: number;
  slow: number;
  test: number;
}

/** GET /api/manage/me — who is signed in and what they may open. */
export interface ManageMe {
  email: string;
  name: string;
  picture: string | null;
  /** An every-agent grant (the Lybi team): "כל הסוכנים" + every agent. */
  all: boolean;
  /** Every agent (all) or the person's own, by display name. */
  agents: Array<{ slug: string; name: string; archived: boolean }>;
}

/** POST /api/manage/auth/google */
export interface ManageSignIn {
  token: string;
  expiresAt: string;
  me: ManageMe;
}

/** GET /api/manage/agents/:slug/conversations/:id — the "צפייה" window. */
export interface ManageConversation {
  id: number;
  agentSlug: string;
  agentName: string;
  customerName: string | null;
  audience: 'real' | 'test';
  channel: string | null;
  status: string | null;
  startedAt: string | null;
  lastActivityAt: string | null;
  lastCustomerAt: string | null;
  /** Customer + agent messages with text. */
  messageCount: number;
  customerMessages: number;
  /** The crew the conversation is in now, by name. */
  phase: string | null;
  /** The whole conversation, oldest first (#1001 follow-up; the newest 1,000 when longer). */
  messages: Array<{ id: number; role: 'customer' | 'agent'; text: string; at: string | null }>;
  shownMessages: number;
  /** More messages than shown. */
  truncated: boolean;
  /** Its customer-chat problems, oldest first — each shown under `anchorMessageId` (null = before the first message). */
  problems: Array<CustomerProblem & { anchorMessageId: number | null }>;
}

/** The `code` of a refused /api/manage call. */
export type ManageErrorCode =
  | 'signed_out' | 'no_access' | 'no_agent_access' | 'no_agent' | 'not_all'
  | 'no_conversation' | 'google_failed' | 'no_user' | 'user_shared' | 'bad_range'
  | 'bad_user' | 'user_exists' | 'already_suspended';

/**
 * One person of an agent's customer chat (tasks #999, #982) — mirrors
 * builder/services/manageUsers.js. On "all" a person on two agents is two rows.
 */
export interface ManageUser {
  id: number;
  name: string | null;
  phone: string | null;
  email: string | null;
  externalId: string | null;
  /** 'real' = marked "Real customer" (#968); everyone else is a test user. */
  audience: 'real' | 'test';
  /** Suspended right now — by hand, or by the auto-suspend time passing (#1002). */
  suspended: boolean;
  suspendedAt: string | null;
  /** An auto-suspend still ahead (#1002); null when off or already passed. */
  autoSuspendAt: string | null;
  /** Suspended by the auto-suspend time, not by hand. */
  autoSuspended: boolean;
  agentSlug: string;
  agentName: string;
  /** Customer-chat conversations on this agent. */
  conversations: number;
  createdAt: string | null;
  lastActiveAt: string | null;
  /** Also belongs to another agent — the actions refuse (they act on the person). */
  shared: boolean;
}

/** GET /api/manage/agents/:slug/users · GET /api/manage/users */
export interface ManageUsersResponse {
  scope: 'agent' | 'all';
  agentSlug: string | null;
  filter?: string | null;
  users: ManageUser[];
  real: number;
  test: number;
  truncated: boolean;
  limit: number;
  checkedAt: string;
}

/** One of a user's customer conversations (the user window's list). */
export interface ManageUserConversation {
  id: number;
  startedAt: string | null;
  lastActivityAt: string | null;
  audience: 'real' | 'test';
  phase: string | null;
  messageCount: number;
}

/** GET /api/manage/agents/:slug/users/:id */
export interface ManageUserDetail {
  user: ManageUser;
  conversations: ManageUserConversation[];
  shownConversations: number;
}

export interface CustomerProblemsResponse {
  scope: 'agent' | 'all';
  agent: ManageAgentSummary | null;
  /** The agent filter on the "all" view, when set. */
  filter?: string | null;
  range: ProblemRange;
  from: string;
  /** The period's end (exclusive). */
  to: string;
  /** A custom period's days ("YYYY-MM-DD"); null otherwise. */
  fromDay: string | null;
  toDay: string | null;
  maxRangeDays: number;
  checkedAt: string;
  newCount: number;
  noReplyMinutes: number;
  slowReplySeconds: number;
  problems: CustomerProblem[];
  /** The tiles (#1001) — the same numbers the conversations page gives. */
  conversationCounts: ConversationCounts;
  agents: ManageAgentSummary[];
}

/** A filter of the conversations page — one per tile of the problems page (#1001). */
export type ConversationFilter = 'all' | 'act' | 'ok' | 'problems' | 'slow' | 'test';

/** GET /api/manage/agents/:slug/conversations · GET /api/manage/conversations (#1001). */
export interface ManageConversationsResponse {
  scope: 'agent' | 'all';
  agentSlug: string | null;
  filter?: string | null;
  range: ProblemRange;
  from: string;
  to: string;
  fromDay: string | null;
  toDay: string | null;
  maxRangeDays: number;
  checkedAt: string;
  /** Every conversation of the period, newest first. */
  conversations: ManageConversationRow[];
  /** Over ALL conversations of the period (also those past the cut). */
  conversationCounts: ConversationCounts;
  /** More conversations than shown — the ones with a problem are always shown. */
  truncated: boolean;
  /** The problems the rows point at. */
  problems: CustomerProblem[];
}
