import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { loadStacks, saveStack, deleteStack, createMemoryStorage, INDEX_KEY, stackKey } from "../js/store.js";
import { createStack } from "../js/model.js";

describe("store", () => {
  test("save then load round-trips a stack", () => {
    const storage = createMemoryStorage();
    const stack = createStack("Saved");
    saveStack(storage, stack);
    const { stacks, skipped } = loadStacks(storage);
    assert.equal(skipped, 0);
    assert.equal(stacks.length, 1);
    assert.deepEqual(stacks[0], stack);
  });

  test("saving twice updates instead of duplicating the index", () => {
    const storage = createMemoryStorage();
    const stack = createStack("Saved");
    saveStack(storage, stack);
    stack.name = "Renamed";
    saveStack(storage, stack);
    const { stacks } = loadStacks(storage);
    assert.equal(stacks.length, 1);
    assert.equal(stacks[0].name, "Renamed");
    assert.deepEqual(JSON.parse(storage.getItem(INDEX_KEY)), [stack.id]);
  });

  test("delete removes data and the index entry", () => {
    const storage = createMemoryStorage();
    const a = createStack("A");
    const b = createStack("B");
    saveStack(storage, a);
    saveStack(storage, b);
    deleteStack(storage, a.id);
    assert.equal(storage.getItem(stackKey(a.id)), null);
    const { stacks } = loadStacks(storage);
    assert.deepEqual(stacks.map((s) => s.id), [b.id]);
    deleteStack(storage, "unknown-id"); // no-op, must not throw
  });

  test("load skips invalid entries and counts them", () => {
    const storage = createMemoryStorage();
    const good = createStack("Good");
    saveStack(storage, good);
    const badId = "bad-id";
    storage.setItem(stackKey(badId), '{"version":99,"cards":[]}');
    storage.setItem(stackKey("broken-json"), "{not json");
    storage.setItem(INDEX_KEY, JSON.stringify([good.id, badId, "broken-json", "missing-id"]));
    const { stacks, skipped } = loadStacks(storage);
    assert.equal(stacks.length, 1);
    assert.equal(skipped, 3);
  });

  test("save refuses an invalid stack and leaves storage untouched", () => {
    const storage = createMemoryStorage();
    const bad = createStack("Bad");
    bad.firstCardId = "ghost";
    assert.throws(() => saveStack(storage, bad), /invalid stack/);
    assert.equal(storage.getItem(INDEX_KEY), null);
  });

  test("save refuses a stack with an invalid script", () => {
    const storage = createMemoryStorage();
    const stack = createStack("Bad Script");
    stack.cards[0].buttons.push({
      id: "b1", name: "B", x: 0, y: 0, w: 10, h: 10,
      label: "B", style: "rect", hidden: false, script: "on mouseUp\n  nope\nend mouseUp",
    });
    assert.throws(() => saveStack(storage, stack), /script error/);
  });
});
