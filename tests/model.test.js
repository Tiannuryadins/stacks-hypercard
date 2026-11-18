import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  createStack, createCard, createField, createButton,
  findCard, findCardByName, firstCard, validateStack,
  exportStack, importStack,
} from "../js/model.js";
import { parseScript } from "../js/script.js";

const checkScript = (source) => parseScript(source);

function validStack() {
  const stack = createStack("Test Stack", "Tester");
  stack.cards[0].name = "Home";
  stack.cards[0].fields.push(
    createField("Intro", { x: 10, y: 10, w: 200, h: 60, text: "Hello" }),
  );
  stack.cards[0].buttons.push(
    createButton("Next", { x: 10, y: 100, script: 'on mouseUp\n  go to next card\nend mouseUp' }),
  );
  return stack;
}

describe("factories", () => {
  test("createStack builds a stack with one first card", () => {
    const s = createStack("My Stack", "Ada");
    assert.equal(s.version, 1);
    assert.equal(s.name, "My Stack");
    assert.equal(s.author, "Ada");
    assert.equal(s.cards.length, 1);
    assert.equal(s.firstCardId, s.cards[0].id);
    assert.equal(typeof s.id, "string");
    assert.ok(s.id.length > 0);
  });

  test("createId produces unique ids", () => {
    const ids = new Set(Array.from({ length: 200 }, () => createStack("x").id));
    assert.equal(ids.size, 200);
  });

  test("createCard rejects unknown scenes", () => {
    assert.equal(createCard("C", "nope").background.scene, "plain");
    assert.equal(createCard("C", "library").background.scene, "library");
  });

  test("createButton rejects unknown styles and defaults label to name", () => {
    const b = createButton("Go", { style: "nope" });
    assert.equal(b.style, "rect");
    assert.equal(b.label, "Go");
  });
});

describe("finders", () => {
  test("findCard / findCardByName / firstCard", () => {
    const s = validStack();
    const second = createCard("Second");
    s.cards.push(second);
    assert.equal(findCard(s, second.id), second);
    assert.equal(findCard(s, "missing"), null);
    assert.equal(findCardByName(s, "Second"), second);
    assert.equal(findCardByName(s, "Nope"), null);
    assert.equal(firstCard(s).name, "Home");
  });
});

describe("validateStack", () => {
  test("accepts a well-formed stack", () => {
    assert.deepEqual(validateStack(validStack(), checkScript), []);
  });

  test("rejects non-objects", () => {
    assert.ok(validateStack(null).length > 0);
    assert.ok(validateStack("nope").length > 0);
    assert.ok(validateStack([]).length > 0);
  });

  test("rejects wrong version and empty name", () => {
    const s = validStack();
    s.version = 99;
    assert.ok(validateStack(s).some((e) => e.includes("version")));
    const s2 = validStack();
    s2.name = "";
    assert.ok(validateStack(s2).some((e) => e.includes("stack.name")));
  });

  test("rejects empty card list and dangling firstCardId", () => {
    const s = validStack();
    s.cards = [];
    assert.ok(validateStack(s).some((e) => e.includes("cards")));
    const s2 = validStack();
    s2.firstCardId = "ghost";
    assert.ok(validateStack(s2).some((e) => e.includes("firstCardId")));
  });

  test("rejects duplicate card names and ids", () => {
    const s = validStack();
    s.cards.push(createCard("Home"));
    assert.ok(validateStack(s).some((e) => e.includes("duplicate card name")));
    const s2 = validStack();
    const dupe = createCard("Other");
    dupe.id = s2.cards[0].id;
    s2.cards.push(dupe);
    assert.ok(validateStack(s2).some((e) => e.includes("duplicates")));
  });

  test("rejects bad scenes, non-string scripts, and invalid element geometry", () => {
    const s = validStack();
    s.cards[0].background.scene = "mars";
    assert.ok(validateStack(s).some((e) => e.includes("scene")));
    const s2 = validStack();
    s2.cards[0].fields[0].x = Number.NaN;
    assert.ok(validateStack(s2).some((e) => e.includes(".x")));
    const s3 = validStack();
    s3.cards[0].buttons[0].script = 42;
    assert.ok(validateStack(s3).some((e) => e.includes(".script")));
  });

  test("rejects duplicate field names on the same card", () => {
    const s = validStack();
    s.cards[0].fields.push(createField("Intro", { x: 0, y: 0, w: 10, h: 10 }));
    assert.ok(validateStack(s).some((e) => e.includes("duplicate field name")));
  });

  test("validates scripts when a checker is provided", () => {
    const s = validStack();
    s.cards[0].buttons[0].script = "on mouseUp\n  frobnicate\nend mouseUp";
    const errors = validateStack(s, checkScript);
    assert.ok(errors.some((e) => e.includes("script error")));
    // Without a checker, the same stack passes (scripts are opaque strings).
    assert.deepEqual(validateStack(s), []);
  });
});

describe("export/import round-trip", () => {
  test("export then import yields an equal, valid stack", () => {
    const s = validStack();
    const json = exportStack(s, checkScript);
    const back = importStack(json, checkScript);
    assert.deepEqual(back, s);
  });

  test("export refuses an invalid stack", () => {
    const s = validStack();
    s.firstCardId = "ghost";
    assert.throws(() => exportStack(s), /invalid stack/);
  });

  test("import refuses malformed JSON and invalid stacks", () => {
    assert.throws(() => importStack("not json"), /invalid JSON/);
    assert.throws(() => importStack('{"version":1}'), /invalid stack/);
  });
});
