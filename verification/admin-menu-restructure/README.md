# Admin menu restructure

What was checked: the per-client admin (`/:agent/admin/*`) sidebar regrouped
into collapsible groups, the former standalone Intelligence admin
(`/intelligence/admin/*`) living inside it, old addresses redirecting, and
Freeda keeping the original flat menu.

How to reproduce:

1. `VITE_API_URL=<api> npx vite --port 5179` in the client repo.
2. `node verification/admin-menu-restructure/shoot.mjs` (needs `playwright`
   resolvable). API calls are relayed GET-only — nothing is written.

| Check | URL | Result |
|---|---|---|
| Grouped menu, Feedback active | `/zolstock/admin/feedback` | Quality open, others folded |
| Intelligence Config inside admin | `/zolstock/admin/intelligence/config` | Loads Zol Stock config, Intelligence group open |
| Intelligence Insights | `/zolstock/admin/intelligence/insights` | Loads |
| Cross-client overview | `/aspect/admin/intelligence-overview` | 8 datasets, Platform group open |
| Agent with no dataset, flat menu | `/freeda/admin/feedback` | Original flat list, same order |
| Old dataset URL | `/intelligence/admin/hypertoy/prompts` | -> `/hypertoy/admin/intelligence/prompts` |
| Old overview URL | `/intelligence/admin` | -> `/aspect/admin/intelligence-overview` |
| Unfold by click | Agent + Platform clicked | Both unfold |
| Business mode | toggle | Same items as before (KB, Dynamic KB, Conversation Trends) |

No page errors on any of them.
