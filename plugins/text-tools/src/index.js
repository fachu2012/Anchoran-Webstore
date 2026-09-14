/**
 * Text Tools — fuses three former Anchoran OS bundled apps that were
 * all single-purpose text utilities: "jsonformatter" (JsonFormatter.tsx),
 * "wordcounter" (WordCounter.tsx) and "textdiff" (TextDiff.tsx, plus
 * its diff.ts LCS line-diff engine, ported verbatim). Same reasoning
 * as Chance/Converter: near-identical purpose (paste text, transform
 * or measure it), so one plugin with a tab switch beats three almost-
 * identical windows. New for this migration: a fourth tab, Encode/
 * Decode (Base64 and URL-encoding, both ways) — a small, genuinely
 * common "paste text, transform it" need that fits this app's exact
 * purpose and was cheap to add well.
 */
import { injectStyle, SHELL_CSS } from "../../_shared/pluginKit.js";

const CSS =
  SHELL_CSS +
  `
.tx-content{display:flex;flex-direction:column;gap:10px;height:100%;}
.tx-panes{display:flex;gap:10px;flex:1;min-height:0;}
.tx-pane{flex:1;display:flex;flex-direction:column;gap:4px;min-width:0;}
.tx-pane-label{font-size:11px;color:var(--anchoran-text-secondary,#9aa0ab);text-transform:uppercase;letter-spacing:.04em;}
.tx-textarea{flex:1;resize:none;background:var(--anchoran-surface,#1c1d22);border:1px solid var(--anchoran-border,#2a2c33);border-radius:8px;color:var(--anchoran-text-primary,#F3F4F6);padding:10px;font:12.5px "Cascadia Code",Consolas,monospace;}
.tx-error{flex:1;color:#E5484D;font-size:12.5px;padding:10px;white-space:pre-wrap;}
.tx-stats{display:flex;flex-wrap:wrap;gap:16px;justify-content:center;padding:10px 0;}
.tx-stat{display:flex;flex-direction:column;align-items:center;gap:2px;}
.tx-stat-value{font-size:22px;}
.tx-stat-label{font-size:11px;color:var(--anchoran-text-secondary,#9aa0ab);}
.tx-diff-result{flex:1;overflow:auto;font-family:"Cascadia Code",Consolas,monospace;font-size:12px;}
.tx-diff-line{display:flex;gap:8px;padding:1px 4px;white-space:pre-wrap;}
.tx-diff-line[data-op="add"]{background:rgba(48,164,108,.15);color:#30A46C;}
.tx-diff-line[data-op="remove"]{background:rgba(229,72,77,.15);color:#E5484D;}
.tx-diff-marker{width:12px;flex-shrink:0;opacity:.7;}
`;

// ---- JSON formatter ----
function JsonPanel({ h, useState, Icon }) {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  function format(indent) {
    if (!input.trim()) { setOutput(""); setError(null); return; }
    try {
      const parsed = JSON.parse(input);
      setOutput(indent === null ? JSON.stringify(parsed) : JSON.stringify(parsed, null, indent));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid JSON");
      setOutput("");
    }
  }

  function copy() {
    if (!output) return;
    navigator.clipboard?.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  return h(
    React.Fragment,
    null,
    h(
      "div",
      { className: "pk-toolbar" },
      h("button", { className: "pk-btn", onClick: () => format(2) }, "Format"),
      h("button", { className: "pk-btn", onClick: () => format(null) }, "Minify"),
      h("button", { className: "pk-btn", onClick: copy, disabled: !output }, Icon ? h(Icon, { name: "copy", size: 14 }) : null, " ", copied ? "Copied" : "Copy")
    ),
    h(
      "div",
      { className: "pk-content tx-content" },
      h(
        "div",
        { className: "tx-panes" },
        h("div", { className: "tx-pane" }, h("div", { className: "tx-pane-label" }, "Input"), h("textarea", { className: "tx-textarea", value: input, onChange: (e) => setInput(e.target.value), placeholder: "Paste JSON here…", spellCheck: false })),
        h(
          "div",
          { className: "tx-pane" },
          h("div", { className: "tx-pane-label" }, "Output"),
          error ? h("div", { className: "tx-error" }, error) : h("textarea", { className: "tx-textarea", value: output, readOnly: true, spellCheck: false })
        )
      )
    )
  );
}

// ---- Word counter ----
const WORDS_PER_MINUTE = 200;
function WordPanel({ h, useState, useMemo }) {
  const [text, setText] = useState("");
  const stats = useMemo(() => {
    const trimmed = text.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    const characters = text.length;
    const charactersNoSpaces = text.replace(/\s/g, "").length;
    const sentences = trimmed ? (trimmed.match(/[.!?]+(\s|$)/g) || []).length || (trimmed ? 1 : 0) : 0;
    const paragraphs = trimmed ? trimmed.split(/\n+/).filter((p) => p.trim().length > 0).length : 0;
    const readingTime = Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
    return { words, characters, charactersNoSpaces, sentences, paragraphs, readingTime };
  }, [text]);

  return h(
    "div",
    { className: "pk-content tx-content" },
    h("textarea", { className: "tx-textarea", value: text, onChange: (e) => setText(e.target.value), placeholder: "Start typing or paste your text…", style: { flex: 2 } }),
    h(
      "div",
      { className: "tx-stats" },
      [
        ["words", "Words"], ["characters", "Characters"], ["charactersNoSpaces", "No spaces"],
        ["sentences", "Sentences"], ["paragraphs", "Paragraphs"],
      ].map(([key, label]) => h("div", { key, className: "tx-stat" }, h("span", { className: "tx-stat-value" }, stats[key]), h("span", { className: "tx-stat-label" }, label))),
      h("div", { className: "tx-stat" }, h("span", { className: "tx-stat-value" }, `${stats.readingTime}m`), h("span", { className: "tx-stat-label" }, "Reading time"))
    )
  );
}

// ---- Text diff ----
function diffLines(a, b) {
  const linesA = a.split("\n");
  const linesB = b.split("\n");
  const n = linesA.length, m = linesB.length;
  const lcs = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) lcs[i][j] = linesA[i] === linesB[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const result = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (linesA[i] === linesB[j]) { result.push({ op: "equal", text: linesA[i] }); i++; j++; }
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) { result.push({ op: "remove", text: linesA[i] }); i++; }
    else { result.push({ op: "add", text: linesB[j] }); j++; }
  }
  while (i < n) { result.push({ op: "remove", text: linesA[i] }); i++; }
  while (j < m) { result.push({ op: "add", text: linesB[j] }); j++; }
  return result;
}

