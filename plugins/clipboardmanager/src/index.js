/**
 * Clipboard Shelf — ported from Anchoran OS's bundled "clipboardmanager"
 * app, ADAPTED for the plugin sandbox: the original watched every copy
 * made anywhere in the OS via an internal, privileged clipboard-history
 * store fed by Anchoran's own main process — a plugin has no such
 * system-wide hook (the SDK exposes no clipboard-watching API, and
 * genuinely can't without a privileged OS integration the App SDK
 * intentionally doesn't grant third-party code). Instead, this plugin
 * is a manual clipboard shelf: paste or type something and click Save
 * to keep it, search/re-copy/delete saved entries — a real, honest
 * utility on its own, persisted in this plugin's own storage.
 */
import { injectStyle, SHELL_CSS, pluginStorage } from "../../_shared/pluginKit.js";

const CSS =
  SHELL_CSS +
  `
.cm-search{flex:1;max-width:220px;}
.cm-count{font-size:12.5px;color:var(--anchoran-text-secondary,#9aa0ab);}
.cm-add-row{display:flex;gap:6px;margin-bottom:10px;}
.cm-row{display:flex;flex-direction:column;gap:4px;padding:10px;border:1px solid var(--anchoran-border,#2a2c33);border-radius:8px;margin-bottom:6px;cursor:pointer;}
.cm-row:hover{background:var(--anchoran-border,#2a2c33);}
.cm-row-text{font-size:12.5px;white-space:pre-wrap;word-break:break-word;max-height:60px;overflow:hidden;}
.cm-row-meta{display:flex;align-items:center;gap:8px;font-size:11px;color:var(--anchoran-text-secondary,#9aa0ab);}
.cm-copied{color:var(--anchoran-accent,#5B8DEF);}
.cm-remove{margin-left:auto;background:transparent;border:none;color:var(--anchoran-text-secondary,#9aa0ab);cursor:pointer;}
.cm-empty{color:var(--anchoran-text-secondary,#9aa0ab);font-size:12.5px;padding:12px;}
`;

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function mount(container, sdk) {
  injectStyle("clipboardmanager", CSS);
  const store = pluginStorage("clipboardmanager");
  const { React, ReactDOM, Icon } = sdk;
  const { createElement: h, useState } = React;

  function App() {
    const [entries, setEntries] = useState(() => store.get("entries", []));
    const [draft, setDraft] = useState("");
    const [copiedId, setCopiedId] = useState(null);
    const [query, setQuery] = useState("");

    function persist(next) {
      setEntries(next);
      store.set("entries", next);
    }

    async function addFromClipboard() {
      try {
        const text = draft.trim() || (await navigator.clipboard?.readText())?.trim();
        if (!text) return;
        persist([{ id: `${Date.now()}`, text, copiedAt: Date.now() }, ...entries].slice(0, 100));
        setDraft("");
      } catch {
        if (draft.trim()) {
          persist([{ id: `${Date.now()}`, text: draft.trim(), copiedAt: Date.now() }, ...entries].slice(0, 100));
          setDraft("");
        }
      }
    }

    function copyBack(id, text) {
      navigator.clipboard?.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1200);
    }

    function remove(id) {
      persist(entries.filter((e) => e.id !== id));
    }

    const filtered = query.trim() ? entries.filter((e) => e.text.toLowerCase().includes(query.trim().toLowerCase())) : entries;

    return h(
      "div",
      { className: "pk-root" },
      h(
        "div",
        { className: "pk-toolbar" },
        h("input", { className: "pk-input cm-search", value: query, onChange: (e) => setQuery(e.target.value), placeholder: "Search saved clips…" }),
        h("span", { className: "cm-count" }, `${filtered.length} item${filtered.length === 1 ? "" : "s"}`),
        entries.length > 0 && h("button", { className: "pk-btn", onClick: () => persist([]), style: { marginLeft: "auto" } }, "Clear all")
      ),
      h(
        "div",
        { className: "pk-content" },
        h(
          "div",
          { className: "cm-add-row" },
          h("input", { className: "pk-input", style: { flex: 1 }, placeholder: "Type or paste text, or leave blank to save what's already on the clipboard…", value: draft, onChange: (e) => setDraft(e.target.value), onKeyDown: (e) => e.key === "Enter" && addFromClipboard() }),
          h("button", { className: "pk-btn", onClick: addFromClipboard }, Icon ? h(Icon, { name: "plus", size: 14 }) : null, " Save")
        ),
        entries.length === 0
          ? h("div", { className: "cm-empty" }, "Nothing saved yet — type or paste something above and click Save.")
          : filtered.length === 0
          ? h("div", { className: "cm-empty" }, `No matches for "${query}".`)
          : filtered.map((e) =>
              h(
                "div",
                { key: e.id, className: "cm-row", onClick: () => copyBack(e.id, e.text) },
                h("div", { className: "cm-row-text" }, e.text),
                h(
                  "div",
                  { className: "cm-row-meta" },
                  h("span", null, formatTime(e.copiedAt)),
                  copiedId === e.id && h("span", { className: "cm-copied" }, "Copied"),
                  h("button", { className: "cm-remove", onClick: (ev) => { ev.stopPropagation(); remove(e.id); }, "aria-label": "Delete" }, Icon ? h(Icon, { name: "close", size: 12 }) : "×")
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
