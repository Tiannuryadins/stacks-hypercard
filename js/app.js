// STACKS — UI shell: hash router, library / player / editor views.
// The only module that touches the DOM, location.hash, localStorage, or
// the clipboard. All user text goes through textContent, never innerHTML.

import {
  createStack, createCard, createField, createButton,
  findCard, findCardByName, firstCard, validateStack,
  exportStack, importStack, SCENES, BUTTON_STYLES,
  CARD_WIDTH, CARD_HEIGHT,
} from "./model.js";
import { parseScript, runScript } from "./script.js";
import { loadStacks, saveStack, deleteStack, createMemoryStorage } from "./store.js";
import { playSound } from "./audio.js";
import { getDemoStack, DEMO_STACK_ID } from "./demo-stack.js";

const SCENE_GLYPHS = {
  plain: "", foyer: "🕯️", library: "📚", attic: "🦇", cellar: "🗝️",
  garden: "🌙", mirror: "🪞", kitchen: "🍲", tower: "🗼", dawn: "🌅", dark: "🌑",
};
const MAX_NAV_CHAIN = 10;

// ------------------------------------------------------------ helpers

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const child of children) node.append(child);
  return node;
}

const view = document.getElementById("view");
const toastEl = document.getElementById("toast");
let toastTimer = null;

function toast(message) {
  toastEl.textContent = message;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.hidden = true; }, 3500);
}

const dialogOverlay = document.getElementById("dialog-overlay");
const dialogText = document.getElementById("dialog-text");
const dialogOk = document.getElementById("dialog-ok");

/** Show a modal message (the `answer` statement). Resolves on OK. */
function showDialog(text) {
  return new Promise((resolve) => {
    dialogText.textContent = text;
    dialogOverlay.hidden = false;
    dialogOk.focus();
    const close = () => {
      dialogOverlay.hidden = true;
      dialogOk.removeEventListener("click", close);
      resolve();
    };
    dialogOk.addEventListener("click", close);
  });
}

