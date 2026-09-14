/**
 * Solitaire (Klondike) — ported from Anchoran OS's bundled "solitaire"
 * app. Full solitaireLogic.ts (deck/shuffle, tableau/foundation stack
 * rules) ported verbatim, along with the click-to-select/click-to-move
 * interaction (no drag-and-drop in the original either).
 */
import { injectStyle, SHELL_CSS } from "../../_shared/pluginKit.js";

const CSS =
  SHELL_CSS +
  `
.sol-content{display:flex;flex-direction:column;gap:16px;}
.sol-top-row{display:flex;gap:10px;align-items:center;}
.sol-spacer{flex:1;}
.sol-pile{width:56px;height:78px;border:1px dashed var(--anchoran-border,#2a2c33);border-radius:6px;display:flex;align-items:center;justify-content:center;cursor:pointer;position:relative;color:var(--anchoran-text-secondary,#9aa0ab);}
.sol-foundation-placeholder{font-size:20px;opacity:.4;}
.sol-card{width:52px;height:74px;border-radius:6px;background:#fff;color:#14161B;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;border:1px solid var(--anchoran-border,#2a2c33);position:absolute;}
.sol-card[data-red="true"]{color:#E5484D;}
.sol-card-back{background:var(--anchoran-accent,#5B8DEF);}
.sol-card[data-selected="true"]{outline:2px solid var(--anchoran-accent,#5B8DEF);}
.sol-tableau{display:flex;gap:10px;}
.sol-column{position:relative;width:56px;min-height:200px;}
.sol-stacked{top:0;}
.sol-stacked[data-back="true"]{background:var(--anchoran-accent,#5B8DEF);}
`;

