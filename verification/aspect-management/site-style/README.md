# Aspect Management in the platform's look

What was checked: the redesign of `/management` from the "Smart Ledger" look
(its own ivory/forest palette, serif and handwriting fonts) to the rest of the
site's: the dashboard's white sidebar, the shared `AdminPage` frame, header and
buttons, white bordered cards, tinted status pills and the `SignInScreen` card
for sign-in. Every screen and dialog, desktop (1440×900) and phone (390×844),
for an owner, a developer and an address that is not on the list.

How to reproduce:

1. `npx vite build --mode aspect && npx vite preview --port 5180`
2. `node verification/aspect-management/site-style/shoot.mjs`
   (needs `playwright-core` and a local Chrome; `CHROME=` to point elsewhere).
   Every `/api/management/*` call is answered from invented sample data in the
   script, so nothing reaches a server.

| Shot | Screen |
|---|---|
| `00-sign-in`, `00b-not-on-list` | Sign-in card; signed in but not in `am_people` |
| `*-01-morning` | Greeting, three figures, "waiting for you today" list |
| `*-02-projects`, `*-02b-project-dialog` | Active projects table, edit dialog |
| `*-03-team`, `*-03b-person-dialog` | Developers, a person's last two weeks |
| `*-04-clients`, `*-05-client-card`, `*-05b-client-edit` | Clients, client card, edit dialog |
| `*-06-quotes`, `*-06b-quote-dialog` | Quotes with four figures, open and won tables |
| `*-07-ask`, `*-07b-ask-answer` | Ask the system, with an answer |
| `*-08-settings` | Who is on the list |
| `*-09-report`, `*-09b-report-stuck` | Daily report, with "something is stuck" on |
| `*-10-developer` | A developer's only screen |

Result: 34 screenshots, no page errors, no console errors. The only write calls
are the two "ask" questions, answered by the script. `tsc` clean.

## On the live site

`node verification/aspect-management/site-style/prod-check.mjs` opens
https://aspect-agents.web.app/management against the real `aspect-server`,
read-only: only `/me` is stubbed, and any non-GET request is aborted and counted.
`prod-*.png` are its shots.

Result (2026-11-12, after the deploy): sign-in, "not on the list" (real `/me`)
and seven owner screens on the real, still nearly empty `am_*` tables. 23 API
responses, all 2xx/304, all from `aspect-server`; 0 writes; no page or console
errors.
