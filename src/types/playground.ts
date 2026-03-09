export type PlaygroundMode = 'simple' | 'thinker';

export interface MockTool {
  name: string;
  description: string;
  parameters: object;
  mockResponse: unknown;
}

export interface PlaygroundConfig {
  displayName: string;
  description: string;
  mode: PlaygroundMode;
  model: string;
  guidance: string;
  thinkingPrompt: string;
  thinkingModel: string;
  persona: string;
  kbSources: Array<{ vectorStoreId: string; name: string }>;
  tools: MockTool[];
  context: Record<string, unknown>;
  maxTokens: number;
}

export interface DesignMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface PlaygroundSession {
  sessionId: string;
  crewName: string;
  agentName: string; // playground agent name for stream requests
  config: PlaygroundConfig;
  registered: boolean;
}

export interface SavedPlaygroundConfig {
  id: string;
  name: string;
  savedAt: string;
}

export interface ToolCallLog {
  id: string;
  name: string;
  params: unknown;
  mockResponse: unknown;
  timestamp: number;
}
