/**
 * Tic-Tac-Toe — ported from Anchoran OS's bundled "tictactoe" app
 * (src/applications/tictactoe/TicTacToe.tsx), plus a new bot opponent
 * (Easy/Medium/Hard) requested for this migration. Human is always X,
 * bot is always O when bot mode is on. Hard uses full minimax (the
 * 9-cell search space is tiny, so it's exhaustive — genuinely
 * unbeatable, not just "strong"). Medium is a simple heuristic: take
 * an immediate win, else block the opponent's immediate win, else
 * play center/corner/random. Easy is uniformly random among legal
 * moves. The bot "thinks" on a short timeout so its move never lands
 * inside the same render pass as the human's, and that timeout is
 * cleared on unmount/board reset to avoid a stray move firing after
 * the window closes.
 */
import { injectStyle, SHELL_CSS } from "../../_shared/pluginKit.js";

const CSS =
  SHELL_CSS +
  `
.ttt-scores{margin-left:auto;font-size:12.5px;color:var(--anchoran-text-secondary,#9aa0ab);}
.ttt-content{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;}
.ttt-status{font-size:14px;color:var(--anchoran-text-secondary,#9aa0ab);}
.ttt-board{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;width:min(100%,260px);aspect-ratio:1/1;}
.ttt-cell{background:var(--anchoran-surface,#1c1d22);border:1px solid var(--anchoran-border,#2a2c33);border-radius:var(--anchoran-radius-md,10px);font-size:34px;font-weight:500;color:var(--anchoran-text-primary,#F3F4F6);cursor:pointer;}
.ttt-cell:hover:not([data-mark]){background:var(--anchoran-border,#2a2c33);}
.ttt-cell[data-mark="X"]{color:var(--anchoran-accent,#5B8DEF);}
.ttt-cell[data-win="true"]{background:var(--anchoran-accent-soft,rgba(91,141,239,.15));border-color:var(--anchoran-accent,#5B8DEF);}
.ttt-select{background:var(--anchoran-surface,#1c1d22);border:1px solid var(--anchoran-border,#2a2c33);border-radius:6px;color:var(--anchoran-text-primary,#F3F4F6);font-size:12.5px;padding:5px 6px;}
`;

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function winnerOf(board) {
  for (const line of LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return { winner: board[a], line };
  }
  return null;
}

function legalMoves(board) {
  const moves = [];
  board.forEach((c, i) => c === null && moves.push(i));
  return moves;
}

// Exhaustive minimax over the 9-cell space — always terminates, no depth cap needed.
function minimax(board, player, botMark, humanMark) {
  const w = winnerOf(board);
  if (w) return { score: w.winner === botMark ? 1 : -1 };
  const moves = legalMoves(board);
  if (moves.length === 0) return { score: 0 };

  let best = null;
  for (const m of moves) {
    const next = [...board];
    next[m] = player;
    const { score } = minimax(next, player === botMark ? humanMark : botMark, botMark, humanMark);
    if (best === null || (player === botMark ? score > best.score : score < best.score)) {
      best = { score, move: m };
    }
  }
  return best;
}

function botMove(board, botMark, humanMark, difficulty) {
  const moves = legalMoves(board);
  if (difficulty === "easy") {
    return moves[Math.floor(Math.random() * moves.length)];
  }
  if (difficulty === "medium") {
    // Take an immediate win.
    for (const m of moves) {
      const next = [...board];
      next[m] = botMark;
      if (winnerOf(next)?.winner === botMark) return m;
    }
    // Block the opponent's immediate win.
    for (const m of moves) {
      const next = [...board];
      next[m] = humanMark;
      if (winnerOf(next)?.winner === humanMark) return m;
    }
    // Otherwise prefer center, then corners, then a random remaining cell.
    if (moves.includes(4)) return 4;
    const corners = [0, 2, 6, 8].filter((c) => moves.includes(c));
    if (corners.length) return corners[Math.floor(Math.random() * corners.length)];
    return moves[Math.floor(Math.random() * moves.length)];
  }
  // hard: full minimax, unbeatable.
  return minimax(board, botMark, botMark, humanMark).move;
}

export function mount(container, sdk) {
  injectStyle("tictactoe", CSS);
  const { React, ReactDOM, Icon } = sdk;
  const { createElement: h, useState, useRef, useEffect } = React;

  function App() {
    const [board, setBoard] = useState(Array(9).fill(null));
    const [turn, setTurn] = useState("X");
    const [scores, setScores] = useState({ X: 0, O: 0, draws: 0 });
    const [opponent, setOpponent] = useState("human"); // "human" | "bot"
    const [difficulty, setDifficulty] = useState("medium");
    const botTimer = useRef(null);

    const result = winnerOf(board);
    const isDraw = !result && board.every((c) => c !== null);
    const botMark = "O";
    const isBotTurn = opponent === "bot" && turn === botMark && !result && !isDraw;

    useEffect(() => () => { if (botTimer.current) window.clearTimeout(botTimer.current); }, []);

    function applyMove(i, mark) {
      const next = [...board];
      next[i] = mark;
      setBoard(next);
      const w = winnerOf(next);
      if (w) setScores((s) => ({ ...s, [w.winner]: s[w.winner] + 1 }));
      else if (next.every((c) => c !== null)) setScores((s) => ({ ...s, draws: s.draws + 1 }));
      setTurn((t) => (t === "X" ? "O" : "X"));
    }

    function play(i) {
      if (board[i] || result || isDraw || isBotTurn) return;
      applyMove(i, turn);
    }

    useEffect(() => {
      if (!isBotTurn) return;
      botTimer.current = window.setTimeout(() => {
        const move = botMove(board, botMark, "X", difficulty);
        if (move != null) applyMove(move, botMark);
      }, 300);
      return () => { if (botTimer.current) window.clearTimeout(botTimer.current); };
      // eslint-disable-next-line
    }, [isBotTurn, board, difficulty]);

    function reset() {
      setBoard(Array(9).fill(null));
      setTurn("X");
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
          { className: "ttt-select", value: opponent, onChange: (e) => { setOpponent(e.target.value); reset(); } },
          h("option", { value: "human" }, "vs. Local Player"),
          h("option", { value: "bot" }, "vs. Bot")
        ),
        opponent === "bot" &&
          h(
            "select",
            { className: "ttt-select", value: difficulty, onChange: (e) => setDifficulty(e.target.value) },
            h("option", { value: "easy" }, "Easy"),
            h("option", { value: "medium" }, "Medium"),
            h("option", { value: "hard" }, "Hard")
          ),
        h("div", { className: "ttt-scores" }, `X ${scores.X} · O ${scores.O} · Draws ${scores.draws}`)
      ),
      h(
        "div",
        { className: "ttt-content" },
        h(
          "div",
          { className: "ttt-status" },
          result ? `${result.winner} wins!` : isDraw ? "It's a draw" : isBotTurn ? "Bot is thinking…" : `Turn: ${turn}`
        ),
        h(
          "div",
          { className: "ttt-board" },
          board.map((cell, i) =>
            h(
              "button",
              {
                key: i,
                className: "ttt-cell",
                "data-mark": cell || undefined,
                "data-win": (result && result.line.includes(i)) || undefined,
                onClick: () => play(i),
              },
              cell
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
