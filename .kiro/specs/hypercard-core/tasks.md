# Tasks — hypercard-core

Implementation plan for the STACKS core. Checkboxes are updated as work
lands. Waves follow Kiro's dependency-graph execution: tasks within a wave
have no dependencies on each other.

## Wave 1 — pure core (no dependencies)

- [x] 1.1 Create `js/model.js`: `createId`, stack/card/field/button
      factories, `validateStack` (shapes, ids, unique names, first-card
      reference, bounds), `exportStack`/`importStack` JSON round-trip.
- [x] 1.2 Create `js/script.js`: lexer, parser (`parseScript`, `ScriptError`
      with line numbers), async interpreter (`runScript`) for all statements
      in `.kiro/steering/hypertalk-language.md`, expression evaluator with
      documented precedence.
- [x] 1.3 Create `js/store.js`: versioned keys, index maintenance,
      `loadStacks`/`saveStack`/`deleteStack` with validation on every write
      and graceful skip of invalid entries on load.

## Wave 2 — tests for the pure core (depend on Wave 1)

- [x] 2.1 `tests/model.test.js`: factories, validation happy path, each
      error class, export/import round-trip.
- [x] 2.2 `tests/script.test.js`: one test per statement type, operator
      precedence, nested `if`, parse-error line numbers, runtime-error
      behavior, sandbox guarantee (no `eval` path).
- [x] 2.3 `tests/store.test.js`: save/load/delete/index with a fake storage
      object; invalid entries skipped and counted.

## Wave 3 — browser shell (depends on Wave 1)

- [x] 3.1 Create `js/audio.js`: lazy `AudioContext`, synthesized sounds
      (`creak`, `thunder`, `chime`, `knock`, `wind`, `whisper`), silent
      no-op when WebAudio is unavailable.
- [x] 3.2 Create `index.html` + `css/app.css`: shell, haunted-library theme
      (custom properties, serif display type), responsive card stage.
- [x] 3.3 Create `js/app.js`: hash router; library view (list, new, import,
      export, delete); player view (render card, run scripts via a player
      runtime, dialogs, sounds); editor view (card list, live preview,
      inspector, script check); share-link encode/decode.

## Wave 4 — verification (depends on Waves 2–3)

- [x] 4.1 Create `scripts/check.sh` (`node --check` on all `js/*.js`, then
      `node --test tests/*.test.js`) and run it green.
- [x] 4.2 Serve locally (`python3 -m http.server`) and verify the library,
      player, and editor render; verify a full play-through of the demo
      stack (see `haunted-stack-demo` spec).
- [x] 4.3 Verify offline behavior: load once, disable network, confirm all
      features still work (no external requests by construction).
