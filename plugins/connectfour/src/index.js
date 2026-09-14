/**
 * Connect Four — ported from Anchoran OS's bundled "connectfour" app,
 * plus a new bot opponent (Easy/Medium/Hard) for this migration. Human
 * is always Red (R), bot is always Yellow (Y) in bot mode. Hard uses
 * depth-limited minimax with alpha-beta pruning over a simple window-
 * counting heuristic (classic Connect Four evaluation: count 4-cell
 * windows and score them by how many of each color they contain) —
 * strong tactically without needing a full solved-game table.
 */
import { injectStyle, SHELL_CSS } from "../../_shared/pluginKit.js";

const CSS =
  SHELL_CSS +
  `
.c4-scores{margin-left:auto;font-size:12.5px;color:var(--anchoran-text-secondary,#9aa0ab);}
.c4-content{display:flex;flex-direction:column;align-items:center;gap:12px;}
.c4-status{font-size:13.5px;color:var(--anchoran-text-secondary,#9aa0ab);}
.c4-board{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;width:100%;max-width:380px;background:var(--anchoran-accent-soft,rgba(91,141,239,.15));padding:8px;border-radius:var(--anchoran-radius-md,10px);border:1px solid var(--anchoran-border,#2a2c33);}
.c4-cell{aspect-ratio:1/1;background:transparent;border:none;padding:3px;cursor:pointer;}
.c4-disc{display:block;width:100%;height:100%;border-radius:50%;background:var(--anchoran-surface,#1c1d22);border:1px solid var(--anchoran-border,#2a2c33);}
.c4-disc[data-color="R"]{background:#E5484D;border-color:#E5484D;}
.c4-disc[data-color="Y"]{background:#F5C518;border-color:#F5C518;}
.c4-select{background:var(--anchoran-surface,#1c1d22);border:1px solid var(--anchoran-border,#2a2c33);border-radius:6px;color:var(--anchoran-text-primary,#F3F4F6);font-size:12.5px;padding:5px 6px;}
`;

const ROWS = 6;
const COLS = 7;

function emptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function checkWinner(board) {
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = board[r][c];
      if (!cell) continue;
      for (const [dr, dc] of dirs) {
        let count = 1;
        for (let i = 1; i < 4; i++) {
          const nr = r + dr * i;
          const nc = c + dc * i;
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || board[nr][nc] !== cell) break;
          count++;
        }
        if (count >= 4) return cell;
      }
    }
  }
  return null;
}

function validCols(board) {
  const cols = [];
  for (let c = 0; c < COLS; c++) if (!board[0][c]) cols.push(c);
  return cols;
}

function dropIn(board, col, mark) {
  const next = board.map((row) => [...row]);
  for (let r = ROWS - 1; r >= 0; r--) {
    if (!next[r][col]) {
      next[r][col] = mark;
      return next;
    }
  }
  return next;
}

function windowScore(window, mark, other) {
  const mine = window.filter((v) => v === mark).length;
  const theirs = window.filter((v) => v === other).length;
  const empty = window.filter((v) => v === null).length;
  if (mine === 4) return 1000;
  if (mine === 3 && empty === 1) return 12;
  if (mine === 2 && empty === 2) return 3;
  if (theirs === 3 && empty === 1) return -20;
  return 0;
}

function evaluate(board, mark) {
  const other = mark === "R" ? "Y" : "R";
  let score = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) if (board[r][c] === mark) score += c >= 2 && c <= 4 ? 3 : 1;
  }
  const lines = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c <= COLS - 4; c++) lines.push([board[r][c], board[r][c + 1], board[r][c + 2], board[r][c + 3]]);
  for (let c = 0; c < COLS; c++) for (let r = 0; r <= ROWS - 4; r++) lines.push([board[r][c], board[r + 1][c], board[r + 2][c], board[r + 3][c]]);
  for (let r = 0; r <= ROWS - 4; r++) for (let c = 0; c <= COLS - 4; c++) lines.push([board[r][c], board[r + 1][c + 1], board[r + 2][c + 2], board[r + 3][c + 3]]);
  for (let r = 3; r < ROWS; r++) for (let c = 0; c <= COLS - 4; c++) lines.push([board[r][c], board[r - 1][c + 1], board[r - 2][c + 2], board[r - 3][c + 3]]);
  for (const w of lines) score += windowScore(w, mark, other);
  return score;
}

function minimax(board, depth, alpha, beta, maximizing, botMark, humanMark) {
  const winner = checkWinner(board);
  const cols = validCols(board);
  if (winner === botMark) return { score: 100000 + depth };
  if (winner === humanMark) return { score: -100000 - depth };
  if (cols.length === 0 || depth === 0) return { score: evaluate(board, botMark) };

  let best = null;
  if (maximizing) {
    let value = -Infinity;
    for (const col of cols) {
      const next = dropIn(board, col, botMark);
      const { score } = minimax(next, depth - 1, alpha, beta, false, botMark, humanMark);
      if (score > value) { value = score; best = col; }
      alpha = Math.max(alpha, value);
      if (alpha >= beta) break;
    }
    return { score: value, move: best };
  }
  let value = Infinity;
  for (const col of cols) {
    const next = dropIn(board, col, humanMark);
    const { score } = minimax(next, depth - 1, alpha, beta, true, botMark, humanMark);
    if (score < value) { value = score; best = col; }
    beta = Math.min(beta, value);
    if (alpha >= beta) break;
  }
  return { score: value, move: best };
}

