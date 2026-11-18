# Design — hypercard-core

## Overview

STACKS is a zero-dependency, zero-backend single-page app. The design splits
cleanly into a **pure core** (data model + scripting language, fully testable
in Node with no DOM) and a **browser shell** (storage adapter, audio, UI).
The pure core is the heart of the resurrection: HyperCard's ideas (cards,
stacks, HyperTalk) expressed as plain data and a small interpreter.

## Architecture

```
index.html
  └─ js/app.js            UI shell: hash router, 3 views, DOM rendering
       ├─ js/model.js     pure: factories, validateStack, JSON import/export
       ├─ js/script.js    pure: lexer → parser → async interpreter
       ├─ js/store.js     storage adapter over an injected storage object
       ├─ js/audio.js     WebAudio synthesized sounds
       └─ js/demo-stack.js  built-in demo stack data (uses model.js)
tests/                    node:test suites, one per module
```

Dependency rules:

- `model.js` and `script.js` import nothing. They run in Node and in the
  browser unchanged.
- `store.js` imports `model.js` only (for validation). It never touches the
  global `localStorage` directly — the storage object is injected, so tests
  pass a fake.
- `demo-stack.js` imports `model.js` factories only.
- `app.js` imports everything; it is the only module that touches the DOM,
  `location.hash`, `localStorage`, or `AudioContext`.

## Data model

```js
Stack  = { version: 1, id, name, author, description, createdAt,
           cards: Card[], firstCardId }
Card   = { id, name, background: { scene: string }, fields: Field[],
           buttons: Button[], onShow: string }
Field  = { id, name, x, y, w, h, text, fontSize, hidden }
Button = { id, name, x, y, w, h, label, style: "rect"|"round"|"ghost",
           script }
```

- `background.scene` names a CSS scene class (`foyer`, `library`, `attic`,
  `cellar`, `garden`, `mirror`, `kitchen`, `tower`, `plain`) rendered by
  the player as layered gradients + a glyph. No image assets.
- Coordinates are in card units: the card is 720×480; the renderer scales
  with CSS (`aspect-ratio` + percentage positioning) so layouts are
  resolution-independent.
- `validateStack(stack)` returns `string[]` (empty = valid). It checks:
  object shapes, id presence/uniqueness, card-name uniqueness, first-card
  reference, element bounds (x/y/w/h are finite numbers), and that every
  script string parses (via `parseScript` from `script.js`).

## Scripting language (HyperTalk-lite)

Pipeline: `parseScript(source)` → AST → `runScript(ast, runtime)`.

- **Lexer:** line-oriented. Each line is tokenized into words, quoted
  strings, numbers, and operators. `--` starts a comment. Blank lines are
  skipped. Keywords are matched case-insensitively.
- **Parser:** recursive descent over handler blocks (`on <event>` ...
  `end <event>`) and `if` blocks. Produces handler ASTs:
  `{ event, body: Statement[] }`. Throws `ScriptError(message, line)`.
- **Interpreter:** async walker over statements. Each statement calls one
  runtime method (see `.kiro/steering/hypertalk-language.md` for the
  contract). Expressions are evaluated by a Pratt-style evaluator with the
  precedence: unary > `*` `/` > `+` `-` > comparison > `and` > `or`.
- **Variables:** stack-scoped `Map` held by the player session, passed to
  the runtime. Undefined variables read as `0`.
- **Errors:** parse errors throw `ScriptError`; runtime errors are delivered
  via `runtime.onError` and abort the current handler only.

## Storage

Keys: `stacks:v1:index` (JSON array of ids) and `stacks:v1:<id>` (stack JSON).
`loadStacks(storage)` returns `{ stacks, skipped }` where `skipped` counts
entries that failed validation. All writes go through `validateStack` first;
an invalid stack is never persisted.

## UI

Hash router, three views:

- `#/library` — stack cards with Play / Edit / Export / Delete; "New stack"
  and "Import JSON" actions; the demo stack is always present (read-only
  copy — editing it creates a user copy).
- `#/play/<stackId>/<cardId>` — renders the card at 720×480, fields as
  positioned divs, buttons as positioned buttons. Clicking a button runs its
  `mouseUp` handler through the player runtime (navigation, visibility,
  text, sound, dialogs). A "Back to library" control and a card-name
  breadcrumb are always visible.
- `#/edit/<stackId>/<cardId>` — left panel: card list + add/remove card;
  center: live card preview; right panel: inspector for the selected field
  or button (text, position, size, script textarea with a "Check script"
  button that parses and shows errors inline).

Share links: `#/s/<base64url(JSON)>` — the player decodes, validates, and
plays the embedded stack without saving it.

## Testing strategy

- `tests/model.test.js` — factories, validation (valid + each error class),
  export/import round-trip.
- `tests/script.test.js` — one test per statement type, per operator class,
  nested `if`, parse-error line numbers, runtime-error behavior, sandbox
  guarantee (a script containing `eval(...)` is a parse error, not code).
- `tests/store.test.js` — save/load/delete/index with a fake storage object.
- `tests/demo-stack.test.js` — the demo stack validates, all scripts parse,
  all navigation targets resolve.
- `scripts/check.sh` — `node --check` on every `js/*.js`, then
  `node --test tests/*.test.js`. The PostFileSave hook runs it.
