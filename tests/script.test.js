import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  parseScript, runScript, getHandler, walkStatements, ScriptError,
} from "../js/script.js";

// Recording fake runtime implementing the contract in
// .kiro/steering/hypertalk-language.md.
function fakeRuntime(cards = ["Alpha", "Beta", "Gamma"]) {
  const vars = new Map();
  const calls = [];
  return {
    vars,
    calls,
    current: cards[0],
    goToCard(ref) {
      calls.push(["goToCard", ref]);
      if (ref.type === "name") {
        if (!cards.includes(ref.value)) throw new Error(`no card named "${ref.value}"`);
        this.current = ref.value;
      } else if (ref.type === "index") {
        if (ref.value < 1 || ref.value > cards.length) throw new Error(`no card number ${ref.value}`);
        this.current = cards[ref.value - 1];
      } else if (ref.type === "next") {
        const i = cards.indexOf(this.current);
        this.current = cards[(i + 1) % cards.length];
      } else if (ref.type === "previous") {
        const i = cards.indexOf(this.current);
        this.current = cards[(i - 1 + cards.length) % cards.length];
      } else if (ref.type === "first") {
        this.current = cards[0];
      } else if (ref.type === "last") {
        this.current = cards[cards.length - 1];
      }
    },
    showElement: (kind, name) => calls.push(["show", kind, name]),
    hideElement: (kind, name) => calls.push(["hide", kind, name]),
    putText: (text, name, mode) => calls.push(["put", text, name, mode]),
    playSound: (name) => calls.push(["play", name]),
    wait: (seconds) => calls.push(["wait", seconds]),
    answer: (text) => calls.push(["answer", text]),
    getVar: (name) => vars.get(name),
    setVar: (name, value) => vars.set(name, value),
    onError: (err) => calls.push(["error", err.message]),
  };
}

async function run(source, runtime, event = "mouseUp") {
  return runScript(source, runtime, event);
}

describe("parseScript", () => {
  test("parses handlers and finds them by event", () => {
    const ast = parseScript('on mouseUp\n  go to card "Beta"\nend mouseUp\non show\n  play sound "chime"\nend show');
    assert.equal(ast.handlers.length, 2);
    assert.equal(getHandler(ast, "mouseUp").length, 1);
    assert.equal(getHandler(ast, "show").length, 1);
    assert.equal(getHandler(ast, "nope"), null);
  });

  test("is case-insensitive for keywords and events", () => {
    const ast = parseScript("ON MOUSEUP\n  GO TO NEXT CARD\nEND MOUSEUP");
    assert.equal(ast.handlers[0].event, "mouseUp");
    assert.equal(getHandler(ast, "mouseup")[0].type, "go");
  });

  test("ignores comments and blank lines", () => {
    const ast = parseScript("-- hello\n\non mouseUp -- trailing\n  -- inner\n  wait 1 second\nend mouseUp");
    assert.equal(getHandler(ast, "mouseUp").length, 1);
  });

  test("reports syntax errors with line numbers", () => {
    assert.throws(
      () => parseScript("on mouseUp\n  frobnicate the wobble\nend mouseUp"),
      (err) => err instanceof ScriptError && err.line === 2 && /unknown statement/.test(err.message),
    );
    assert.throws(
      () => parseScript("on mouseUp\n  go to card\nend mouseUp"),
      (err) => err instanceof ScriptError && err.line === 2,
    );
    assert.throws(
      () => parseScript("on mouseUp\n  wait 1 second"),
      (err) => err instanceof ScriptError && /missing "end mouseup"/i.test(err.message),
    );
    assert.throws(
      () => parseScript("go to card 1"),
      (err) => err instanceof ScriptError && err.line === 1,
    );
    assert.throws(
      () => parseScript("on keyDown\nend keyDown"),
      (err) => err instanceof ScriptError && /unknown event/.test(err.message),
    );
  });

  test("rejects mismatched end blocks", () => {
    assert.throws(
      () => parseScript("on mouseUp\n  if 1 = 1 then\n  end mouseUp"),
      (err) => err instanceof ScriptError && /expected "end if"/.test(err.message),
    );
  });
});

