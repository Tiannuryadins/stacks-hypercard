---
inclusion: fileMatch
fileMatchPattern: ["js/script.js", "js/demo-stack.js", "tests/script.test.js", "tests/demo-stack.test.js"]
---

# HyperTalk-lite — Language Reference

This file is the normative reference for the scripting language implemented
in `js/script.js`. When writing or reviewing scripts (including every script
in `js/demo-stack.js`), follow it exactly.

## Handlers

A script is a sequence of handlers. Each handler starts with `on <event>`
and ends with `end <event>`. Supported events: `mouseUp` (button clicked),
`show` (card shown). Keywords are case-insensitive; identifiers and string
contents are case-sensitive.

```
on mouseUp
  go to card "Library"
end mouseUp
```

## Statements (one per line; `--` starts a comment)

| Statement | Meaning |
|---|---|
| `go to card "Name"` | Navigate to the card with that name |
| `go to card 3` | Navigate to the card at 1-based index 3 |
| `go to next card` / `go to previous card` | Relative navigation (wraps) |
| `go to first card` / `go to last card` | Jump to an end |
| `show field "Name"` / `hide field "Name"` | Toggle a field's visibility on the current card |
| `show button "Name"` / `hide button "Name"` | Toggle a button's visibility |
| `put "text" into field "Name"` | Replace a field's text |
| `put "text" after field "Name"` | Append to a field's text |
| `play sound "creak"` | Play a synthesized sound: `creak`, `thunder`, `chime`, `knock`, `wind`, `whisper` |
| `wait 1.5 seconds` | Pause execution (seconds, may be fractional) |
| `set score to score + 1` | Assign a variable (stack-scoped, persists while playing) |
| `answer "text"` | Show a message dialog to the player |
| `if <expr> then` ... `end if` | Conditional block (may nest) |

## Expressions

Literals: numbers (`42`, `1.5`), double-quoted strings (`"hello"`),
variables (`score`, `hasKey`). Operators, by precedence (high to low):
unary `-`/`not`; `*` `/`; `+` `-`; comparisons `=` `<>` `<` `<=` `>` `>=`;
`and`; `or`. Parentheses group. `+` concatenates when either side is a
string, otherwise adds numbers. Undefined variables read as `0`.

## Errors

- Parse errors throw `ScriptError` with a 1-based `line` number and a
  human-readable message. The editor shows them next to the script.
- Runtime errors (unknown card/field/button/sound, bad navigation) are
  reported through the runtime's `onError` callback; the player shows the
  error in a dialog and stops that script. A script error must never crash
  the app or corrupt the stack.
- **Navigation ends the handler.** Statements after a successful
  `go to card` do not run — the handler stops and the new card's
  `on show` handler takes over.

## Runtime contract

`runScript(source, runtime)` where `runtime` provides: `goToCard(ref)`,
`showElement(kind, name)`, `hideElement(kind, name)`, `putText(text, name, mode)`,
`playSound(name)`, `wait(seconds)`, `answer(text)`, `getVar(name)`,
`setVar(name, value)`, `onError(error)`. The interpreter is async and awaits
`wait` and `answer`. Tests substitute a recording fake runtime.
