export type TestRunType = 'individuals' | 'population' | 'conversation' | 'review';
export type TestRunStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface TestRun {
  id: number;
  type: TestRunType;
  agentName: string;
  status: TestRunStatus;
  input: Record<string, unknown>;
  output: unknown;
  parentRunId: number | null;
  error: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTestRunData {
  type: TestRunType;
  agentName: string;
  input: Record<string, unknown>;
}

export interface TestRunFilters {
  type?: TestRunType;
  agentName?: string;
  status?: TestRunStatus;
}

/** Domain-specific individual profile (banking-onboarder schema) */
export interface IndividualProfile {
  id: string;
  name: string;
  age: number;
  gender: string;
  family_status: string;
  children: number;
  location: string;
  origin: string;
  employment_status: string;
  occupation: string;
  income_level: string;
  income_monthly_approx: number;
  financial_stability: string;
  banking_status: string;
  has_credit_card: boolean;
  has_savings: boolean;
  has_loans: boolean;
  digital_banking_comfort: string;
  financial_literacy: string;
  financial_goal: string;
  risk_appetite: string;
  motivation_primary: string;
  motivation_secondary: string | null;
  behavioral_trait: string;
  decision_making_style: string;
  information_need: string;
  trust_building_speed: string;
  objection_style: string;
  pressure_response: string;
  social_proof_sensitivity: string;
  primary_fear: string;
  difficulty: string;
  unique_fact: string;
}

export interface MotivationDef {
  key: string;
  description: string;
}

export interface TestRunConfig {
  id?: number;
  agentName: string;
  motivations: MotivationDef[];
  generatorPrompt: string;
  userMessageTemplate: string;
  personaSchema?: Record<string, unknown> | null;
  defaultModel: string;
  defaultCount: number;
  metadata?: Record<string, unknown>;
}

export interface UpdateTestConfigData {
  motivations?: MotivationDef[];
  generatorPrompt?: string;
  userMessageTemplate?: string;
  defaultModel?: string;
  defaultCount?: number;
}

// ============================================================
// Step 3: Conversation simulator
// ============================================================

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  crewMember?: string | null;
  crewTransitions?: Array<{ from: string; to: string; reason: string; stage: 'pre' | 'post' }>;
}

export interface ConversationOutput {
  transcript: ConversationTurn[];
  turnCount: number;
  terminationReason: 'end_signal' | 'max_turns' | 'failed' | 'cancelled' | null;
  endReason?: string | null;
  lastSyntheticUserMessage?: string | null;
}

/** Server response shape for POST /api/admin/test-runner/conversations/start */
export interface StartConversationResponse {
  testRunId: number;
  conversationId: number;
  conversationExternalId: string;
  conversationUrl: string;
  userId: number;
  userExternalId: string;
  maxTurns: number;
  model: string;
  run: TestRun;
}

/** Server response shape for POST /api/admin/test-runs/:id/turn */
export interface AdvanceTurnResponse {
  run: TestRun;
  terminated: boolean;
  lastUserMessage?: string;
  lastAssistantReply?: string;
  crewMember?: string | null;
  crewTransitions?: Array<{ from: string; to: string; reason: string; stage: 'pre' | 'post' }>;
  error?: string;
}

/** Synthetic-user upsert response */
export interface SyntheticUserUpsertResponse {
  userId: number;
  externalId: string;
  name: string | null;
  created: boolean;
}

/** Conversation metadata stored on conversations.metadata */
export interface ConversationMetadata {
  synthetic?: boolean;
  testRunId?: number;
  populationRunId?: number | null;
  individualId?: string;
  [key: string]: unknown;
}