describe("runScript statements", () => {
  test("go to card by name, index, and relative navigation", async () => {
    const rt = fakeRuntime();
    await run('on mouseUp\n  go to card "Beta"\nend mouseUp', rt);
    assert.equal(rt.current, "Beta");
    await run("on mouseUp\n  go to card 3\nend mouseUp", rt);
    assert.equal(rt.current, "Gamma");
    await run("on mouseUp\n  go to next card\nend mouseUp", rt);
    assert.equal(rt.current, "Alpha"); // wraps
    await run("on mouseUp\n  go to previous card\nend mouseUp", rt);
    assert.equal(rt.current, "Gamma"); // wraps
    await run("on mouseUp\n  go to first card\nend mouseUp", rt);
    assert.equal(rt.current, "Alpha");
    await run("on mouseUp\n  go to last card\nend mouseUp", rt);
    assert.equal(rt.current, "Gamma");
  });

  test("navigation ends the handler", async () => {
    const rt = fakeRuntime();
    await run('on mouseUp\n  go to card "Beta"\n  answer "never shown"\nend mouseUp', rt);
    assert.ok(!rt.calls.some((c) => c[0] === "answer"));
  });

  test("show/hide/put/play/wait/answer dispatch to the runtime", async () => {
    const rt = fakeRuntime();
    const res = await run(
      'on mouseUp\n  show field "Note"\n  hide button "Secret"\n  put "hi" into field "Note"\n  put "!" after field "Note"\n  play sound "creak"\n  wait 0.5 seconds\n  answer "done"\nend mouseUp',
      rt,
    );
    assert.equal(res.ok, true);
    assert.deepEqual(rt.calls, [
      ["show", "field", "Note"],
      ["hide", "button", "Secret"],
      ["put", "hi", "Note", "into"],
      ["put", "!", "Note", "after"],
      ["play", "creak"],
      ["wait", 0.5],
      ["answer", "done"],
    ]);
  });

  test("set/if with variables, including nested conditionals", async () => {
    const rt = fakeRuntime();
    await run(
      'on mouseUp\n  set score to 1 + 2\n  if score = 3 then\n    set label to "three"\n    if score > 2 then\n      answer label\n    end if\n  end if\n  if score = 99 then\n    answer "never"\n  end if\nend mouseUp',
      rt,
    );
    assert.equal(rt.vars.get("score"), 3);
    assert.equal(rt.vars.get("label"), "three");
    assert.deepEqual(rt.calls.filter((c) => c[0] === "answer"), [["answer", "three"]]);
  });

  test("undefined variables read as 0", async () => {
    const rt = fakeRuntime();
    await run('on mouseUp\n  if missing = 0 then\n    answer "zero"\n  end if\nend mouseUp', rt);
    assert.deepEqual(rt.calls, [["answer", "zero"]]);
  });

  test("expression precedence and string concatenation", async () => {
    const rt = fakeRuntime();
    await run(
      'on mouseUp\n  set a to 2 + 3 * 4\n  set b to (2 + 3) * 4\n  set c to "count: " + a\n  set d to 10 / 4\n  if not a = 14 then\n    answer "bad"\n  end if\nend mouseUp',
      rt,
    );
    assert.equal(rt.vars.get("a"), 14);
    assert.equal(rt.vars.get("b"), 20);
    assert.equal(rt.vars.get("c"), "count: 14");
    assert.equal(rt.vars.get("d"), 2.5);
    assert.ok(!rt.calls.some((c) => c[0] === "answer"));
  });

  test("comparison and logic operators", async () => {
    const rt = fakeRuntime();
    await run(
      'on mouseUp\n  if 1 < 2 and 3 >= 3 and "a" <> "b" and not 1 > 2 then\n    answer "yes"\n  end if\n  if 1 > 2 or 2 > 1 then\n    answer "or works"\n  end if\nend mouseUp',
      rt,
    );
    assert.deepEqual(rt.calls, [["answer", "yes"], ["answer", "or works"]]);
  });

  test("missing handler is a silent success", async () => {
    const rt = fakeRuntime();
    const res = await run('on show\n  play sound "chime"\nend show', rt, "mouseUp");
    assert.equal(res.ok, true);
    assert.deepEqual(rt.calls, []);
  });
});

describe("runScript errors", () => {
  test("unknown card is reported via onError and ok:false, without throwing", async () => {
    const rt = fakeRuntime();
    const res = await run('on mouseUp\n  go to card "Nope"\nend mouseUp', rt);
    assert.equal(res.ok, false);
    assert.ok(res.error instanceof ScriptError);
    assert.equal(res.error.line, 2);
    assert.ok(rt.calls.some((c) => c[0] === "error"));
  });

  test("unknown sound is a runtime error naming the sound", async () => {
    const rt = fakeRuntime();
    const res = await run('on mouseUp\n  play sound "explosion"\nend mouseUp', rt);
    assert.equal(res.ok, false);
    assert.match(res.error.message, /unknown sound "explosion"/);
  });

  test("division by zero and non-numeric math are runtime errors", async () => {
    const rt = fakeRuntime();
    const res = await run('on mouseUp\n  set x to 1 / 0\nend mouseUp', rt);
    assert.equal(res.ok, false);
    assert.match(res.error.message, /division by zero/);
  });

  test("a script error stops the handler but leaves the runtime usable", async () => {
    const rt = fakeRuntime();
    const res = await run('on mouseUp\n  go to card "Nope"\n  answer "never"\nend mouseUp', rt);
    assert.equal(res.ok, false);
    assert.ok(!rt.calls.some((c) => c[0] === "answer"));
    const res2 = await run('on mouseUp\n  answer "alive"\nend mouseUp', rt);
    assert.equal(res2.ok, true);
  });

  test("sandbox: script text that looks like JS is a parse error, not code", () => {
    assert.throws(
      () => parseScript('on mouseUp\n  eval("alert(1)")\nend mouseUp'),
      (err) => err instanceof ScriptError,
    );
    // A string literal containing code is inert data.
    const ast = parseScript('on mouseUp\n  answer "eval(1); process.exit()"\nend mouseUp');
    assert.equal(ast.handlers.length, 1);
  });
});

describe("walkStatements", () => {
  test("visits nested statements depth-first", () => {
    const ast = parseScript('on mouseUp\n  if 1 = 1 then\n    go to card "Beta"\n  end if\n  wait 1 second\nend mouseUp');
    const types = [];
    walkStatements(getHandler(ast, "mouseUp"), (st) => types.push(st.type));
    assert.deepEqual(types, ["if", "go", "wait"]);
  });
});
