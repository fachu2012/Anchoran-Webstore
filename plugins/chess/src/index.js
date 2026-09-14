/**
 * Chess — ported from Anchoran OS's bundled "chess" app. The full
 * legal-move engine (chessLogic.ts: pseudo-moves, check detection,
 * castling, en passant, auto-queen promotion) is ported verbatim,
 * types stripped since this is plain JS — no rule was simplified.
 * New for this migration: a bot opponent (Easy/Medium/Hard). Human is
 * always White, bot is always Black in bot mode. Hard uses depth-3
 * minimax with alpha-beta pruning over material + piece-square-table
 * evaluation — a real, if short-sighted, opponent rather than a
 * tournament engine, matching this migration's stated scope.
 */
import { injectStyle, SHELL_CSS } from "../../_shared/pluginKit.js";

const CSS =
  SHELL_CSS +
  `
.ch-status{margin-left:auto;font-size:12.5px;color:var(--anchoran-text-secondary,#9aa0ab);}
.ch-content{display:flex;flex-direction:column;align-items:center;gap:10px;}
.ch-board{display:grid;grid-template-columns:repeat(8,1fr);width:min(100%,400px);aspect-ratio:1/1;border:1px solid var(--anchoran-border,#2a2c33);border-radius:var(--anchoran-radius-sm,6px);overflow:hidden;}
.ch-square{border:none;background:var(--anchoran-surface,#1c1d22);display:flex;align-items:center;justify-content:center;font-size:26px;cursor:pointer;padding:0;}
.ch-square[data-dark="true"]{background:var(--anchoran-accent-soft,rgba(91,141,239,.15));}
.ch-square[data-selected="true"]{outline:2px solid var(--anchoran-accent,#5B8DEF);outline-offset:-2px;}
.ch-square[data-target="true"]{box-shadow:inset 0 0 0 3px var(--anchoran-accent,#5B8DEF);}
.ch-square span[data-color="w"]{color:#F2F0EB;filter:drop-shadow(0 0 1px #000) drop-shadow(0 0 1px #000);}
.ch-square span[data-color="b"]{color:#17171A;}
.ch-captured{font-size:11.5px;color:var(--anchoran-text-secondary,#9aa0ab);display:flex;flex-direction:column;gap:2px;text-align:center;}
.ch-select{background:var(--anchoran-surface,#1c1d22);border:1px solid var(--anchoran-border,#2a2c33);border-radius:6px;color:var(--anchoran-text-primary,#F3F4F6);font-size:12.5px;padding:5px 6px;}
`;

// ---- chessLogic.ts, ported to plain JS (types stripped, logic unchanged) ----

function initialCastlingRights() {
  return { wK: true, wQ: true, bK: true, bQ: true };
}

function initialBoard() {
  const back = ["r", "n", "b", "q", "k", "b", "n", "r"];
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (let c = 0; c < 8; c++) {
    board[0][c] = { type: back[c], color: "b" };
    board[1][c] = { type: "p", color: "b" };
    board[6][c] = { type: "p", color: "w" };
    board[7][c] = { type: back[c], color: "w" };
  }
  return board;
}

function inBounds(r, c) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

const KNIGHT_DELTAS = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
const KING_DELTAS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const BISHOP_DIRS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const ROOK_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function pseudoMoves(board, r, c, enPassant = null) {
  const piece = board[r][c];
  if (!piece) return [];
  const pieceColor = piece.color;
  const moves = [];

  function slide(dirs) {
    for (const [dr, dc] of dirs) {
      let nr = r + dr;
      let nc = c + dc;
      while (inBounds(nr, nc)) {
        const target = board[nr][nc];
        if (!target) moves.push([nr, nc]);
        else {
          if (target.color !== pieceColor) moves.push([nr, nc]);
          break;
        }
        nr += dr;
        nc += dc;
      }
    }
  }

  if (piece.type === "p") {
    const dir = piece.color === "w" ? -1 : 1;
    const startRow = piece.color === "w" ? 6 : 1;
    if (inBounds(r + dir, c) && !board[r + dir][c]) {
      moves.push([r + dir, c]);
      if (r === startRow && !board[r + dir * 2][c]) moves.push([r + dir * 2, c]);
    }
    for (const dc of [-1, 1]) {
      const nr = r + dir;
      const nc = c + dc;
      if (!inBounds(nr, nc)) continue;
      if (board[nr][nc] && board[nr][nc].color !== piece.color) moves.push([nr, nc]);
      else if (enPassant && enPassant[0] === nr && enPassant[1] === nc) moves.push([nr, nc]);
    }
  } else if (piece.type === "n") {
    for (const [dr, dc] of KNIGHT_DELTAS) {
      const nr = r + dr, nc = c + dc;
      if (inBounds(nr, nc) && (!board[nr][nc] || board[nr][nc].color !== piece.color)) moves.push([nr, nc]);
    }
  } else if (piece.type === "k") {
    for (const [dr, dc] of KING_DELTAS) {
      const nr = r + dr, nc = c + dc;
      if (inBounds(nr, nc) && (!board[nr][nc] || board[nr][nc].color !== piece.color)) moves.push([nr, nc]);
    }
  } else if (piece.type === "b") slide(BISHOP_DIRS);
  else if (piece.type === "r") slide(ROOK_DIRS);
  else if (piece.type === "q") slide([...BISHOP_DIRS, ...ROOK_DIRS]);
  return moves;
}

