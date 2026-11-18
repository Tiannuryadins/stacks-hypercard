// STACKS — HyperTalk-lite scripting language (pure module: no DOM, no
// network, Node-safe). A small line-oriented interpreter: lexer → parser →
// async evaluator. Scripts are data, never JavaScript: there is no eval,
// no Function constructor, and no dynamic import anywhere in this module.
// Normative reference: .kiro/steering/hypertalk-language.md

export class ScriptError extends Error {
  constructor(message, line = null) {
    super(line ? `line ${line}: ${message}` : message);
    this.name = "ScriptError";
    this.line = line;
  }
}

export const EVENTS = ["mouseUp", "show"];
export const SOUNDS = ["creak", "thunder", "chime", "knock", "wind", "whisper"];

// ---------------------------------------------------------------- lexer

const TOKEN_RE =
  /\s*(?:(--.*$)|("(?:[^"\\]|\\.)*")|(\d+(?:\.\d+)?)|([A-Za-z_][A-Za-z0-9_]*)|(<>|<=|>=|[=<>+\-*/()]))/y;

function tokenizeLine(text, lineNo) {
  const tokens = [];
  let pos = 0;
  TOKEN_RE.lastIndex = 0;
  while (pos < text.length) {
    TOKEN_RE.lastIndex = pos;
    const m = TOKEN_RE.exec(text);
    if (!m || m.index !== pos) {
      throw new ScriptError(`unexpected character ${JSON.stringify(text[pos])}`, lineNo);
    }
    pos = TOKEN_RE.lastIndex;
    if (m[1] !== undefined) break; // comment: rest of line ignored
    if (m[2] !== undefined) {
      tokens.push({ type: "string", value: JSON.parse(m[2]), line: lineNo });
    } else if (m[3] !== undefined) {
      tokens.push({ type: "number", value: Number(m[3]), line: lineNo });
    } else if (m[4] !== undefined) {
      tokens.push({ type: "word", value: m[4], line: lineNo });
    } else if (m[5] !== undefined) {
      tokens.push({ type: "op", value: m[5], line: lineNo });
    }
  }
  return tokens;
}

// Split source into logical lines: [{ lineNo, tokens }], skipping blanks.
function lexLines(source) {
  if (typeof source !== "string") throw new ScriptError("script must be a string");
  return source
    .split(/\r?\n/)
    .map((text, i) => ({ lineNo: i + 1, tokens: tokenizeLine(text, i + 1) }))
    .filter((l) => l.tokens.length > 0);
}

// -------------------------------------------------------------- parser

function isWord(tok, word) {
  return tok && tok.type === "word" && tok.value.toLowerCase() === word;
}

function expectWord(tokens, i, word, lineNo) {
  if (!isWord(tokens[i], word)) {
    const got = tokens[i] ? JSON.stringify(tokens[i].value) : "end of line";
    throw new ScriptError(`expected "${word}" but found ${got}`, lineNo);
  }
  return i + 1;
}

function expectEnd(tokens, i, lineNo) {
  if (i < tokens.length) {
    throw new ScriptError(`unexpected ${JSON.stringify(tokens[i].value)}`, lineNo);
  }
}

// Expression parser (Pratt): or > and > comparison > additive >
// multiplicative > unary > primary. Consumes tokens, returns { node, next }.
function parseExpression(tokens, i, lineNo) {
  return parseOr(tokens, i, lineNo);
}

function parseOr(tokens, i, lineNo) {
  let { node, next } = parseAnd(tokens, i, lineNo);
  while (isWord(tokens[next], "or")) {
    const right = parseAnd(tokens, next + 1, lineNo);
    node = { type: "binary", op: "or", left: node, right: right.node };
    next = right.next;
  }
  return { node, next };
}

function parseAnd(tokens, i, lineNo) {
  let { node, next } = parseComparison(tokens, i, lineNo);
  while (isWord(tokens[next], "and")) {
    const right = parseComparison(tokens, next + 1, lineNo);
    node = { type: "binary", op: "and", left: node, right: right.node };
    next = right.next;
  }
  return { node, next };
}

