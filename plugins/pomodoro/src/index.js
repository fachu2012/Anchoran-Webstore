/**
 * Pomodoro Timer — ported from Anchoran OS's bundled "pomodoro" app.
 * Same focus/short-break/long-break durations and cycle counting;
 * the countdown interval is cleared both on mode switch (its own
 * effect cleanup) and when the plugin window closes (root.unmount()
 * triggers that same effect cleanup).
 */
import { injectStyle, SHELL_CSS } from "../../_shared/pluginKit.js";

const CSS =
  SHELL_CSS +
  `
.pom-content{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;}
.pom-ring{width:200px;height:200px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:conic-gradient(var(--anchoran-accent,#5B8DEF) calc(var(--progress,0) * 360deg), var(--anchoran-border,#2a2c33) 0);}
.pom-time{width:170px;height:170px;border-radius:50%;background:var(--anchoran-bg,#141519);display:flex;align-items:center;justify-content:center;font-size:34px;font-variant-numeric:tabular-nums;}
.pom-controls{display:flex;gap:8px;}
.pom-cycles{font-size:12.5px;color:var(--anchoran-text-secondary,#9aa0ab);}
`;

const DURATIONS = { focus: 25 * 60, short: 5 * 60, long: 15 * 60 };
const LABELS = { focus: "Focus", short: "Short break", long: "Long break" };

export function mount(container, sdk) {
  injectStyle("pomodoro", CSS);
  const { React, ReactDOM, Icon } = sdk;
  const { createElement: h, useState, useRef, useEffect } = React;

  function App() {
    const [mode, setMode] = useState("focus");
    const [secondsLeft, setSecondsLeft] = useState(DURATIONS.focus);
    const [running, setRunning] = useState(false);
    const [cycles, setCycles] = useState(0);
    const intervalRef = useRef(null);

    useEffect(() => {
      if (!running) return;
      intervalRef.current = window.setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            window.clearInterval(intervalRef.current);
            setRunning(false);
            if (mode === "focus") setCycles((c) => c + 1);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
      return () => {
        if (intervalRef.current) window.clearInterval(intervalRef.current);
      };
    }, [running, mode]);

    function switchMode(next) {
      setMode(next);
      setRunning(false);
      setSecondsLeft(DURATIONS[next]);
    }

    function reset() {
      setRunning(false);
      setSecondsLeft(DURATIONS[mode]);
    }

    const mins = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
    const secs = String(secondsLeft % 60).padStart(2, "0");
    const progress = 1 - secondsLeft / DURATIONS[mode];

    return h(
      "div",
      { className: "pk-root" },
      h(
        "div",
        { className: "pk-toolbar" },
        Object.keys(LABELS).map((m) =>
          h("button", { key: m, className: "pk-btn", "data-active": mode === m, onClick: () => switchMode(m) }, LABELS[m])
        )
      ),
      h(
        "div",
        { className: "pk-content pom-content" },
        h(
          "div",
          { className: "pom-ring", style: { "--progress": progress } },
          h("div", { className: "pom-time" }, `${mins}:${secs}`)
        ),
        h(
          "div",
          { className: "pom-controls" },
          h("button", { className: "pk-btn", onClick: () => setRunning((r) => !r) }, running ? "Pause" : "Start"),
          h("button", { className: "pk-btn", onClick: reset }, Icon ? h(Icon, { name: "restart", size: 14 }) : null, " Reset")
        ),
        h("div", { className: "pom-cycles" }, `${cycles} focus session${cycles === 1 ? "" : "s"} completed`)
      )
    );
  }

  const root = ReactDOM.createRoot(container);
  root.render(h(App));
  return () => root.unmount();
}