function findKing(board, color) {
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const p = board[r][c]; if (p && p.type === "k" && p.color === color) return [r, c]; }
  return null;
}

function isSquareAttacked(board, r, c, byColor) {
  for (let sr = 0; sr < 8; sr++)
    for (let sc = 0; sc < 8; sc++) {
      const piece = board[sr][sc];
      if (piece && piece.color === byColor && pseudoMoves(board, sr, sc).some(([mr, mc]) => mr === r && mc === c)) return true;
    }
  return false;
}

function isInCheck(board, color) {
  const king = findKing(board, color);
  if (!king) return false;
  return isSquareAttacked(board, king[0], king[1], color === "w" ? "b" : "w");
}

function castlingMoves(board, r, c, color, rights) {
  const moves = [];
  const homeRow = color === "w" ? 7 : 0;
  if (r !== homeRow || c !== 4) return moves;
  const opponent = color === "w" ? "b" : "w";
  if (isSquareAttacked(board, r, c, opponent)) return moves;
  const kingSideRight = color === "w" ? rights.wK : rights.bK;
  if (kingSideRight && !board[r][5] && !board[r][6] && board[r][7]?.type === "r" && board[r][7]?.color === color) {
    if (!isSquareAttacked(board, r, 5, opponent) && !isSquareAttacked(board, r, 6, opponent)) moves.push([r, 6]);
  }
  const queenSideRight = color === "w" ? rights.wQ : rights.bQ;
  if (queenSideRight && !board[r][3] && !board[r][2] && !board[r][1] && board[r][0]?.type === "r" && board[r][0]?.color === color) {
    if (!isSquareAttacked(board, r, 3, opponent) && !isSquareAttacked(board, r, 2, opponent)) moves.push([r, 2]);
  }
  return moves;
}

function applyMoveRaw(board, from, to, enPassant = null) {
  const next = board.map((row) => [...row]);
  const piece = next[from[0]][from[1]];
  const isEnPassantCapture = !!piece && piece.type === "p" && from[1] !== to[1] && !board[to[0]][to[1]] && !!enPassant && enPassant[0] === to[0] && enPassant[1] === to[1];
  next[to[0]][to[1]] = piece;
  next[from[0]][from[1]] = null;
  if (isEnPassantCapture) next[from[0]][to[1]] = null;
  if (piece && piece.type === "p" && (to[0] === 0 || to[0] === 7)) next[to[0]][to[1]] = { type: "q", color: piece.color };
  if (piece && piece.type === "k" && Math.abs(to[1] - from[1]) === 2) {
    const row = from[0];
    if (to[1] === 6) { next[row][5] = next[row][7]; next[row][7] = null; }
    else if (to[1] === 2) { next[row][3] = next[row][0]; next[row][0] = null; }
  }
  return next;
}

function legalMoves(board, r, c, castling = initialCastlingRights(), enPassant = null) {
  const piece = board[r][c];
  if (!piece) return [];
  const candidates = [...pseudoMoves(board, r, c, enPassant), ...(piece.type === "k" ? castlingMoves(board, r, c, piece.color, castling) : [])];
  return candidates.filter(([tr, tc]) => !isInCheck(applyMoveRaw(board, [r, c], [tr, tc], enPassant), piece.color));
}

function hasAnyLegalMove(board, color, castling = initialCastlingRights(), enPassant = null) {
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const p = board[r][c]; if (p && p.color === color && legalMoves(board, r, c, castling, enPassant).length > 0) return true; }
  return false;
}

function makeMove(board, from, to, enPassant = null) {
  return applyMoveRaw(board, from, to, enPassant);
}

function nextCastlingRights(rights, board, from, to) {
  const next = { ...rights };
  const piece = board[from[0]][from[1]];
  const clearFor = ([r, c]) => {
    if (r === 7 && c === 4) { next.wK = false; next.wQ = false; }
    else if (r === 0 && c === 4) { next.bK = false; next.bQ = false; }
    else if (r === 7 && c === 7) next.wK = false;
    else if (r === 7 && c === 0) next.wQ = false;
    else if (r === 0 && c === 7) next.bK = false;
    else if (r === 0 && c === 0) next.bQ = false;
  };
  if (piece) clearFor(from);
  clearFor(to);
  return next;
}

