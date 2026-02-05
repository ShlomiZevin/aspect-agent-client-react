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
  prompt: string;
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
