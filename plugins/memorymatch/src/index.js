/**
 * Memory Match — ported from Anchoran OS's bundled "memorymatch" app.
 * Same shuffle/flip/match logic and 600ms flip-back delay as the
 * original; timers are cleaned up via mount()'s returned cleanup and
 * React's own effect cleanup, so no stray timers survive a window close.
 */
import { injectStyle, SHELL_CSS } from "../../_shared/pluginKit.js";

const CSS =
  SHELL_CSS +
  `
.mm-moves{margin-left:auto;font-size:12.5px;color:var(--anchoran-text-secondary,#9aa0ab);}
.mm-content{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;}
.mm-board{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;width:min(100%,320px);}
.mm-card{position:relative;aspect-ratio:1/1;border:none;background:transparent;cursor:pointer;perspective:600px;padding:0;}
.mm-card-face{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;border-radius:var(--anchoran-radius-md,10px);backface-visibility:hidden;transition:transform 300ms ease;font-size:22px;}
.mm-card-front{background:var(--anchoran-surface,#1c1d22);border:1px solid var(--anchoran-border,#2a2c33);transform:rotateY(0deg);}
.mm-card-back{background:var(--anchoran-accent-soft,rgba(91,141,239,.15));border:1px solid var(--anchoran-accent,#5B8DEF);color:var(--anchoran-accent,#5B8DEF);transform:rotateY(180deg);}
.mm-card[data-open="true"] .mm-card-front{transform:rotateY(-180deg);}
.mm-card[data-open="true"] .mm-card-back{transform:rotateY(0deg);}
.mm-card[data-matched="true"] .mm-card-back{opacity:.7;}
.mm-won{font-size:13.5px;color:var(--anchoran-accent,#5B8DEF);}
`;

const SYMBOLS = ["◆", "●", "■", "▲", "★", "✚", "◉", "◈"];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function newDeck() {
  return shuffle([...SYMBOLS, ...SYMBOLS]).map((symbol, id) => ({ id, symbol, flipped: false, matched: false }));
}

export function mount(container, sdk) {
  injectStyle("memorymatch", CSS);
  const { React, ReactDOM, Icon } = sdk;
  const { createElement: h, useState, useEffect, useMemo } = React;

  function App() {
    const [cards, setCards] = useState(newDeck);
    const [selected, setSelected] = useState([]);
    const [moves, setMoves] = useState(0);
    const [locked, setLocked] = useState(false);

    const won = useMemo(() => cards.every((c) => c.matched), [cards]);

    useEffect(() => {
      if (selected.length !== 2) return;
      setLocked(true);
      setMoves((m) => m + 1);
      const [a, b] = selected;
      const timer = window.setTimeout(() => {
        setCards((prev) => {
          const match = prev[a].symbol === prev[b].symbol;
          return prev.map((c, i) => (i === a || i === b ? { ...c, matched: match, flipped: match } : c));
        });
        setSelected([]);
        setLocked(false);
      }, 600);
      return () => window.clearTimeout(timer);
    }, [selected]);

    function flip(i) {
      if (locked || cards[i].flipped || cards[i].matched || selected.includes(i)) return;
      setCards((prev) => prev.map((c, idx) => (idx === i ? { ...c, flipped: true } : c)));
      setSelected((s) => [...s, i]);
    }

    function restart() {
      setCards(newDeck());
      setSelected([]);
      setMoves(0);
      setLocked(false);
    }

    return h(
      "div",
      { className: "pk-root" },
      h(
        "div",
        { className: "pk-toolbar" },
        h("button", { className: "pk-btn", onClick: restart }, Icon ? h(Icon, { name: "restart", size: 14 }) : null, " New game"),
        h("div", { className: "mm-moves" }, `Moves: ${moves}`)
      ),
      h(
        "div",
        { className: "pk-content mm-content" },
        h(
          "div",
          { className: "mm-board" },
          cards.map((card, i) =>
            h(
              "button",
              {
                key: card.id,
                className: "mm-card",
                "data-open": card.flipped || card.matched,
                "data-matched": card.matched,
                onClick: () => flip(i),
              },
              h("span", { className: "mm-card-face mm-card-front" }),
              h("span", { className: "mm-card-face mm-card-back" }, card.symbol)
            )
          )
        ),
        won && h("div", { className: "mm-won" }, `Solved in ${moves} moves!`)
      )
    );
  }

  const root = ReactDOM.createRoot(container);
  root.render(h(App));
  return () => root.unmount();
}
