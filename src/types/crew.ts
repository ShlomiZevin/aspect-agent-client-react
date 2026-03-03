/**
 * Crew Member Types
 *
 * Types for the multi-agent crew infrastructure
 */

/**
 * Crew member information returned from API
 */
export interface CrewMember {
  name: string;
  displayName: string;
  description: string;
  isDefault: boolean;
  model: string;
  collectFields: string[];
  fieldsToCollect: { name: string; description: string }[];
  transitionTo: string | null;
  toolCount: number;
  hasKnowledgeBase: boolean;
  knowledgeBase?: { enabled: boolean; sources: string[] } | null;
  extractionMode?: 'conversational' | 'form';
  persona?: string | null;
  source?: 'file' | 'database';
}

/**
 * A single step in the crew journey visualization
 */
export interface CrewJourneyStep {
  crew: CrewMember;
  status: 'completed' | 'current' | 'upcoming';
}

/**
 * Response from GET /api/agents/:agentName/crew
 */
export interface CrewListResponse {
  agentName: string;
  crew: CrewMember[];
}

/**
 * Crew info sent via SSE
 */
export interface CrewInfoEvent {
  type: 'crew_info';
  crew: CrewMember;
}

/**
 * Crew transition event sent via SSE
 */
export interface CrewTransitionEvent {
  type: 'crew_transition';
  transition: {
    from: string;
    to: string;
    reason: string;
    timestamp: string;
  };
}

/**
 * State for crew management in the chat
 */
export interface CrewState {
  crewMembers: CrewMember[];
  currentCrew: CrewMember | null;
  selectedOverride: string | null;
  isLoading: boolean;
  error: string | null;
}

// ============================================
// Dashboard Crew Management Types
// ============================================

/**
 * Knowledge base configuration for a crew member
 */
export interface CrewKnowledgeBase {
  enabled: boolean;
  kbId?: number;
  storeId?: string;
  googleCorpusId?: string;
  searchInstructions?: string;
  sources?: string[];  // File-based crews use source names instead of kbId
}

/**
 * Field to collect from user during conversation
 */
export interface FieldToCollect {
  name: string;
  description: string;
}

/**
 * Full crew member configuration from database
 * Used for dashboard editing
 */
export interface CrewMemberConfig {
  id?: number;
  name: string;
  displayName: string;
  description: string;
  isDefault: boolean;
  guidance: string;
  model: string;
  maxTokens: number;
  knowledgeBase: CrewKnowledgeBase | null;
  fieldsToCollect: FieldToCollect[];
  transitionTo: string | null;
  transitionSystemPrompt: string | null;
  tools: string[];
  isActive: boolean;
  source: 'database' | 'file';
  persona?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Request to generate a crew member from description
 */
export interface CrewGenerateRequest {
  description: string;
}

/**
 * Response from crew generation endpoint
 */
export interface CrewGenerateResponse {
  success: boolean;
  config?: CrewMemberConfig;
  error?: string;
}

/**
 * Response from crew export endpoint
 */
export interface CrewExportResponse {
  success: boolean;
  code?: string;
  filename?: string;
  error?: string;
}

/**
 * Request to create/update a crew member
 */
export interface CrewMemberCreateRequest {
  name: string;
  displayName: string;
  description?: string;
  isDefault?: boolean;
  guidance: string;
  model?: string;
  maxTokens?: number;
  knowledgeBase?: CrewKnowledgeBase | null;
  fieldsToCollect?: FieldToCollect[];
  transitionTo?: string | null;
  transitionSystemPrompt?: string | null;
  tools?: string[];
}

/**
 * Request to update a crew member (partial)
 */
export interface CrewMemberUpdateRequest {
  displayName?: string;
  description?: string;
  isDefault?: boolean;
  guidance?: string;
  model?: string;
  maxTokens?: number;
  knowledgeBase?: CrewKnowledgeBase | null;
  fieldsToCollect?: FieldToCollect[];
  transitionTo?: string | null;
  transitionSystemPrompt?: string | null;
  tools?: string[];
  isActive?: boolean;
}

/**
 * State for the crew generator wizard
 */
export interface CrewGeneratorState {
  step: 'input' | 'generating' | 'review' | 'error';
  description: string;
  generatedConfig: CrewMemberConfig | null;
  error: string | null;
}

// ============================================
// Crew Editor (AI-assisted file editing) Types
// ============================================

/**
 * A message in the crew editor chat with Claude
 */
export interface CrewEditorMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Response from GET /api/admin/crew/:agentName/:crewName/source
 */
export interface CrewSourceResponse {
  source: string;
  filePath: string;
  lastModified: string;
}

/**
 * Response from POST /api/admin/crew/:agentName/:crewName/chat
 */
export interface CrewChatResponse {
  response: string;
  updatedSource?: string;
}

/**
 * Response from POST /api/admin/crew/:agentName/:crewName/apply
 */
export interface CrewApplyResponse {
  success: boolean;
  error?: string;
  backupVersion?: string;
}

/**
 * A backed-up version of a crew file in GCS
 */
export interface CrewVersionInfo {
  timestamp: string;
  name: string;
  size: number;
  created: string | null;
  isDefault?: boolean;
  versionName?: string | null;
}

/**
 * Project file backup info from GCS
 */
export interface ProjectFileInfo {
  exists: boolean;
  size: number;
  created: string | null;
}
