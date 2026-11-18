# STACKS — HyperCard, resurrected 🕯️

> **Kiroween 2026 entry** · Category: **Resurrection** · Built with Kiro

STACKS brings HyperCard (Apple, 1987–2004) back to life as a local-first
hypermedia authoring tool that runs entirely in your browser. Build **stacks**
of **cards** — screens made of text fields and buttons — and wire them
together with **HyperTalk-lite**, a readable English-like scripting language
with a real interpreter (lexer, parser, async evaluator). No account, no
server, no build step, no dependencies: open the page and start building.

**Live demo:** https://tiannuryadins.github.io/stacks-hypercard/

## Play it in 30 seconds

1. Open the demo link above.
2. Click **▶ Play** on **The Haunted Stack**.
3. You're locked in Blackwood Manor at midnight. Find the brass key, light
   the tower candle, and escape — or sleep in the garden and stay forever.

The demo is a complete 10-card adventure with two endings, and every card
and script in it was built with the same tool you get. Click **Remix** to
open it in the editor and make it yours.

## What you can build

- Interactive stories and text adventures
- Small puzzle games with inventory flags and conditional branches
- Guided tours, quizzes, and teaching material
- Anything HyperCard could do in 1987 — now in a browser tab

## Features

- **Card editor** — add cards, fields, and buttons; edit text, positions,
  scenes, and scripts; every script is syntax-checked live.
- **HyperTalk-lite** — `on mouseUp`, `go to card`, `show`/`hide`,
  `put ... into/after field`, `play sound`, `set` variables,
  `if ... then ... end if`, `answer`, `wait`. A real interpreter — no `eval`,
  scripts cannot escape the sandbox. See
  [`.kiro/steering/hypertalk-language.md`](.kiro/steering/hypertalk-language.md).
- **Player** — runs any stack full-screen with synthesized WebAudio sounds
  (creak, thunder, chime, knock, wind, whisper). No audio files.
- **Local-first** — stacks live in `localStorage`; export/import JSON;
  share a link that embeds the whole stack.
- **Offline** — after first load, the app makes zero network requests.

## Run it locally

```bash
# No install step. Serve the repo root over HTTP (ES modules need http, not file://):
python3 -m http.server 8000
# then open http://localhost:8000/
```

## Tests

```bash
bash scripts/check.sh   # node --check on all JS files, then the full test suite
```

48 unit tests (Node's built-in runner, zero dependencies) cover the data
model, the script engine, storage, and the demo stack — including a
reachability proof that every card and both endings are reachable. A
headless-Chromium end-to-end script (`scripts/e2e-chrome.mjs`, 28 checks)
plays the demo's golden path to the Escape ending in a real browser.

## How Kiro was used

This project was built with Kiro's spec-driven workflow — the `/.kiro`
folder is the evidence, not decoration:

- **Specs** (`.kiro/specs/`): two feature specs, each with `requirements.md`
  (EARS acceptance criteria), `design.md`, and `tasks.md` with checkboxes
  updated as work landed. Code was written to match the specs, in the
  waves the task lists define.
- **Steering** (`.kiro/steering/`): `product.md`, `tech.md`, `structure.md`
  (always loaded), plus `hypertalk-language.md` and `testing-standards.md`
  with `fileMatch` inclusion so language and testing rules load only when
  relevant files are in play.
- **Hooks** (`.kiro/hooks/test-on-save.json`, v1 schema): a `PostFileSave`
  hook runs `scripts/check.sh` (syntax check + full test suite) after every
  save, and a `PostTaskExec` agent hook keeps `tasks.md` checkboxes honest.
- **Custom agent** (`.kiro/agents/stack-reviewer.md`): a read-only reviewer
  persona for the script engine and data model — sandbox safety first.
- **Kiro CLI** (v3.3.0): installed on Linux from the official installer,
  login completed via the OAuth device flow, and an authenticated Kiro
  agent session independently verified the project (48/48 tests, all spec
  criteria met, verdict READY). The specs, steering, hooks, and agent
  above were authored in Kiro's documented formats and the implementation
  followed them task by task. See
  [`BUILD-TRANSCRIPT.md`](BUILD-TRANSCRIPT.md) for exactly what the Kiro
  agent itself did vs. what was implemented by hand following the specs.

See [`BUILD-TRANSCRIPT.md`](BUILD-TRANSCRIPT.md) for the full build log,
including exactly what was verified and the honest limits of the Kiro usage.

## Project structure

```
├── index.html            entry point
├── css/app.css           haunted-library theme (system fonts only)
├── js/
│   ├── model.js          stack/card data model + validation + JSON I/O (pure)
│   ├── script.js         HyperTalk-lite lexer/parser/interpreter (pure)
│   ├── store.js          localStorage adapter (injectable storage)
│   ├── audio.js          WebAudio synthesized sounds
│   ├── demo-stack.js     "The Haunted Stack" data (10 cards)
│   └── app.js            router, library/player/editor views
├── tests/                node:test suites (48 tests)
├── scripts/
│   ├── check.sh          syntax check + test suite
│   └── e2e-chrome.mjs    headless-Chromium E2E (28 checks)
└── .kiro/                specs, steering, hooks, custom agent
```

## License

MIT — see [LICENSE](LICENSE). HyperCard was created by Bill Atkinson at
Apple Computer, 1987. STACKS is an independent homage, not affiliated with
or endorsed by Apple.
