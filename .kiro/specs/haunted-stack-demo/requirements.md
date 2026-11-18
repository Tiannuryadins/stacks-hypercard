# Requirements — haunted-stack-demo

Feature spec for "The Haunted Stack", the built-in demo adventure that ships
with STACKS. It is both the first-run experience and the proof that the tool
works: every card and script in it is built with the same model and language
available to users. Workflow: Requirements-First. Status: implemented
2026-11-17 (see tasks.md).

## Introduction

A new user opening STACKS should immediately be able to play something good.
"The Haunted Stack" is a 10-card haunted-house adventure: the player is locked
in a manor at midnight and must find the brass key, light the tower candle,
and escape before the house wakes. It is also the demo-video script and the
Kiroween Halloween hook — spooky, but warm and playful, never gory.

## Requirements

### Requirement 1 — A complete playable story

**User Story:** As a first-time visitor, I want to play a finished adventure
immediately, so that I understand what STACKS can do.

#### Acceptance Criteria

1. WHEN the user opens the library THEN the system SHALL list "The Haunted
   Stack" as a built-in stack, playable without any setup.
2. WHEN the user plays it THEN the system SHALL present a story with a clear
   goal (escape the manor), at least two endings (escape / trapped), and a
   path to each ending reachable by clicking buttons only.
3. WHEN the user finishes an ending THEN the system SHALL offer a way back
   to the first card and to the library.

### Requirement 2 — The demo exercises the language

**User Story:** As a judge evaluating the tool, I want the demo to prove
every language feature works, so that I trust the implementation.

#### Acceptance Criteria

1. WHEN the demo stack is inspected THEN it SHALL contain at least one use
   of each of: `go to card` (by name and by relative navigation),
   `show`/`hide`, `put ... into/after field`, `play sound`, `set` variable,
   `if ... then ... end if`, `answer`, and `wait`.
2. WHEN the demo stack is inspected THEN it SHALL contain at least one
   `on show` handler and at least one conditional branch that changes the
   story (a locked door that opens only with the key).
3. WHEN the demo stack is validated THEN `validateStack` SHALL return zero
   errors and every script SHALL parse cleanly.

### Requirement 3 — Atmosphere

**User Story:** As a player, I want the manor to feel haunted, so that the
adventure is memorable.

#### Acceptance Criteria

1. WHEN each card is shown THEN the system SHALL render a distinct scene
   (foyer, library, attic, cellar, garden, mirror room, kitchen, tower,
   ending) with its own palette and glyph.
2. WHEN the player enters the cellar or tower THEN the system SHALL play a
   sound (thunder / wind / creak) via the card's `on show` handler.
3. WHEN the player reads the text THEN the system SHALL present short,
   well-written prose (each field under 400 characters) with no placeholder
   text anywhere.
