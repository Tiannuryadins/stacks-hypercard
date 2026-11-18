// STACKS — data model (pure module: no DOM, no network, Node-safe).
// A stack is a document: a named collection of cards. Cards hold fields
// (text) and buttons (clickable, scripted). See
// .kiro/specs/hypercard-core/design.md for the schema.

export const STACK_VERSION = 1;
export const CARD_WIDTH = 720;
export const CARD_HEIGHT = 480;
export const SCENES = [
  "plain", "foyer", "library", "attic", "cellar",
  "garden", "mirror", "kitchen", "tower", "dawn", "dark",
];
export const BUTTON_STYLES = ["rect", "round", "ghost"];

let fallbackCounter = 0;

/** Generate a unique string id. Prefers crypto.randomUUID, falls back to a
 *  counter + timestamp + random suffix when crypto is unavailable. */
export function createId() {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  fallbackCounter += 1;
  return `id-${Date.now().toString(36)}-${fallbackCounter}-${Math.floor(
    Math.random() * 0xffff,
  ).toString(16)}`;
}

export function createStack(name, author = "") {
  const first = createCard("First Card");
  return {
    version: STACK_VERSION,
    id: createId(),
    name: name || "Untitled Stack",
    author,
    description: "",
    createdAt: new Date().toISOString(),
    cards: [first],
    firstCardId: first.id,
  };
}

export function createCard(name, scene = "plain") {
  return {
    id: createId(),
    name: name || "Untitled Card",
    background: { scene: SCENES.includes(scene) ? scene : "plain" },
    fields: [],
    buttons: [],
    onShow: "",
  };
}

export function createField(name, { x = 24, y = 24, w = 300, h = 80, text = "", fontSize = 18 } = {}) {
  return { id: createId(), name, x, y, w, h, text, fontSize, hidden: false };
}

export function createButton(name, { x = 24, y = 24, w = 160, h = 44, label = null, style = "rect", script = "" } = {}) {
  return {
    id: createId(),
    name,
    x, y, w, h,
    label: label ?? name,
    style: BUTTON_STYLES.includes(style) ? style : "rect",
    script,
    hidden: false,
  };
}

export function findCard(stack, cardId) {
  if (!stack || !Array.isArray(stack.cards)) return null;
  return stack.cards.find((c) => c.id === cardId) || null;
}

export function findCardByName(stack, name) {
  if (!stack || !Array.isArray(stack.cards)) return null;
  return stack.cards.find((c) => c.name === name) || null;
}

export function firstCard(stack) {
  return findCard(stack, stack.firstCardId) || stack.cards[0] || null;
}

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function isFiniteNumber(v) {
  return typeof v === "number" && Number.isFinite(v);
}

/**
 * Validate a stack document. Returns an array of human-readable error
 * strings; an empty array means the stack is valid. Never throws on
 * malformed input — every problem is reported as an error string.
 *
 * @param {unknown} stack - the value to validate
 * @param {(source: string) => void} [checkScript] - optional script parser
 *   used to validate script strings; it must throw on invalid scripts.
 */