function download(filename, text) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = el("a", { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function toBase64Url(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64Url(b64) {
  const padded = b64.replaceAll("-", "+").replaceAll("/", "_");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

// ------------------------------------------------------------ storage

let storage;
let storageWarning = false;
try {
  const probe = "__stacks_probe__";
  localStorage.setItem(probe, "1");
  localStorage.removeItem(probe);
  storage = localStorage;
} catch {
  storage = createMemoryStorage();
  storageWarning = true;
}

let userStacks = [];
let skippedCount = 0;

function reloadStacks() {
  const result = loadStacks(storage);
  userStacks = result.stacks;
  skippedCount = result.skipped;
}

const demoStack = getDemoStack();

function getStackById(id) {
  if (id === DEMO_STACK_ID) return demoStack;
  return userStacks.find((s) => s.id === id) || null;
}

function cloneStack(stack) {
  return JSON.parse(JSON.stringify(stack));
}

// -------------------------------------------------------- player state

let session = null; // { stackId, vars, shown, hidden, text, busy, pendingNav }
let errorBanner = null;

function ensureSession(stackId) {
  if (!session || session.stackId !== stackId) {
    session = {
      stackId,
      vars: new Map(),
      shown: new Set(),
      hidden: new Set(),
      text: new Map(),
      busy: false,
      pendingNav: null,
    };
  }
  return session;
}

function showError(message) {
  if (errorBanner) {
    errorBanner.textContent = `Script error: ${message}`;
    errorBanner.hidden = false;
  }
}

function clearError() {
  if (errorBanner) errorBanner.hidden = true;
}

// Element nodes of the currently rendered card, for in-place updates.
let renderedElements = new Map();

function applyVisibility(card, nodeMap) {
  for (const field of card.fields) {
    const node = nodeMap.get(field.id);
    if (!node) continue;
    const visible = session.hidden.has(field.id)
      ? false
      : session.shown.has(field.id) || !field.hidden;
    node.style.display = visible ? "" : "none";
  }
  for (const button of card.buttons) {
    const node = nodeMap.get(button.id);
    if (!node) continue;
    const visible = session.hidden.has(button.id)
      ? false
      : session.shown.has(button.id) || !button.hidden;
    node.style.display = visible ? "" : "none";
  }
}

function applyFieldText(card, nodeMap) {
  for (const field of card.fields) {
    const node = nodeMap.get(field.id);
    if (!node) continue;
    node.textContent = session.text.has(field.id) ? session.text.get(field.id) : field.text;
  }
}

function createRuntime(stack, card) {
  return {
    goToCard(ref) {
      let target = null;
      const idx = stack.cards.findIndex((c) => c.id === card.id);
      if (ref.type === "name") target = findCardByName(stack, ref.value);
      else if (ref.type === "index") target = stack.cards[ref.value - 1] || null;
      else if (ref.type === "next") target = stack.cards[(idx + 1) % stack.cards.length];
      else if (ref.type === "previous") target = stack.cards[(idx - 1 + stack.cards.length) % stack.cards.length];
      else if (ref.type === "first") target = stack.cards[0];
      else if (ref.type === "last") target = stack.cards[stack.cards.length - 1];
      if (!target) {
        const label = ref.type === "name" ? `"${ref.value}"` : ref.type === "index" ? `number ${ref.value}` : ref.type;
        throw new Error(`no such card: ${label}`);
      }
      session.pendingNav = target.id;
    },
    showElement(kind, name) {
      const list = kind === "field" ? card.fields : card.buttons;
      const target = list.find((e) => e.name === name);
      if (!target) throw new Error(`no ${kind} named "${name}" on this card`);
      session.hidden.delete(target.id);
      session.shown.add(target.id);
      applyVisibility(card, renderedElements);
    },
    hideElement(kind, name) {
      const list = kind === "field" ? card.fields : card.buttons;
      const target = list.find((e) => e.name === name);
      if (!target) throw new Error(`no ${kind} named "${name}" on this card`);
      session.shown.delete(target.id);
      session.hidden.add(target.id);
      applyVisibility(card, renderedElements);
    },
    putText(text, name, mode) {
      const field = card.fields.find((f) => f.name === name);
      if (!field) throw new Error(`no field named "${name}" on this card`);
      const current = session.text.has(field.id) ? session.text.get(field.id) : field.text;
      session.text.set(field.id, mode === "after" ? current + text : text);
      applyFieldText(card, renderedElements);
    },
    playSound(name) {
      return playSound(name);
    },
    wait(seconds) {
      return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
    },
    answer(text) {
      return showDialog(text);
    },
    getVar: (name) => session.vars.get(name),
    setVar: (name, value) => session.vars.set(name, value),
    onError: (err) => showError(err.message),
  };
}

async function runHandler(stack, card, source, event) {
  if (!source.trim()) return { ok: true, navigated: false };
  const runtime = createRuntime(stack, card);
  return runScript(source, runtime, event);
}

// Navigate (via hash) and run the target card's on show handler, following
// chained navigations up to MAX_NAV_CHAIN.
let navChain = 0;
async function followNavigation(stack, cardId) {
  if (navChain >= MAX_NAV_CHAIN) {
    showError("navigation loop detected (too many chained go-to-card steps)");
    return;
  }
  navChain += 1;
  location.hash = `#/play/${stack.id}/${cardId}`;
  // The hashchange handler re-renders; onShow runs from renderPlayer.
}

// ------------------------------------------------------- card renderer

function fitStage(wrap) {
  const scaler = wrap.querySelector(".stage-scaler");
  const stage = wrap.querySelector(".card-stage");
  if (!scaler || !stage) return;
  const available = wrap.clientWidth;
  const scale = Math.min(1, available / CARD_WIDTH);
  stage.style.transform = `scale(${scale})`;
  scaler.style.width = `${CARD_WIDTH * scale}px`;
  scaler.style.height = `${CARD_HEIGHT * scale}px`;
}

function renderCardStage(card, { mode, onButtonClick, onSelect, selectedId }) {
  renderedElements = new Map();
  const stage = el("div", {
    class: `card-stage scene-${card.background.scene}`,
    "data-glyph": SCENE_GLYPHS[card.background.scene] || "",
  });
  stage.append(el("div", { class: "card-name-tag", text: card.name }));

  for (const field of card.fields) {
    const node = el("div", { class: "card-field", text: field.text });
    node.style.left = `${field.x}px`;
    node.style.top = `${field.y}px`;
    node.style.width = `${field.w}px`;
    node.style.height = `${field.h}px`;
    node.style.fontSize = `${field.fontSize}px`;
    if (mode === "play") {
      node.style.display = field.hidden ? "none" : "";
    } else {
      node.style.display = "";
      if (field.hidden) node.style.opacity = "0.45";
      node.style.cursor = "pointer";
      node.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelect("field", field.id);
      });
    }
    if (selectedId === field.id) node.classList.add("selected");
    renderedElements.set(field.id, node);
    stage.append(node);
  }

  for (const button of card.buttons) {
    const node = el("button", {
      class: `card-button style-${button.style}`,
      text: button.label,
      type: "button",
    });
    node.style.left = `${button.x}px`;
    node.style.top = `${button.y}px`;
    node.style.width = `${button.w}px`;
    node.style.height = `${button.h}px`;
    if (mode === "play") {
      node.style.display = button.hidden ? "none" : "";
      node.addEventListener("click", () => onButtonClick(button));
    } else {
      node.style.display = "";
      if (button.hidden) node.style.opacity = "0.45";
      node.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelect("button", button.id);
      });
    }
    if (selectedId === button.id) node.classList.add("selected");
    renderedElements.set(button.id, node);
    stage.append(node);
  }

  const scaler = el("div", { class: "stage-scaler" }, [stage]);
  const wrap = el("div", { class: "stage-wrap" }, [scaler]);
  requestAnimationFrame(() => fitStage(wrap));
  return wrap;
}

