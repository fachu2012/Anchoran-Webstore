/**
 * Checkers — ported from Anchoran OS's bundled "checkers" app
 * (movesFor/initialBoard logic copied verbatim — including the
 * original's own scope, e.g. it never required chained multi-jumps
 * either, so the bot doesn't invent that rule), plus a new bot
 * opponent (Easy/Medium/Hard) for this migration. Human is always
 * White, bot is always Black in bot mode. Hard uses depth-limited
 * minimax (piece count + king bonus + center-control heuristic).
 */
import { injectStyle, SHELL_CSS } from "../../_shared/pluginKit.js";

const CSS =
  SHELL_CSS +
  `
.ck-status{margin-left:auto;font-size:12.5px;color:var(--anchoran-text-secondary,#9aa0ab);}
.ck-content{display:flex;justify-content:center;}
.ck-board{display:grid;grid-template-columns:repeat(8,1fr);width:min(100%,380px);aspect-ratio:1/1;border:1px solid var(--anchoran-border,#2a2c33);border-radius:var(--anchoran-radius-md,10px);overflow:hidden;}
.ck-cell{border:none;background:var(--anchoran-surface,#1c1d22);display:flex;align-items:center;justify-content:center;padding:0;}
.ck-cell[data-dark="true"]{background:var(--anchoran-accent-soft,rgba(91,141,239,.15));cursor:pointer;}
.ck-cell[data-selected="true"]{outline:2px solid var(--anchoran-accent,#5B8DEF);outline-offset:-2px;}
.ck-cell[data-target="true"]{box-shadow:inset 0 0 0 3px var(--anchoran-accent,#5B8DEF);}
.ck-piece{width:68%;height:68%;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;}
.ck-piece[data-color="W"]{background:#F2F0EB;border:2px solid #C9C4B8;color:var(--anchoran-accent,#5B8DEF);}
.ck-piece[data-color="B"]{background:#2B2B2E;border:2px solid #111;color:var(--anchoran-accent,#5B8DEF);}
.ck-select{background:var(--anchoran-surface,#1c1d22);border:1px solid var(--anchoran-border,#2a2c33);border-radius:6px;color:var(--anchoran-text-primary,#F3F4F6);font-size:12.5px;padding:5px 6px;}
`;

function initialBoard() {
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) if ((r + c) % 2 === 1) board[r][c] = { color: "B", king: false };
  for (let r = 5; r < 8; r++) for (let c = 0; c < 8; c++) if ((r + c) % 2 === 1) board[r][c] = { color: "W", king: false };
  return board;
}

function inBounds(r, c) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function movesFor(board, r, c) {
  const piece = board[r][c];
  if (!piece) return [];
  const dirs = piece.king
    ? [[1, 1], [1, -1], [-1, 1], [-1, -1]]
    : piece.color === "W"
    ? [[-1, 1], [-1, -1]]
    : [[1, 1], [1, -1]];
  const result = [];
  for (const [dr, dc] of dirs) {
    const nr = r + dr;
    const nc = c + dc;
    if (inBounds(nr, nc) && !board[nr][nc]) {
      result.push({ to: [nr, nc] });
    } else if (inBounds(nr, nc) && board[nr][nc] && board[nr][nc].color !== piece.color) {
      const jr = r + dr * 2;
      const jc = c + dc * 2;
      if (inBounds(jr, jc) && !board[jr][jc]) result.push({ to: [jr, jc], capture: [nr, nc] });
    }
  }
  return result;
}

function allMoves(board, color) {
  const moves = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (board[r][c] && board[r][c].color === color) for (const m of movesFor(board, r, c)) moves.push({ from: [r, c], ...m });
  return moves;
}

function applyMove(board, move) {
  const next = board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
  const moving = next[move.from[0]][move.from[1]];
  next[move.from[0]][move.from[1]] = null;
  if (moving && (move.to[0] === 0 || move.to[0] === 7)) moving.king = true;
  next[move.to[0]][move.to[1]] = moving;
  if (move.capture) next[move.capture[0]][move.capture[1]] = null;
  return next;
}

function evaluate(board, botColor) {
  const other = botColor === "W" ? "B" : "W";
  let score = 0;
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;
      const value = (p.king ? 5 : 3) + (c >= 2 && c <= 5 ? 0.3 : 0);
      score += p.color === botColor ? value : -value;
    }
  return score;
}

function minimax(board, depth, alpha, beta, maximizing, botColor, humanColor) {
  const color = maximizing ? botColor : humanColor;
  const moves = allMoves(board, color);
  if (depth === 0 || moves.length === 0) return { score: evaluate(board, botColor) };
  let best = null;
  if (maximizing) {
    let value = -Infinity;
    for (const m of moves) {
      const { score } = minimax(applyMove(board, m), depth - 1, alpha, beta, false, botColor, humanColor);
      if (score > value) { value = score; best = m; }
      alpha = Math.max(alpha, value);
      if (alpha >= beta) break;
    }
    return { score: value, move: best };
  }
  let value = Infinity;
  for (const m of moves) {
    const { score } = minimax(applyMove(board, m), depth - 1, alpha, beta, true, botColor, humanColor);
    if (score < value) { value = score; best = m; }
    beta = Math.min(beta, value);
    if (alpha >= beta) break;
  }
  return { score: value, move: best };
}

