/**
 * Emoji Picker — ported from Anchoran OS's bundled "emojipicker" app
 * (same curated emoji set from emojiData.ts, copied verbatim). New for
 * this migration: a search box (filters by category name — the plain
 * emoji set has no keyword metadata, so this is a reasonable, honest
 * scope for search) and a persisted "Recently used" row.
 */
import { injectStyle, SHELL_CSS, pluginStorage } from "../../_shared/pluginKit.js";

const CSS =
  SHELL_CSS +
  `
.ep-copied{margin-left:auto;font-size:12px;color:var(--anchoran-accent,#5B8DEF);}
.ep-search{margin-bottom:10px;width:100%;}
.ep-section{margin-bottom:14px;}
.ep-section-title{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--anchoran-text-secondary,#9aa0ab);margin-bottom:6px;}
.ep-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(36px,1fr));gap:2px;}
.ep-btn{background:transparent;border:none;font-size:20px;padding:6px;border-radius:6px;cursor:pointer;}
.ep-btn:hover{background:var(--anchoran-border,#2a2c33);}
`;

const EMOJI_CATEGORIES = [
  { label: "Smileys", emoji: ["😀", "😁", "😂", "🤣", "😊", "😍", "😘", "😜", "🤔", "😎", "🙂", "🙃", "😉", "😢", "😭", "😡", "😱", "🥳", "🤯", "🥺", "😴", "🤒", "🤗", "😇"] },
  { label: "Gestures & People", emoji: ["👍", "👎", "👌", "✌️", "🤞", "👏", "🙌", "🙏", "💪", "👋", "🤝", "👀", "🧠", "💀", "👶", "🧑", "👨", "👩", "🧓", "🕺", "💃"] },
  { label: "Animals & Nature", emoji: ["🐶", "🐱", "🐭", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐸", "🐵", "🐔", "🐦", "🐟", "🐢", "🌵", "🌲", "🌸", "🌞", "🌙", "⭐", "🔥", "❄️"] },
  { label: "Food & Drink", emoji: ["🍎", "🍌", "🍕", "🍔", "🍟", "🌮", "🍣", "🍩", "🍰", "🍫", "☕", "🍺", "🍷", "🥤", "🍿", "🥑", "🍉", "🍇"] },
  { label: "Activities & Objects", emoji: ["⚽", "🏀", "🎮", "🎧", "🎸", "🎨", "📷", "💡", "📱", "💻", "⌚", "🔑", "🔒", "📦", "✉️", "📅", "📌", "🔍", "🛠️", "💰"] },
  { label: "Symbols", emoji: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💯", "✅", "❌", "⚡", "⚠️", "❓", "❗", "♻️", "🔁", "🎉", "✨", "🚀"] },
];

export function mount(container, sdk) {
  injectStyle("emojipicker", CSS);
  const store = pluginStorage("emojipicker");
  const { React, ReactDOM } = sdk;
  const { createElement: h, useState } = React;

  function App() {
    const [copied, setCopied] = useState(null);
    const [query, setQuery] = useState("");
    const [recent, setRecent] = useState(() => store.get("recent", []));

    function copy(emoji) {
      navigator.clipboard?.writeText(emoji);
      setCopied(emoji);
      setTimeout(() => setCopied((c) => (c === emoji ? null : c)), 1000);
      const next = [emoji, ...recent.filter((e) => e !== emoji)].slice(0, 16);
      setRecent(next);
      store.set("recent", next);
    }

    const q = query.trim().toLowerCase();
    const categories = q ? EMOJI_CATEGORIES.filter((c) => c.label.toLowerCase().includes(q)) : EMOJI_CATEGORIES;

    return h(
      "div",
      { className: "pk-root" },
      h(
        "div",
        { className: "pk-toolbar" },
        h("span", { style: { fontSize: 12.5, color: "var(--anchoran-text-secondary,#9aa0ab)" } }, "Click an emoji to copy it"),
        copied && h("span", { className: "ep-copied" }, `Copied ${copied}`)
      ),
      h(
        "div",
        { className: "pk-content" },
        h("input", { className: "pk-input ep-search", placeholder: "Filter by category…", value: query, onChange: (e) => setQuery(e.target.value) }),
        recent.length > 0 &&
          !q &&
          h(
            "div",
            { className: "ep-section" },
            h("div", { className: "ep-section-title" }, "Recently used"),
            h("div", { className: "ep-grid" }, recent.map((e) => h("button", { key: "r" + e, className: "ep-btn", onClick: () => copy(e), title: e }, e)))
          ),
        categories.map((cat) =>
          h(
            "div",
            { key: cat.label, className: "ep-section" },
            h("div", { className: "ep-section-title" }, cat.label),
            h("div", { className: "ep-grid" }, cat.emoji.map((e) => h("button", { key: e, className: "ep-btn", onClick: () => copy(e), title: e }, e)))
          )
        )
      )
    );
  }

  const root = ReactDOM.createRoot(container);
  root.render(h(App));
  return () => root.unmount();
}
