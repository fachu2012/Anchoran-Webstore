/**
 * Chance — fuses two former Anchoran OS bundled apps that were both
 * simple random-chance toys: "diceroller" (DiceRoller.tsx) and
 * "coinflip" (CoinFlip.tsx). Same purpose (generate a random outcome,
 * keep a running tally/history), so instead of two near-identical
 * plugins this is one plugin with a Dice/Coin tab switch. All of each
 * original's own logic (dice count 1-6, 8-frame roll animation, 20-row
 * history; coin flip animation + heads/tails tally) is preserved as-is.
 */
import { injectStyle, SHELL_CSS } from "../../_shared/pluginKit.js";

const CSS =
  SHELL_CSS +
  `
.ch-content{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;}
.ch-count-label{display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--anchoran-text-secondary,#9aa0ab);}
.ch-count-label input{width:44px;background:var(--anchoran-surface,#1c1d22);border:1px solid var(--anchoran-border,#2a2c33);border-radius:6px;color:var(--anchoran-text-primary,#F3F4F6);padding:4px 6px;}
.ch-dice-row{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;}
.ch-dice-face{width:56px;height:56px;display:flex;align-items:center;justify-content:center;font-size:38px;border:1px solid var(--anchoran-border,#2a2c33);border-radius:var(--anchoran-radius-md,10px);background:var(--anchoran-surface,#1c1d22);}
.ch-dice-face[data-rolling="true"]{opacity:.6;}
.ch-total{font-size:14px;color:var(--anchoran-text-secondary,#9aa0ab);}
.ch-history{width:100%;max-width:260px;max-height:140px;overflow-y:auto;border-top:1px solid var(--anchoran-border,#2a2c33);padding-top:8px;}
.ch-history-row{display:flex;justify-content:space-between;font-size:12px;padding:2px 0;color:var(--anchoran-text-secondary,#9aa0ab);}
.ch-history-total{color:var(--anchoran-text-primary,#F3F4F6);}
.ch-coin{width:120px;height:120px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:40px;font-weight:600;background:var(--anchoran-accent-soft,rgba(91,141,239,.15));border:3px solid var(--anchoran-accent,#5B8DEF);color:var(--anchoran-accent,#5B8DEF);transition:transform .5s ease;}
.ch-coin[data-flipping="true"]{transform:rotateY(720deg) scale(0.9);}
.ch-result{font-size:14px;color:var(--anchoran-text-secondary,#9aa0ab);}
.ch-tally{margin-left:auto;font-size:12.5px;color:var(--anchoran-text-secondary,#9aa0ab);}
`;

const DICE_FACES = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

export function mount(container, sdk) {
  injectStyle("chance", CSS);
  const { React, ReactDOM, Icon } = sdk;
  const { createElement: h, useState, useRef, useEffect } = React;

  function DicePanel() {
    const [count, setCount] = useState(2);
    const [current, setCurrent] = useState([1, 1]);
    const [history, setHistory] = useState([]);
    const [rolling, setRolling] = useState(false);
    const intervalRef = useRef(null);

    useEffect(() => () => { if (intervalRef.current) window.clearInterval(intervalRef.current); }, []);

    function roll() {
      if (rolling) return;
      setRolling(true);
      let frames = 0;
      intervalRef.current = window.setInterval(() => {
        const values = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * 6));
        setCurrent(values);
        frames++;
        if (frames >= 8) {
          window.clearInterval(intervalRef.current);
          intervalRef.current = null;
          setRolling(false);
          setHistory((hh) => [{ id: Date.now(), values, total: values.reduce((a, b) => a + b, 0) }, ...hh].slice(0, 20));
        }
      }, 60);
    }

    return h(
      React.Fragment,
      null,
      h(
        "div",
        { className: "pk-toolbar" },
        h(
          "label",
          { className: "ch-count-label" },
          "Dice",
          h("input", {
            type: "number",
            min: 1,
            max: 6,
            value: count,
            onChange: (e) => {
              const n = Math.max(1, Math.min(6, Number(e.target.value) || 1));
              setCount(n);
              setCurrent((c) => Array.from({ length: n }, (_, i) => c[i] ?? 1));
            },
          })
        ),
        h("button", { className: "pk-btn", onClick: roll, disabled: rolling }, Icon ? h(Icon, { name: "diceRoller", size: 14 }) : null, " Roll")
      ),
      h(
        "div",
        { className: "pk-content ch-content" },
        h(
          "div",
          { className: "ch-dice-row" },
          current.map((v, i) => h("div", { key: i, className: "ch-dice-face", "data-rolling": rolling }, DICE_FACES[v - 1]))
        ),
        h("div", { className: "ch-total" }, `Total: ${current.reduce((a, b) => a + b, 0)}`),
        history.length > 0 &&
          h(
            "div",
            { className: "ch-history" },
            history.map((r) =>
              h(
                "div",
                { key: r.id, className: "ch-history-row" },
                h("span", null, r.values.join(" + ")),
                h("span", { className: "ch-history-total" }, r.total)
              )
            )
          )
      )
    );
  }

  function CoinPanel() {
    const [side, setSide] = useState("heads");
    const [flipping, setFlipping] = useState(false);
    const [tally, setTally] = useState({ heads: 0, tails: 0 });
    const timerRef = useRef(null);

    useEffect(() => () => { if (timerRef.current) window.clearTimeout(timerRef.current); }, []);

    function flip() {
      if (flipping) return;
      setFlipping(true);
      timerRef.current = window.setTimeout(() => {
        const result = Math.random() < 0.5 ? "heads" : "tails";
        setSide(result);
        setTally((t) => ({ ...t, [result]: t[result] + 1 }));
        setFlipping(false);
      }, 500);
    }

    return h(
      React.Fragment,
      null,
      h(
        "div",
        { className: "pk-toolbar" },
        h("button", { className: "pk-btn", onClick: flip, disabled: flipping }, Icon ? h(Icon, { name: "coinFlip", size: 14 }) : null, " Flip"),
        h("div", { className: "ch-tally" }, `Heads ${tally.heads} · Tails ${tally.tails}`)
      ),
      h(
        "div",
        { className: "pk-content ch-content" },
        h("div", { className: "ch-coin", "data-flipping": flipping }, flipping ? "" : side === "heads" ? "H" : "T"),
        h("div", { className: "ch-result" }, flipping ? "Flipping…" : side === "heads" ? "Heads" : "Tails")
      )
    );
  }

  function App() {
    const [tab, setTab] = useState("dice");
    return h(
      "div",
      { className: "pk-root" },
      h(
        "div",
        { className: "pk-toolbar", style: { borderBottom: "1px solid var(--anchoran-border,#2a2c33)" } },
        h("button", { className: "pk-btn", "data-active": tab === "dice", onClick: () => setTab("dice") }, "Dice"),
        h("button", { className: "pk-btn", "data-active": tab === "coin", onClick: () => setTab("coin") }, "Coin")
      ),
      tab === "dice" ? h(DicePanel) : h(CoinPanel)
    );
  }

  const root = ReactDOM.createRoot(container);
  root.render(h(App));
  return () => root.unmount();
}
