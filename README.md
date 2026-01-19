# Aspect React Client

A unified React application for multi-agent chat systems. This client supports multiple AI agents (Aspect BI Assistant, Freeda Menopause Companion) with a configuration-driven architecture that makes it easy to add new agents.

## Overview

This React client replaces the previous vanilla JavaScript implementation (`aspect-agent-client/`) which had separate HTML files for each agent. The new architecture unifies everything into a single React SPA with:

- **Configuration-driven agents** - Each agent is defined by a config file
- **Shared components** - Common UI components used across all agents
- **Theme support** - Light/dark mode with agent-specific color schemes
- **SSE streaming** - Real-time chat with Server-Sent Events
- **Knowledge Base** - File upload and management for RAG capabilities

## Technology Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **React Router 6** - Client-side routing
- **Vite 5** - Build tool (compatible with Node 18+)
- **CSS Modules** - Scoped component styles
- **CSS Custom Properties** - Theming system

## Project Structure

```
src/
├── agents/                     # Agent configurations
│   ├── aspect.config.ts        # Aspect BI Assistant config
│   ├── freeda.config.ts        # Freeda Menopause Companion config
│   └── index.ts
│
├── components/
│   ├── chat/                   # Chat-related components
│   │   ├── ChatContainer/      # Main chat area with messages
│   │   ├── ChatInput/          # Message input form
│   │   ├── Message/            # Individual message bubble
│   │   ├── ThinkingIndicator/  # "AI is thinking" animation
│   │   └── WelcomeSection/     # Initial state with quick questions
│   │
│   ├── layout/                 # Layout components
│   │   ├── AppLayout/          # Main app wrapper
│   │   ├── Header/             # Top navigation bar
│   │   └── HistorySidebar/     # Chat history sidebar
│   │
│   ├── kb/                     # Knowledge Base components
│   │   └── KBManager/          # KB list, file upload, management
│   │
│   ├── common/                 # Reusable UI components
│   │   ├── Button/
│   │   ├── Modal/
│   │   ├── ThemeToggle/
│   │   └── StatusIndicator/
│   │
│   └── agent-specific/         # Agent-specific components
│       └── aspect/
│           └── LogoUpload/     # Client logo upload (Aspect only)
│
├── context/                    # React Context providers
│   ├── AgentContext.tsx        # Current agent configuration
│   ├── ChatContext.tsx         # Chat state & actions
│   ├── ThemeContext.tsx        # Light/dark theme state
│   ├── UserContext.tsx         # Anonymous user management
│   └── index.ts
│
├── hooks/                      # Custom React hooks
│   ├── useChat.ts              # SSE streaming, messages, thinking
│   ├── useConversation.ts      # Conversation CRUD operations
│   ├── useKnowledgeBase.ts     # KB file management
│   ├── useLocalStorage.ts      # localStorage wrapper
│   ├── useTheme.ts             # Theme toggle logic
│   ├── useUser.ts              # Anonymous user creation
│   └── index.ts
│
├── services/                   # API client services
│   ├── api.ts                  # Base fetch wrapper
│   ├── chatService.ts          # SSE streaming endpoint
│   ├── conversationService.ts  # Conversation CRUD
│   ├── kbService.ts            # Knowledge Base API
│   ├── userService.ts          # User creation
│   └── index.ts
│
├── styles/                     # Global styles & themes
│   ├── variables.css           # CSS custom properties
│   ├── global.css              # Base styles, resets
│   ├── animations.css          # Keyframe animations
│   └── themes/
│       ├── aspect-theme.css    # Blue professional theme
│       └── freeda-theme.css    # Pink/warm caring theme
│
├── types/                      # TypeScript interfaces
│   ├── agent.ts                # AgentConfig, QuickQuestion
│   ├── chat.ts                 # Message, Conversation, ChatState
│   ├── kb.ts                   # KnowledgeBase, KBFile
│   └── index.ts
│
├── utils/                      # Utility functions
│   ├── formatMessage.ts        # Markdown-like formatting
│   ├── formatDate.ts           # Relative date display
│   ├── formatBytes.ts          # File size formatting
│   ├── storage.ts              # localStorage helpers
│   └── index.ts
│
├── pages/                      # Route pages
│   ├── AspectPage.tsx          # /aspect route
│   ├── FreedaPage.tsx          # /freeda route
│   ├── KBPage.tsx              # /kb/:agent route
│   ├── NotFoundPage.tsx        # 404 page
│   └── index.ts
│
├── App.tsx                     # Root component with routing
└── main.tsx                    # Entry point
```

## Agent Configuration System

Each agent is defined by a configuration object in `src/agents/`. This is the key to the multi-agent architecture.

### AgentConfig Interface

