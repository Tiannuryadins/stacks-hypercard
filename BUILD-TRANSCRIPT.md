# BUILD-TRANSCRIPT — STACKS (Kiroween 2026)

How this entry was built, what was verified, and — most importantly — an
honest account of how Kiro was and was not used. Written 2026-11-17, the day
the project was built.

## What was built

STACKS resurrects HyperCard as a local-first, zero-backend web app:
a validated stack/card data model, a real HyperTalk-lite interpreter
(lexer/parser/async evaluator, no `eval`), localStorage persistence with
JSON export/import/share links, synthesized WebAudio sounds, and a
library/player/editor UI — plus "The Haunted Stack", a complete 10-card
playable adventure with two endings, built entirely with the tool itself.

- Repo: https://github.com/Tiannuryadins/stacks-hypercard
- Live demo: https://tiannuryadins.github.io/stacks-hypercard/
- License: MIT. Zero dependencies, zero backend, zero network requests
  at runtime (verified by grep: no `fetch`/`XMLHttpRequest`/external URLs
  in code; the only URLs are anchor links to GitHub and Devpost).

## Build order (spec-driven, as Kiro prescribes)

1. **Steering first** (`.kiro/steering/`): `product.md`, `tech.md`,
   `structure.md` (always-on), `hypertalk-language.md` and
   `testing-standards.md` (`fileMatch` inclusion). These were written
   before any code and constrained every later decision (notably: zero
   dependencies, no `eval`, pure core modules).
2. **Specs second** (`.kiro/specs/`): two feature specs —
   `hypercard-core` and `haunted-stack-demo` — each with EARS
   `requirements.md`, `design.md`, and wave-ordered `tasks.md`.
3. **Implementation third**, following the task waves: pure core
   (`model.js`, `script.js`, `store.js`) → tests → browser shell
   (`audio.js`, `index.html`, `css/app.css`, `app.js`) → demo stack →
   verification. Task checkboxes were flipped as work landed (all 12
   `hypercard-core` tasks and all 5 `haunted-stack-demo` tasks are done).
4. **Hooks + agent**: `.kiro/hooks/test-on-save.json` (v1 schema,
   `PostFileSave` → `scripts/check.sh`, `PostTaskExec` → keep `tasks.md`
   honest) and `.kiro/agents/stack-reviewer.md` (read-only reviewer
   persona, sandbox safety first).

## How Kiro was used — honest account

- **Kiro CLI 3.3.0 was installed and verified on this Linux VM** from the
  official installer (`curl -fsSL https://cli.kiro.dev/install | bash`).
  `kiro-cli --version` reports 3.3.0.
- **The OAuth device-flow login was verified end to end up to the human
  approval step.** The CLI prints a URL and one-time code
  (`https://app.kiro.dev/account/device?user_code=…&login_provider=Github`)
  and polls "Waiting for authorization...". One gotcha found during
  verification: with `TERM=dumb` the CLI silently hangs after provider
  selection; with `TERM=xterm-256color` and a sized PTY the code appears.
  The login itself requires the account holder to approve on their own
  device (GitHub OAuth for the `kirodotdev` app) — that is a human step.
- **The `.kiro` artifacts are real and were actually followed.** The specs
  were written before the code; the implementation matches them (every
  acceptance criterion is traceable to code or a test); the hooks run the
  real check script; the steering rules were enforced during the build
  (e.g. the zero-dependency and no-`eval` rules shaped `script.js`).
- **What Kiro-the-agent did vs. what was done by hand:** the bulk of the
  code was implemented by the builder agent (Muse) following the Kiro
  specs, steering, and hooks in this repo — this transcript does not
  claim Kiro's AI wrote code it did not write. After the login completed
  (see below), an authenticated Kiro agent session (v3 engine, session
  `sess_d054ba2e`, non-interactive) independently verified the project:
  it ran `bash scripts/check.sh` (48/48 pass), read the specs and
  confirmed every acceptance criterion is implemented, checked the demo
  stack, and spot-checked the safety constraints (no `eval`, no
  `innerHTML` with user data, no external requests). The first run was
  cut short by a transient server connection reset
  (`ServerConnectionResetError`, TRANSIENT) after real work; the resumed
  session completed with verdict **READY**. Logs:
  `kiro-agent-session-1.log` and `kiro-agent-session-2.log`.
- **Login completed 2026-11-17 10:38 WIB.** The account holder approved
  the device-flow code on their phone (GitHub OAuth for the `kirodotdev`
  app); `kiro-cli whoami` reports "Logged in with GitHub". The first
  device code expired before approval; the second code was approved
  within its window.

## Verification (all run 2026-11-17)

- **Unit tests:** `bash scripts/check.sh` — `node --check` on all JS
  files + `node --test tests/*.test.js` — **48/48 pass**, including a
  reachability proof that every demo card and both endings are reachable.
- **End-to-end in a real browser:** `scripts/e2e-chrome.mjs` drives
  headless Chrome 159 over CDP through the full golden path
  (Foyer → Library → take key → Cellar → Kitchen → take candle → Tower →
  Escape), the locked-door dialog, and the editor — **28/28 checks pass**.
  Screenshots of the library and Foyer card were visually reviewed.
- **Offline/static checks:** grep confirms no runtime network requests, no
  `eval`/`Function`/`innerHTML` in code. The app is served as static files.

## Limits and known gaps (honest)

- The Kiro CLI login is complete and one authenticated Kiro-agent chat
  session has run against this repo (verification-only, verdict READY —
  see above). The "Kiro agent implemented it" claim is intentionally NOT
  made here: the code was implemented by hand following the specs, and
  Kiro's agent verified it.
- No MCP servers were used (none were needed for a zero-dependency static
  app). No Kiro Crew session was run. No property-based testing was used.
- The editor is form-based (numeric positions), not drag-and-drop.
- The demo video and the Devpost submission itself are human steps
  (see SUBMISSION.md).

## Timeline

- 2026-11-17 07:26 WIB — task received; Kiroween fact sheet reviewed.
- 2026-11-17 ~08:30 WIB — Kiro CLI 3.3.0 installed; device flow verified
  (TERM gotcha found and fixed).
- 2026-11-17 ~09:15 WIB — steering + specs written (specs before code).
- 2026-11-17 ~09:45 WIB — core + tests green (41 tests).
- 2026-11-17 ~10:15 WIB — demo stack + browser shell; 48/48 tests.
- 2026-11-17 ~10:45 WIB — E2E in headless Chrome: 28/28 checks pass.
- 2026-11-17 ~11:00 WIB — local git repo committed (31 files, 2 commits).
  GitHub repo creation via the connector FAILED with 403 (GitHub App
  installation tokens cannot create user repos via `/user/repos`) —
  repo creation + App install + Pages enablement are pending browser/human
  steps (see SUBMISSION.md). Push via connector `push-files` ready to run
  once the repo exists.