// ------------------------------------------------------------ library

function stackCardElement(stack, { isDemo }) {
  const card = el("section", { class: "stack-card" });
  const title = el("h2", { text: stack.name });
  if (isDemo) title.append(el("span", { class: "badge", text: "Built-in demo" }));
  card.append(title);
  card.append(el("p", {
    class: "meta",
    text: `${stack.cards.length} cards${stack.author ? ` · by ${stack.author}` : ""}`,
  }));
  if (stack.description) card.append(el("p", { class: "desc", text: stack.description }));
  const actions = el("div", { class: "actions" });
  actions.append(el("a", { class: "btn btn-primary", href: `#/play/${stack.id}/${stack.firstCardId}`, text: "▶ Play" }));
  actions.append(el("a", { class: "btn", href: `#/edit/${stack.id}/${stack.firstCardId}`, text: isDemo ? "Remix" : "Edit" }));
  actions.append(el("button", {
    class: "btn",
    text: "Export",
    type: "button",
    onclick: () => {
      try {
        download(`${stack.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.stack.json`, exportStack(stack, parseScript));
        toast("Stack exported as JSON.");
      } catch (err) {
        toast(`Export failed: ${err.message}`);
      }
    },
  }));
  actions.append(el("button", {
    class: "btn",
    text: "Share link",
    type: "button",
    onclick: async () => {
      try {
        const url = `${location.origin}${location.pathname}#/s/${toBase64Url(exportStack(stack, parseScript))}`;
        await navigator.clipboard.writeText(url);
        toast("Share link copied to clipboard.");
      } catch {
        toast("Could not copy the link — clipboard unavailable.");
      }
    },
  }));
  if (!isDemo) {
    actions.append(el("button", {
      class: "btn btn-danger",
      text: "Delete",
      type: "button",
      onclick: () => {
        if (window.confirm(`Delete "${stack.name}"? This cannot be undone.`)) {
          deleteStack(storage, stack.id);
          reloadStacks();
          renderLibrary();
          toast("Stack deleted.");
        }
      },
    }));
  }
  card.append(actions);
  return card;
}

