/**
 * Typing Test — ported from Anchoran OS's bundled "typingtest" app
 * (same sample set and WPM/accuracy formulas). New for this
 * migration: your best WPM and last 10 results persist across
 * sessions and show as a small history/best-score row.
 */
import { injectStyle, SHELL_CSS, pluginStorage } from "../../_shared/pluginKit.js";

const CSS =
  SHELL_CSS +
  `
.tt-stats{margin-left:auto;font-size:12.5px;color:var(--anchoran-text-secondary,#9aa0ab);}
.tt-content{display:flex;flex-direction:column;gap:14px;}
.tt-sample{font-size:15px;line-height:1.7;font-family:"Cascadia Code",Consolas,monospace;}
.tt-char[data-state="correct"]{color:var(--anchoran-accent,#5B8DEF);}
.tt-char[data-state="wrong"]{color:#E5484D;text-decoration:underline;}
.tt-char[data-state="pending"]{color:var(--anchoran-text-secondary,#9aa0ab);}
.tt-input{width:100%;resize:vertical;background:var(--anchoran-surface,#1c1d22);border:1px solid var(--anchoran-border,#2a2c33);border-radius:8px;color:var(--anchoran-text-primary,#F3F4F6);padding:8px;font:inherit;}
.tt-result{font-size:13.5px;color:var(--anchoran-accent,#5B8DEF);}
.tt-history{font-size:11.5px;color:var(--anchoran-text-secondary,#9aa0ab);}
`;

const SAMPLES = [
  "The quick brown fox jumps over the lazy dog while the sun sets behind the hills.",
  "Anchoran keeps every window, file and setting exactly where you left them.",
  "Typing quickly and accurately is a skill that improves with steady practice.",
  "A calm mind and a light touch on the keyboard will get you further than speed alone.",
  "Small consistent habits compound into results that feel impossible at the start.",
];

function pickSample() {
  return SAMPLES[Math.floor(Math.random() * SAMPLES.length)];
}

export function mount(container, sdk) {
  injectStyle("typingtest", CSS);
  const store = pluginStorage("typingtest");
  const { React, ReactDOM, Icon } = sdk;
  const { createElement: h, useState, useEffect, useRef } = React;

  function App() {
    const [sample, setSample] = useState(pickSample);
    const [input, setInput] = useState("");
    const [startedAt, setStartedAt] = useState(null);
    const [finishedAt, setFinishedAt] = useState(null);
    const [history, setHistory] = useState(() => store.get("history", []));
    const inputRef = useRef(null);

    useEffect(() => {
      inputRef.current?.focus();
    }, [sample]);

    function onChange(value) {
      if (finishedAt) return;
      if (!startedAt && value.length > 0) setStartedAt(Date.now());
      setInput(value);
      if (value === sample) setFinishedAt(Date.now());
    }

    function restart() {
      setSample(pickSample());
      setInput("");
      setStartedAt(null);
      setFinishedAt(null);
    }

    const elapsedMinutes = startedAt ? ((finishedAt ?? Date.now()) - startedAt) / 60000 : 0;
    const wordsTyped = input.trim().length > 0 ? input.trim().split(/\s+/).length : 0;
    const wpm = elapsedMinutes > 0 ? Math.round(wordsTyped / elapsedMinutes) : 0;
    let correctChars = 0;
    for (let i = 0; i < input.length; i++) if (input[i] === sample[i]) correctChars++;
    const accuracy = input.length > 0 ? Math.round((correctChars / input.length) * 100) : 100;

    useEffect(() => {
      if (!finishedAt) return;
      const next = [{ wpm, accuracy, at: finishedAt }, ...history].slice(0, 10);
      setHistory(next);
      store.set("history", next);
      // eslint-disable-next-line
    }, [finishedAt]);

    const best = history.reduce((m, h2) => Math.max(m, h2.wpm), 0);

    return h(
      "div",
      { className: "pk-root" },
      h(
        "div",
        { className: "pk-toolbar" },
        h("button", { className: "pk-btn", onClick: restart }, Icon ? h(Icon, { name: "restart", size: 14 }) : null, " New text"),
        h("div", { className: "tt-stats" }, finishedAt ? `${wpm} WPM · ${accuracy}% accuracy` : startedAt ? "Typing…" : `Start typing to begin${best ? ` · Best: ${best} WPM` : ""}`)
      ),
      h(
        "div",
        { className: "pk-content tt-content" },
        h("div", { className: "tt-sample" }, sample.split("").map((ch, i) => {
          const typed = input[i];
          const state = typed === undefined ? "pending" : typed === ch ? "correct" : "wrong";
          return h("span", { key: i, className: "tt-char", "data-state": state }, ch);
        })),
        h("textarea", { ref: inputRef, className: "tt-input", value: input, onChange: (e) => onChange(e.target.value), placeholder: "Start typing the text above…", rows: 3, disabled: !!finishedAt }),
        finishedAt && h("div", { className: "tt-result" }, `Done! ${wpm} words per minute, ${accuracy}% accuracy.`),
        history.length > 0 && h("div", { className: "tt-history" }, "Recent: " + history.slice(0, 5).map((h2) => `${h2.wpm}wpm`).join(", "))
      )
    );
  }

  const root = ReactDOM.createRoot(container);
  root.render(h(App));
  return () => root.unmount();
}
