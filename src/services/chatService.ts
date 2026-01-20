import { getBaseURL } from './api';
import type { ThinkingStep } from '../types';

export interface StreamChatOptions {
  message: string;
  conversationId: string;
  agentName: string;
  userId: string | null;
  useKnowledgeBase?: boolean;
  baseURL?: string;
}

export interface StreamCallbacks {
  onChunk: (chunk: string) => void;
  onComplete: (fullText: string) => void;
  onError: (error: Error) => void;
  onThinkingStep?: (step: ThinkingStep) => void;
  onThinkingComplete?: () => void;
}

/**
 * Stream chat response using Server-Sent Events
 */
export async function streamChat(
  options: StreamChatOptions,
  callbacks: StreamCallbacks
): Promise<void> {
  const { message, conversationId, agentName, userId, useKnowledgeBase = false, baseURL } = options;
  const { onChunk, onComplete, onError, onThinkingStep, onThinkingComplete } = callbacks;

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
              // Could add additional handling here if needed
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
