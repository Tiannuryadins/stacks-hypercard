import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { validateStack } from "../js/model.js";
import { parseScript, getHandler, walkStatements } from "../js/script.js";
import { getDemoStack } from "../js/demo-stack.js";

const demo = getDemoStack();

function allScripts(stack) {
  const scripts = [];
  for (const card of stack.cards) {
    if (card.onShow.trim()) scripts.push({ where: `${card.name} onShow`, source: card.onShow });
    for (const button of card.buttons) {
      if (button.script.trim()) scripts.push({ where: `${card.name} / ${button.name}`, source: button.script });
    }
  }
  return scripts;
}

describe("demo stack", () => {
  test("validates cleanly", () => {
    assert.deepEqual(validateStack(demo, (s) => parseScript(s)), []);
  });

  test("has 10 cards with the expected names", () => {
    assert.deepEqual(
      demo.cards.map((c) => c.name),
      ["Foyer", "Library", "Attic", "Cellar", "Kitchen", "Garden", "Mirror Room", "Tower", "Escape", "Trapped"],
    );
    assert.equal(demo.cards[0].id, demo.firstCardId);
  });

  test("every script parses", () => {
    for (const { where, source } of allScripts(demo)) {
      assert.doesNotThrow(() => parseScript(source), `${where} should parse`);
    }
  });

  test("every story field is short, finished prose (no placeholders)", () => {
    for (const card of demo.cards) {
      const story = card.fields.find((f) => f.name === "Story");
      assert.ok(story, `${card.name} has a Story field`);
      assert.ok(story.text.length > 40, `${card.name} story is substantive`);
      assert.ok(story.text.length < 400, `${card.name} story is under 400 chars`);
      assert.ok(!/lorem|todo|placeholder|xxx/i.test(story.text), `${card.name} has no placeholder text`);
    }
  });

  test("every go-to-card target resolves", () => {
    const names = new Set(demo.cards.map((c) => c.name));
    for (const { where, source } of allScripts(demo)) {
      const ast = parseScript(source);
      for (const handler of ast.handlers) {
        walkStatements(handler.body, (st) => {
          if (st.type === "go" && st.ref.type === "name") {
            assert.ok(names.has(st.ref.value), `${where}: unknown card "${st.ref.value}"`);
          }
          if (st.type === "go" && st.ref.type === "index") {
            assert.ok(st.ref.value >= 1 && st.ref.value <= demo.cards.length, `${where}: card index out of range`);
          }
        });
      }
    }
  });

  test("exercises every language feature", () => {
    const used = new Set();
    let hasOnShow = false;
    let hasConditionalGo = false;
    for (const { source } of allScripts(demo)) {
      const ast = parseScript(source);
      for (const handler of ast.handlers) {
        if (handler.event === "show") hasOnShow = true;
        walkStatements(handler.body, (st) => {
          used.add(st.type);
          if (st.type === "go") used.add(`go:${st.ref.type}`);
          if (st.type === "put") used.add(`put:${st.mode}`);
          if (st.type === "if") {
            let goes = false;
            walkStatements(st.body, (inner) => { if (inner.type === "go") goes = true; });
            if (goes) hasConditionalGo = true;
          }
        });
      }
    }
    for (const feature of [
      "go", "go:name", "go:next", "go:index", "go:first",
      "show", "hide", "put", "put:into", "put:after",
      "play", "wait", "set", "if", "answer",
    ]) {
      assert.ok(used.has(feature), `demo should use ${feature}`);
    }
    assert.ok(hasOnShow, "demo should have an on show handler");
    assert.ok(hasConditionalGo, "demo should branch the story with a conditional go");
  });

  test("story graph is connected and both endings are reachable", () => {
    // BFS over navigation edges from the parsed scripts.
    const edges = new Map(demo.cards.map((c) => [c.id, new Set()]));
    const resolve = (fromCard, ref) => {
      const idx = demo.cards.findIndex((c) => c.id === fromCard.id);
      if (ref.type === "name") return demo.cards.find((c) => c.name === ref.value) ?? null;
      if (ref.type === "index") return demo.cards[ref.value - 1] ?? null;
      if (ref.type === "next") return demo.cards[(idx + 1) % demo.cards.length];
      if (ref.type === "previous") return demo.cards[(idx - 1 + demo.cards.length) % demo.cards.length];
      if (ref.type === "first") return demo.cards[0];
      if (ref.type === "last") return demo.cards[demo.cards.length - 1];
      return null;
    };
    for (const card of demo.cards) {
      for (const button of card.buttons) {
        if (!button.script.trim()) continue;
        const ast = parseScript(button.script);
        for (const handler of ast.handlers) {
          walkStatements(handler.body, (st) => {
            if (st.type === "go") {
              const target = resolve(card, st.ref);
              assert.ok(target, `${card.name}: go target resolves`);
              edges.get(card.id).add(target.id);
            }
          });
        }
      }
    }
    const seen = new Set([demo.firstCardId]);
    const queue = [demo.firstCardId];
    while (queue.length > 0) {
      for (const next of edges.get(queue.shift())) {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    assert.equal(seen.size, demo.cards.length, "every card reachable from the first card");
    const escape = demo.cards.find((c) => c.name === "Escape");
    const trapped = demo.cards.find((c) => c.name === "Trapped");
    assert.ok(seen.has(escape.id), "Escape ending reachable");
    assert.ok(seen.has(trapped.id), "Trapped ending reachable");
  });
});
