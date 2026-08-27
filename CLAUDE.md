# aspect-react-client

React 19 + TypeScript + Vite 5 SPA. One codebase serves every Aspect surface — agent chat, dashboards, Builder V2, Aspect BI, Aspect Intelligence, and the internal HQ — separated by route and by build mode, not by project.

Backend: [`aspect-agent-server`](../aspect-agent-server) (sibling folder; the Vite config reaches into it — see *Cross-repo coupling*).

## Commands

```bash
npm run dev              # Vite on :5173, proxies /api → localhost:3000
npm run build            # tsc -b && vite build
npm run lint             # eslint
npm run deploy:aspect        # build --mode aspect     → firebase default
npm run deploy:lybi-prod     # build --mode lybi-prod  → firebase lybi-prod
npm run deploy:freeda        # build --mode freeda     → firebase freeda
```

`sync-builder-types` runs automatically on `postinstall`, `predev` and `prebuild`. No test runner is configured — `npx tsc -b` and `npx eslint <file>` are the checks.

**Verification results are organised, never left in the repo root.** Any run that produces result artefacts (screenshots, JSON, timing data) writes to `verification/<what-was-checked>/` — create the folder if absent, name the subfolder for the thing under test, and include a short `README.md` stating what was checked, how to reproduce it, and a summary table. The server repo follows the same rule; see `aspect-agent-server/verification/`.

Build modes pick `.env.<mode>`; the only variable that matters is `VITE_API_URL`, which overrides the Cloud Run default in `src/services/api.ts`.

## Layout

| Path | What it is |
|---|---|
| `src/App.tsx` | All routing. Heavy subtrees (`BuilderPage`, `BIPage`, `IntelligencePage`, `LiveChatPage`, `HQApp`) are `lazy()` so end-user routes don't download them. |
| `src/agents/` | One `<name>.config.ts` per agent + `agentRegistry.ts` mapping URL slug → config. **Adding an agent end-to-end = adding one registry entry.** The slug is also the tenant value stamped on users. |
| `src/pages/` | Route-level components (~98 files). |
| `src/components/` | Feature-grouped: `chat/`, `dashboard/`, `bi/`, `intelligence/`, `kb/`, `tasks/`, `layout/`, `common/`, `agent-specific/`. |
| `src/components/intelligence/jobs/` | Investigation jobs. Progress is **polled from the server** (`GET /:datasetId/progress/:jobId`) and reflects the real pipeline stage — it used to animate against a hardcoded 8s while real runs take 30–100s, so it froze at 96%. Keep progress monotonic (`Math.max`) and never read a clock during render. |
| `src/services/` | One module per backend domain; every one wraps `apiRequest` from `api.ts`. **Components never call `fetch` directly.** |
| `src/context/` | `AgentContext`, `ChatContext`, `UserContext`, `LanguageContext`, `ThemeContext`. |
| `src/hooks/` | Shared hooks (`useChat`, `useUser`, `useConversation`, `useTheme`, …), re-exported from `hooks/index.ts`. |
| `src/i18n/` | `translations.ts` (~1.4k lines) + `crewTranslations.ts`. Flat dotted keys: `t('header.newChat')`. |
| `src/styles/` | `global.css`, `variables.css` (CSS custom properties), `themes/`, `rtl.css`, `animations.css`. |
| `src/builder/` | Builder V2 UI (~243 files) — largest subtree. `src/builder/types/` is a **gitignored mirror** of the server's types. |
| `src/hq/` | Internal Lybi HQ app. Never a customer surface. |
| `src/live-chat/` | Customer-facing embeddable chat. |

## Conventions

**CSS Modules everywhere** — 250 `.module.css` files beside 355 `.tsx`. Dominant pattern is one folder per component: `Name/Name.tsx` + `Name/Name.module.css` + `Name/index.ts`, with a barrel `index.ts` at each feature-folder level. Theme via CSS custom properties in `src/styles/variables.css`; never hardcode a colour that has a token.

**Path aliases** (`vite.config.ts`): `@`, `@components`, `@hooks`, `@context`, `@services`, `@agents`, `@styles`, `@types`, `@utils`, `@pages`, `@addons`.

**Bilingual + RTL is a first-class constraint.** Hebrew and English are both live. New user-facing strings go in `src/i18n/translations.ts` under both locales and are read via `t()`; layout must survive `dir="rtl"` (see `styles/rtl.css`).

**Services layer shape** — a service module is a plain object of functions returning parsed data, e.g.:

```ts
getInsights: (datasetId: string, userId: string) =>
  request<{ insights: InsightSummary[] }>(`/${datasetId}/insights?userId=${encodeURIComponent(userId)}`)
    .then(r => r.insights),
```

`apiRequest` attaches the super-admin key when unlocked and unwraps the server's `{ error }` body so callers get the real message, not `400 Bad Request`.

**Identity is an anonymous browser session.** `useUser` creates a `userId` via `POST /api/user/create` on first mount and keeps it in `localStorage`; it is `null` until that resolves. Every per-user request must wait for it — firing with `null` silently scopes to nothing or 400s.

**Types** live in `src/types/`, imported with `import type`.

## Cross-repo coupling

Two links reach into the sibling server folder — both deliberate, both easy to break:

1. **`@addons` alias** → `../aspect-agent-server/builder/addons`. Addon descriptor JSON is imported by both sides as one source of truth. This is why `server.fs.allow: ['..']` is set.
2. **`scripts/sync-builder-types.cjs`** copies `aspect-agent-server/builder/types/index.ts` → `src/builder/types/index.ts` (gitignored). **Edit the server copy**; the client copy is overwritten on every install/dev/build.

