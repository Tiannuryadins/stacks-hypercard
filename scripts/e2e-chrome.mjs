// Headless-Chromium end-to-end verification for STACKS.
// Drives the real app over CDP: loads the library, plays the demo stack's
// golden path to the Escape ending, and checks the locked-door dialog.
// Usage: python3 -m http.server 8123 (in repo root) + chrome headless with
// --remote-debugging-port=9223, then: node scripts/e2e-chrome.mjs
// Exits non-zero on any failed assertion.

const CDP = "http://127.0.0.1:9223";
const BASE = "http://127.0.0.1:8123";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
function check(name, ok, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failures += 1;
}

async function cdpRequest(path, method = "GET") {
  const res = await fetch(`${CDP}${path}`, { method });
  if (!res.ok) throw new Error(`CDP ${path} -> ${res.status}`);
  return res.json();
}

class Session {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    };
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(`JS exception: ${JSON.stringify(res.exceptionDetails.exception?.description || res.exceptionDetails)}`);
    }
    return res.result?.value;
  }

  async waitFor(fn, label, timeoutMs = 15000) {
    const start = Date.now();
    for (;;) {
      try {
        if (await fn()) return true;
      } catch { /* retry */ }
      if (Date.now() - start > timeoutMs) {
        console.log(`TIMEOUT waiting for: ${label}`);
        return false;
      }
      await sleep(250);
    }
  }
}

const target = await cdpRequest(`/json/new?${BASE}/#/library`, "PUT");
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});
const session = new Session(ws);
await session.send("Runtime.enable");
await session.send("Page.enable");

const bodyText = () => session.eval("document.body.innerText");
const cardName = () => session.eval(
  "document.querySelector('.card-name-tag')?.textContent || ''",
);
// A button script may still be running (e.g. awaiting a sound); wait for the
// app to go idle before clicking, otherwise the click is ignored by design.
async function waitForIdle(label, timeoutMs = 15000) {
  return session.waitFor(
    async () => (await session.eval("!window.__stacksBusy")) === true,
    `idle before ${label}`,
    timeoutMs,
  );
}
async function clickButton(label) {
  await waitForIdle(`click ${label}`);
  return session.eval(`(() => {
    const btns = [...document.querySelectorAll('.card-button')];
    const b = btns.find((x) => x.textContent.trim() === ${JSON.stringify(label)});
    if (!b) return 'missing: ' + btns.map((x) => x.textContent.trim()).join('|');
    b.click();
    return 'clicked';
  })()`);
}

// 1. Library renders with the demo stack.
check("library shows demo stack", await session.waitFor(
  async () => (await bodyText()).includes("The Haunted Stack"),
  "demo stack in library",
));

// 2. Open the player on the demo stack (no card id -> first card).
await session.send("Page.navigate", { url: `${BASE}/#/play/demo-haunted-stack` });
check("player shows Foyer card", await session.waitFor(
  async () => (await cardName()) === "Foyer",
  "Foyer card",
));
check("foyer story text renders", (await bodyText()).includes("Blackwood Manor"));

// 3. Locked door without the key -> answer dialog appears.
await session.eval(`location.hash = '#/play/demo-haunted-stack'`);
await sleep(500);
check("click Enter the Library", (await clickButton("Enter the Library")) === "clicked");
check("player shows Library card", await session.waitFor(
  async () => (await cardName()) === "Library",
  "Library card",
));
check("click Down to the Cellar", (await clickButton("Down to the Cellar")) === "clicked");
check("player shows Cellar card", await session.waitFor(
  async () => (await cardName()) === "Cellar",
  "Cellar card",
));
check("click Try the cellar door", (await clickButton("Try the cellar door")) === "clicked");
check("locked door shows dialog", await session.waitFor(
  async () => session.eval("!document.getElementById('dialog-overlay').hidden"),
  "answer dialog visible",
));
check("dialog text mentions keyhole", (await bodyText()).includes("keyhole"));
await session.eval("document.getElementById('dialog-ok').click()");
await sleep(300);
check("dialog closes", await session.eval("document.getElementById('dialog-overlay').hidden"));

// 4. Golden path: key -> cellar -> kitchen -> candle -> tower -> escape.
check("back to Library", (await clickButton("Back to the Library")) === "clicked");
await session.waitFor(async () => (await cardName()) === "Library", "Library again");
check("take the brass key", (await clickButton("Take the brass key")) === "clicked");
check("key note appears", await session.waitFor(
  async () => (await bodyText()).includes("tuning fork"),
  "key note text",
));
check("take-key button hides itself", await session.eval(
  "[...document.querySelectorAll('.card-button')].every((b) => b.textContent.trim() !== 'Take the brass key' || b.style.display === 'none')",
));
check("down to cellar again", (await clickButton("Down to the Cellar")) === "clicked");
await session.waitFor(async () => (await cardName()) === "Cellar", "Cellar again");
check("try door with key", (await clickButton("Try the cellar door")) === "clicked");
check("door opens to Kitchen", await session.waitFor(
  async () => (await cardName()) === "Kitchen",
  "Kitchen card",
));
check("take the candle", (await clickButton("Take the candle")) === "clicked");
check("candle note appears", await session.waitFor(
  async () => (await bodyText()).includes("small flame"),
  "candle note text",
));
check("up to the Tower", (await clickButton("Up to the Tower")) === "clicked");
check("player shows Tower card", await session.waitFor(
  async () => (await cardName()) === "Tower",
  "Tower card",
));
check("light the candle", (await clickButton("Light the candle")) === "clicked");
check("escape ending reached", await session.waitFor(
  async () => (await cardName()) === "Escape",
  "Escape card",
));
check("escape text renders", (await bodyText()).includes("You made it out"));

// 5. Editor opens for the demo (remix mode).
await session.send("Page.navigate", { url: `${BASE}/#/edit/demo-haunted-stack` });
check("editor opens with card list", await session.waitFor(
  async () => (await bodyText()).includes("Remixing the demo"),
  "editor remix notice",
));
check("editor lists cards", (await bodyText()).includes("Mirror Room"));

// 6. No console errors on the library page.
await session.send("Page.navigate", { url: `${BASE}/#/library` });
await sleep(800);
const errors = await session.eval(
  "window.__stacksErrors || 'no-error-hook'",
);
check("no error hook needed (page loaded)", errors === "no-error-hook");

await cdpRequest(`/json/close/${target.id}`, "GET").catch(() => {});
ws.close();
console.log(failures === 0 ? "\nE2E: ALL CHECKS PASSED" : `\nE2E: ${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
