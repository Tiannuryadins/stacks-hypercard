---
inclusion: always
---

# STACKS — Product Overview

## What it is

**STACKS** is HyperCard, resurrected: a local-first hypermedia authoring tool
that runs entirely in the browser. Users build "stacks" of "cards" — screens
made of text fields and buttons — and wire them together with a small,
HyperTalk-inspired scripting language. No account, no server, no build step:
open the page and start building. Stacks persist in the browser
(localStorage) and travel as plain JSON files or shareable links.

This project is an entry for **Kiroween 2026** (Kiro/AWS hackathon on Devpost),
category **Resurrection**. HyperCard (Apple, 1987–2004) is the dead technology
being brought back: the card/stack metaphor, the friendly authoring
environment, and the readable English-like scripting language — reimagined
with modern web technology (ES modules, WebAudio, localStorage) and a
haunted-library design fitting the Kiroween theme.

## Who it is for

- **Storytellers and game makers** who want to build small interactive
  stories, text adventures, and puzzle games without learning a game engine.
- **Teachers and learners** who want a gentle, readable introduction to
  programming concepts (events, variables, conditionals) through HyperTalk-lite.
- **Nostalgic HyperCard users** and anyone curious about hypermedia history.
- **Hackathon judges** who need to see a working app in under three minutes:
  the built-in demo stack, "The Haunted Stack", is a complete playable
  haunted-house adventure that proves the tool works.

## Key features

1. **Card editor** — create cards, add text fields and buttons, position them
   on the card, and attach scripts. Form-based editing (no drag-and-drop in
   v1); every change is validated before it is saved.
2. **HyperTalk-lite scripting** — a real interpreter (lexer, parser,
   evaluator) for an English-like language: `on mouseUp`, `go to card`,
   `show`/`hide`, `put ... into field`, `play sound`, `set` variables,
   `if ... then ... end if`, `answer`. No `eval`, no arbitrary JavaScript —
   scripts cannot escape the sandbox.
3. **Player** — run any stack full-screen: click buttons, scripts execute,
   sounds play (synthesized with WebAudio, no audio files).
4. **Local-first storage** — stacks live in localStorage; export/import as
   JSON; share via a link that embeds the stack.
5. **The Haunted Stack** — a built-in 10-card playable demo adventure that
   exercises every language feature (variables, conditionals, sounds,
   navigation) and doubles as the video-demo script.

## Non-goals (v1)

- No multiplayer, no accounts, no cloud sync, no backend of any kind.
- No drag-and-drop layout editing (positions are numeric form fields).
- No image upload: card art is CSS/canvas-generated scenes and typography.
- No mobile-native app: the web app is responsive but desktop-first.

## Success criteria

- A first-time visitor can play "The Haunted Stack" to an ending in under
  3 minutes with zero setup.
- A new user can create a stack, add a second card, link them with a button
  script, and play it in under 5 minutes.
- Every script in the demo stack parses and runs; the test suite
  (`node --test tests/*.test.js`) passes with zero failures.
- The app works offline after first load (no CDN, no external requests).