```typescript
interface AgentConfig {
  // Identity
  agentName: string;           // Server identifier: "Aspect", "Freeda 2.0"
  displayName: string;         // UI display name
  storagePrefix: string;       // localStorage prefix: "aspect_", "freeda_"
  baseURL: string;             // API server URL

  // UI Content
  logo: { src: string; alt: string };
  headerTitle: string;
  headerSubtitle: string;
  welcomeIcon: string;         // Emoji for welcome section
  welcomeTitle: string;
  welcomeMessage: string;
  inputPlaceholder: string;
  quickQuestions: QuickQuestion[];  // Quick action buttons

  // Thinking Animation
  thinkingSteps: string[][];   // Random thinking step arrays

  // Feature Flags
  features: {
    hasKnowledgeBase: boolean;  // Show KB features
    kbToggleable: boolean;      // Can toggle KB in chat
    hasLogoUpload: boolean;     // Client logo upload (Aspect)
    hasFileUpload: boolean;     // File upload in chat (Freeda)
    hasChatHistory: boolean;    // Show history sidebar
  };

  // Styling
  themeClass: string;          // CSS class: "theme-aspect", "theme-freeda"
}
```

### Adding a New Agent

1. **Create config file**: `src/agents/newagent.config.ts`
   ```typescript
   export const newAgentConfig: AgentConfig = {
     agentName: 'NewAgent',
     storagePrefix: 'newagent_',
     // ... rest of config
   };
   ```

2. **Export from index**: `src/agents/index.ts`
   ```typescript
   export { newAgentConfig } from './newagent.config';
   ```

3. **Create page component**: `src/pages/NewAgentPage.tsx`
   ```typescript
   import { newAgentConfig } from '../agents';

   export function NewAgentPage() {
     return (
       <ThemeProvider storagePrefix={newAgentConfig.storagePrefix}>
         <UserProvider storagePrefix={newAgentConfig.storagePrefix}>
           <AgentProvider config={newAgentConfig}>
             <ChatProvider>
               <AppLayout>
                 <ChatContainer />
               </AppLayout>
             </ChatProvider>
           </AgentProvider>
         </UserProvider>
       </ThemeProvider>
     );
   }
   ```

4. **Add route**: `src/App.tsx`
   ```typescript
   <Route path="/newagent" element={<NewAgentPage />} />
   ```

5. **Create theme CSS**: `src/styles/themes/newagent-theme.css`

## Context Providers

The app uses React Context for state management. Providers are nested in a specific order:

```
ThemeProvider          # Light/dark mode
  └── UserProvider     # Anonymous user ID
      └── AgentProvider    # Agent configuration
          └── ChatProvider     # Chat state & actions
              └── App Components
```

### ThemeContext
- Manages light/dark theme
- Persists to localStorage with agent prefix
- Applies `data-theme` attribute to document

### UserContext
- Creates anonymous user on first visit via API
- Stores user ID in localStorage
- Provides userId to all API calls

### AgentContext
- Provides current agent configuration
- Applies theme class to document
- Helper for prefixed storage keys

### ChatContext
- Combines `useChat` and `useConversation` hooks
- Manages messages, streaming state, thinking indicators
- Handles conversation switching and history

## Custom Hooks

### useChat
Main chat hook handling SSE streaming:
- `messages` - Current message list
- `isLoading` - API call in progress
- `isThinking` - Showing thinking indicator
- `currentThinkingStep` - Current step text
- `sendMessage(text)` - Send user message
- `loadHistory(id)` - Load conversation history

### useConversation
Conversation management:
- `conversationId` - Current conversation UUID
- `conversations` - All user conversations
- `createNewChat()` - Start new conversation
- `switchToChat(id)` - Switch to existing chat
- `deleteChat(id)` - Delete conversation

### useKnowledgeBase
KB file management:
- `knowledgeBases` - List of KBs
- `files` - Files in selected KB
- `uploadFiles(files)` - Upload to KB
- `deleteFile(id)` - Remove file

### useTheme
Theme toggle:
- `theme` - 'light' | 'dark'
- `toggleTheme()` - Switch theme

### useUser
User management:
- `userId` - Anonymous user ID
- `isLoading` - Creating user
- `initializeUser()` - Create if needed

## API Services

All services communicate with the backend at `VITE_API_URL`.

### chatService
```typescript
streamChat(options, callbacks)
// SSE streaming for chat messages
// Parses "data: {chunk}" format
// Calls onChunk, onComplete, onError
```

### conversationService
```typescript
getConversationHistory(id)      // GET /api/conversation/:id/history
getUserConversations(userId)    // GET /api/user/:id/conversations
updateConversationTitle(id)     // PATCH /api/conversation/:id
deleteConversation(id)          // DELETE /api/conversation/:id
```

