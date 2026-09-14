/**
 * Sudoku — ported from Anchoran OS's bundled "sudoku" app. The full
 * backtracking generator (sudokuLogic.ts: fillGrid + hole-punching per
 * difficulty) is ported verbatim.
 */
import { injectStyle, SHELL_CSS } from "../../_shared/pluginKit.js";

const CSS =
  SHELL_CSS +
  `
.su-content{display:flex;flex-direction:column;align-items:center;gap:14px;}
.su-board{display:grid;grid-template-columns:repeat(9,1fr);width:min(100%,340px);aspect-ratio:1/1;border:2px solid var(--anchoran-border,#2a2c33);}
.su-cell{background:var(--anchoran-surface,#1c1d22);border:1px solid var(--anchoran-border,#2a2c33);color:var(--anchoran-text-primary,#F3F4F6);font-size:15px;}
.su-cell[data-fixed="true"]{color:var(--anchoran-text-secondary,#9aa0ab);font-weight:600;}
.su-cell[data-selected="true"]{background:var(--anchoran-accent-soft,rgba(91,141,239,.15));}
.su-cell[data-border-right="true"]{border-right:2px solid var(--anchoran-border,#2a2c33);}
.su-cell[data-border-bottom="true"]{border-bottom:2px solid var(--anchoran-border,#2a2c33);}
.su-pad{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;width:min(100%,240px);}
.su-pad-btn{background:var(--anchoran-surface,#1c1d22);border:1px solid var(--anchoran-border,#2a2c33);border-radius:6px;color:var(--anchoran-text-primary,#F3F4F6);padding:8px;cursor:pointer;}
.su-result{font-size:13px;}
.su-result[data-correct="true"]{color:var(--anchoran-accent,#5B8DEF);}
.su-result[data-correct="false"]{color:#E5484D;}
`;

function shuffled(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function isValid(grid, row, col, val) {
  for (let i = 0; i < 9; i++) if (grid[row][i] === val || grid[i][col] === val) return false;
  const br = Math.floor(row / 3) * 3, bc = Math.floor(col / 3) * 3;
  for (let r = br; r < br + 3; r++) for (let c = bc; c < bc + 3; c++) if (grid[r][c] === val) return false;
  return true;
}
function fillGrid(grid) {
  for (let row = 0; row < 9; row++)
    for (let col = 0; col < 9; col++) {
      if (grid[row][col] === 0) {
        for (const val of shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
          if (isValid(grid, row, col, val)) {
            grid[row][col] = val;
            if (fillGrid(grid)) return true;
            grid[row][col] = 0;
          }
        }
        return false;
      }
    }
  return true;
}
const HOLES = { easy: 36, medium: 46, hard: 54 };
function generatePuzzle(difficulty) {
  const solution = Array.from({ length: 9 }, () => Array(9).fill(0));
  fillGrid(solution);
  const puzzle = solution.map((row) => [...row]);
  const cells = shuffled(Array.from({ length: 81 }, (_, i) => [Math.floor(i / 9), i % 9]));
  let removed = 0;
  for (const [r, c] of cells) {
    if (removed >= HOLES[difficulty]) break;
    puzzle[r][c] = 0;
    removed++;
  }
  return { puzzle, solution };
}

export function mount(container, sdk) {
  injectStyle("sudoku", CSS);
  const { React, ReactDOM, Icon } = sdk;
  const { createElement: h, useState, useMemo } = React;

  function App() {
    const [difficulty, setDifficulty] = useState("easy");
    const [game, setGame] = useState(() => generatePuzzle("easy"));
    const [grid, setGrid] = useState(() => game.puzzle.map((r) => [...r]));
    const [selected, setSelected] = useState(null);
    const [checkResult, setCheckResult] = useState(null);

    const fixedCells = useMemo(() => new Set(game.puzzle.flatMap((row, r) => row.map((v, c) => (v !== 0 ? `${r}-${c}` : null)))), [game]);

    function newGame(diff) {
      const g = generatePuzzle(diff);
      setDifficulty(diff);
      setGame(g);
      setGrid(g.puzzle.map((r) => [...r]));
      setSelected(null);
      setCheckResult(null);
    }

    function setValue(val) {
      if (!selected) return;
      const [r, c] = selected;
      if (fixedCells.has(`${r}-${c}`)) return;
      const next = grid.map((row) => [...row]);
      next[r][c] = val;
      setGrid(next);
      setCheckResult(null);
    }

    function check() {
      const solved = grid.every((row, r) => row.every((v, c) => v === game.solution[r][c]));
      setCheckResult(solved ? "correct" : "incorrect");
    }

    return h(
      "div",
      { className: "pk-root" },
      h(
        "div",
        { className: "pk-toolbar" },
        ["easy", "medium", "hard"].map((d) => h("button", { key: d, className: "pk-btn", "data-active": difficulty === d, onClick: () => newGame(d) }, d[0].toUpperCase() + d.slice(1))),
        h("button", { className: "pk-btn", onClick: check }, Icon ? h(Icon, { name: "check", size: 14 }) : null, " Check")
      ),
      h(
        "div",
        { className: "pk-content su-content" },
        h(
          "div",
          { className: "su-board" },
          grid.map((row, r) =>
            row.map((v, c) => {
              const fixed = fixedCells.has(`${r}-${c}`);
              return h(
                "button",
                { key: `${r}-${c}`, className: "su-cell", "data-fixed": fixed, "data-selected": selected?.[0] === r && selected?.[1] === c, "data-border-right": c % 3 === 2 && c !== 8, "data-border-bottom": r % 3 === 2 && r !== 8, onClick: () => !fixed && setSelected([r, c]) },
                v !== 0 ? v : ""
              );
            })
          )
        ),
        h(
          "div",
          { className: "su-pad" },
          [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => h("button", { key: n, className: "su-pad-btn", onClick: () => setValue(n) }, n)),
          h("button", { className: "su-pad-btn", onClick: () => setValue(0) }, Icon ? h(Icon, { name: "close", size: 13 }) : "×")
        ),
        checkResult && h("div", { className: "su-result", "data-correct": checkResult === "correct" }, checkResult === "correct" ? "Solved correctly!" : "Not quite — keep trying")
      )
    );
  }

  const root = ReactDOM.createRoot(container);
  root.render(h(App));
  return () => root.unmount();
}