const COMPARISONS = new Set(["=", "<>", "<", "<=", ">", ">="]);

function parseComparison(tokens, i, lineNo) {
  let { node, next } = parseAdditive(tokens, i, lineNo);
  while (tokens[next] && tokens[next].type === "op" && COMPARISONS.has(tokens[next].value)) {
    const op = tokens[next].value;
    const right = parseAdditive(tokens, next + 1, lineNo);
    node = { type: "binary", op, left: node, right: right.node };
    next = right.next;
  }
  return { node, next };
}

function parseAdditive(tokens, i, lineNo) {
  let { node, next } = parseMultiplicative(tokens, i, lineNo);
  while (tokens[next] && tokens[next].type === "op" && (tokens[next].value === "+" || tokens[next].value === "-")) {
    const op = tokens[next].value;
    const right = parseMultiplicative(tokens, next + 1, lineNo);
    node = { type: "binary", op, left: node, right: right.node };
    next = right.next;
  }
  return { node, next };
}

function parseMultiplicative(tokens, i, lineNo) {
  let { node, next } = parseUnary(tokens, i, lineNo);
  while (tokens[next] && tokens[next].type === "op" && (tokens[next].value === "*" || tokens[next].value === "/")) {
    const op = tokens[next].value;
    const right = parseUnary(tokens, next + 1, lineNo);
    node = { type: "binary", op, left: node, right: right.node };
    next = right.next;
  }
  return { node, next };
}

function parseUnary(tokens, i, lineNo) {
  if (tokens[i] && tokens[i].type === "op" && tokens[i].value === "-") {
    const operand = parseUnary(tokens, i + 1, lineNo);
    return { node: { type: "unary", op: "-", operand: operand.node }, next: operand.next };
  }
  if (isWord(tokens[i], "not")) {
    const operand = parseUnary(tokens, i + 1, lineNo);
    return { node: { type: "unary", op: "not", operand: operand.node }, next: operand.next };
  }
  return parsePrimary(tokens, i, lineNo);
}

function parsePrimary(tokens, i, lineNo) {
  const tok = tokens[i];
  if (!tok) throw new ScriptError("expected an expression but found end of line", lineNo);
  if (tok.type === "number" || tok.type === "string") {
    return { node: { type: "literal", value: tok.value }, next: i + 1 };
  }
  if (tok.type === "word") {
    return { node: { type: "variable", name: tok.value }, next: i + 1 };
  }
  if (tok.type === "op" && tok.value === "(") {
    const inner = parseExpression(tokens, i + 1, lineNo);
    if (!tokens[inner.next] || tokens[inner.next].type !== "op" || tokens[inner.next].value !== ")") {
      throw new ScriptError('expected ")"', lineNo);
    }
    return { node: inner.node, next: inner.next + 1 };
  }
  throw new ScriptError(`unexpected ${JSON.stringify(tok.value)} in expression`, lineNo);
}

