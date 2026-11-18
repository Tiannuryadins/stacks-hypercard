# Devpost Submission Draft — Kiroween 2026

> DRAFT — do not submit as-is. The human steps at the bottom must be done
> first (video, credit request, Devpost form). Deadline: **4 Dec 2026,
> 14:00 PT = 22:00 UTC = 5 Dec 05:00 WIB**. No extensions.

## Title

**STACKS — HyperCard, Resurrected**

## Tagline

HyperCard (1987–2004) reborn as a local-first hypermedia studio in your
browser: build stacks of interactive cards with a friendly English-like
scripting language. No account, no server, no build step.

## Category

**Resurrection** — bringing dead technology back to life.

## Links

- GitHub repo (public, MIT): https://github.com/Tiannuryadins/stacks-hypercard
- Live demo (GitHub Pages): https://tiannuryadins.github.io/stacks-hypercard/
- Demo video (YouTube, <3 min): _TODO — human step, see below_

## Description (for the Devpost form)

**The problem.** HyperCard was the most humane authoring tool ever shipped:
ordinary people built interactive stories, games, and tools by stacking
cards and writing readable scripts. Apple killed it in 2004, and nothing
since has matched its combination of approachability and power. Today's
alternatives need accounts, servers, or a game engine.

**The solution.** STACKS resurrects HyperCard for the modern web. Open the
page and you can:

- **Author stacks of cards** — text fields, buttons, and scenes, edited in
  a visual editor with live script checking.
- **Script in HyperTalk-lite** — a real interpreter (lexer, parser, async
  evaluator) for an English-like language: `on mouseUp`, `go to card`,
  `show`/`hide`, `put ... into field`, `play sound`, variables,
  conditionals. No `eval` — scripts run in a sandbox.
- **Play instantly** — the built-in demo, *The Haunted Stack*, is a complete
  10-card haunted-house adventure with two endings, synthesized WebAudio
  sound, and puzzles. Every card and script in it was built with the tool.
- **Own your work** — stacks live in your browser (localStorage), export as
  JSON, and share as a link. The app works offline and makes zero network
  requests.

**Why it matters.** Local-first hypermedia lowers the floor for interactive
storytelling: a teacher can build a branching quiz, a writer can prototype
a game, a kid can learn variables and conditionals by making a haunted
house — all without signing up for anything.

**Technical highlights.**

- Zero dependencies, zero backend, zero build step — the repo IS the site.
- Pure core modules (`model.js`, `script.js`) fully tested in Node:
  48 unit tests, including a reachability proof over the demo's story graph.
- 28 headless-Chromium end-to-end checks play the demo's golden path to
  the Escape ending in a real browser.
- Kiro spec-driven development throughout: specs, steering, hooks, and a
  custom reviewer agent in `/.kiro` (see "How Kiro was used" below).

## How Kiro was used (Devpost write-up)

- **Specs drove everything.** Two feature specs (`.kiro/specs/`) were
  written before any code: `hypercard-core` and `haunted-stack-demo`,
  each with EARS requirements, a design doc, and wave-ordered tasks.
  Implementation followed the task waves, and checkboxes were updated as
  work landed — all 17 tasks are complete and traceable.
- **Steering kept the agent honest.** `product.md`, `tech.md`, and
  `structure.md` load on every interaction; `hypertalk-language.md` and
  `testing-standards.md` use `fileMatch` inclusion so language and testing
  rules appear only when relevant files are in play. The steering rules
  (zero dependencies, no `eval`, pure core modules) shaped the
  architecture — the script engine is a real interpreter, not a wrapper
  around `eval`, because steering forbade the shortcut.
- **Hooks automated discipline.** A `PostFileSave` hook (v1 JSON schema)
  runs `scripts/check.sh` — syntax check plus the full 48-test suite —
  after every save, and a `PostTaskExec` agent hook keeps `tasks.md`
  checkboxes in sync with reality.
- **Custom agent.** `.kiro/agents/stack-reviewer.md` is a read-only
  reviewer persona for the script engine and data model, with sandbox
  safety as its first priority.
