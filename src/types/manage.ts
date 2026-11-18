/**
 * The management center for non-technical users (task #985).
 * Mirrors aspect-agent-server/builder/routes/manageRoute.js +
 * builder/services/customerProblems.js — the server writes every sentence.
 */

export type ProblemRange = 'today' | 'week';

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
  /** The last few, oldest first. */
  messages: Array<{ role: 'customer' | 'agent'; text: string; at: string | null }>;
  shownMessages: number;
}

/** The `code` of a refused /api/manage call. */
export type ManageErrorCode =
  | 'signed_out' | 'no_access' | 'no_agent_access' | 'no_agent' | 'not_all'
  | 'no_conversation' | 'google_failed';

export interface CustomerProblemsResponse {
  scope: 'agent' | 'all';
  agent: ManageAgentSummary | null;
  /** The agent filter on the "all" view, when set. */
  filter?: string | null;
  range: ProblemRange;
  from: string;
  checkedAt: string;
  newCount: number;
  noReplyMinutes: number;
  slowReplySeconds: number;
  problems: CustomerProblem[];
  agents: ManageAgentSummary[];
}
