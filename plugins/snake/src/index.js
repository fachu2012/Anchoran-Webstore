/**
 * Snake — ported from Anchoran OS's bundled "snake" app. Same 18x18
 * grid, 130ms tick, keyboard controls (arrows + WASD) and collision
 * logic. The keydown listener and tick interval are both attached to
 * `window` — real risk if not cleaned up when the plugin window
 * closes, so both keep their original React effect-cleanup pattern,
 * which fires on unmount (i.e. when mount()'s returned cleanup calls
 * root.unmount()).
 */
import { injectStyle, SHELL_CSS } from "../../_shared/pluginKit.js";

const CSS =
  SHELL_CSS +
  `
.sn-score{margin-left:auto;font-size:12.5px;color:var(--anchoran-text-secondary,#9aa0ab);}
.sn-content{display:flex;align-items:center;justify-content:center;}
.sn-board{position:relative;display:grid;width:min(100%,360px);aspect-ratio:1/1;gap:1px;background:var(--anchoran-border,#2a2c33);border:1px solid var(--anchoran-border,#2a2c33);}
.sn-cell{background:var(--anchoran-bg,#141519);}
.sn-cell[data-body="true"]{background:var(--anchoran-accent,#5B8DEF);opacity:.7;}
.sn-cell[data-head="true"]{background:var(--anchoran-accent,#5B8DEF);}
.sn-cell[data-food="true"]{background:#E5484D;border-radius:50%;}
.sn-overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);color:#fff;font-size:13px;text-align:center;}
`;

const GRID = 18;
const TICK_MS = 130;
const DELTA = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };

function randomFood(snake) {
  let food;
  do {
    food = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
  } while (snake.some((s) => s.x === food.x && s.y === food.y));
  return food;
}

export function mount(container, sdk) {
  injectStyle("snake", CSS);
  const { React, ReactDOM, Icon } = sdk;
  const { createElement: h, useState, useRef, useEffect, useCallback } = React;

  function App() {
    const [snake, setSnake] = useState([{ x: 9, y: 9 }]);
    const [food, setFood] = useState(() => randomFood([{ x: 9, y: 9 }]));
    const [dir, setDir] = useState("right");
    const [running, setRunning] = useState(false);
    const [gameOver, setGameOver] = useState(false);
    const [score, setScore] = useState(0);
    const [best, setBest] = useState(0);
    const dirRef = useRef(dir);
    const nextDirRef = useRef(dir);

    useEffect(() => {
      dirRef.current = dir;
    }, [dir]);

    const restart = useCallback(() => {
      const start = [{ x: 9, y: 9 }];
      setSnake(start);
      setFood(randomFood(start));
      setDir("right");
      nextDirRef.current = "right";
      setScore(0);
      setGameOver(false);
      setRunning(true);
    }, []);

    useEffect(() => {
      function onKey(e) {
        const map = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", w: "up", s: "down", a: "left", d: "right" };
        const next = map[e.key];
        if (!next) return;
        e.preventDefault();
        const opposite = { up: "down", down: "up", left: "right", right: "left" };
        if (opposite[next] === dirRef.current) return;
        nextDirRef.current = next;
        if (!running && !gameOver) setRunning(true);
      }
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [running, gameOver]);

    useEffect(() => {
      if (!running || gameOver) return;
      const interval = window.setInterval(() => {
        setDir(nextDirRef.current);
        setSnake((prev) => {
          const delta = DELTA[nextDirRef.current];
          const head = { x: prev[0].x + delta.x, y: prev[0].y + delta.y };
          if (head.x < 0 || head.y < 0 || head.x >= GRID || head.y >= GRID || prev.some((s) => s.x === head.x && s.y === head.y)) {
            setGameOver(true);
            setRunning(false);
            setBest((b) => Math.max(b, prev.length - 1));
            return prev;
          }
          const ate = head.x === food.x && head.y === food.y;
          const nextSnake = [head, ...prev];
          if (ate) {
            setScore((sc) => sc + 1);
            setFood(randomFood(nextSnake));
          } else {
            nextSnake.pop();
          }
          return nextSnake;
        });
      }, TICK_MS);
      return () => window.clearInterval(interval);
    }, [running, gameOver, food]);

    return h(
      "div",
      { className: "pk-root" },
      h(
        "div",
        { className: "pk-toolbar" },
        h("button", { className: "pk-btn", onClick: () => (gameOver ? restart() : setRunning((r) => !r)) }, gameOver ? "New game" : running ? "Pause" : "Start"),
        h("button", { className: "pk-btn", onClick: restart }, Icon ? h(Icon, { name: "restart", size: 14 }) : null, " Reset"),
        h("div", { className: "sn-score" }, `Score: ${score} · Best: ${best}`)
      ),
      h(
        "div",
        { className: "pk-content sn-content" },
        h(
          "div",
          { className: "sn-board", style: { gridTemplateColumns: `repeat(${GRID}, 1fr)` } },
          Array.from({ length: GRID * GRID }).map((_, i) => {
            const x = i % GRID;
            const y = Math.floor(i / GRID);
            const isHead = snake[0].x === x && snake[0].y === y;
            const isBody = !isHead && snake.some((s) => s.x === x && s.y === y);
            const isFood = food.x === x && food.y === y;
            return h("div", { key: i, className: "sn-cell", "data-head": isHead, "data-body": isBody, "data-food": isFood });
          }),
          gameOver && h("div", { className: "sn-overlay" }, h("div", null, "Game over")),
          !running && !gameOver && score === 0 && h("div", { className: "sn-overlay" }, h("div", null, "Press an arrow key to start"))
        )
      )
    );
  }

  const root = ReactDOM.createRoot(container);
  root.render(h(App));
  return () => root.unmount();
}
