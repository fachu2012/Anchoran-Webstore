/**
 * Spreadsheet — ported from Anchoran OS's bundled "spreadsheet" app.
 * The formula engine (formula.ts: cell refs, +-*\/, parentheses,
 * SUM(range)) is ported verbatim, no eval(). New for this migration:
 * AVG(range), MIN(range) and MAX(range), the same shape as the
 * original's SUM — small, useful additions to a genuinely small engine.
 */
import { injectStyle, SHELL_CSS, pluginStorage } from "../../_shared/pluginKit.js";

const CSS =
  SHELL_CSS +
  `
.sp-cellref{font-family:"Cascadia Code",Consolas,monospace;font-size:12px;color:var(--anchoran-text-secondary,#9aa0ab);width:36px;}
.sp-formula-bar{flex:1;font-family:"Cascadia Code",Consolas,monospace;}
.sp-scroll{overflow:auto;padding:0;}
.sp-table{border-collapse:collapse;font-size:12px;}
.sp-table th{background:var(--anchoran-surface,#1c1d22);color:var(--anchoran-text-secondary,#9aa0ab);font-weight:500;padding:4px 6px;border:1px solid var(--anchoran-border,#2a2c33);position:sticky;top:0;min-width:30px;}
.sp-table td{border:1px solid var(--anchoran-border,#2a2c33);padding:4px 8px;min-width:76px;height:22px;cursor:cell;white-space:nowrap;color:var(--anchoran-text-primary,#F3F4F6);}
.sp-table td[data-selected="true"]{outline:2px solid var(--anchoran-accent,#5B8DEF);outline-offset:-2px;background:var(--anchoran-accent-soft,rgba(91,141,239,.15));}
`;

const ROWS = 30;
const COLS = 12;
const STORAGE_KEY = "spreadsheetGrid";

function colToIndex(col) {
  let n = 0;
  for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}
function cellId(row, col) {
  let c = col + 1;
  let letters = "";
  while (c > 0) {
    const rem = (c - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    c = Math.floor((c - 1) / 26);
  }
  return `${letters}${row + 1}`;
}
function parseRange(ref) {
  const [start, end] = ref.split(":");
  if (!end) return [start];
  const m1 = start.match(/^([A-Z]+)(\d+)$/i);
  const m2 = end.match(/^([A-Z]+)(\d+)$/i);
  if (!m1 || !m2) return [];
  const c1 = colToIndex(m1[1].toUpperCase());
  const r1 = Number(m1[2]) - 1;
  const c2 = colToIndex(m2[1].toUpperCase());
  const r2 = Number(m2[2]) - 1;
  const ids = [];
  for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) ids.push(cellId(r, c));
  return ids;
}

class Parser {
  constructor(src) { this.src = src; this.pos = 0; }
  peek() { return this.src[this.pos]; }
  next() { return this.src[this.pos++]; }
  skipSpace() { while (this.peek() === " ") this.pos++; }
  parseExpr() {
    let value = this.parseTerm();
    this.skipSpace();
    while (this.peek() === "+" || this.peek() === "-") {
      const op = this.next();
      const rhs = this.parseTerm();
      value = op === "+" ? value + rhs : value - rhs;
      this.skipSpace();
    }
    return value;
  }
  parseTerm() {
    let value = this.parseFactor();
    this.skipSpace();
    while (this.peek() === "*" || this.peek() === "/") {
      const op = this.next();
      const rhs = this.parseFactor();
      value = op === "*" ? value * rhs : value / rhs;
      this.skipSpace();
    }
    return value;
  }
  parseFactor() {
    this.skipSpace();
    if (this.peek() === "-") { this.next(); return -this.parseFactor(); }
    if (this.peek() === "(") {
      this.next();
      const value = this.parseExpr();
      this.skipSpace();
      if (this.peek() === ")") this.next();
      return value;
    }
    this.skipSpace();
    const match = this.src.slice(this.pos).match(/^-?\d+(\.\d+)?/);
    if (match) { this.pos += match[0].length; return Number(match[0]); }
    return 0;
  }
}