- **Kiro CLI 3.3.0** on Linux, installed from the official installer; the
  OAuth device-flow login was completed (account holder approved the
  device code on their phone; `kiro-cli whoami` reports "Logged in with
  GitHub"). An authenticated Kiro agent session then independently
  verified the project — test suite 48/48, every spec acceptance
  criterion implemented, safety constraints holding — with verdict
  **READY** (see `BUILD-TRANSCRIPT.md`). The build surfaced (and
  documented) a real CLI quirk: with `TERM=dumb` the login hangs silently
  after provider selection; with a sized PTY and `TERM=xterm-256color`
  the device code appears.
- **Not used, honestly:** no MCP servers (none were needed for a
  zero-dependency static app), no Kiro Crew session, no property-based
  testing. The `BUILD-TRANSCRIPT.md` in the repo records exactly what
  Kiro's agent did vs. what was implemented by hand following the specs.

## Demo video script (<3 minutes)

_Record a screen capture with voiceover. No copyrighted music. Target: 2:30._

| Time | Shot | Narration |
|---|---|---|
| 0:00–0:20 | Library view | "In 1987, Apple shipped HyperCard — the friendliest authoring tool ever made. Apple killed it in 2004. This is STACKS: HyperCard, resurrected — built with Kiro for Kiroween 2026." |
| 0:20–0:50 | Play The Haunted Stack: Foyer → Library, take the key | "It ships with a complete adventure. You're locked in a manor at midnight. Find the brass key — watch the button hide itself and the note appear. That's a script running." |
| 0:50–1:20 | Cellar locked door (dialog), then with key → Kitchen → Tower → Escape | "The locked door checks a variable. No key, no entry. With the key and the candle, you reach the tower and escape. Two endings, ten cards, zero setup." |
| 1:20–1:50 | Editor: open the Library card, show the key script, edit text, Check script | "Everything you just played is editable. Here's the key script — readable English, checked live. Change a line, save, play. No build step, no server — your stacks never leave the browser." |
| 1:50–2:20 | `/.kiro` folder in the repo: specs, steering, hooks | "And it was built the Kiro way: specs before code, steering for the rules, hooks running the 48-test suite on every save. The whole process is in the repo." |
| 2:20–2:30 | Library view, links on screen | "STACKS — HyperCard, resurrected. Play it now, free, at the link below." |

## Bonus prizes

- **Best Demo** — automatic consideration; the video above is the entry.
- **Social Blitz Prize** (human step): post on any social platform during
  the submission period, starting with `#KiroweenHackathon26`, about your
  favorite thing about Kiro. Add the post URL to the submission.
- **Bonus Blog Prize** (human step): publish a public blog post about Kiro
  and this project during the submission period; add the URL. (Optional;
  100 winners get 2,000 Kiro credits.)
- Not eligible: Best Student / Best Startup / Best Ghost of Kiroween Past
  (no claim made).

## Human steps (only the account holder can do these)

1. **Kiro device-flow login approval** (ASAP — needed for genuine Kiro
   agent sessions; the CLI prints a URL + code, approve on your phone with
   GitHub). _Status: CLI verified; awaiting approval._
2. **Request the free 4,000 Kiro credits** via the form on the Devpost
   Resources tab — deadline **1 Dec 12:00 PT = 2 Dec 03:00 WIB**. Needs
   your Kiro user ID / AWS account ID. Optional but useful for follow-up
   Kiro sessions.
3. **Enable GitHub Pages** (Settings → Pages → Deploy from branch `main`,
   folder `/ (root)`) so the demo URL goes live. Free. _Do this right
   after the repo is pushed._
4. **Record + upload the demo video** to YouTube (public, <3 min) using
   the script above. Any time before the deadline; earlier is safer.
5. **Submit on Devpost** (kiroween.devpost.com → Enter a Submission):
   paste the title/description/links above, select **Resurrection**,
   attach the video URL, save early and update as needed. Deadline
   **5 Dec 05:00 WIB** — no extensions.
6. Optional: Social Blitz post + blog post (bonus prizes above).
