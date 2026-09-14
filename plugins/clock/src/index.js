/**
 * Clock — ported from Anchoran OS's bundled "clock" app (World Clock /
 * Stopwatch / Timer). All three tabs' logic is preserved (rAF-driven
 * stopwatch, lap list, countdown timer with a completion notification
 * via sdk.pushNotification instead of the internal notification store).
 * New for this migration: the world-clock list is now editable (add
 * any IANA timezone by name, remove any you added) instead of a fixed
 * 5-city list, and the timer remembers your last-used duration.
 */
import { injectStyle, SHELL_CSS, pluginStorage } from "../../_shared/pluginKit.js";

const CSS =
  SHELL_CSS +
  `
.cl-world-list{display:flex;flex-direction:column;gap:2px;}
.cl-world-row{display:flex;align-items:center;justify-content:space-between;padding:8px 4px;border-bottom:1px solid var(--anchoran-border,#2a2c33);}
.cl-world-time{font-variant-numeric:tabular-nums;font-size:15px;}
.cl-world-remove{background:transparent;border:none;color:var(--anchoran-text-secondary,#9aa0ab);cursor:pointer;font-size:11px;}
.cl-add-row{display:flex;gap:6px;margin-top:10px;}
.cl-stopwatch,.cl-timer{display:flex;flex-direction:column;align-items:center;gap:14px;}
.cl-display{font-size:36px;font-variant-numeric:tabular-nums;}
.cl-controls{display:flex;gap:8px;}
.cl-laps{width:100%;max-width:260px;max-height:140px;overflow-y:auto;}
.cl-lap-row{display:flex;justify-content:space-between;font-size:12.5px;padding:3px 4px;color:var(--anchoran-text-secondary,#9aa0ab);}
.cl-timer-input{width:60px;}
`;

const DEFAULT_ZONES = [
  { label: "Local", zone: undefined },
  { label: "New York", zone: "America/New_York" },
  { label: "London", zone: "Europe/London" },
  { label: "Tokyo", zone: "Asia/Tokyo" },
  { label: "Buenos Aires", zone: "America/Argentina/Buenos_Aires" },
];

