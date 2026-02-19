export type ViewMode = 'whatsapp' | 'regular';
export type MessageSide = 'left' | 'right';
export type Language = 'en' | 'he';

// Color schemes: light variants (bright) + dark variants
export type ColorScheme =
  | 'light-blue'
  | 'light-green'
  | 'light-purple'
  | 'light-coral'
  | 'dark-blue'
  | 'dark-green'
  | 'dark-purple'
  | 'dark-slate';

export interface DemoMessage {
  id: string;
  senderName: string;
  text: string;
  side: MessageSide;
  timestamp: string;
}

export interface DemoConfig {
  agentName: string;
  agentLogoUrl: string;
  senderName: string;
  colorScheme: ColorScheme;
  language: Language;
}

export interface DemoMockup {
  id: number;
  publicId: string;
  title: string;
  viewMode: ViewMode;
  config: DemoConfig;
  messages: DemoMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateDemoMockupRequest {
  title?: string;
  viewMode?: ViewMode;
  config?: Partial<DemoConfig>;
  messages?: DemoMessage[];
}

export interface UpdateDemoMockupRequest {
  title?: string;
  viewMode?: ViewMode;
  config?: Partial<DemoConfig>;
  messages?: DemoMessage[];
}

export interface ParseConversationRequest {
  text: string;
  language?: Language;
}

export interface ParseConversationResponse {
  success: boolean;
  messages: DemoMessage[];
  error?: string;
}

export const DEFAULT_CONFIG: DemoConfig = {
  agentName: 'Assistant',
  agentLogoUrl: '',
  senderName: 'User',
  colorScheme: 'light-blue',
  language: 'en',
};