function parseStatement(line) {
  const { tokens, lineNo } = line;
  const kw = tokens[0].type === "word" ? tokens[0].value.toLowerCase() : null;

  if (kw === "go") {
    let i = expectWord(tokens, 1, "to", lineNo);
    if (isWord(tokens[i], "next")) {
      i = expectWord(tokens, i + 1, "card", lineNo);
      expectEnd(tokens, i, lineNo);
      return { type: "go", ref: { type: "next" }, line: lineNo };
    }
    if (isWord(tokens[i], "previous")) {
      i = expectWord(tokens, i + 1, "card", lineNo);
      expectEnd(tokens, i, lineNo);
      return { type: "go", ref: { type: "previous" }, line: lineNo };
    }
    if (isWord(tokens[i], "first")) {
      i = expectWord(tokens, i + 1, "card", lineNo);
      expectEnd(tokens, i, lineNo);
      return { type: "go", ref: { type: "first" }, line: lineNo };
    }
    if (isWord(tokens[i], "last")) {
      i = expectWord(tokens, i + 1, "card", lineNo);
      expectEnd(tokens, i, lineNo);
      return { type: "go", ref: { type: "last" }, line: lineNo };
    }
    i = expectWord(tokens, i, "card", lineNo);
    const target = tokens[i];
    if (!target) throw new ScriptError('expected a card name or number after "go to card"', lineNo);
    if (target.type === "string") {
      expectEnd(tokens, i + 1, lineNo);
      return { type: "go", ref: { type: "name", value: target.value }, line: lineNo };
    }
    if (target.type === "number") {
      expectEnd(tokens, i + 1, lineNo);
      return { type: "go", ref: { type: "index", value: target.value }, line: lineNo };
    }
    throw new ScriptError('expected a card name or number after "go to card"', lineNo);
  }

  if (kw === "show" || kw === "hide") {
    const kind = tokens[1] && tokens[1].type === "word" ? tokens[1].value.toLowerCase() : null;
    if (kind !== "field" && kind !== "button") {
      throw new ScriptError(`expected "field" or "button" after "${kw}"`, lineNo);
    }
    const name = tokens[2];
    if (!name || name.type !== "string") {
      throw new ScriptError(`expected a quoted name after "${kw} ${kind}"`, lineNo);
    }
    expectEnd(tokens, 3, lineNo);
    return { type: kw, kind, name: name.value, line: lineNo };
  }

  if (kw === "put") {
    const expr = parseExpression(tokens, 1, lineNo);
    let i = expr.next;
    const modeTok = tokens[i];
    if (!modeTok || modeTok.type !== "word" || (modeTok.value.toLowerCase() !== "into" && modeTok.value.toLowerCase() !== "after")) {
      throw new ScriptError('expected "into" or "after" in put statement', lineNo);
    }
    const mode = modeTok.value.toLowerCase();
    i = expectWord(tokens, i + 1, "field", lineNo);
    const name = tokens[i];
    if (!name || name.type !== "string") {
      throw new ScriptError('expected a quoted field name after "put ... into field"', lineNo);
    }
    expectEnd(tokens, i + 1, lineNo);
    return { type: "put", expr: expr.node, mode, name: name.value, line: lineNo };
  }

  if (kw === "play") {
    let i = expectWord(tokens, 1, "sound", lineNo);
    const name = tokens[i];
    if (!name || name.type !== "string") {
      throw new ScriptError('expected a quoted sound name after "play sound"', lineNo);
    }
    expectEnd(tokens, i + 1, lineNo);
    return { type: "play", sound: name.value, line: lineNo };
  }

  if (kw === "wait") {
    const seconds = tokens[1];
    if (!seconds || seconds.type !== "number" || seconds.value < 0) {
      throw new ScriptError('expected a non-negative number of seconds after "wait"', lineNo);
    }
    const unit = tokens[2];
    if (!unit || unit.type !== "word" || (unit.value.toLowerCase() !== "second" && unit.value.toLowerCase() !== "seconds")) {
      throw new ScriptError('expected "second" or "seconds" after wait duration', lineNo);
    }
    expectEnd(tokens, 3, lineNo);
    return { type: "wait", seconds: seconds.value, line: lineNo };
  }

  if (kw === "set") {
    const nameTok = tokens[1];
    if (!nameTok || nameTok.type !== "word") {
      throw new ScriptError('expected a variable name after "set"', lineNo);
    }
    const i = expectWord(tokens, 2, "to", lineNo);
    const expr = parseExpression(tokens, i, lineNo);
    expectEnd(tokens, expr.next, lineNo);
    return { type: "set", name: nameTok.value, expr: expr.node, line: lineNo };
  }

  if (kw === "answer") {
    const expr = parseExpression(tokens, 1, lineNo);
    expectEnd(tokens, expr.next, lineNo);
    return { type: "answer", expr: expr.node, line: lineNo };
  }

  throw new ScriptError(
    `unknown statement ${JSON.stringify(tokens[0].value)} (expected go, show, hide, put, play, wait, set, answer, or if)`,
    lineNo,
  );
}

