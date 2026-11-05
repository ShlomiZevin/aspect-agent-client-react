# Aspect Management V0

What was checked: all six screens of task #115, plus team, settings, sign-in and
the "not on the list" screen, in the real UI with a real browser against the real
routes and services. Screen 6 used the real model. Everything ran on a throwaway
local Postgres with fictional data taken from the concept images. No real database
was touched, and the migration has not been run on one.

To reproduce:

1. In a scratch folder: `npm i embedded-postgres playwright`, and copy `stand.js`
   and `verify.js` from here.
2. `node stand.js` starts Postgres and the API on port 3000.
3. `npx vite --port 5173` in this repo.
4. `node verify.js` seeds through the API, walks the screens, and writes the
   screenshots and `results.json` here. Restart `stand.js` before running it again.

Offline rules battery: `node scripts/test-aspect-management-unit.js` in the server repo.

| Area | Result |
|---|---|
| Alert rules against real SQL | pass |
| Server refusals, in Hebrew | pass |
| Who gets in (on the list, Aspect admin, other account, unknown) | pass |
| Screens 1, 3, 4, 5 and their modals, including quote to project | pass |
| Screen 2 on a phone: prefill, send, resend replaces, day navigation | pass |
| Screen 6: Hebrew answers with correct numbers (`ask-answers.json`) | pass |
| A developer cannot reach other screens | pass in the UI only, see the known gap in the server README |
| **Total** | **71/71** (`results.json`) |

## Ten runs

`run-10.sh` repeats everything ten times, each on its own fresh database. The result
is 710/710 checks and 10/10 runs of the offline battery (`ten-runs/summary.txt`), with
30 real model answers (`ten-runs/answers.json`). The wording differs between runs; the
facts in the answers were the same, read through by eye. The fact checks that are
automated cover only the total hours and the over-budget client.

This shows the behaviour is stable on one scenario. It adds no new cases: every run
uses the same data on the same date.

## Not covered

Real Google sign-in. The stand does not serve the sign-in config, so
the screen fell back to the password form, and signing in was simulated by setting
the session. It needs one real check after deploy.
