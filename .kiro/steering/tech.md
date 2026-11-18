---
inclusion: always
---

# STACKS — Technology Stack

## Stack (deliberately minimal)

- **Language:** Vanilla JavaScript (ES2022), no TypeScript, no framework.
- **Modules:** Native ES modules (`<script type="module">`). No bundler,
  no build step — the repository IS the deployable site.
- **Runtime targets:** Modern browsers (Chrome/Edge/Firefox/Safari, evergreen)
  and Node.js 20+ for tests. No polyfills.
- **Styling:** Plain CSS in `css/app.css`. System font stacks only
  (Georgia/Palatino serif for display, system sans for UI, monospace for
  scripts). No webfonts, no CDN, no external requests at runtime.
- **Audio:** WebAudio API, synthesized in code (`js/audio.js`). No audio
  files, no assets to download.
- **Persistence:** `localStorage` behind a thin storage adapter (`js/store.js`)
  so tests can substitute a fake storage object.
- **Tests:** Node.js built-in test runner (`node:test` + `node:assert`).
  No test framework dependency. Run with `node --test tests/*.test.js` or
  `bash scripts/check.sh` (also runs `node --check` on every JS file).
- **Hosting:** GitHub Pages (static). The repo root is the site root;
  `index.html` is the entry point.

## Constraints

- **Zero dependencies.** `package.json` does not exist on purpose. If a
  feature needs a library, either implement it in ~100 lines or cut the
  feature. This keeps the project install-free and audit-friendly.
- **Zero backend.** Nothing in this repo makes a network request at runtime.
  There is no API, no analytics, no tracking.
- **No `eval` / `Function` / `innerHTML` with user data.** User scripts are
  interpreted by our own parser, never executed as JavaScript. User text is
  inserted with `textContent`, never `innerHTML`. (The card renderer builds
  DOM nodes with `document.createElement`.)
- **Offline-first.** After first load, every feature works with the network
  disabled. Verify by loading the page once, then disabling the network.
- **Deterministic core.** `js/model.js` and `js/script.js` are pure modules
  with no DOM or network access, so they are fully testable in Node.

## Commands

| Command | Purpose |
|---|---|
| `bash scripts/check.sh` | Syntax-check all JS files, then run the full test suite |
| `node --test tests/*.test.js` | Run tests only |
| `python3 -m http.server 8000` | Serve the app locally (ES modules need http, not `file://`) |

## Browser support notes

- ES modules, `crypto.randomUUID`, `localStorage`, and WebAudio are required.
  `crypto.randomUUID` falls back to a counter-based ID generator when
  unavailable (see `js/model.js`), so the core still works in restricted
  contexts; audio degrades silently when WebAudio is unavailable.
