import { getBaseURL } from './api';
import type { ThinkingStep, DebugPromptData, PostExtractionContext } from '../types';
import type { CrewMember } from '../types/crew';

export interface StreamChatOptions {
  message: string;
  conversationId: string;
  agentName: string;
  userId: string | null;
  useKnowledgeBase?: boolean;
  baseURL?: string;
  overrideCrewMember?: string | null;
  debug?: boolean;
  promptOverrides?: Record<string, string>; // Session overrides: { crewName: prompt }
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
  onDebugContextUpdate?: (data: PostExtractionContext) => void;
  onMessageSaved?: (messageId: number) => void;
  onUserMessageSaved?: (messageId: number) => void;
}

/**
 * Stream chat response using Server-Sent Events
 */
export async function streamChat(
  options: StreamChatOptions,
  callbacks: StreamCallbacks
): Promise<void> {
  const { message, conversationId, agentName, userId, useKnowledgeBase = false, baseURL, overrideCrewMember, debug, promptOverrides } = options;
  const { onChunk, onComplete, onError, onThinkingStep, onThinkingComplete, onCrewInfo, onCrewTransition, onDebugData, onDebugContextUpdate, onMessageSaved, onUserMessageSaved } = callbacks;

  const url = `${baseURL || getBaseURL()}/api/finance-assistant/stream`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        conversationId,
        useKnowledgeBase,
        userId,
        agentName,
        ...(overrideCrewMember && { overrideCrewMember }),
        ...(debug && { debug: true }),
        ...(promptOverrides && Object.keys(promptOverrides).length > 0 && { promptOverrides }),
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
            return;
          }

          try {
            const parsed = JSON.parse(data);

            // Handle thinking step events
            if (parsed.type === 'thinking_step' && parsed.step) {
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
            // Handle errors
            else if (parsed.error) {
              throw new Error(parsed.error);
            }
            // Handle function call events (pass through for logging/UI purposes if needed)
            else if (parsed.type === 'function_call' || parsed.type === 'function_result') {
              // Function calls are already handled as thinking steps on server
            }
            // Handle field extraction events (displayed via thinking steps on server)
            else if (parsed.type === 'field_extracted') {
              // Field extractions are sent as thinking_step events by the server
              // No additional client handling needed
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
