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
