/**
 * Minesweeper — ported from Anchoran OS's bundled "minesweeper" app.
 * Same 10x10/14-mine board, safe-first-click placement, and flood-fill
 * reveal, copied verbatim.
 */
import { injectStyle, SHELL_CSS } from "../../_shared/pluginKit.js";

const CSS =
  SHELL_CSS +
  `
.ms-status{margin-left:auto;font-size:12.5px;color:var(--anchoran-text-secondary,#9aa0ab);}
.ms-content{display:flex;flex-direction:column;align-items:center;gap:10px;}
.ms-board{display:grid;grid-template-columns:repeat(10,1fr);gap:1px;width:min(100%,340px);aspect-ratio:1/1;background:var(--anchoran-border,#2a2c33);border:1px solid var(--anchoran-border,#2a2c33);}
.ms-cell{background:var(--anchoran-surface,#1c1d22);border:none;font-size:12px;color:var(--anchoran-text-primary,#F3F4F6);}
.ms-cell[data-revealed="true"]{background:var(--anchoran-bg,#141519);}
.ms-cell[data-mine="true"]{background:#E5484D;}
.ms-hint{font-size:11.5px;color:var(--anchoran-text-secondary,#9aa0ab);}
`;

const ROWS = 10;
const COLS = 10;
const MINES = 14;

function buildBoard(safeR, safeC) {
  const board = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => ({ mine: false, revealed: false, flagged: false, adjacent: 0 })));
  let placed = 0;
  while (placed < MINES) {
    const r = Math.floor(Math.random() * ROWS);
    const c = Math.floor(Math.random() * COLS);
    if (board[r][c].mine || (Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1)) continue;
    board[r][c].mine = true;
    placed++;
  }
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      if (board[r][c].mine) continue;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && board[nr][nc].mine) count++;
      }
      board[r][c].adjacent = count;
    }
  return board;
}

export function mount(container, sdk) {
  injectStyle("minesweeper", CSS);
  const { React, ReactDOM, Icon } = sdk;
  const { createElement: h, useState, useCallback } = React;

  function App() {
    const [board, setBoard] = useState(null);
    const [status, setStatus] = useState("playing");
    const [flagsUsed, setFlagsUsed] = useState(0);

    const reveal = useCallback((startBoard, r, c) => {
      const stack = [[r, c]];
      while (stack.length) {
        const [cr, cc] = stack.pop();
        const cell = startBoard[cr][cc];
        if (cell.revealed || cell.flagged) continue;
        cell.revealed = true;
        if (cell.adjacent === 0 && !cell.mine) {
          for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
            const nr = cr + dr, nc = cc + dc;
            if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && !startBoard[nr][nc].revealed) stack.push([nr, nc]);
          }
        }
      }
    }, []);

    function checkWin(b) {
      return b.every((row) => row.every((cell) => cell.mine || cell.revealed));
    }

    function onCellClick(r, c) {
      if (status !== "playing") return;
      let current = board;
      if (!current) current = buildBoard(r, c);
      else current = current.map((row) => row.map((cell) => ({ ...cell })));
      const cell = current[r][c];
      if (cell.flagged || cell.revealed) { setBoard(current); return; }
      if (cell.mine) {
        current.forEach((row) => row.forEach((cc) => cc.mine && (cc.revealed = true)));
        setBoard(current);
        setStatus("lost");
        return;
      }
      reveal(current, r, c);
      setBoard(current);
      if (checkWin(current)) setStatus("won");
    }

    function onCellRightClick(e, r, c) {
      e.preventDefault();
      if (status !== "playing" || !board) return;
      const cell = board[r][c];
      if (cell.revealed) return;
      const next = board.map((row) => row.map((cc) => ({ ...cc })));
      next[r][c].flagged = !next[r][c].flagged;
      setBoard(next);
      setFlagsUsed((f) => f + (next[r][c].flagged ? 1 : -1));
    }

    function reset() {
      setBoard(null);
      setStatus("playing");
      setFlagsUsed(0);
    }

    const displayBoard = board ?? buildBoard(-1, -1);

    return h(
      "div",
      { className: "pk-root" },
      h(
        "div",
        { className: "pk-toolbar" },
        h("button", { className: "pk-btn", onClick: reset }, Icon ? h(Icon, { name: "restart", size: 14 }) : null, " New game"),
        h("div", { className: "ms-status" }, status === "won" ? "You win!" : status === "lost" ? "Boom — game over" : `Flags: ${flagsUsed}/${MINES}`)
      ),
      h(
        "div",
        { className: "pk-content ms-content" },
        h(
          "div",
          { className: "ms-board" },
          displayBoard.map((row, r) =>
            row.map((cell, c) =>
              h(
                "button",
                { key: `${r}-${c}`, className: "ms-cell", "data-revealed": cell.revealed, "data-mine": cell.revealed && cell.mine, onClick: () => onCellClick(r, c), onContextMenu: (e) => onCellRightClick(e, r, c) },
                cell.revealed ? (cell.mine ? "*" : cell.adjacent || "") : cell.flagged ? (Icon ? h(Icon, { name: "pin", size: 12 }) : "⚑") : ""
              )
            )
          )
        ),
        h("div", { className: "ms-hint" }, "Right-click to flag a cell")
      )
    );
  }

  const root = ReactDOM.createRoot(container);
  root.render(h(App));
  return () => root.unmount();
}
