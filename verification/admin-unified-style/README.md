# Admin — one visual style across pages

What was checked: every document-style admin page now uses the shared
`AdminPage` frame (`src/components/dashboard/AdminPage`) — same full-width
left-aligned layout, padding, header (title / subtitle / actions on the
right), buttons (`adminUi.btn`, `btnPrimary` = client theme colour,
`btnDanger`) and tabs (`adminUi.tabs`). Full-screen tools (Crew Editor,
Playground, task boards, Conversation Trends) keep their own edge-to-edge
layout on purpose. Sidebar groups are unfolded by default.

How to reproduce:

1. Production build: `npx vite build --mode aspect && npx vite preview --port 5180`
   (dev mode sends sign-in and task-board calls to localhost:3000, so those
   two only render in a build).
2. `BASE=http://localhost:5180 OUT=./after node verification/admin-unified-style/shoot-all.mjs`
   (needs `playwright`). API calls are relayed GET-only — nothing is written.

| Page | Change |
|---|---|
| Feedback, Users, Test Runner, Crew | Shared frame + header; Users' pink "Add User" now theme colour; Test Runner tabs shared |
| Knowledge Base, Library | Had no page title — now have one; KB uses `embedded` (standalone `/kb/:agent` unchanged); Library tabs shared |
| Dynamic KB Files | Was edge-to-edge with no title — now framed, panel is a bordered card |
| Intelligence (Config/Prompts/Quick Questions/Insights/Overview) | 32px title and own padding replaced by the shared header; Enabled toggle in header actions |
| Data Loader | Purple buttons → shared buttons (Import = primary); dark-theme status badges → light tints; history table no longer wraps |
| Query Optimizer, Billing, Cloud Run Logs | Shared frame + header + buttons; Logs keeps its own scroll so the header stays visible |
| Modules | Was a 1000px column — now a card grid; empty reserved notice slot removed |
| Settings | Was a 900px centred column — full width; tabs shared; API-key tables share column widths |
| LLM Usage | Alfred filter uses the theme colour; dates/refresh in header actions; cost shown green like Billing |
| Podcast | Shared frame; upload button theme colour |

No page errors on any of the 25 pages. `tsc -b` clean; eslint error counts in
touched files are identical before and after (all pre-existing).