Both mean the sibling repo must be checked out next to this one at the expected path.

**Two token systems, and a component can land in either.** The chat app uses the global tokens in `styles/variables.css` (`--surface`, `--border`, `--primary-color`); Aspect Intelligence defines its own `--ai-*` set on `.shell`, re-themed per client via `data-brand`. A dialog rendered inside Intelligence must therefore prefer the portal's tokens and fall back — `var(--ai-surface, var(--surface))` — or it looks like a generic box dropped on the client's palette. Note there is no bare `--primary`: it is `--primary-color`, and `var(--primary)` silently resolves to nothing (a submit button with no background).

**Never call `useAgentContext()` from a component that Intelligence might render.** It THROWS when there is no `AgentProvider`, and `IntelligenceShell` has none — the whole tree unmounts and the user sees a blank page. Pass `agentName`/`baseURL` as props; hosts inside Intelligence resolve them from `getAgentConfig(datasetId)`.

**Mobile: a flex child needs `min-width: 0` / `min-height: 0` before it will shrink or scroll.** Both bugs cost real time here — an input with `flex: 1` refused to shrink and pushed the page's primary button off-screen, and a welcome pane with no `overflow-y`/`min-height: 0` was clipped by its `overflow: hidden` parent with nothing to scroll. Keep mobile rules inside `@media` blocks so desktop is provably untouched.

**The data-status panel is bilingual and catalog-complete (Stage 3, 2026-08-24).** `DataHealthModal` (opened from `DataStatusBar`'s Last-sync label; enabled per agent via `features.showDataStatus`) renders TWO tables from `GET /api/admin/data-loader/:schema/data-health`: the file-mapped sources, and a `tables[]` catalog listing EVERY table + materialized view in the live schema with the period it stores (`from`/`through`) or an explicit "snapshot — no date column" label — never a bare dash. It also shows the server's post-reload MV `freshness` verdict when present. New strings for this panel go through `i18n/translations.ts` in BOTH languages (`dataHealth.*` keys) — an English-only key renders as its raw key name for Hebrew users.

**The chat-widget page injects a recolor sheet that WINS !important ties — register colored-background elements in its exception list.** `AgentChatWidgetPage` re-skins bot bubbles with `[class*="_bot_"] * { color: #241A38 !important }`; any element inside the bot subtree with a colored background (gradient buttons, pressed tag chips) must join the white-text exception list in that same sheet (`th`, `_dataTableBtn_`, `_submit_`, pressed `_tag_`). Fighting it from a component's own module CSS is unwinnable: equal-specificity `!important` ties resolve by source order, and the injected sheet comes later — a submit button spent three review rounds dark-on-blue before this was pinned (2026-08-26). Also remember the modal overlay may render OUTSIDE the Intelligence `.shell`, where every `--ai-*` token is undefined — primary-button styling needs a literal gradient fallback, not another token chain.

**The composer is never scrolled away or squeezed.** Both welcome surfaces follow the same structure: a `flex:1; min-height:0; overflow-y:auto` scroll area for hero/tiles/messages, with the input row OUTSIDE it, `flex-shrink:0`-pinned below (`ChatWelcome` in Intelligence; `ChatContainer`+`ChatInput` in the chat app — whose `.messages` carries the load-bearing `min-height:0`). The widget opened with the composer truncated twice (2026-08-26) because content lived around the input inside one scroll region; if a pane gains new content, it goes in the scroll area, never between it and the composer.

**Message feedback = the Reject flow.** `GeneralFeedbackModal` has a `reject` mode (prefilled "Data for request: … is incorrect", wrong-numbers tag preselected, message-scoped submit via `assistantMessageId`); chat's entry point is the "Reject answer" ghost pill at each assistant bubble's trailing bottom corner, Intelligence's is the ghost Reject in `InsightDetail`'s actions row. Message delete is parked behind `SHOW_DELETE=false` in `Message.tsx`.

## Gotchas

- **Declare every hook above the component's early returns.** These components `return` early for loading and error states, so a `useState` added lower down changes the hook count between renders — React treats that as fatal. Easy to do accidentally when adding state next to the handler that uses it.
- **Charts pick their form from the data.** Calendar-shaped categories (months, quarters, `W12`, bare years) render as a line; entity names (stores, products, campaigns) render as bars. A line across a ranking implies a before/after between rank #1 and rank #8 that doesn't exist. The client helper in `Reports/ReportsPage.tsx` mirrors `looksLikeTimeSeries()` on the server — keep them in step.
- **React 19 StrictMode double-invokes effects.** Any effect firing a real request needs dedupe-by-key via a ref, not a per-closure `cancelled` flag — the naive version leaves the UI stuck on a skeleton forever (worked example in `src/components/intelligence/useInsightsFeed.ts`).
- Firebase hosting sends `no-cache` on everything (`firebase.json`) — deploys land immediately, and caching bugs won't reproduce here.
- Only routes matching `/:agent/login` and `/:agent/chat` are treated as restricted; the global task-board and quick-bug modals mount on every other route, including customer-facing ones.
- The default API base is a **hardcoded production Cloud Run URL** in `api.ts`. Without `VITE_API_URL`, a local build silently talks to production.
- `npm run dev` proxies `/api` to `localhost:3000`, so the local server must be running or every request 500s at the proxy.
