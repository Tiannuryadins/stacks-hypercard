# Tasks — haunted-stack-demo

Implementation plan for "The Haunted Stack". Depends on the `hypercard-core`
spec (model, script engine, player). Checkboxes are updated as work lands.

## Wave 1 — content (depends on hypercard-core Wave 1)

- [x] 1.1 Write the story text for all 9 cards (Foyer, Library, Attic,
      Cellar, Kitchen, Garden, Mirror Room, Tower, Escape, Trapped — 10
      cards total; see design.md story map) with final prose, no placeholders.
- [x] 1.2 Create `js/demo-stack.js`: build the stack with `model.js`
      factories; wire every button script and `on show` handler per the
      design; assign each card its scene.
- [x] 1.3 Add the 10 scene styles (`.scene-foyer` … `.scene-dark`) to
      `css/app.css`.

## Wave 2 — tests (depends on Wave 1)

- [x] 2.1 `tests/demo-stack.test.js`: validates cleanly, all scripts parse,
      all navigation targets resolve, story graph connected, both endings
      reachable.
- [x] 2.2 Full play-through verification: play the demo stack end to end in
      a real browser session (headless Chromium), reaching both endings.