export function validateStack(stack, checkScript) {
  const errors = [];
  if (!isPlainObject(stack)) return ["stack must be an object"];
  if (stack.version !== STACK_VERSION) {
    errors.push(`unsupported stack version: ${JSON.stringify(stack.version)} (expected ${STACK_VERSION})`);
  }
  if (typeof stack.id !== "string" || !stack.id) errors.push("stack.id must be a non-empty string");
  if (typeof stack.name !== "string" || !stack.name) errors.push("stack.name must be a non-empty string");
  if (!Array.isArray(stack.cards) || stack.cards.length === 0) {
    errors.push("stack.cards must be a non-empty array");
    return errors;
  }

  const cardIds = new Set();
  const cardNames = new Set();
  for (let i = 0; i < stack.cards.length; i++) {
    const card = stack.cards[i];
    const where = `cards[${i}]`;
    if (!isPlainObject(card)) {
      errors.push(`${where} must be an object`);
      continue;
    }
    if (typeof card.id !== "string" || !card.id) {
      errors.push(`${where}.id must be a non-empty string`);
    } else if (cardIds.has(card.id)) {
      errors.push(`${where}.id duplicates an earlier card id: ${card.id}`);
    } else {
      cardIds.add(card.id);
    }
    if (typeof card.name !== "string" || !card.name) {
      errors.push(`${where}.name must be a non-empty string`);
    } else if (cardNames.has(card.name)) {
      errors.push(`duplicate card name: "${card.name}"`);
    } else {
      cardNames.add(card.name);
    }
    if (!isPlainObject(card.background) || !SCENES.includes(card.background.scene)) {
      errors.push(`${where}.background.scene must be one of: ${SCENES.join(", ")}`);
    }
    if (typeof card.onShow !== "string") errors.push(`${where}.onShow must be a string`);
    if (!Array.isArray(card.fields)) {
      errors.push(`${where}.fields must be an array`);
    } else {
      errors.push(...validateElements(card.fields, `${where}.fields`, "field", checkScript));
    }
    if (!Array.isArray(card.buttons)) {
      errors.push(`${where}.buttons must be an array`);
    } else {
      errors.push(...validateElements(card.buttons, `${where}.buttons`, "button", checkScript));
    }
    if (typeof card.onShow === "string" && card.onShow.trim() && checkScript) {
      try {
        checkScript(card.onShow);
      } catch (err) {
        errors.push(`${where}.onShow script error: ${err.message}`);
      }
    }
  }

  if (typeof stack.firstCardId !== "string" || !cardIds.has(stack.firstCardId)) {
    errors.push(`stack.firstCardId does not reference an existing card: ${JSON.stringify(stack.firstCardId)}`);
  }
  return errors;
}

function validateElements(elements, where, kind, checkScript) {
  const errors = [];
  const ids = new Set();
  const names = new Set();
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    const at = `${where}[${i}]`;
    if (!isPlainObject(el)) {
      errors.push(`${at} must be an object`);
      continue;
    }
    if (typeof el.id !== "string" || !el.id) {
      errors.push(`${at}.id must be a non-empty string`);
    } else if (ids.has(el.id)) {
      errors.push(`${at}.id duplicates an earlier ${kind} id: ${el.id}`);
    } else {
      ids.add(el.id);
    }
    if (typeof el.name !== "string" || !el.name) {
      errors.push(`${at}.name must be a non-empty string`);
    } else if (names.has(el.name)) {
      errors.push(`duplicate ${kind} name on the same card: "${el.name}"`);
    } else {
      names.add(el.name);
    }
    for (const prop of ["x", "y", "w", "h"]) {
      if (!isFiniteNumber(el[prop])) errors.push(`${at}.${prop} must be a finite number`);
    }
    if (typeof el.hidden !== "boolean") errors.push(`${at}.hidden must be a boolean`);
    if (kind === "field") {
      if (typeof el.text !== "string") errors.push(`${at}.text must be a string`);
      if (!isFiniteNumber(el.fontSize) || el.fontSize <= 0) errors.push(`${at}.fontSize must be a positive number`);
    } else {
      if (typeof el.label !== "string") errors.push(`${at}.label must be a string`);
      if (!BUTTON_STYLES.includes(el.style)) errors.push(`${at}.style must be one of: ${BUTTON_STYLES.join(", ")}`);
      if (typeof el.script !== "string") {
        errors.push(`${at}.script must be a string`);
      } else if (el.script.trim() && checkScript) {
        try {
          checkScript(el.script);
        } catch (err) {
          errors.push(`${at}.script error: ${err.message}`);
        }
      }
    }
  }
  return errors;
}

/** Serialize a stack to a JSON string. Throws if the stack is invalid. */
export function exportStack(stack, checkScript) {
  const errors = validateStack(stack, checkScript);
  if (errors.length > 0) {
    throw new Error(`cannot export invalid stack:\n- ${errors.join("\n- ")}`);
  }
  return JSON.stringify(stack, null, 2);
}

/**
 * Parse and validate a JSON string into a stack. Throws on malformed JSON
 * or on a stack that fails validation.
 */
export function importStack(jsonText, checkScript) {
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    throw new Error(`invalid JSON: ${err.message}`);
  }
  const errors = validateStack(parsed, checkScript);
  if (errors.length > 0) {
    throw new Error(`invalid stack:\n- ${errors.join("\n- ")}`);
  }
  return parsed;
}