### kbService
```typescript
getKnowledgeBases(agentName)    // GET /api/kb/list/:agent
getKBFiles(kbId)                // GET /api/kb/:id/files
createKnowledgeBase(...)        // POST /api/kb/create
uploadFiles(kbId, files)        // POST /api/kb/:id/upload
deleteFile(kbId, fileId)        // DELETE /api/kb/:id/files/:fileId
```

### userService
```typescript
createUser()                    // POST /api/user/create
```

## Styling System

### CSS Variables
Global variables in `src/styles/variables.css`:
- Layout: `--sidebar-width`, `--header-height`
- Spacing: `--spacing-xs` through `--spacing-xl`
- Typography: `--font-size-sm` through `--font-size-2xl`
- Border radius: `--radius-sm` through `--radius-full`
- Transitions: `--transition-fast`, `--transition-normal`

### Theme Variables
Each theme defines colors:
- `--primary-color`, `--primary-hover`
- `--background`, `--surface`, `--surface-light`
- `--text-primary`, `--text-secondary`, `--text-muted`
- `--border`, `--shadow-sm/md/lg`
- `--gradient`

### CSS Modules
Components use `.module.css` files for scoped styles:
```typescript
import styles from './Button.module.css';
<button className={styles.button}>
```

## Routes

| Path | Component | Description |
|------|-----------|-------------|
| `/` | Redirect | → `/aspect` |
| `/aspect` | AspectPage | Aspect BI Assistant |
| `/freeda` | FreedaPage | Freeda Menopause Companion |
| `/kb/:agent` | KBPage | Knowledge Base Manager |
| `/aspect.html` | Redirect | Legacy → `/aspect` |
| `/freeda.html` | Redirect | Legacy → `/freeda` |
| `/kb.html` | Redirect | Legacy → `/kb/freeda` |
| `*` | NotFoundPage | 404 page |

## Environment Variables

```bash
# .env (development)
VITE_API_URL=http://localhost:3000

# .env.production
VITE_API_URL=https://aspect-agent-server-1018338671074.europe-west1.run.app
```

## Firebase Deployment

The app is configured for Firebase Hosting with SPA rewrites.

### firebase.json
```json
{
  "hosting": {
    "public": "dist",
    "rewrites": [{ "source": "**", "destination": "/index.html" }],
    "headers": [
      { "source": "**/*.@(js|css)", "headers": [{ "key": "Cache-Control", "value": "max-age=31536000" }] }
    ]
  }
}
```

### Deploy Commands
```bash
npm run build    # Build to dist/
npm run deploy   # Build + firebase deploy
```

## Key Features

### SSE Streaming Chat
- Uses fetch with ReadableStream
- Parses `data: {chunk}` SSE format
- Shows thinking indicator during processing
- Formats markdown-like syntax in responses

### Thinking Indicator
- Collapsible UI showing "AI is thinking"
- Cycles through random thinking steps
- Collapses when response starts streaming

### Message Formatting
Converts markdown-like syntax:
- `**bold**` → `<strong>`
- `### Header` → `<h3>`
- `- item` → `<ul><li>`
- `1. item` → numbered list

### Chat History
- Persisted on server via API
- Sidebar shows all conversations
- Switch between conversations
- Delete conversations

### Knowledge Base
- Create named knowledge bases
- Upload files with drag-drop
- View file list with metadata
- Delete individual files
- Toggle KB usage in chat (Freeda)

### Theme System
- Light/dark mode toggle
- Agent-specific color schemes
- Persisted in localStorage
- CSS custom properties for easy theming

## Differences from Original

| Feature | Original (Vanilla JS) | React Version |
|---------|----------------------|---------------|
| Files | 3 separate HTML files | Single SPA |
| State | Global variables + localStorage | React Context + hooks |
| DOM | Manual manipulation | React JSX |
| Events | addEventListener | React event handlers |
| Styles | Global CSS files | CSS Modules |
| Config | Inline in scripts | Typed config objects |
| Routing | File-based | React Router |
| Build | None (direct serve) | Vite bundler |

## Development

```bash
# Install dependencies
npm install

# Start dev server (port 5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

## Server Integration

The client expects the server (aspect-agent-server) to provide:

- `POST /api/user/create` - Create anonymous user
- `POST /api/finance-assistant/stream` - SSE chat endpoint
- `GET /api/conversation/:id/history` - Get messages
- `GET /api/user/:id/conversations` - List conversations
- `PATCH /api/conversation/:id` - Update title
- `DELETE /api/conversation/:id` - Delete conversation
- `GET /api/kb/list/:agent` - List knowledge bases
- `GET /api/kb/:id/files` - List KB files
- `POST /api/kb/create` - Create KB
- `POST /api/kb/:id/upload` - Upload files
- `DELETE /api/kb/:id/files/:fileId` - Delete file

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

Requires JavaScript enabled and modern browser features (fetch, CSS variables, CSS Grid).
