/**
 * Calculator — ported from Anchoran OS's bundled "calculator" app.
 * Same memory keys, operator chaining and history list, copied
 * verbatim (pure UI state, no Anchoran API involved at all).
 */
import { injectStyle, SHELL_CSS } from "../../_shared/pluginKit.js";

const CSS =
  SHELL_CSS +
  `
.cc-root{height:100%;display:flex;flex-direction:column;padding:16px;gap:12px;color:var(--anchoran-text-primary,#F3F4F6);}
.cc-memory-row{display:flex;align-items:center;gap:6px;flex-shrink:0;}
.cc-mem-btn{border:1px solid var(--anchoran-border,#2a2c33);background:var(--anchoran-surface,#1c1d22);border-radius:6px;font-size:12px;padding:5px 10px;color:var(--anchoran-text-primary,#F3F4F6);cursor:pointer;}
.cc-mem-btn:disabled{opacity:.4;cursor:default;}
.cc-mem-indicator{margin-left:auto;font-size:11px;font-weight:600;color:var(--anchoran-accent,#5B8DEF);}
.cc-display{flex-shrink:0;text-align:right;font-size:32px;font-weight:300;padding:12px 6px;overflow-x:auto;}
.cc-grid{flex:1;display:grid;grid-template-columns:repeat(4,1fr);gap:8px;}
.cc-btn{border:1px solid var(--anchoran-border,#2a2c33);background:var(--anchoran-surface,#1c1d22);border-radius:6px;font-size:16px;color:var(--anchoran-text-primary,#F3F4F6);cursor:pointer;}
.cc-btn:hover{background:var(--anchoran-border,#2a2c33);}
.cc-btn[data-op="true"]{color:var(--anchoran-accent,#5B8DEF);}
.cc-btn[data-equals="true"]{background:var(--anchoran-accent,#5B8DEF);color:#fff;border-color:var(--anchoran-accent,#5B8DEF);}
.cc-history{flex-shrink:0;max-height:120px;overflow-y:auto;border-top:1px solid var(--anchoran-border,#2a2c33);padding-top:8px;}
.cc-history-header{display:flex;justify-content:space-between;align-items:center;font-size:11px;color:var(--anchoran-text-secondary,#9aa0ab);margin-bottom:4px;}
.cc-history-clear{border:none;background:transparent;color:var(--anchoran-text-secondary,#9aa0ab);cursor:pointer;font-size:11px;text-decoration:underline;}
.cc-history-row{display:flex;justify-content:space-between;gap:8px;padding:3px 2px;font-size:12px;cursor:pointer;color:var(--anchoran-text-secondary,#9aa0ab);}
.cc-history-row:hover{color:var(--anchoran-text-primary,#F3F4F6);}
.cc-history-result{color:var(--anchoran-text-primary,#F3F4F6);flex-shrink:0;}
`;

const BUTTONS = ["C", "±", "%", "÷", "7", "8", "9", "×", "4", "5", "6", "−", "1", "2", "3", "+", "0", ".", "="];

export function mount(container, sdk) {
  injectStyle("calculator", CSS);
  const { React, ReactDOM } = sdk;
  const { createElement: h, useState } = React;

  function App() {
    const [display, setDisplay] = useState("0");
    const [accumulator, setAccumulator] = useState(null);
    const [pendingOp, setPendingOp] = useState(null);
    const [awaitingOperand, setAwaitingOperand] = useState(false);
    const [memory, setMemory] = useState(null);
    const [history, setHistory] = useState([]);

    function inputDigit(digit) {
      if (awaitingOperand) { setDisplay(digit === "." ? "0." : digit); setAwaitingOperand(false); return; }
      if (digit === "." && display.includes(".")) return;
      setDisplay(display === "0" && digit !== "." ? digit : display + digit);
    }

    function applyOp(a, b, op) {
      switch (op) {
        case "+": return a + b;
        case "−": return a - b;
        case "×": return a * b;
        case "÷": return b === 0 ? NaN : a / b;
        default: return b;
      }
    }

    function onOperator(op) {
      const value = parseFloat(display);
      if (op === "C") { setDisplay("0"); setAccumulator(null); setPendingOp(null); setAwaitingOperand(false); return; }
      if (op === "±") { setDisplay(String(value * -1)); return; }
      if (op === "%") { setDisplay(String(value / 100)); return; }
      if (op === "=") {
        if (pendingOp && accumulator !== null) {
          const result = applyOp(accumulator, value, pendingOp);
          const expression = `${accumulator} ${pendingOp} ${value}`;
          setDisplay(String(result));
          setHistory((h2) => [{ expression, result: String(result) }, ...h2].slice(0, 30));
          setAccumulator(null);
          setPendingOp(null);
          setAwaitingOperand(true);
        }
        return;
      }
      if (pendingOp && accumulator !== null && !awaitingOperand) {
        const result = applyOp(accumulator, value, pendingOp);
        setAccumulator(result);
        setDisplay(String(result));
      } else {
        setAccumulator(value);
      }
      setPendingOp(op);
      setAwaitingOperand(true);
    }

    function memoryAction(action) {
      const value = parseFloat(display);
      if (action === "MC") setMemory(null);
      else if (action === "MR") { if (memory !== null) { setDisplay(String(memory)); setAwaitingOperand(false); } }
      else if (action === "M+") setMemory((m) => (m ?? 0) + value);
      else if (action === "M-") setMemory((m) => (m ?? 0) - value);
    }

    return h(
      "div",
      { className: "cc-root" },
      h(
        "div",
        { className: "cc-memory-row" },
        h("button", { className: "cc-mem-btn", onClick: () => memoryAction("MC"), disabled: memory === null }, "MC"),
        h("button", { className: "cc-mem-btn", onClick: () => memoryAction("MR"), disabled: memory === null }, "MR"),
        h("button", { className: "cc-mem-btn", onClick: () => memoryAction("M+") }, "M+"),
        h("button", { className: "cc-mem-btn", onClick: () => memoryAction("M-") }, "M−"),
        memory !== null && h("span", { className: "cc-mem-indicator" }, "M")
      ),
      h("div", { className: "cc-display" }, display),
      h(
        "div",
        { className: "cc-grid" },
        BUTTONS.map((btn) => {
          const isOp = ["÷", "×", "−", "+"].includes(btn);
          const isEquals = btn === "=";
          return h(
            "button",
            { key: btn, className: "cc-btn", "data-op": isOp, "data-equals": isEquals, style: btn === "0" ? { gridColumn: "span 2" } : undefined, onClick: () => (/[0-9.]/.test(btn) ? inputDigit(btn) : onOperator(btn)) },
            btn
          );
        })
      ),
      history.length > 0 &&
        h(
          "div",
          { className: "cc-history" },
          h("div", { className: "cc-history-header" }, h("span", null, "History"), h("button", { className: "cc-history-clear", onClick: () => setHistory([]) }, "Clear")),
          history.map((h2, i) => h("div", { key: i, className: "cc-history-row", onClick: () => setDisplay(h2.result) }, h("span", null, h2.expression), h("span", { className: "cc-history-result" }, `= ${h2.result}`)))
        )
    );
  }

  const root = ReactDOM.createRoot(container);
  root.render(h(App));
  return () => root.unmount();
}
