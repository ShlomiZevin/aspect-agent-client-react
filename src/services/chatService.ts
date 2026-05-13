import { getBaseURL } from './api';
import type { ThinkingStep, DebugPromptData, PostExtractionContext } from '../types';
import type { CrewMember } from '../types/crew';

export interface StreamChatOptions {
  message: string;
  conversationId: string;
  agentName: string;
  userId: string | null;
  baseURL?: string;
  overrideCrewMember?: string | null;
  debug?: boolean;
  promptOverrides?: Record<string, string>; // Session overrides: { crewName: prompt }
  modelOverrides?: Record<string, string>;      // Session overrides: { crewName: modelName }
  fallbackOverrides?: Record<string, string>;   // Session overrides: { crewName: fallbackModelName }
  personaOverride?: string; // Session override for agent-level persona (applies to all crews)
  kbOverrides?: Record<string, string[]>; // Session override: { crewName: string[] } - same pattern as modelOverrides
  thinkingPromptOverrides?: Record<string, string>; // Session override: { crewName: thinkingPrompt }
  thinkingModelOverrides?: Record<string, string>;  // Session override: { crewName: thinkingModel }
  thinkerDisabled?: Record<string, boolean>; // Session override: { crewName: true } to disable thinker
  temperatureOverrides?: Record<string, number>;    // Session override: { crewName: number }
  topKOverrides?: Record<string, number>;            // Session override: { crewName: number }
  profilerFreshStart?: boolean; // Debug: ignore existing profile, start from scratch
  profilerEnabled?: boolean; // Debug: enable profiler (disabled by default)
  restrictedMode?: boolean; // Outside-user chat: use published crew version instead of active
}

export interface CrewTransition {
  from: string;
  to: string;
  reason: string;
  timestamp: string;
}

export interface StreamCallbacks {
  onChunk: (chunk: string) => void;
  onComplete: (fullText: string) => void;
  onError: (error: Error) => void;
  onThinkingStep?: (step: ThinkingStep) => void;
  onThinkingComplete?: () => void;
  onCrewInfo?: (crew: CrewMember) => void;
  onCrewTransition?: (transition: CrewTransition) => void;
  onDebugData?: (data: DebugPromptData) => void;
  onModelUsed?: (data: { model: string; modelUsed: string; fallbackUsed: boolean }) => void;
  onDebugContextUpdate?: (data: PostExtractionContext) => void;
  onMessageSaved?: (messageId: number) => void;
  onUserMessageSaved?: (messageId: number) => void;
  onReplaceMessage?: (text: string) => void;
  onFieldExtracted?: (field: string, value: string) => void;
  onProfileUpdate?: (data: ProfileUpdateData) => void;
  onProfilerRaw?: (data: unknown) => void;
}

export interface ProfileUpdateData {
  clusters: Record<string, { fields: Record<string, { value: string | null; confidence: number; source: string; updatedNow: boolean; _filtered?: boolean }> }>;
  clusterScores: Record<string, { depth: number }>;
  summary: { general_overview: string; key_profile_traits: string[]; potential_index: number; focused_action_recommendation: string } | null;
  overallDepth: number;
  overallConfidence: number;
  profileTier: string;
  confidenceThreshold?: number;
}

/**
 * Stream chat response using Server-Sent Events
 */
