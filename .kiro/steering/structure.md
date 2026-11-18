---
inclusion: always
---

# STACKS — Project Structure

## Layout

```
stacks-hypercard/            # repo root = GitHub Pages site root
├── index.html               # single entry point; loads css/app.css + js/app.js
├── css/
│   └── app.css              # all styles; haunted-library theme
├── js/
│   ├── model.js             # stack/card/field/button data model + validation + JSON I/O (pure, Node-safe)
│   ├── script.js            # HyperTalk-lite lexer/parser/interpreter (pure, Node-safe)
│   ├── store.js             # localStorage adapter (injectable storage object)
│   ├── audio.js             # WebAudio synthesized sounds (browser only)
│   ├── demo-stack.js        # "The Haunted Stack" data (imports model.js factories)
│   └── app.js               # UI: router, library/player/editor views, DOM rendering
├── tests/
│   ├── model.test.js
│   ├── script.test.js
│   ├── store.test.js
│   └── demo-stack.test.js
├── scripts/
│   └── check.sh             # node --check on all js files + node --test
├── .kiro/
│   ├── steering/            # this folder (product/tech/structure + focused files)
│   ├── specs/               # one folder per feature: requirements.md, design.md, tasks.md
│   ├── hooks/               # v1 JSON hooks (see kiro.dev/docs/hooks)
│   └── agents/              # custom agents (Markdown format)
├── README.md
├── LICENSE                  # MIT
├── BUILD-TRANSCRIPT.md      # how the project was built, incl. honest Kiro-usage notes
└── SUBMISSION.md            # Devpost submission draft
```

## Conventions

- **File naming:** kebab-case for files (`demo-stack.js`, `check.sh`).
  Test files mirror their module: `js/model.js` → `tests/model.test.js`.
- **Module style:** ES modules with named exports. No default exports.
  Pure modules (`model.js`, `script.js`) must not import browser-only
  modules; `app.js` is the only module that touches the DOM directly.
- **IDs:** every stack, card, field, and button has a string `id` generated
  by `createId()` in `model.js`. References between objects use ids, never
  array indexes. Human-readable `name` fields are for display and for
  script references (`go to card "Library"` resolves by name).
- **Scripts are data:** button/card scripts are plain strings stored on the
  object (`button.script`, `card.onShow`). They are parsed at run time by
  `js/script.js`; parse errors surface in the editor's "Check script" action
  and in the player as a visible error card, never as a crash.
- **Validation boundary:** `validateStack()` in `model.js` is the single
  source of truth for stack correctness. Import, load, and save paths all
  run through it. The UI never trusts stored data without validation.
- **CSS:** one stylesheet, custom properties for the palette at the top
  (`--ink`, `--parchment`, `--ember`, ...). Class names are semantic
  (`.card-view`, `.stack-list`). No utility-class soup.
- **Tests:** one test file per module, using `node:test` and `node:assert/strict`.
  Test names describe behavior ("rejects a stack whose button references a
  missing card"). No test may touch the real DOM, network, or filesystem
  outside the repo.

## Adding a feature

1. Write or extend a spec in `.kiro/specs/<feature>/` first
   (requirements → design → tasks), following the existing specs.
2. Implement the pure logic in `js/` with tests in `tests/` before wiring UI.
3. Run `bash scripts/check.sh` before committing; all checks must pass.
4. Update the spec's `tasks.md` checkboxes to match what was actually done.
