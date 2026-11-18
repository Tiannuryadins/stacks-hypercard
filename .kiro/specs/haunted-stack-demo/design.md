# Design — haunted-stack-demo

## Overview

"The Haunted Stack" is data, not code: a single `Stack` object built with
the `model.js` factories in `js/demo-stack.js`, using only features any user
can use. It is the dogfood test for the whole platform — if the tool cannot
build this adventure, the tool is not done.

## Story map (9 cards)

```
Foyer ──► Library ──► Attic
  │          │           │
  │          ▼           ▼
  │       Cellar ──► Kitchen ──► Garden
  │          │                       │
  └────► Mirror Room ────────────────┘
                    │
                    ▼
                 Tower ──► Escape (ending) / Trapped (ending)
```

- **Foyer** (first card): the hook. "Midnight. The door locks behind you."
  Buttons: explore the Library, peek into the Mirror Room.
- **Library**: find the brass key. Button "Take the brass key" sets
  `hasKey` to 1, hides itself, reveals a note field. Button to the Cellar.
- **Attic**: a red herring with a whisper sound and a poem; leads back.
- **Cellar**: the locked door. Button "Try the cellar door": if `hasKey`
  then go to Kitchen, else `answer` "Locked. Something brass-shaped would
  help." Thunder on show.
- **Kitchen**: find the candle. Sets `hasCandle`. Leads to Garden / Tower.
- **Garden**: moonlight breather card; a riddle whose answer reveals a
  shortcut hint (put text into a field).
- **Mirror Room**: the mirror shows the player a ghost; `show`/`hide`
  trickery — the ghost field appears only after clicking the mirror.
- **Tower**: the climax. `on show` plays wind. Button "Light the candle":
  if `hasCandle` then go to Escape, else `answer` "Too dark to climb."
- **Escape** (ending): dawn breaks; chime sound; buttons to replay or to
  the library. **Trapped** (ending): reached by choosing "Give up and
  sleep" in the Garden — a gentle bad ending with a replay button.

Variables: `hasKey`, `hasCandle` (0/1 flags). All navigation is by card
name except the Garden's "wander" button, which uses `go to next card` to
exercise relative navigation.

## Scenes

Each card's `background.scene` maps to a CSS class in `app.css`:
`foyer`, `library`, `attic`, `cellar`, `garden`, `mirror`, `kitchen`,
`tower`, `dawn` (Escape), `dark` (Trapped). Scenes are layered CSS
gradients plus one large glyph (🕯️ 📚 🦇 🗝️ 🌙 🪞 🍲 🗼 🌅 🌑).
No image assets — the whole stack is JSON-serializable data.

## Testing strategy

`tests/demo-stack.test.js`:
- `validateStack(demoStack)` returns zero errors.
- Every script in the stack parses via `parseScript`.
- Every `go to card "Name"` target resolves to an existing card.
- The story graph is connected: every card is reachable from the first card
  by following navigation statements (BFS over the parsed scripts).
- Both endings are reachable (BFS from the first card reaches Escape and
  Trapped).
