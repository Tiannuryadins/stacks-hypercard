#!/bin/bash
# STACKS — check script: syntax-check every JS file, then run the test suite.
# Used by the PostFileSave hook (.kiro/hooks/test-on-save.json).
set -eu
cd "$(dirname "$0")/.."
for f in js/*.js tests/*.js; do
  node --check "$f"
done
echo "syntax OK: $(ls js/*.js tests/*.js | wc -l) files"
node --test "tests/*.test.js"