function formatElapsed(ms) {
  const totalCs = Math.floor(ms / 10);
  const cs = totalCs % 100;
  const totalSeconds = Math.floor(totalCs / 100);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

export function mount(container, sdk) {
  injectStyle("clock", CSS);
  const store = pluginStorage("clock");
  const { React, ReactDOM, Icon } = sdk;
  const { createElement: h, useState, useEffect, useRef } = React;

  function WorldClockTab() {
    const [now, setNow] = useState(new Date());
    const [zones, setZones] = useState(() => store.get("zones", DEFAULT_ZONES));
    const [newZone, setNewZone] = useState("");

    useEffect(() => {
      const t = setInterval(() => setNow(new Date()), 1000);
      return () => clearInterval(t);
    }, []);

    function addZone() {
      const label = newZone.trim();
      if (!label) return;
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: label }).format(new Date());
      } catch {
        sdk.pushNotification("World Clock", `"${label}" isn't a recognized timezone (try e.g. "Europe/Paris").`);
        return;
      }
      const next = [...zones, { label, zone: label }];
      setZones(next);
      store.set("zones", next);
      setNewZone("");
    }

    function removeZone(i) {
      const next = zones.filter((_, idx) => idx !== i);
      setZones(next);
      store.set("zones", next);
    }

    return h(
      "div",
      null,
      h(
        "div",
        { className: "cl-world-list" },
        zones.map((c, i) =>
          h(
            "div",
            { key: `${c.label}-${i}`, className: "cl-world-row" },
            h("span", null, c.label),
            h(
              "span",
              { style: { display: "flex", alignItems: "center", gap: 10 } },
              h("span", { className: "cl-world-time" }, now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: c.zone })),
              i >= DEFAULT_ZONES.length && h("button", { className: "cl-world-remove", onClick: () => removeZone(i) }, "Remove")
            )
          )
        )
      ),
      h(
        "div",
        { className: "cl-add-row" },
        h("input", {
          className: "pk-input",
          placeholder: "Add a timezone (e.g. Europe/Paris)",
          value: newZone,
          onChange: (e) => setNewZone(e.target.value),
          onKeyDown: (e) => e.key === "Enter" && addZone(),
          style: { flex: 1 },
        }),
        h("button", { className: "pk-btn", onClick: addZone }, "Add")
      )
    );
  }

  function StopwatchTab() {
    const [elapsed, setElapsed] = useState(0);
    const [running, setRunning] = useState(false);
    const [laps, setLaps] = useState([]);
    const startRef = useRef(0);
    const rafRef = useRef(0);

    useEffect(() => {
      if (!running) return;
      startRef.current = performance.now() - elapsed;
      function tick() {
        setElapsed(performance.now() - startRef.current);
        rafRef.current = requestAnimationFrame(tick);
      }
      rafRef.current = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(rafRef.current);
      // eslint-disable-next-line
    }, [running]);

    return h(
      "div",
      { className: "cl-stopwatch" },
      h("div", { className: "cl-display" }, formatElapsed(elapsed)),
      h(
        "div",
        { className: "cl-controls" },
        h("button", { className: "pk-btn", onClick: () => setRunning((r) => !r) }, running ? "Stop" : "Start"),
        h(
          "button",
          {
            className: "pk-btn",
            onClick: () => {
              if (running) setLaps((l) => [elapsed, ...l]);
              else { setElapsed(0); setLaps([]); }
            },
          },
          running ? "Lap" : "Reset"
        )
      ),
      laps.length > 0 &&
        h(
          "div",
          { className: "cl-laps" },
          laps.map((lap, i) => h("div", { key: i, className: "cl-lap-row" }, h("span", null, `Lap ${laps.length - i}`), h("span", null, formatElapsed(lap))))
        )
    );
  }

  function TimerTab() {
    const [minutesInput, setMinutesInput] = useState(() => store.get("lastMinutes", 5));
    const [remainingMs, setRemainingMs] = useState(null);
    const endRef = useRef(0);

    useEffect(() => {
      if (remainingMs === null) return;
      if (remainingMs <= 0) {
        sdk.pushNotification("Timer", "Time's up.");
        setRemainingMs(null);
        return;
      }
      const t = setTimeout(() => setRemainingMs(Math.max(0, endRef.current - Date.now())), 250);
      return () => clearTimeout(t);
    }, [remainingMs]);

    function start() {
      store.set("lastMinutes", minutesInput);
      endRef.current = Date.now() + minutesInput * 60_000;
      setRemainingMs(minutesInput * 60_000);
    }

    const displaySeconds = remainingMs !== null ? Math.ceil(remainingMs / 1000) : minutesInput * 60;
    const mm = Math.floor(displaySeconds / 60);
    const ss = displaySeconds % 60;

    return h(
      "div",
      { className: "cl-timer" },
      h("div", { className: "cl-display" }, `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`),
      remainingMs === null
        ? h(
            "div",
            { className: "cl-controls" },
            h("input", {
              type: "number",
              min: 1,
              max: 180,
              value: minutesInput,
              className: "pk-input cl-timer-input",
              onChange: (e) => setMinutesInput(Math.max(1, Number(e.target.value))),
            }),
            h("span", { style: { fontSize: 12.5, alignSelf: "center", color: "var(--anchoran-text-secondary,#9aa0ab)" } }, "minutes"),
            h("button", { className: "pk-btn", onClick: start }, Icon ? h(Icon, { name: "clock", size: 14 }) : null, " Start")
          )
        : h("button", { className: "pk-btn", onClick: () => setRemainingMs(null) }, "Cancel")
    );
  }

  function App() {
    const [tab, setTab] = useState("world");
    return h(
      "div",
      { className: "pk-root" },
      h(
        "div",
        { className: "pk-toolbar" },
        ["world", "stopwatch", "timer"].map((t) =>
          h("button", { key: t, className: "pk-btn", "data-active": tab === t, onClick: () => setTab(t) }, t === "world" ? "World Clock" : t === "stopwatch" ? "Stopwatch" : "Timer")
        )
      ),
      h("div", { className: "pk-content" }, tab === "world" ? h(WorldClockTab) : tab === "stopwatch" ? h(StopwatchTab) : h(TimerTab))
    );
  }

  const root = ReactDOM.createRoot(container);
  root.render(h(App));
  return () => root.unmount();
}
