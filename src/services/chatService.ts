import { getBaseURL } from './api';

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
}

/**
 * Stream chat response using Server-Sent Events
 */
export async function streamChat(
  options: StreamChatOptions,
  callbacks: StreamCallbacks
): Promise<void> {
  const { message, conversationId, agentName, userId, useKnowledgeBase = false, baseURL } = options;
  const { onChunk, onComplete, onError } = callbacks;

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
            if (parsed.chunk) {
              fullText += parsed.chunk;
              onChunk(parsed.chunk);
            } else if (parsed.error) {
              throw new Error(parsed.error);
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
