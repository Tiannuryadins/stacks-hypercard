// STACKS — local-first storage adapter.
// Wraps any localStorage-like object ({ getItem, setItem, removeItem }) so
// tests can inject a fake. Every write is validated first; an invalid stack
// is never persisted. Every load skips (and counts) invalid entries instead
// of crashing.

import { validateStack } from "./model.js";
import { parseScript } from "./script.js";

export const INDEX_KEY = "stacks:v1:index";

export function stackKey(id) {
  return `stacks:v1:${id}`;
}

function checkScript(source) {
  parseScript(source);
}

function readIndex(storage) {
  try {
    const raw = storage.getItem(INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function writeIndex(storage, ids) {
  storage.setItem(INDEX_KEY, JSON.stringify(ids));
}

/** Load all saved stacks. Returns { stacks, skipped }. */
export function loadStacks(storage) {
  const stacks = [];
  let skipped = 0;
  for (const id of readIndex(storage)) {
    try {
      const raw = storage.getItem(stackKey(id));
      if (!raw) {
        skipped += 1;
        continue;
      }
      const stack = JSON.parse(raw);
      const errors = validateStack(stack, checkScript);
      if (errors.length > 0) {
        skipped += 1;
        continue;
      }
      stacks.push(stack);
    } catch {
      skipped += 1;
    }
  }
  return { stacks, skipped };
}

/** Save a stack (insert or update). Throws if the stack is invalid. */
export function saveStack(storage, stack) {
  const errors = validateStack(stack, checkScript);
  if (errors.length > 0) {
    throw new Error(`cannot save invalid stack:\n- ${errors.join("\n- ")}`);
  }
  const ids = readIndex(storage);
  if (!ids.includes(stack.id)) {
    ids.push(stack.id);
    writeIndex(storage, ids);
  }
  storage.setItem(stackKey(stack.id), JSON.stringify(stack));
  return stack;
}

/** Delete a stack and its index entry. No-op when the id is unknown. */
export function deleteStack(storage, stackId) {
  storage.removeItem(stackKey(stackId));
  writeIndex(
    storage,
    readIndex(storage).filter((id) => id !== stackId),
  );
}

/** In-memory storage object with the localStorage interface (fallback when
 *  real localStorage is unavailable, and handy for tests). */
export function createMemoryStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  };
}