export async function streamChat(
  options: StreamChatOptions,
  callbacks: StreamCallbacks
): Promise<void> {
  const { message, conversationId, agentName, userId, baseURL, overrideCrewMember, debug, promptOverrides, modelOverrides, fallbackOverrides, personaOverride, kbOverrides, thinkingPromptOverrides, thinkingModelOverrides, thinkerDisabled, temperatureOverrides, topKOverrides, profilerFreshStart, profilerEnabled, restrictedMode } = options;
  const { onChunk, onComplete, onError, onThinkingStep, onThinkingComplete, onCrewInfo, onCrewTransition, onDebugData, onModelUsed, onDebugContextUpdate, onMessageSaved, onUserMessageSaved, onReplaceMessage, onFieldExtracted, onProfileUpdate, onProfilerRaw } = callbacks;

  const url = `${baseURL || getBaseURL()}/api/finance-assistant/stream`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        conversationId,
        userId,
        agentName,
        ...(overrideCrewMember && { overrideCrewMember }),
        ...(debug && { debug: true }),
        ...(promptOverrides && Object.keys(promptOverrides).length > 0 && { promptOverrides }),
        ...(modelOverrides && Object.keys(modelOverrides).length > 0 && { modelOverrides }),
        ...(fallbackOverrides && Object.keys(fallbackOverrides).length > 0 && { fallbackOverrides }),
        ...(personaOverride && { personaOverride }),
        ...(kbOverrides && Object.keys(kbOverrides).length > 0 && { kbOverrides }),
        ...(thinkingPromptOverrides && Object.keys(thinkingPromptOverrides).length > 0 && { thinkingPromptOverrides }),
        ...(thinkingModelOverrides && Object.keys(thinkingModelOverrides).length > 0 && { thinkingModelOverrides }),
        ...(thinkerDisabled && Object.keys(thinkerDisabled).length > 0 && { thinkerDisabled }),
        ...(temperatureOverrides && Object.keys(temperatureOverrides).length > 0 && { temperatureOverrides }),
        ...(topKOverrides && Object.keys(topKOverrides).length > 0 && { topKOverrides }),
        ...(profilerFreshStart && { profilerFreshStart: true }),
        ...(profilerEnabled && { profilerEnabled: true }),
        ...(restrictedMode && { restrictedMode: true }),
      }),
    });

    if (!response.ok) {
      throw new Error(`Network response was not ok: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';

    const processChunk = async (): Promise<void> => {
      const { done, value } = await reader.read();
      if (done) {
        onComplete(fullText);
        return;
      }

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') {
            onComplete(fullText);
            // Don't return — keep reading for late profiler events
            continue;
          }
          if (data === '[STREAM_END]') {
            return;
          }

          try {
            const parsed = JSON.parse(data);

            // Handle stream errors from server (LLM failures, etc.)
            if (parsed.type === 'stream_error' || parsed.error) {
              const errorMessage = parsed.error || 'Unknown streaming error';
              onError(new Error(errorMessage));
              return; // Stop processing
            }
            // Handle thinking step events
            else if (parsed.type === 'thinking_step' && parsed.step) {
              onThinkingStep?.({
                stepType: parsed.step.stepType,
                description: parsed.step.description,
                stepOrder: parsed.step.stepOrder,
                metadata: parsed.step.metadata,
              });
            }
            // Handle thinking complete event
            else if (parsed.type === 'thinking_complete') {
              onThinkingComplete?.();
            }
            // Handle text chunks
            else if (parsed.chunk) {
              fullText += parsed.chunk;
              onChunk(parsed.chunk);
            }
            // Handle function call events (pass through for logging/UI purposes if needed)
            else if (parsed.type === 'function_call' || parsed.type === 'function_result') {
              // Function calls are already handled as thinking steps on server
            }
            // Handle field extraction events
            else if (parsed.type === 'field_extracted') {
              // Notify callback so UI can refresh (e.g., fields panel)
              onFieldExtracted?.(parsed.field, parsed.value);
            }
            // Handle crew info event
            else if (parsed.type === 'crew_info' && parsed.crew) {
              onCrewInfo?.(parsed.crew);
            }
            // Handle crew transition event
            else if (parsed.type === 'crew_transition' && parsed.transition) {
              onCrewTransition?.(parsed.transition);
            }
            // Handle debug prompt data (dev debug mode)
            else if (parsed.type === 'debug_prompt' && parsed.data) {
              onDebugData?.(parsed.data);
            }
            // Handle model_used event — which model actually responded
            else if (parsed.type === 'model_used') {
              onModelUsed?.({ model: parsed.model, modelUsed: parsed.modelUsed, fallbackUsed: parsed.fallbackUsed });
            }
            // Handle debug context update (post-extraction)
            else if (parsed.type === 'debug_context_update' && parsed.data) {
              onDebugContextUpdate?.(parsed.data);
            }
            // Handle message saved event (for feedback dbId)
            else if (parsed.type === 'message_saved' && parsed.messageId) {
              onMessageSaved?.(parsed.messageId);
            }
            // Handle user message saved event (for delete functionality)
            else if (parsed.type === 'user_message_saved' && parsed.messageId) {
              onUserMessageSaved?.(parsed.messageId);
            }
            // Handle mid-stream error — replace partial bubble with error text
            else if (parsed.type === 'replace_message' && parsed.text) {
              onReplaceMessage?.(parsed.text);
            }
            // Handle profile update from async profiler
            else if (parsed.type === 'profile_update' && parsed.data) {
              onProfileUpdate?.(parsed.data);
            }
            // Handle raw profiler response (debug)
            else if (parsed.type === 'profiler_raw') {
              onProfilerRaw?.({ response: parsed.data, durationSec: parsed.durationSec, model: parsed.model });
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }

      await processChunk();
    };

    await processChunk();
  } catch (error) {
    onError(error instanceof Error ? error : new Error(String(error)));
  }
}