// Parse a block of lines until an `end <what>` line (or end of input).
// Returns { statements, nextIndex }.
function parseBlock(lines, start, endWord, lineNo) {
  const statements = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    const { tokens } = line;
    if (isWord(tokens[0], "end")) {
      const what = tokens[1] && tokens[1].type === "word" ? tokens[1].value.toLowerCase() : null;
      if (what === endWord) {
        expectEnd(tokens, 2, line.lineNo);
        return { statements, nextIndex: i + 1 };
      }
      throw new ScriptError(`expected "end ${endWord}" but found "end ${what ?? ""}"`, line.lineNo);
    }
    if (isWord(tokens[0], "if")) {
      const expr = parseExpression(tokens, 1, line.lineNo);
      let j = expr.next;
      j = expectWord(tokens, j, "then", line.lineNo);
      expectEnd(tokens, j, line.lineNo);
      const inner = parseBlock(lines, i + 1, "if", line.lineNo);
      statements.push({ type: "if", expr: expr.node, body: inner.statements, line: line.lineNo });
      i = inner.nextIndex;
      continue;
    }
    if (isWord(tokens[0], "on")) {
      throw new ScriptError('unexpected "on" inside a handler', line.lineNo);
    }
    statements.push(parseStatement(line));
    i += 1;
  }
  throw new ScriptError(`missing "end ${endWord}"`, lineNo);
}

/**
 * Parse a script source string into an AST: { handlers: [{ event, body }] }.
 * Throws ScriptError (with a line number) on any syntax problem.
 */
export function parseScript(source) {
  const lines = lexLines(source);
  const handlers = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const { tokens } = line;
    if (!isWord(tokens[0], "on")) {
      throw new ScriptError(`expected "on <event>" but found ${JSON.stringify(tokens[0].value)}`, line.lineNo);
    }
    const eventTok = tokens[1];
    const event = eventTok && eventTok.type === "word" ? eventTok.value : null;
    if (!event || !EVENTS.some((e) => e.toLowerCase() === event.toLowerCase())) {
      throw new ScriptError(`unknown event ${JSON.stringify(event ?? "")} (expected ${EVENTS.join(" or ")})`, line.lineNo);
    }
    const normalized = EVENTS.find((e) => e.toLowerCase() === event.toLowerCase());
    expectEnd(tokens, 2, line.lineNo);
    const block = parseBlock(lines, i + 1, normalized.toLowerCase(), line.lineNo);
    handlers.push({ event: normalized, body: block.statements, line: line.lineNo });
    i = block.nextIndex;
  }
  return { handlers };
}

export function getHandler(ast, event) {
  const h = ast.handlers.find((x) => x.event.toLowerCase() === event.toLowerCase());
  return h ? h.body : null;
}

/** Depth-first walk of a statement list (descends into `if` bodies). */
export function walkStatements(statements, fn) {
  for (const st of statements) {
    fn(st);
    if (st.type === "if") walkStatements(st.body, fn);
  }
}

// ---------------------------------------------------------- interpreter

function isTruthy(v) {
  return v !== 0 && v !== "" && v !== false && v !== null && v !== undefined;
}

function toDisplay(v) {
  if (typeof v === "string") return v;
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(v);
  return String(v);
}

function toNumber(v, line) {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new ScriptError(`"${toDisplay(v)}" is not a number`, line);
  return n;
}

