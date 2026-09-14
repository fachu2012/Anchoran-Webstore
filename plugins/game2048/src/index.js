/**
 * 2048 — ported from Anchoran OS's bundled "game2048" app. The full
 * slide/merge/rotate algorithm is copied verbatim (it's pure logic,
 * no Anchoran API involved at all); only the render layer changed to
 * createElement. The window keydown listener is removed via the same
 * effect-cleanup pattern as the original.
 */
import { injectStyle, SHELL_CSS } from "../../_shared/pluginKit.js";

const CSS =
  SHELL_CSS +
  `
.g48-score{margin-left:auto;font-size:12.5px;color:var(--anchoran-text-secondary,#9aa0ab);}
.g48-content{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;}
.g48-board{position:relative;display:grid;grid-template-columns:repeat(4,1fr);gap:8px;width:min(100%,320px);aspect-ratio:1/1;background:var(--anchoran-border,#2a2c33);padding:8px;border-radius:var(--anchoran-radius-md,10px);}
.g48-cell{display:flex;align-items:center;justify-content:center;background:var(--anchoran-surface,#1c1d22);border-radius:6px;font-size:20px;font-weight:600;}
.g48-cell[data-value]{background:var(--anchoran-accent-soft,rgba(91,141,239,.15));color:var(--anchoran-accent,#5B8DEF);}
.g48-overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);color:#fff;font-size:14px;border-radius:var(--anchoran-radius-md,10px);}
.g48-hint{font-size:12px;color:var(--anchoran-text-secondary,#9aa0ab);}
`;

const SIZE = 4;

function emptyBoard() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

function addRandomTile(board) {
  const empties = [];
  board.forEach((row, y) => row.forEach((v, x) => v === 0 && empties.push([y, x])));
  if (empties.length === 0) return board;
  const [y, x] = empties[Math.floor(Math.random() * empties.length)];
  const next = board.map((row) => [...row]);
  next[y][x] = Math.random() < 0.9 ? 2 : 4;
  return next;
}

function slideRow(row) {
  const filtered = row.filter((v) => v !== 0);
  let gained = 0;
  for (let i = 0; i < filtered.length - 1; i++) {
    if (filtered[i] === filtered[i + 1]) {
      filtered[i] *= 2;
      gained += filtered[i];
      filtered.splice(i + 1, 1);
    }
  }
  while (filtered.length < SIZE) filtered.push(0);
  const moved = filtered.some((v, i) => v !== row[i]);
  return { row: filtered, gained, moved };
}

function rotate(board) {
  const next = emptyBoard();
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) next[x][SIZE - 1 - y] = board[y][x];
  return next;
}

function move(board, dir) {
  let working = board;
  let rotations = 0;
  if (dir === "up") rotations = 3;
  else if (dir === "right") rotations = 2;
  else if (dir === "down") rotations = 1;
  for (let i = 0; i < rotations; i++) working = rotate(working);

  let gained = 0;
  let moved = false;
  const resultRows = working.map((row) => {
    const isRight = dir === "right";
    const r = isRight ? [...row].reverse() : row;
    const { row: slid, gained: g, moved: m } = slideRow(r);
    gained += g;
    moved = moved || m;
    return isRight ? slid.reverse() : slid;
  });
  let result = resultRows;
  for (let i = 0; i < (4 - rotations) % 4; i++) result = rotate(result);
  return { board: result, gained, moved };
}

function hasMoves(board) {
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (board[y][x] === 0) return true;
      if (x < SIZE - 1 && board[y][x] === board[y][x + 1]) return true;
      if (y < SIZE - 1 && board[y][x] === board[y + 1][x]) return true;
    }
  }
  return false;
}

function initBoard() {
  return addRandomTile(addRandomTile(emptyBoard()));
}

export function mount(container, sdk) {
  injectStyle("game2048", CSS);
  const { React, ReactDOM, Icon } = sdk;
  const { createElement: h, useState, useEffect, useCallback } = React;

  function App() {
    const [board, setBoard] = useState(initBoard);
    const [score, setScore] = useState(0);
    const [best, setBest] = useState(0);
    const [over, setOver] = useState(false);

    const restart = useCallback(() => {
      setBoard(initBoard());
      setScore(0);
      setOver(false);
    }, []);

    useEffect(() => {
      function onKey(e) {
        const map = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down", a: "left", d: "right", w: "up", s: "down" };
        const dir = map[e.key];
        if (!dir || over) return;
        e.preventDefault();
        setBoard((prev) => {
          const { board: next, gained, moved } = move(prev, dir);
          if (!moved) return prev;
          setScore((sc) => {
            const ns = sc + gained;
            setBest((b) => Math.max(b, ns));
            return ns;
          });
          const withTile = addRandomTile(next);
          if (!hasMoves(withTile)) setOver(true);
          return withTile;
        });
      }
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [over]);

    return h(
      "div",
      { className: "pk-root" },
      h(
        "div",
        { className: "pk-toolbar" },
        h("button", { className: "pk-btn", onClick: restart }, Icon ? h(Icon, { name: "restart", size: 14 }) : null, " New game"),
        h("div", { className: "g48-score" }, `Score: ${score} · Best: ${best}`)
      ),
      h(
        "div",
        { className: "pk-content g48-content" },
        h(
          "div",
          { className: "g48-board" },
          board.flatMap((row, y) => row.map((v, x) => h("div", { key: `${y}-${x}`, className: "g48-cell", "data-value": v || undefined }, v !== 0 ? v : null))),
          over && h("div", { className: "g48-overlay" }, h("div", null, "Game over"))
        ),
        h("div", { className: "g48-hint" }, "Use the arrow keys to play")
      )
    );
  }

  const root = ReactDOM.createRoot(container);
  root.render(h(App));
  return () => root.unmount();
}