function renderLibrary() {
  reloadStacks();
  view.replaceChildren();
  const intro = el("div", { class: "library-intro" });
  intro.append(el("h1", { text: "Your library" }));
  intro.append(el("p", {
    text: "STACKS resurrects HyperCard: build stacks of interactive cards with an English-like scripting language. Everything runs in your browser — no account, no server. Start by playing the demo, then remix it or build your own.",
  }));
  if (storageWarning) {
    intro.append(el("p", { text: "⚠️ Browser storage is unavailable in this session — stacks will only live in memory until you close the tab. Export JSON to keep them." }));
  }
  if (skippedCount > 0) {
    intro.append(el("p", { text: `⚠️ ${skippedCount} saved stack(s) failed validation and were skipped.` }));
  }
  view.append(intro);

  const actions = el("div", { class: "library-actions" });
  const nameInput = el("input", { type: "text", placeholder: "Name your new stack…", "aria-label": "New stack name" });
  nameInput.style.maxWidth = "280px";
  const createBtn = el("button", {
    class: "btn btn-primary",
    text: "+ New stack",
    type: "button",
    onclick: () => {
      const name = nameInput.value.trim() || "Untitled Stack";
      const stack = createStack(name, "");
      saveStack(storage, stack);
      reloadStacks();
      location.hash = `#/edit/${stack.id}/${stack.firstCardId}`;
    },
  });
  const importInput = el("input", { type: "file", accept: ".json,application/json", hidden: "hidden" });
  importInput.addEventListener("change", async () => {
    const file = importInput.files[0];
    if (!file) return;
    try {
      const stack = importStack(await file.text(), parseScript);
      saveStack(storage, stack);
      reloadStacks();
      renderLibrary();
      toast(`Imported "${stack.name}".`);
    } catch (err) {
      toast(`Import failed: ${err.message}`);
    }
    importInput.value = "";
  });
  const importBtn = el("button", {
    class: "btn",
    text: "Import JSON…",
    type: "button",
    onclick: () => importInput.click(),
  });
  actions.append(nameInput, createBtn, importBtn, importInput);
  view.append(actions);

  const grid = el("div", { class: "stack-grid" });
  grid.append(stackCardElement(demoStack, { isDemo: true }));
  for (const stack of userStacks) grid.append(stackCardElement(stack, { isDemo: false }));
  view.append(grid);
  if (userStacks.length === 0) {
    view.append(el("p", { class: "empty-note", text: "No saved stacks yet — create one above, or remix the demo." }));
  }
}

// ------------------------------------------------------------- player

async function renderPlayer(stack, cardId, { runShow = true } = {}) {
  ensureSession(stack.id);
  const card = findCard(stack, cardId) || firstCard(stack);
  if (!card) {
    view.replaceChildren(el("p", { text: "This stack has no cards." }));
    return;
  }
  navChain = 0;
  clearError();
  view.replaceChildren();

  const bar = el("div", { class: "player-bar" });
  const heading = el("div");
  heading.append(el("h1", { text: stack.name }));
  heading.append(el("div", {
    class: "crumbs",
    text: `Card ${stack.cards.findIndex((c) => c.id === card.id) + 1} of ${stack.cards.length} · ${card.name}`,
  }));
  bar.append(heading);
  const barActions = el("div", { style: "display:flex;gap:0.5rem;flex-wrap:wrap;" });
  barActions.append(el("button", {
    class: "btn",
    text: "↺ Restart",
    type: "button",
    onclick: () => {
      session = null;
      ensureSession(stack.id);
      location.hash = `#/play/${stack.id}/${stack.firstCardId}`;
    },
  }));
  barActions.append(el("a", { class: "btn", href: "#/library", text: "Library" }));
  bar.append(barActions);
  view.append(bar);

  errorBanner = el("div", { class: "error-banner", hidden: "hidden" });
  view.append(errorBanner);

  const onButtonClick = async (button) => {
    if (session.busy) return;
    session.busy = true;
    window.__stacksBusy = true;
    document.body.classList.add("script-busy");
    clearError();
    const res = await runHandler(stack, card, button.script, "mouseUp");
    session.busy = false;
    window.__stacksBusy = false;
    document.body.classList.remove("script-busy");
    if (res.navigated && session.pendingNav) {
      const target = session.pendingNav;
      session.pendingNav = null;
      await followNavigation(stack, target);
    }
  };

  view.append(renderCardStage(card, { mode: "play", onButtonClick }));
  applyVisibility(card, renderedElements);
  applyFieldText(card, renderedElements);

  if (runShow) {
    const res = await runHandler(stack, card, card.onShow, "show");
    if (res.navigated && session.pendingNav) {
      const target = session.pendingNav;
      session.pendingNav = null;
      await followNavigation(stack, target);
    }
  }
}

// ------------------------------------------------------------- editor

let editor = null; // { stack, cardId, selected: {kind,id}|null, dirty, isDemoCopy }

function setEditorDirty() {
  if (!editor) return;
  editor.dirty = true;
  const status = document.getElementById("save-status");
  if (status) status.textContent = "● Unsaved changes";
}