function botMove(board, botMark, humanMark, difficulty) {
  const cols = validCols(board);
  if (difficulty === "easy") return cols[Math.floor(Math.random() * cols.length)];
  if (difficulty === "medium") {
    for (const col of cols) if (checkWinner(dropIn(board, col, botMark)) === botMark) return col;
    for (const col of cols) if (checkWinner(dropIn(board, col, humanMark)) === humanMark) return col;
    const center = cols.filter((c) => c >= 2 && c <= 4);
    return (center.length ? center : cols)[Math.floor(Math.random() * (center.length ? center.length : cols.length))];
  }
  const { move } = minimax(board, 5, -Infinity, Infinity, true, botMark, humanMark);
  return move ?? cols[Math.floor(Math.random() * cols.length)];
}

export function mount(container, sdk) {
  injectStyle("connectfour", CSS);
  const { React, ReactDOM, Icon } = sdk;
  const { createElement: h, useState, useRef, useEffect } = React;

  function App() {
    const [board, setBoard] = useState(emptyBoard);
    const [turn, setTurn] = useState("R");
    const [winner, setWinner] = useState(null);
    const [scores, setScores] = useState({ R: 0, Y: 0 });
    const [opponent, setOpponent] = useState("human");
    const [difficulty, setDifficulty] = useState("medium");
    const botTimer = useRef(null);

    const isFull = board.every((row) => row.every((c) => c !== null));
    const botMark = "Y";
    const isBotTurn = opponent === "bot" && turn === botMark && !winner && !isFull;

    useEffect(() => () => { if (botTimer.current) window.clearTimeout(botTimer.current); }, []);

    function drop(col) {
      if (winner || isBotTurn) return;
      if (board[0][col]) return;
      const next = dropIn(board, col, turn);
      setBoard(next);
      const w = checkWinner(next);
      if (w) {
        setWinner(w);
        setScores((s) => ({ ...s, [w]: s[w] + 1 }));
      } else {
        setTurn((t) => (t === "R" ? "Y" : "R"));
      }
    }

    useEffect(() => {
      if (!isBotTurn) return;
      botTimer.current = window.setTimeout(() => {
        const col = botMove(board, botMark, "R", difficulty);
        if (col == null) return;
        const next = dropIn(board, col, botMark);
        setBoard(next);
        const w = checkWinner(next);
        if (w) {
          setWinner(w);
          setScores((s) => ({ ...s, [w]: s[w] + 1 }));
        } else {
          setTurn("R");
        }
      }, 400);
      return () => { if (botTimer.current) window.clearTimeout(botTimer.current); };
      // eslint-disable-next-line
    }, [isBotTurn, board, difficulty]);

    function reset() {
      setBoard(emptyBoard());
      setTurn("R");
      setWinner(null);
    }

    return h(
      "div",
      { className: "pk-root" },
      h(
        "div",
        { className: "pk-toolbar" },
        h("button", { className: "pk-btn", onClick: reset }, Icon ? h(Icon, { name: "restart", size: 14 }) : null, " New round"),
        h(
          "select",
          { className: "c4-select", value: opponent, onChange: (e) => { setOpponent(e.target.value); reset(); } },
          h("option", { value: "human" }, "vs. Local Player"),
          h("option", { value: "bot" }, "vs. Bot")
        ),
        opponent === "bot" &&
          h(
            "select",
            { className: "c4-select", value: difficulty, onChange: (e) => setDifficulty(e.target.value) },
            h("option", { value: "easy" }, "Easy"),
            h("option", { value: "medium" }, "Medium"),
            h("option", { value: "hard" }, "Hard")
          ),
        h("div", { className: "c4-scores" }, `Red ${scores.R} · Yellow ${scores.Y}`)
      ),
      h(
        "div",
        { className: "pk-content c4-content" },
        h(
          "div",
          { className: "c4-status" },
          winner ? `${winner === "R" ? "Red" : "Yellow"} wins!` : isFull ? "It's a draw" : isBotTurn ? "Bot is thinking…" : `Turn: ${turn === "R" ? "Red" : "Yellow"}`
        ),
        h(
          "div",
          { className: "c4-board" },
          board.map((row, r) => row.map((cell, c) => h("button", { key: `${r}-${c}`, className: "c4-cell", onClick: () => drop(c) }, h("span", { className: "c4-disc", "data-color": cell || undefined }))))
        )
      )
    );
  }

  const root = ReactDOM.createRoot(container);
  root.render(h(App));
  return () => root.unmount();
}
