# Requirements — hypercard-core

Feature spec for the STACKS core: the stack/card data model, the HyperTalk-lite
scripting language, local-first storage, and the library/player/editor UI.
Workflow: Requirements-First. Status: implemented 2026-11-17 (see tasks.md).

## Introduction

STACKS resurrects HyperCard as a browser app. The core feature delivers
everything a user needs to author and play a stack of cards: a validated data
model, a safe little scripting language, local persistence, and a three-view
UI (library, player, editor). All of it runs with zero backend and zero
dependencies.

## Glossary

- **Stack**: a named collection of cards (one document).
- **Card**: one screen in a stack, holding fields and buttons.
- **Field**: a text area on a card (display text, can be shown/hidden and
  rewritten by scripts).
- **Button**: a clickable element on a card that runs a script on `mouseUp`.
- **Script**: a HyperTalk-lite program attached to a button or a card
  (`on show` handler).
- **Player**: the view that runs a stack: renders the current card and
  executes scripts.
- **Editor**: the view that modifies a stack's structure and scripts.

## Requirements

### Requirement 1 — Stack data model

**User Story:** As a storyteller, I want my stack saved as a well-defined
document, so that it loads, exports, and imports reliably.

#### Acceptance Criteria

1. WHEN a new stack is created THEN the system SHALL assign it a unique id,
   a name, an author, a creation timestamp, an empty card list, and a
   first-card pointer.
2. WHEN a card is added to a stack THEN the system SHALL assign it a unique
   id and a name unique within the stack.
3. WHEN a field or button is added to a card THEN the system SHALL assign it
   a unique id and a position (x, y) and size (w, h) within the card.
4. WHEN `validateStack` runs on a well-formed stack THEN the system SHALL
   return zero errors.
5. WHEN `validateStack` runs on a stack with a duplicate card name, a missing
   id, a dangling first-card reference, or a non-object element THEN the
   system SHALL return at least one descriptive error per problem.
6. WHEN a stack is exported THEN the system SHALL produce a JSON string that
   round-trips through import and validates cleanly.

### Requirement 2 — HyperTalk-lite scripting

**User Story:** As an author, I want to write readable English-like scripts,
so that I can make my cards interactive without learning JavaScript.

#### Acceptance Criteria

1. WHEN a script contains `on mouseUp ... end mouseUp` THEN the system SHALL
   parse it into a handler that runs when the button is clicked.
2. WHEN a script contains `on show ... end show` THEN the system SHALL parse
   it into a handler that runs when the card is shown.
3. WHEN a script uses `go to card "Name"` THEN the system SHALL navigate to
   the card with that name, or report a runtime error naming the missing card.
4. WHEN a script uses `go to next card` or `go to previous card` THEN the
   system SHALL wrap around at the ends of the stack.
5. WHEN a script uses `show`/`hide` on a field or button THEN the system
   SHALL toggle that element's visibility on the current card.
6. WHEN a script uses `put "text" into field "Name"` or `put "text" after
   field "Name"` THEN the system SHALL replace or append the field's text.
7. WHEN a script uses `play sound "<name>"` with a known sound THEN the
   system SHALL play it; with an unknown sound THEN the system SHALL report
   a runtime error naming the sound.
8. WHEN a script uses `set <var> to <expr>` THEN the system SHALL store the
   value in a stack-scoped variable that persists while playing.
9. WHEN a script uses `if <expr> then ... end if` THEN the system SHALL
   execute the block only when the expression is truthy, including nested
   conditionals.
10. WHEN a script contains a syntax error THEN the system SHALL throw a
    `ScriptError` carrying the 1-based line number and a readable message.
11. WHEN a script raises a runtime error THEN the system SHALL stop that
    script, report the error to the player, and leave the app and the stack
    uncorrupted.
12. WHEN any script runs THEN the system SHALL NOT use `eval`, `Function`,
    or any other mechanism that executes arbitrary JavaScript.

### Requirement 3 — Local-first storage

**User Story:** As a user, I want my stacks saved in my browser, so that my
work survives reloads without an account.

#### Acceptance Criteria

1. WHEN a stack is saved THEN the system SHALL persist it under a
   versioned key and keep an index of stack ids.
2. WHEN the app loads THEN the system SHALL list all saved stacks from the
   index, skipping entries that fail validation (and reporting the count).
3. WHEN a stack is deleted THEN the system SHALL remove its data and its
   index entry.
4. WHEN storage is unavailable THEN the system SHALL keep the app usable
   in-memory for the session and show a warning.

### Requirement 4 — Library, player, and editor

**User Story:** As a user, I want to browse my stacks, play them, and edit
them, so that the whole authoring loop lives in one app.

#### Acceptance Criteria

1. WHEN the app opens THEN the system SHALL show the library: the built-in
   demo stack plus the user's saved stacks, each with Play, Edit, Export,
   and Delete actions.
2. WHEN the user plays a stack THEN the system SHALL render the first card,
   run its `on show` handler, and render fields and buttons at their
   positions.
3. WHEN the user clicks a button in the player THEN the system SHALL run the
   button's `mouseUp` script.
4. WHEN the user edits a stack THEN the system SHALL allow adding/removing
   cards, adding/removing fields and buttons, editing text, positions, and
   scripts, and validating scripts with visible errors.
5. WHEN the user exports a stack THEN the system SHALL download a JSON file;
   WHEN the user imports a JSON file THEN the system SHALL validate it and
   either save it or show the validation errors.
6. WHEN the user copies a share link THEN the system SHALL produce a URL
   that opens the stack in the player on any browser with no prior state.

### Requirement 5 — Offline and dependency-free operation

**User Story:** As a user on a flaky connection, I want the app to work
offline, so that nothing I do depends on the network.

#### Acceptance Criteria

1. WHEN the page has loaded once THEN the system SHALL perform zero network
   requests for any feature (no CDN, no fonts, no analytics).
2. WHEN the app is served from any static host THEN the system SHALL work
   with no build step and no server-side code.