function openEditor(stackId, cardId) {
  const source = getStackById(stackId);
  if (!source) {
    view.replaceChildren(el("p", { text: "Stack not found." }));
    return;
  }
  const isDemo = source.id === DEMO_STACK_ID;
  const stack = cloneStack(source);
  if (isDemo) {
    // The demo is read-only: editing creates a personal copy.
    stack.id = `copy-${Date.now().toString(36)}`;
    stack.name = `${source.name} (my remix)`;
    stack.author = "";
  }
  const card = findCard(stack, cardId) || firstCard(stack);
  editor = { stack, cardId: card.id, selected: null, dirty: false, isDemoCopy: isDemo };
  renderEditor();
}

function renderEditor() {
  const { stack } = editor;
  const card = findCard(stack, editor.cardId) || firstCard(stack);
  editor.cardId = card.id;
  view.replaceChildren();

  const toolbar = el("div", { class: "editor-toolbar" });
  toolbar.append(el("h1", { text: `Editing: ${stack.name}`, style: "font-family:Georgia,serif;font-size:1.3rem;margin:0 1rem 0 0;" }));
  const saveBtn = el("button", {
    class: "btn btn-primary",
    text: editor.isDemoCopy ? "Save as my stack" : "Save stack",
    type: "button",
    onclick: () => {
      const errors = validateStack(editor.stack, parseScript);
      if (errors.length > 0) {
        toast(`Cannot save — ${errors.length} problem(s). First: ${errors[0]}`);
        return;
      }
      saveStack(storage, editor.stack);
      editor.isDemoCopy = false;
      editor.dirty = false;
      reloadStacks();
      const status = document.getElementById("save-status");
      if (status) status.textContent = "✓ Saved";
      toast("Stack saved.");
    },
  });
  toolbar.append(saveBtn);
  toolbar.append(el("a", { class: "btn", href: `#/play/${stack.id}/${card.id}`, text: "▶ Play this stack" }));
  toolbar.append(el("a", { class: "btn", href: "#/library", text: "Library" }));
  toolbar.append(el("span", { class: "save-status", id: "save-status", text: editor.dirty ? "● Unsaved changes" : editor.isDemoCopy ? "Remixing the demo — save to keep your copy" : "✓ Saved" }));
  view.append(toolbar);

  const grid = el("div", { class: "editor-grid" });

  // Left: card list.
  const listPanel = el("div", { class: "card-list" });
  listPanel.append(el("h3", { text: "Cards" }));
  const list = el("ul");
  for (const c of stack.cards) {
    const item = el("li");
    item.append(el("button", {
      class: c.id === card.id ? "active" : "",
      text: c.name,
      type: "button",
      onclick: () => {
        editor.cardId = c.id;
        editor.selected = null;
        renderEditor();
      },
    }));
    list.append(item);
  }
  listPanel.append(list);
  listPanel.append(el("button", {
    class: "btn",
    text: "+ Add card",
    type: "button",
    onclick: () => {
      const next = createCard(`Card ${stack.cards.length + 1}`);
      stack.cards.push(next);
      editor.cardId = next.id;
      editor.selected = null;
      setEditorDirty();
      renderEditor();
    },
  }));
  grid.append(listPanel);

  // Center: preview.
  const center = el("div");
  center.append(renderCardStage(card, {
    mode: "edit",
    selectedId: editor.selected?.id,
    onSelect: (kind, id) => {
      editor.selected = { kind, id };
      renderEditor();
    },
  }));
  const addRow = el("div", { class: "editor-toolbar", style: "margin-top:0.8rem;" });
  addRow.append(el("button", {
    class: "btn",
    text: "+ Add field",
    type: "button",
    onclick: () => {
      const field = createField(`Field ${card.fields.length + 1}`, { x: 40, y: 40 + card.fields.length * 30, w: 300, h: 60, text: "New text" });
      card.fields.push(field);
      editor.selected = { kind: "field", id: field.id };
      setEditorDirty();
      renderEditor();
    },
  }));
  addRow.append(el("button", {
    class: "btn",
    text: "+ Add button",
    type: "button",
    onclick: () => {
      const button = createButton(`Button ${card.buttons.length + 1}`, {
        x: 40, y: 380, w: 180, h: 44,
        script: "on mouseUp\n  go to next card\nend mouseUp",
      });
      card.buttons.push(button);
      editor.selected = { kind: "button", id: button.id };
      setEditorDirty();
      renderEditor();
    },
  }));
  center.append(addRow);
  grid.append(center);

  // Right: inspector.
  grid.append(renderInspector(stack, card));
  view.append(grid);
}

