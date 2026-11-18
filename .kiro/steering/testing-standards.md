---
inclusion: fileMatch
fileMatchPattern: ["tests/**/*.js", "scripts/check.sh"]
---

# Testing Standards

## Runner

Node.js built-in test runner only: `node:test` + `node:assert/strict`.
Run the suite with `node --test tests/*.test.js` or `bash scripts/check.sh`.
No external test dependencies, ever.

## Rules

- **One test file per module**, named `<module>.test.js`.
- **Test behavior, not implementation.** Prefer public functions
  (`validateStack`, `parseScript`, `runScript`, `saveStack`) over internals.
- **Pure modules get exhaustive tests.** `model.js` and `script.js` run in
  Node with no DOM: every public function needs happy-path, edge-case, and
  error-path coverage. The script engine needs a test per statement type,
  per expression operator class, and per error class.
- **Fakes over mocks.** The script runtime and the storage adapter are
  plain-object interfaces; tests pass hand-written fakes (recording arrays)
  instead of a mocking library.
- **No test may touch the real DOM, network, localStorage, or the filesystem
  outside the repo.** `store.js` tests use an in-memory fake storage object.
- **Determinism.** No random data, no real timers (the `wait` statement is
  tested with a fake runtime that records the duration instead of sleeping),
  no dependence on test execution order.
- **The demo stack is tested too.** `tests/demo-stack.test.js` validates the
  demo stack against `validateStack`, parses every script it contains, and
  verifies every `go to card` target resolves to a real card.
- **Green before commit.** `bash scripts/check.sh` must exit 0. A failing
  test is a bug in the code or the test — fix it, do not delete the test.