function botPickMove(board, botColor, humanColor, difficulty) {
  const moves = allMoves(board, botColor);
  if (moves.length === 0) return null;
  if (difficulty === "easy") {
    const captures = moves.filter((m) => m.capture);
    const pool = captures.length && Math.random() < 0.3 ? captures : moves;
    return pool[Math.floor(Math.random() * pool.length)];
  }
  if (difficulty === "medium") {
    const captures = moves.filter((m) => m.capture);
    if (captures.length) return captures[Math.floor(Math.random() * captures.length)];
    return moves[Math.floor(Math.random() * moves.length)];
  }
  return minimax(board, 5, -Infinity, Infinity, true, botColor, humanColor).move ?? moves[0];
}

export function mount(container, sdk) {
  injectStyle("checkers", CSS);
  const { React, ReactDOM, Icon } = sdk;
  const { createElement: h, useState, useMemo, useRef, useEffect } = React;

  function App() {
    const [board, setBoard] = useState(initialBoard);
    const [turn, setTurn] = useState("W");
    const [selected, setSelected] = useState(null);
    const [captures, setCaptures] = useState({ W: 0, B: 0 });
    const [opponent, setOpponent] = useState("human");
    const [difficulty, setDifficulty] = useState("medium");
    const botTimer = useRef(null);

    const legalMoves = useMemo(() => (selected ? movesFor(board, selected[0], selected[1]) : []), [board, selected]);
    const remaining = useMemo(() => {
      let w = 0, b = 0;
      board.forEach((row) => row.forEach((cell) => { if (cell?.color === "W") w++; if (cell?.color === "B") b++; }));
      return { W: w, B: b };
    }, [board]);
    const winner = remaining.W === 0 ? "B" : remaining.B === 0 ? "W" : null;
    const botColor = "B";
    const isBotTurn = opponent === "bot" && turn === botColor && !winner;

    useEffect(() => () => { if (botTimer.current) window.clearTimeout(botTimer.current); }, []);

    function commit(move) {
      const next = applyMove(board, move);
      if (move.capture) setCaptures((s) => ({ ...s, [turn]: s[turn] + 1 }));
      setBoard(next);
      setSelected(null);
      setTurn((t) => (t === "W" ? "B" : "W"));
    }

    function onCellClick(r, c) {
      if (winner || isBotTurn) return;
      const piece = board[r][c];
      if (selected) {
        const move = legalMoves.find((m) => m.to[0] === r && m.to[1] === c);
        if (move) { commit({ from: selected, ...move }); return; }
        setSelected(piece && piece.color === turn ? [r, c] : null);
        return;
      }
      if (piece && piece.color === turn) setSelected([r, c]);
    }

    useEffect(() => {
      if (!isBotTurn) return;
      botTimer.current = window.setTimeout(() => {
        const move = botPickMove(board, botColor, "W", difficulty);
        if (move) commit(move);
      }, 400);
      return () => { if (botTimer.current) window.clearTimeout(botTimer.current); };
      // eslint-disable-next-line
    }, [isBotTurn, board, difficulty]);

    function reset() {
      setBoard(initialBoard());
      setTurn("W");
      setSelected(null);
      setCaptures({ W: 0, B: 0 });
    }

    return h(
      "div",
      { className: "pk-root" },
      h(
        "div",
        { className: "pk-toolbar" },
        h("button", { className: "pk-btn", onClick: reset }, Icon ? h(Icon, { name: "restart", size: 14 }) : null, " New game"),
        h(
          "select",
          { className: "ck-select", value: opponent, onChange: (e) => { setOpponent(e.target.value); reset(); } },
          h("option", { value: "human" }, "vs. Local Player"),
          h("option", { value: "bot" }, "vs. Bot")
        ),
        opponent === "bot" &&
          h(
            "select",
            { className: "ck-select", value: difficulty, onChange: (e) => setDifficulty(e.target.value) },
            h("option", { value: "easy" }, "Easy"),
            h("option", { value: "medium" }, "Medium"),
            h("option", { value: "hard" }, "Hard")
          ),
        h("div", { className: "ck-status" }, winner ? `${winner === "W" ? "White" : "Black"} wins!` : isBotTurn ? "Bot is thinking…" : `Turn: ${turn === "W" ? "White" : "Black"}`)
      ),
      h(
        "div",
        { className: "pk-content ck-content" },
        h(
          "div",
          { className: "ck-board" },
          board.map((row, r) =>
            row.map((cell, c) => {
              const dark = (r + c) % 2 === 1;
              const isSelected = selected?.[0] === r && selected?.[1] === c;
              const isTarget = legalMoves.some((m) => m.to[0] === r && m.to[1] === c);
              return h(
                "button",
                { key: `${r}-${c}`, className: "ck-cell", "data-dark": dark, "data-selected": isSelected, "data-target": isTarget, onClick: () => dark && onCellClick(r, c) },
                cell && h("span", { className: "ck-piece", "data-color": cell.color }, cell.king ? "K" : "")
              );
            })
          )
        )
      )
    );
  }

  const root = ReactDOM.createRoot(container);
  root.render(h(App));
  return () => root.unmount();
}
