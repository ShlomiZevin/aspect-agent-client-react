/**
 * Prompt Editor Types
 *
 * Types for the crew member prompt editing functionality in debug mode
 */

/**
 * A single version of a crew member's prompt
 */
export interface PromptVersion {
  id: string;
  version: number;
  name?: string;  // Version name/tag (e.g., "Added empathy guidelines")
  description?: string;  // Free-text note about what changed in this version
  prompt: string;
  transitionSystemPrompt?: string;  // System prompt injected once when transitioning to this crew
  model?: string;          // Saved LLM model override
  provider?: string;       // Saved LLM provider ('openai', 'anthropic', 'google')
  kbSources?: string[];    // Saved active KB sources
  persona?: string;        // Saved persona override
  thinkingPrompt?: string; // Saved thinker prompt for thinking-crew architecture
  thinkingModel?: string;  // Saved thinker model override
  temperature?: number;    // Saved LLM temperature override (0.0 - 2.0)
  topK?: number;           // Saved LLM top_k / top_p override
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Crew member prompt data (with all versions)
 */
export interface CrewMemberPrompt {
  crewMemberId: string;
  crewMemberName: string;
  displayName: string;
  model?: string; // The crew's default model from server
  fallbackModel?: string; // The crew's fallback model
  versions: PromptVersion[];
  currentVersion: PromptVersion;
}

/**
 * State for the prompt editor panel
 */
export interface PromptEditorState {
  selectedCrewMemberId: string | null;
  editedPrompt: string;
  isDirty: boolean;
  isSessionOverride: boolean;
}