function DiffPanel({ h, useState, useMemo }) {
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const [showDiff, setShowDiff] = useState(false);
  const diff = useMemo(() => (showDiff ? diffLines(left, right) : []), [showDiff, left, right]);
  const added = diff.filter((d) => d.op === "add").length;
  const removed = diff.filter((d) => d.op === "remove").length;

  return h(
    React.Fragment,
    null,
    h(
      "div",
      { className: "pk-toolbar" },
      h("button", { className: "pk-btn", onClick: () => setShowDiff(true) }, "Compare"),
      showDiff && h("button", { className: "pk-btn", onClick: () => setShowDiff(false) }, "Edit"),
      showDiff && h("span", { style: { fontSize: 12, color: "var(--anchoran-text-secondary,#9aa0ab)" } }, `+${added} / -${removed}`)
    ),
    h(
      "div",
      { className: "pk-content tx-content" },
      !showDiff
        ? h(
            "div",
            { className: "tx-panes" },
            h("textarea", { className: "tx-textarea", placeholder: "Original text…", value: left, onChange: (e) => setLeft(e.target.value) }),
            h("textarea", { className: "tx-textarea", placeholder: "Changed text…", value: right, onChange: (e) => setRight(e.target.value) })
          )
        : h(
            "div",
            { className: "tx-diff-result" },
            diff.map((line, idx) => h("div", { key: idx, className: "tx-diff-line", "data-op": line.op }, h("span", { className: "tx-diff-marker" }, line.op === "add" ? "+" : line.op === "remove" ? "-" : " "), h("span", null, line.text || " ")))
          )
    )
  );
}

// ---- Encode/Decode (new) ----
function EncodePanel({ h, useState }) {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState("base64-encode");
  const [error, setError] = useState(null);
  const [result, setResult] = useState("");
  function handleRun() {
    setError(null);
    try {
      let out = "";
      if (mode === "base64-encode") out = btoa(unescape(encodeURIComponent(input)));
      else if (mode === "base64-decode") out = decodeURIComponent(escape(atob(input)));
      else if (mode === "url-encode") out = encodeURIComponent(input);
      else out = decodeURIComponent(input);
      setResult(out);
    } catch {
      setError("Couldn't decode — input isn't valid for this format.");
      setResult("");
    }
  }

  return h(
    React.Fragment,
    null,
    h(
      "div",
      { className: "pk-toolbar" },
      h(
        "select",
        { className: "pk-input", value: mode, onChange: (e) => setMode(e.target.value) },
        h("option", { value: "base64-encode" }, "Base64: Encode"),
        h("option", { value: "base64-decode" }, "Base64: Decode"),
        h("option", { value: "url-encode" }, "URL: Encode"),
        h("option", { value: "url-decode" }, "URL: Decode")
      ),
      h("button", { className: "pk-btn", onClick: handleRun }, "Convert")
    ),
    h(
      "div",
      { className: "pk-content tx-content" },
      h(
        "div",
        { className: "tx-panes" },
        h("div", { className: "tx-pane" }, h("div", { className: "tx-pane-label" }, "Input"), h("textarea", { className: "tx-textarea", value: input, onChange: (e) => setInput(e.target.value) })),
        h("div", { className: "tx-pane" }, h("div", { className: "tx-pane-label" }, "Output"), error ? h("div", { className: "tx-error" }, error) : h("textarea", { className: "tx-textarea", value: result, readOnly: true }))
      )
    )
  );
}

let React;

export function mount(container, sdk) {
  injectStyle("text-tools", CSS);
  React = sdk.React;
  const { ReactDOM, Icon } = sdk;
  const { createElement: h, useState, useMemo } = React;

  function App() {
    const [tab, setTab] = useState("json");
    const panels = {
      json: () => h(JsonPanel, { h, useState, Icon }),
      words: () => h(WordPanel, { h, useState, useMemo }),
      diff: () => h(DiffPanel, { h, useState, useMemo }),
      encode: () => h(EncodePanel, { h, useState }),
    };
    return h(
      "div",
      { className: "pk-root" },
      h(
        "div",
        { className: "pk-toolbar", style: { borderBottom: "1px solid var(--anchoran-border,#2a2c33)" } },
        h("button", { className: "pk-btn", "data-active": tab === "json", onClick: () => setTab("json") }, "JSON Formatter"),
        h("button", { className: "pk-btn", "data-active": tab === "words", onClick: () => setTab("words") }, "Word Counter"),
        h("button", { className: "pk-btn", "data-active": tab === "diff", onClick: () => setTab("diff") }, "Text Diff"),
        h("button", { className: "pk-btn", "data-active": tab === "encode", onClick: () => setTab("encode") }, "Encode/Decode")
      ),
      panels[tab]()
    );
  }

  const root = ReactDOM.createRoot(container);
  root.render(h(App));
  return () => root.unmount();
}