function scriptCheckRow(initialScript, onApply) {
  const area = el("textarea", { rows: "8", spellcheck: "false" });
  area.value = initialScript;
  const status = el("div", { class: "script-status" });
  const check = () => {
    try {
      parseScript(area.value);
      status.textContent = area.value.trim() ? "✓ Script is valid." : "Empty script — nothing will run.";
      status.className = "script-status ok";
    } catch (err) {
      status.textContent = `✗ ${err.message}`;
      status.className = "script-status err";
    }
  };
  area.addEventListener("input", () => {
    onApply(area.value);
    setEditorDirty();
    check();
  });
  check();
  const wrap = el("div");
  wrap.append(el("label", { text: "Script (HyperTalk-lite)" }), area, status);
  return wrap;
}

function renderInspector(stack, card) {
  const panel = el("div", { class: "inspector" });
  const sel = editor.selected;

  if (!sel) {
    panel.append(el("h3", { text: "Card" }));
    const nameInput = el("input", { type: "text" });
    nameInput.value = card.name;
    nameInput.addEventListener("input", () => {
      card.name = nameInput.value;
      setEditorDirty();
    });
    panel.append(el("label", { text: "Name" }), nameInput);

    const sceneSelect = el("select");
    for (const scene of SCENES) {
      sceneSelect.append(el("option", { value: scene, text: `${SCENE_GLYPHS[scene] ? `${SCENE_GLYPHS[scene]} ` : ""}${scene}` }));
    }
    sceneSelect.value = card.background.scene;
    sceneSelect.addEventListener("change", () => {
      card.background.scene = sceneSelect.value;
      setEditorDirty();
      renderEditor();
    });
    panel.append(el("label", { text: "Scene" }), sceneSelect);
    panel.append(scriptCheckRow(card.onShow, (v) => { card.onShow = v; }));
    if (stack.cards.length > 1) {
      panel.append(el("button", {
        class: "btn btn-danger",
        text: "Delete this card",
        type: "button",
        onclick: () => {
          if (!window.confirm(`Delete card "${card.name}"?`)) return;
          stack.cards = stack.cards.filter((c) => c.id !== card.id);
          if (stack.firstCardId === card.id) stack.firstCardId = stack.cards[0].id;
          editor.cardId = stack.cards[0].id;
          setEditorDirty();
          renderEditor();
        },
      }));
    }
    panel.append(el("p", { class: "empty-note", text: "Tip: click a field or button on the card to inspect it." }));
    return panel;
  }

  const list = sel.kind === "field" ? card.fields : card.buttons;
  const target = list.find((e) => e.id === sel.id);
  if (!target) {
    editor.selected = null;
    return renderInspector(stack, card);
  }

  panel.append(el("h3", { text: sel.kind === "field" ? "Field" : "Button" }));
  const nameInput = el("input", { type: "text" });
  nameInput.value = target.name;
  nameInput.addEventListener("input", () => {
    target.name = nameInput.value;
    setEditorDirty();
  });
  panel.append(el("label", { text: "Name (used by scripts)" }), nameInput);

  const numberInput = (value, onChange) => {
    const input = el("input", { type: "number" });
    input.value = String(value);
    input.addEventListener("input", () => {
      onChange(Number(input.value));
      setEditorDirty();
    });
    return input;
  };
  const posRow = el("div", { class: "form-row" });
  const posWrap = (labelText, input) => {
    const wrap = el("div");
    wrap.append(el("label", { text: labelText }), input);
    return wrap;
  };
  posRow.append(
    posWrap("X", numberInput(target.x, (v) => { target.x = v; })),
    posWrap("Y", numberInput(target.y, (v) => { target.y = v; })),
  );
  const sizeRow = el("div", { class: "form-row" });
  sizeRow.append(
    posWrap("Width", numberInput(target.w, (v) => { target.w = v; })),
    posWrap("Height", numberInput(target.h, (v) => { target.h = v; })),
  );
  panel.append(posRow, sizeRow);

  if (sel.kind === "field") {
    const textArea = el("textarea", { rows: "4" });
    textArea.value = target.text;
    textArea.addEventListener("input", () => {
      target.text = textArea.value;
      setEditorDirty();
    });
    panel.append(el("label", { text: "Text" }), textArea);
    panel.append(el("label", { text: "Font size" }), numberInput(target.fontSize, (v) => { target.fontSize = v; }));
  } else {
    const labelInput = el("input", { type: "text" });
    labelInput.value = target.label;
    labelInput.addEventListener("input", () => {
      target.label = labelInput.value;
      setEditorDirty();
    });
    panel.append(el("label", { text: "Label" }), labelInput);
    const styleSelect = el("select");
    for (const style of BUTTON_STYLES) styleSelect.append(el("option", { value: style, text: style }));
    styleSelect.value = target.style;
    styleSelect.addEventListener("change", () => {
      target.style = styleSelect.value;
      setEditorDirty();
      renderEditor();
    });
    panel.append(el("label", { text: "Style" }), styleSelect);
    panel.append(scriptCheckRow(target.script, (v) => { target.script = v; }));
  }

  const hiddenLabel = el("label");
  const hiddenBox = el("input", { type: "checkbox" });
  hiddenBox.checked = target.hidden;
  hiddenBox.style.width = "auto";
  hiddenBox.addEventListener("change", () => {
    target.hidden = hiddenBox.checked;
    setEditorDirty();
    renderEditor();
  });
  hiddenLabel.append(hiddenBox, document.createTextNode(" Hidden by default (scripts can show it)"));
  panel.append(hiddenLabel);

  panel.append(el("button", {
    class: "btn btn-danger",
    text: `Delete this ${sel.kind}`,
    type: "button",
    onclick: () => {
      const arr = sel.kind === "field" ? card.fields : card.buttons;
      const i = arr.findIndex((e) => e.id === sel.id);
      if (i >= 0) arr.splice(i, 1);
      editor.selected = null;
      setEditorDirty();
      renderEditor();
    },
  }));
  return panel;
}