function evalExpr(node, runtime, line) {
  switch (node.type) {
    case "literal":
      return node.value;
    case "variable": {
      const v = runtime.getVar ? runtime.getVar(node.name) : undefined;
      return v === undefined ? 0 : v;
    }
    case "unary": {
      const v = evalExpr(node.operand, runtime, line);
      if (node.op === "-") return -toNumber(v, line);
      return !isTruthy(v);
    }
    case "binary": {
      if (node.op === "and") return isTruthy(evalExpr(node.left, runtime, line)) && isTruthy(evalExpr(node.right, runtime, line));
      if (node.op === "or") return isTruthy(evalExpr(node.left, runtime, line)) || isTruthy(evalExpr(node.right, runtime, line));
      const l = evalExpr(node.left, runtime, line);
      const r = evalExpr(node.right, runtime, line);
      if (node.op === "+") {
        if (typeof l === "string" || typeof r === "string") return toDisplay(l) + toDisplay(r);
        return toNumber(l, line) + toNumber(r, line);
      }
      if (node.op === "-") return toNumber(l, line) - toNumber(r, line);
      if (node.op === "*") return toNumber(l, line) * toNumber(r, line);
      if (node.op === "/") {
        const divisor = toNumber(r, line);
        if (divisor === 0) throw new ScriptError("division by zero", line);
        return toNumber(l, line) / divisor;
      }
      if (typeof l === "number" && typeof r === "number") {
        if (node.op === "=") return l === r;
        if (node.op === "<>") return l !== r;
        if (node.op === "<") return l < r;
        if (node.op === "<=") return l <= r;
        if (node.op === ">") return l > r;
        if (node.op === ">=") return l >= r;
      }
      if (node.op === "=") return toDisplay(l) === toDisplay(r);
      if (node.op === "<>") return toDisplay(l) !== toDisplay(r);
      if (node.op === "<") return toDisplay(l) < toDisplay(r);
      if (node.op === "<=") return toDisplay(l) <= toDisplay(r);
      if (node.op === ">") return toDisplay(l) > toDisplay(r);
      if (node.op === ">=") return toDisplay(l) >= toDisplay(r);
      throw new ScriptError(`unknown operator ${node.op}`, line);
    }
    default:
      throw new ScriptError(`unknown expression node ${node.type}`, line);
  }
}

async function execStatement(st, runtime) {
  switch (st.type) {
    case "go":
      await runtime.goToCard(st.ref);
      return "navigated";
    case "show":
      runtime.showElement(st.kind, st.name);
      return null;
    case "hide":
      runtime.hideElement(st.kind, st.name);
      return null;
    case "put": {
      const value = evalExpr(st.expr, runtime, st.line);
      runtime.putText(toDisplay(value), st.name, st.mode);
      return null;
    }
    case "play":
      if (!SOUNDS.includes(st.sound)) {
        throw new ScriptError(`unknown sound "${st.sound}" (known: ${SOUNDS.join(", ")})`, st.line);
      }
      await runtime.playSound(st.sound);
      return null;
    case "wait":
      await runtime.wait(st.seconds);
      return null;
    case "set":
      runtime.setVar(st.name, evalExpr(st.expr, runtime, st.line));
      return null;
    case "answer": {
      const value = evalExpr(st.expr, runtime, st.line);
      await runtime.answer(toDisplay(value));
      return null;
    }
    case "if": {
      if (isTruthy(evalExpr(st.expr, runtime, st.line))) {
        return execBlock(st.body, runtime);
      }
      return null;
    }
    default:
      throw new ScriptError(`unknown statement ${st.type}`, st.line);
  }
}

async function execBlock(statements, runtime) {
  for (const st of statements) {
    let result;
    try {
      result = await execStatement(st, runtime);
    } catch (err) {
      if (err instanceof ScriptError) throw err;
      throw new ScriptError(err.message, st.line);
    }
    if (result === "navigated") return "navigated";
  }
  return null;
}

/**
 * Parse and run one handler of a script.
 *
 * @param {string} source - script source
 * @param {object} runtime - the runtime contract (see steering)
 * @param {string} event - handler event to run ("mouseUp" or "show")
 * @returns {Promise<{ok: boolean, navigated: boolean, error?: ScriptError}>}
 *   Parse errors throw ScriptError. Runtime errors are reported via
 *   runtime.onError (if provided) and returned as { ok: false, error } —
 *   they never crash the caller.
 */
export async function runScript(source, runtime, event = "mouseUp") {
  const ast = parseScript(source);
  const body = getHandler(ast, event);
  if (!body) return { ok: true, navigated: false };
  try {
    const result = await execBlock(body, runtime);
    return { ok: true, navigated: result === "navigated" };
  } catch (err) {
    const scriptErr = err instanceof ScriptError ? err : new ScriptError(err.message);
    if (runtime.onError) {
      try {
        runtime.onError(scriptErr);
      } catch {
        // onError itself must never break script execution reporting.
      }
    }
    return { ok: false, navigated: false, error: scriptErr };
  }
}