const SUITS = ["S", "H", "D", "C"];
const RANK_LABEL = { 1: "A", 11: "J", 12: "Q", 13: "K" };
const SUIT_SYMBOL = { S: "♠", H: "♥", D: "♦", C: "♣" };
function rankLabel(rank) {
  return RANK_LABEL[rank] ?? String(rank);
}
function isRed(suit) {
  return suit === "H" || suit === "D";
}
function newShuffledDeck() {
  const deck = [];
  for (const suit of SUITS) for (let rank = 1; rank <= 13; rank++) deck.push({ id: `${suit}${rank}`, rank, suit, faceUp: false });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
function canStackTableau(moving, onto) {
  if (!onto) return moving.rank === 13;
  return onto.faceUp && isRed(onto.suit) !== isRed(moving.suit) && onto.rank === moving.rank + 1;
}
function canStackFoundation(moving, onto, suit) {
  if (moving.suit !== suit) return false;
  if (!onto) return moving.rank === 1;
  return onto.rank === moving.rank - 1;
}

function dealNewGame() {
  const deck = newShuffledDeck();
  const tableau = Array.from({ length: 7 }, () => []);
  let cursor = 0;
  for (let col = 0; col < 7; col++) for (let row = 0; row <= col; row++) tableau[col].push({ ...deck[cursor++], faceUp: row === col });
  const stock = deck.slice(cursor).map((c) => ({ ...c, faceUp: false }));
  return { tableau, stock, waste: [], foundations: { S: [], H: [], D: [], C: [] } };
}

export function mount(container, sdk) {
  injectStyle("solitaire", CSS);
  const { React, ReactDOM, Icon } = sdk;
  const { createElement: h, useState, useCallback } = React;

  function App() {
    const [state, setState] = useState(dealNewGame);
    const [selection, setSelection] = useState(null);
    const [won, setWon] = useState(false);

    const restart = useCallback(() => {
      setState(dealNewGame());
      setSelection(null);
      setWon(false);
    }, []);

    function checkWin(foundations) {
      return SUITS.every((s) => foundations[s].length === 13);
    }

    function drawStock() {
      setState((s) => {
        if (s.stock.length === 0) return { ...s, stock: s.waste.map((c) => ({ ...c, faceUp: false })).reverse(), waste: [] };
        const card = { ...s.stock[s.stock.length - 1], faceUp: true };
        return { ...s, stock: s.stock.slice(0, -1), waste: [...s.waste, card] };
      });
    }

    function selectedCards() {
      if (!selection) return null;
      if (selection.source === "waste") {
        const top = state.waste[state.waste.length - 1];
        return top ? [top] : null;
      }
      const col = state.tableau[selection.columnIndex];
      return col.slice(selection.cardIndex);
    }

    function clearSourceAfterMove() {
      if (!selection) return (s) => s;
      if (selection.source === "waste") return (s) => ({ ...s, waste: s.waste.slice(0, -1) });
      const colIndex = selection.columnIndex, cardIndex = selection.cardIndex;
      return (s) => {
        const col = s.tableau[colIndex].slice(0, cardIndex);
        if (col.length > 0) col[col.length - 1] = { ...col[col.length - 1], faceUp: true };
        const tableau = s.tableau.map((c, i) => (i === colIndex ? col : c));
        return { ...s, tableau };
      };
    }

    function moveToTableau(targetCol) {
      const moving = selectedCards();
      if (!moving) return;
      const dest = state.tableau[targetCol];
      if (!canStackTableau(moving[0], dest[dest.length - 1])) return;
      const removeSource = clearSourceAfterMove();
      setState((s) => {
        const next = removeSource(s);
        const tableau = next.tableau.map((c, i) => (i === targetCol ? [...c, ...moving] : c));
        return { ...next, tableau };
      });
      setSelection(null);
    }

    function moveToFoundation(suit) {
      const moving = selectedCards();
      if (!moving || moving.length !== 1) return;
      const dest = state.foundations[suit];
      if (!canStackFoundation(moving[0], dest[dest.length - 1], suit)) return;
      const removeSource = clearSourceAfterMove();
      setState((s) => {
        const next = removeSource(s);
        const foundations = { ...next.foundations, [suit]: [...dest, moving[0]] };
        if (checkWin(foundations)) setWon(true);
        return { ...next, foundations };
      });
      setSelection(null);
    }

    function onTableauCardClick(colIndex, cardIndex) {
      const col = state.tableau[colIndex];
      const card = col[cardIndex];
      if (!card.faceUp) {
        if (cardIndex === col.length - 1) {
          setState((s) => ({ ...s, tableau: s.tableau.map((c, i) => (i === colIndex ? c.map((cc, ci) => (ci === cardIndex ? { ...cc, faceUp: true } : cc)) : c)) }));
        }
        return;
      }
      if (selection) {
        if (selection.source === "tableau" && selection.columnIndex === colIndex && selection.cardIndex === cardIndex) {
          setSelection(null);
          return;
        }
        moveToTableau(colIndex);
        return;
      }
      setSelection({ source: "tableau", columnIndex: colIndex, cardIndex });
    }

    function onWasteClick() {
      if (state.waste.length === 0) return;
      setSelection(selection?.source === "waste" ? null : { source: "waste" });
    }

    return h(
      "div",
      { className: "pk-root" },
      h(
        "div",
        { className: "pk-toolbar" },
        h("button", { className: "pk-btn", onClick: restart }, Icon ? h(Icon, { name: "restart", size: 14 }) : null, " New game"),
        won && h("span", { style: { color: "var(--anchoran-accent,#5B8DEF)", fontSize: 13 } }, "You won!")
      ),
      h(
        "div",
        { className: "pk-content sol-content" },
        h(
          "div",
          { className: "sol-top-row" },
          h("div", { className: "sol-pile", onClick: drawStock }, state.stock.length > 0 ? h("div", { className: "sol-card sol-card-back", style: { position: "static" } }) : (Icon ? h(Icon, { name: "restart", size: 16 }) : "↺")),
          h(
            "div",
            { className: "sol-pile", onClick: onWasteClick },
            state.waste.length > 0 &&
              h(
                "div",
                { className: "sol-card", style: { position: "static" }, "data-selected": selection?.source === "waste", "data-red": isRed(state.waste[state.waste.length - 1].suit) },
                rankLabel(state.waste[state.waste.length - 1].rank),
                SUIT_SYMBOL[state.waste[state.waste.length - 1].suit]
              )
          ),
          h("div", { className: "sol-spacer" }),
          SUITS.map((suit) =>
            h(
              "div",
              { key: suit, className: "sol-pile", onClick: () => moveToFoundation(suit) },
              state.foundations[suit].length > 0
                ? h("div", { className: "sol-card", style: { position: "static" }, "data-red": isRed(suit) }, rankLabel(state.foundations[suit][state.foundations[suit].length - 1].rank), SUIT_SYMBOL[suit])
                : h("span", { className: "sol-foundation-placeholder" }, SUIT_SYMBOL[suit])
            )
          )
        ),
        h(
          "div",
          { className: "sol-tableau" },
          state.tableau.map((col, colIndex) =>
            h(
              "div",
              { key: colIndex, className: "sol-column", onClick: () => col.length === 0 && moveToTableau(colIndex) },
              col.map((card, cardIndex) =>
                h(
                  "div",
                  {
                    key: card.id,
                    className: "sol-card sol-stacked",
                    "data-back": !card.faceUp,
                    "data-red": card.faceUp && isRed(card.suit),
                    "data-selected": selection?.source === "tableau" && selection.columnIndex === colIndex && cardIndex >= (selection.cardIndex ?? 0),
                    style: { top: cardIndex * 22 },
                    onClick: (e) => { e.stopPropagation(); onTableauCardClick(colIndex, cardIndex); },
                  },
                  card.faceUp && [rankLabel(card.rank), SUIT_SYMBOL[card.suit]].join("")
                )
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
