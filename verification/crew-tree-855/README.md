# Crew tree in the CREWS sidebar (task #855) — verification

**What was checked:** the manual, display-only crew hierarchy in the Builder's
CREWS sidebar — build Noa's example tree by drag and by the ⋯ menu, reload,
confirm it persisted (in place, no new version, no "unsaved changes"), fold
state per browser, drag feedback, and that a chat turn behaves the same.

**Where:** local client (Vite on :5173, this working folder) against the
**staging** API, on a throwaway duplicate of account-opening
(`zz-crew-tree-855`, agent `agent_szvfs1e81fhc`, now **archived**). Staging's
CORS has no localhost, so the Playwright script relays staging requests itself
(no Origin header) — nothing in the repo was changed for it.

**How to reproduce:** duplicate an agent on staging, run Vite with
`VITE_API_URL=<staging>`, drive `/<slug>/builder` with Playwright (script kept
in the session scratchpad: `pw-tree.js build`, then `pw-tree.js reload`).

| Check | Result |
|---|---|
| Drag Young / Partners / Business onto "Welcome & routing", Motive onto Young | nested, connectors drawn |
| ⋯ → Move under… → Young for "Path discovery" (picker greys itself + its branch) | nested |
| Drag Business onto the top edge of Partners (reorder at a level) | reordered |
| Writes | one `crew-order` PUT per order change, one in-place `versions/<active>` PUT per tree change; 6 order writes each building on the last |
| Reload | same tree; server body `crewTree.parents` = 5 entries; order matches |
| Versions | 8 before, 8 after (no new version) |
| Agent pill "unsaved" after reload | no |
| Fold "Young", reload | still folded (localStorage) |
| Drag onto a crew / between crews (no drop) | dashed highlight / level-aligned line; nothing written |
| Chat turn "hi, I am 16 and I want to open an account" before vs after the tree | same crew (Welcome & routing), same transition (→ Young, "Rule 4 matched"), same fields written, same add-on runs (reply wording differs — model variance) |

Screenshots: `01-before` · `02-menu-open` · `03-move-under-picker` ·
`04-tree-built` · `05-after-reload` · `06-young-collapsed` · `07-full-builder`
· `08-dragging-onto-welcome` · `09-dragging-between`.

Offline (no database): the MCP crew-tree routes against a stubbed
`builderProjects` (24 checks, all pass), the exact SQL of `setAgentCrewTree`
(`jsonb_set` / `- 'crewTree'`), and the client tree/move logic (11 checks).
`npx tsc --noEmit -p tsconfig.app.json` clean.