// -------------------------------------------------------- shared stacks

async function renderShared(b64) {
  view.replaceChildren();
  let stack;
  try {
    stack = importStack(fromBase64Url(b64), parseScript);
  } catch (err) {
    view.append(el("h1", { text: "This share link is broken" }));
    view.append(el("p", { text: err.message }));
    view.append(el("a", { class: "btn", href: "#/library", text: "Back to the library" }));
    return;
  }
  stack.id = `shared-${stack.id}`;
  await renderPlayer(stack, stack.firstCardId);
}

// -------------------------------------------------------------- router

let lastHash = location.hash || "#/library";
let suppressHash = false;

function route() {
  const hash = location.hash || "#/library";
  const parts = hash.slice(2).split("/").filter(Boolean); // drop "#/"
  const [section, a, b] = parts;

  if (section === "library" || !section) {
    editor = null;
    renderLibrary();
  } else if (section === "play") {
    editor = null;
    const stack = getStackById(a);
    if (!stack) {
      view.replaceChildren(el("p", { text: "Stack not found." }));
      return;
    }
    void renderPlayer(stack, b || stack.firstCardId);
  } else if (section === "edit") {
    // Stay in the editor if we are already editing this stack; otherwise open it.
    if (!editor || editor.stack.id !== a) {
      openEditor(a, b);
    } else if (b && b !== editor.cardId) {
      editor.cardId = b;
      editor.selected = null;
      renderEditor();
    }
  } else if (section === "s") {
    editor = null;
    void renderShared(a || "");
  } else {
    editor = null;
    renderLibrary();
  }
  lastHash = location.hash;
}

window.addEventListener("hashchange", () => {
  if (suppressHash) {
    suppressHash = false;
    return;
  }
  if (editor && editor.dirty) {
    const leaving = !location.hash.startsWith("#/edit/");
    if (leaving && !window.confirm("You have unsaved changes. Leave the editor and discard them?")) {
      suppressHash = true;
      location.hash = lastHash;
      return;
    }
    if (leaving) editor = null;
  }
  route();
});

window.addEventListener("resize", () => {
  document.querySelectorAll(".stage-wrap").forEach(fitStage);
});

document.getElementById("nav-new").addEventListener("click", () => {
  setTimeout(() => {
    const input = view.querySelector('input[aria-label="New stack name"]');
    if (input) input.focus();
  }, 50);
});

// Initial render.
route();