function nextEnPassantTarget(board, from, to) {
  const piece = board[from[0]][from[1]];
  if (piece && piece.type === "p" && Math.abs(to[0] - from[0]) === 2) return [(from[0] + to[0]) / 2, from[1]];
  return null;
}

const PIECE_UNICODE = { w: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" }, b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" } };

// ---- bot: material + piece-square evaluation, depth-limited minimax ----

const PIECE_VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
const PAWN_TABLE = [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, -10, -10, 10, 10, 5, 5, -5, -10, 0, 0, -10, -5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, 5, 10, 25, 25, 10, 5, 5, 10, 10, 20, 30, 30, 20, 10, 10, 50, 50, 50, 50, 50, 50, 50, 50, 0, 0, 0, 0, 0, 0, 0, 0];
const CENTER_TABLE = [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -10, 0, 0, 0, 0, 0, 0, -10, -20, -10, -10, -10, -10, -10, -10, -20];

function squareBonus(type, color, r, c) {
  const idx = color === "w" ? r * 8 + c : (7 - r) * 8 + c;
  if (type === "p") return PAWN_TABLE[idx];
  if (type === "n" || type === "b") return CENTER_TABLE[idx] * 0.5;
  return 0;
}

function evaluateBoard(board, botColor) {
  let score = 0;
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;
      const value = PIECE_VALUE[p.type] + squareBonus(p.type, p.color, r, c);
      score += p.color === botColor ? value : -value;
    }
  return score;
}

function allLegalMoves(board, color, castling, enPassant) {
  const moves = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p || p.color !== color) continue;
      for (const to of legalMoves(board, r, c, castling, enPassant)) moves.push({ from: [r, c], to });
    }
  return moves;
}

function minimaxChess(board, castling, enPassant, depth, alpha, beta, maximizing, botColor, humanColor) {
  const color = maximizing ? botColor : humanColor;
  const moves = allLegalMoves(board, color, castling, enPassant);
  if (depth === 0 || moves.length === 0) {
    if (moves.length === 0) return { score: isInCheck(board, color) ? (maximizing ? -100000 : 100000) : 0 };
    return { score: evaluateBoard(board, botColor) };
  }
  let best = null;
  if (maximizing) {
    let value = -Infinity;
    for (const m of moves) {
      const nb = makeMove(board, m.from, m.to, enPassant);
      const nc = nextCastlingRights(castling, board, m.from, m.to);
      const ne = nextEnPassantTarget(board, m.from, m.to);
      const { score } = minimaxChess(nb, nc, ne, depth - 1, alpha, beta, false, botColor, humanColor);
      if (score > value) { value = score; best = m; }
      alpha = Math.max(alpha, value);
      if (alpha >= beta) break;
    }
    return { score: value, move: best };
  }
  let value = Infinity;
  for (const m of moves) {
    const nb = makeMove(board, m.from, m.to, enPassant);
    const nc = nextCastlingRights(castling, board, m.from, m.to);
    const ne = nextEnPassantTarget(board, m.from, m.to);
    const { score } = minimaxChess(nb, nc, ne, depth - 1, alpha, beta, true, botColor, humanColor);
    if (score < value) { value = score; best = m; }
    beta = Math.min(beta, value);
    if (alpha >= beta) break;
  }
  return { score: value, move: best };
}

function botPickMove(board, castling, enPassant, botColor, humanColor, difficulty) {
  const moves = allLegalMoves(board, botColor, castling, enPassant);
  if (moves.length === 0) return null;
  if (difficulty === "easy") return moves[Math.floor(Math.random() * moves.length)];
  if (difficulty === "medium") {
    const captures = moves.filter((m) => board[m.to[0]][m.to[1]]);
    const best = captures.sort((a, b) => PIECE_VALUE[board[b.to[0]][b.to[1]].type] - PIECE_VALUE[board[a.to[0]][a.to[1]].type])[0];
    return best ?? moves[Math.floor(Math.random() * moves.length)];
  }
  return minimaxChess(board, castling, enPassant, 3, -Infinity, Infinity, true, botColor, humanColor).move ?? moves[0];
}

// ---- component ----