function aggregate(ids, grid, seen, fn, initial) {
  const values = ids.map((id) => resolveCell(id, grid, seen)).filter((v) => typeof v === "number");
  if (values.length === 0) return 0;
  return values.reduce(fn, initial === "first" ? values[0] : initial);
}

function evaluateFormula(raw, grid, seen = new Set()) {
  if (!raw.startsWith("=")) {
    const n = Number(raw);
    return raw.trim() === "" ? "" : Number.isNaN(n) ? raw : n;
  }
  let expr = raw.slice(1).toUpperCase();

  const fnMatch = expr.match(/^(SUM|AVG|MIN|MAX)\((.+)\)$/);
  if (fnMatch) {
    const [, fn, rangeStr] = fnMatch;
    const ids = parseRange(rangeStr);
    if (fn === "SUM") return aggregate(ids, grid, seen, (a, b) => a + b, 0);
    if (fn === "AVG") {
      const values = ids.map((id) => resolveCell(id, grid, seen)).filter((v) => typeof v === "number");
      return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    }
    if (fn === "MIN") return aggregate(ids, grid, seen, (a, b) => Math.min(a, b), "first");
    if (fn === "MAX") return aggregate(ids, grid, seen, (a, b) => Math.max(a, b), "first");
  }

  expr = expr.replace(/[A-Z]+\d+/g, (ref) => {
    const v = resolveCell(ref, grid, seen);
    return String(typeof v === "number" ? v : 0);
  });

  try {
    return new Parser(expr).parseExpr();
  } catch {
    return "#ERR";
  }
}

function resolveCell(id, grid, seen) {
  if (seen.has(id)) return "#CYCLE";
  const raw = grid[id];
  if (!raw) return "";
  const nextSeen = new Set(seen).add(id);
  return evaluateFormula(raw, grid, nextSeen);
}

function displayValue(raw, grid) {
  if (!raw) return "";
  const v = evaluateFormula(raw, grid);
  return v === "" ? "" : String(v);
}

export function mount(container, sdk) {
  injectStyle("spreadsheet", CSS);
  const store = pluginStorage("spreadsheet");
  const { React, ReactDOM } = sdk;
  const { createElement: h, useState } = React;

  function App() {
    const [grid, setGrid] = useState(() => store.get(STORAGE_KEY, {}));
    const [selected, setSelected] = useState(null);
    const [editValue, setEditValue] = useState("");

    function save(next) {
      setGrid(next);
      store.set(STORAGE_KEY, next);
    }

    function selectCell(id) {
      setSelected(id);
      setEditValue(grid[id] ?? "");
    }

    function commitEdit() {
      if (!selected) return;
      const next = { ...grid };
      if (editValue.trim() === "") delete next[selected];
      else next[selected] = editValue;
      save(next);
    }

    return h(
      "div",
      { className: "pk-root" },
      h(
        "div",
        { className: "pk-toolbar" },
        h("span", { className: "sp-cellref" }, selected ?? ""),
        h("input", {
          className: "pk-input sp-formula-bar",
          placeholder: "Value or =formula (e.g. =A1+B2, =SUM(A1:A5), =AVG(...), =MIN(...), =MAX(...))",
          value: editValue,
          onChange: (e) => setEditValue(e.target.value),
          onBlur: commitEdit,
          onKeyDown: (e) => e.key === "Enter" && commitEdit(),
          disabled: !selected,
        })
      ),
      h(
        "div",
        { className: "pk-content sp-scroll" },
        h(
          "table",
          { className: "sp-table" },
          h("thead", null, h("tr", null, h("th"), Array.from({ length: COLS }, (_, c) => h("th", { key: c }, cellId(0, c).replace(/\d+$/, ""))))),
          h(
            "tbody",
            null,
            Array.from({ length: ROWS }, (_, r) =>
              h(
                "tr",
                { key: r },
                h("th", null, r + 1),
                Array.from({ length: COLS }, (_, c) => {
                  const id = cellId(r, c);
                  return h("td", { key: id, "data-selected": selected === id, onClick: () => selectCell(id) }, displayValue(grid[id], grid));
                })
              )
            )
          )
        )
      )
    );
  }

  const root = ReactDOM.createRoot(container);
  root.render(h(App));
  return () => root.unmount();
}