export function mount(container, sdk) {
  injectStyle("chess", CSS);
  const { React, ReactDOM, Icon } = sdk;
  const { createElement: h, useState, useRef, useEffect } = React;

  function App() {
    const [board, setBoard] = useState(initialBoard);
    const [turn, setTurn] = useState("w");
    const [selected, setSelected] = useState(null);
    const [captured, setCaptured] = useState({ w: [], b: [] });
    const [castling, setCastling] = useState(initialCastlingRights);
    const [enPassant, setEnPassant] = useState(null);
    const [opponent, setOpponent] = useState("human");
    const [difficulty, setDifficulty] = useState("medium");
    const botTimer = useRef(null);

    const inCheck = isInCheck(board, turn);
    const hasMoves = hasAnyLegalMove(board, turn, castling, enPassant);
    const gameOver = !hasMoves;
    const moves = selected ? legalMoves(board, selected[0], selected[1], castling, enPassant) : [];
    const botColor = "b";
    const isBotTurn = opponent === "bot" && turn === botColor && !gameOver;

    useEffect(() => () => { if (botTimer.current) window.clearTimeout(botTimer.current); }, []);

    function reset() {
      setBoard(initialBoard());
      setTurn("w");
      setSelected(null);
      setCaptured({ w: [], b: [] });
      setCastling(initialCastlingRights());
      setEnPassant(null);
    }

    function commitMove(from, to) {
      const target = board[to[0]][to[1]];
      const mover = board[from[0]][from[1]];
      if (target) setCaptured((cap) => ({ ...cap, [mover.color]: [...cap[mover.color], PIECE_UNICODE[target.color][target.type]] }));
      setCastling((rights) => nextCastlingRights(rights, board, from, to));
      setEnPassant(nextEnPassantTarget(board, from, to));
      setBoard(makeMove(board, from, to, enPassant));
      setSelected(null);
      setTurn((t) => (t === "w" ? "b" : "w"));
    }

    function onSquareClick(r, c) {
      if (gameOver || isBotTurn) return;
      const piece = board[r][c];
      if (selected) {
        const isLegal = moves.some(([mr, mc]) => mr === r && mc === c);
        if (isLegal) { commitMove(selected, [r, c]); return; }
        setSelected(piece && piece.color === turn ? [r, c] : null);
        return;
      }
      if (piece && piece.color === turn) setSelected([r, c]);
    }

    useEffect(() => {
      if (!isBotTurn) return;
      botTimer.current = window.setTimeout(() => {
        const move = botPickMove(board, castling, enPassant, botColor, "w", difficulty);
        if (move) commitMove(move.from, move.to);
      }, 350);
      return () => { if (botTimer.current) window.clearTimeout(botTimer.current); };
      // eslint-disable-next-line
    }, [isBotTurn, board, castling, enPassant, difficulty]);

    return h(
      "div",
      { className: "pk-root" },
      h(
        "div",
        { className: "pk-toolbar" },
        h("button", { className: "pk-btn", onClick: reset }, Icon ? h(Icon, { name: "restart", size: 14 }) : null, " New game"),
        h(
          "select",
          { className: "ch-select", value: opponent, onChange: (e) => { setOpponent(e.target.value); reset(); } },
          h("option", { value: "human" }, "vs. Local Player"),
          h("option", { value: "bot" }, "vs. Bot")
        ),
        opponent === "bot" &&
          h(
            "select",
            { className: "ch-select", value: difficulty, onChange: (e) => setDifficulty(e.target.value) },
            h("option", { value: "easy" }, "Easy"),
            h("option", { value: "medium" }, "Medium"),
            h("option", { value: "hard" }, "Hard")
          ),
        h(
          "span",
          { className: "ch-status" },
          gameOver
            ? inCheck ? `Checkmate — ${turn === "w" ? "Black" : "White"} wins!` : "Stalemate — draw"
            : isBotTurn ? "Bot is thinking…" : `${turn === "w" ? "White" : "Black"} to move${inCheck ? " (in check)" : ""}`
        )
      ),
      h(
        "div",
        { className: "pk-content ch-content" },
        h(
          "div",
          { className: "ch-board" },
          board.map((row, r) =>
            row.map((piece, c) => {
              const dark = (r + c) % 2 === 1;
              const isSelected = selected?.[0] === r && selected?.[1] === c;
              const isTarget = moves.some(([mr, mc]) => mr === r && mc === c);
              return h(
                "button",
                { key: `${r}-${c}`, className: "ch-square", "data-dark": dark, "data-selected": isSelected, "data-target": isTarget, onClick: () => onSquareClick(r, c) },
                piece && h("span", { "data-color": piece.color }, PIECE_UNICODE[piece.color][piece.type])
              );
            })
          )
        ),
        h(
          "div",
          { className: "ch-captured" },
          h("div", null, `White captured: ${captured.w.join(" ") || "—"}`),
          h("div", null, `Black captured: ${captured.b.join(" ") || "—"}`)
        )
      )
    );
  }

  const root = ReactDOM.createRoot(container);
  root.render(h(App));
  return () => root.unmount();
}
