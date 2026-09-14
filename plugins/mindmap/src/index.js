/**
 * Mind Map — ported from Anchoran OS's bundled "mindmap" app (same
 * pointer-drag node positioning and parent/child tree). New for this
 * migration: Export/Import as JSON (download-free — copies the map's
 * JSON to the clipboard / reads it back from a paste) so a map can be
 * backed up or moved between devices, and a "Recenter" button.
 */
import { injectStyle, SHELL_CSS, pluginStorage } from "../../_shared/pluginKit.js";

const CSS =
  SHELL_CSS +
  `
.mm-canvas{position:relative;height:100%;overflow:auto;}
.mm-lines{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible;}
.mm-node{position:absolute;transform:translate(-50%,-50%);display:flex;align-items:center;gap:6px;background:var(--anchoran-surface,#1c1d22);border:1px solid var(--anchoran-border,#2a2c33);border-radius:16px;padding:6px 12px;font-size:12.5px;cursor:grab;user-select:none;}
.mm-node[data-root="true"]{background:var(--anchoran-accent-soft,rgba(91,141,239,.15));border-color:var(--anchoran-accent,#5B8DEF);font-weight:600;}
.mm-node input{background:transparent;border:none;outline:1px solid var(--anchoran-accent,#5B8DEF);color:inherit;font:inherit;width:100px;}
.mm-node-actions{display:flex;gap:2px;}
.mm-node-actions button{background:transparent;border:none;color:var(--anchoran-text-secondary,#9aa0ab);cursor:pointer;padding:2px;}
`;

const STORAGE_KEY = "mindMap";
const ROOT = { id: "root", text: "Central idea", x: 320, y: 220, parentId: null };

export function mount(container, sdk) {
  injectStyle("mindmap", CSS);
  const store = pluginStorage("mindmap");
  const { React, ReactDOM, Icon } = sdk;
  const { createElement: h, useState, useRef } = React;

  function App() {
    const [nodes, setNodes] = useState(() => store.get(STORAGE_KEY, [ROOT]));
    const [editingId, setEditingId] = useState(null);
    const dragRef = useRef(null);

    function save(next) {
      setNodes(next);
      store.set(STORAGE_KEY, next);
    }

    function addChild(parentId) {
      const parent = nodes.find((n) => n.id === parentId);
      if (!parent) return;
      const angle = Math.random() * Math.PI * 2;
      const id = `${Date.now()}`;
      save([...nodes, { id, text: "New idea", x: parent.x + Math.cos(angle) * 140, y: parent.y + Math.sin(angle) * 100, parentId }]);
      setEditingId(id);
    }

    function removeNode(id) {
      if (id === "root") return;
      const toRemove = new Set([id]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const n of nodes) {
          if (n.parentId && toRemove.has(n.parentId) && !toRemove.has(n.id)) { toRemove.add(n.id); changed = true; }
        }
      }
      save(nodes.filter((n) => !toRemove.has(n.id)));
    }

    function updateText(id, text) {
      save(nodes.map((n) => (n.id === id ? { ...n, text } : n)));
    }

    function onPointerDown(e, node) {
      if (e.target.tagName === "INPUT") return;
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = { id: node.id, startX: e.clientX, startY: e.clientY, origX: node.x, origY: node.y };
    }

    function onPointerMove(e) {
      if (!dragRef.current) return;
      const { id, startX, startY, origX, origY } = dragRef.current;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, x: origX + dx, y: origY + dy } : n)));
    }

    function onPointerUp() {
      if (dragRef.current) save(nodes);
      dragRef.current = null;
    }

    async function exportJson() {
      try {
        await navigator.clipboard.writeText(JSON.stringify(nodes));
        sdk.pushNotification("Mind Map", "Map copied to clipboard as JSON.");
      } catch {
        sdk.pushNotification("Mind Map", "Couldn't access the clipboard.");
      }
    }

    async function importJson() {
      try {
        const text = await navigator.clipboard.readText();
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed) || !parsed.some((n) => n.id === "root")) throw new Error("bad shape");
        save(parsed);
        sdk.pushNotification("Mind Map", "Map imported from clipboard.");
      } catch {
        sdk.pushNotification("Mind Map", "Clipboard doesn't contain a valid mind map JSON.");
      }
    }

    function recenter() {
      save(nodes.map((n) => (n.id === "root" ? { ...n, x: 320, y: 220 } : n)));
    }

    return h(
      "div",
      { className: "pk-root" },
      h(
        "div",
        { className: "pk-toolbar" },
        h("button", { className: "pk-btn", onClick: recenter }, "Recenter"),
        h("button", { className: "pk-btn", onClick: exportJson }, "Export (copy JSON)"),
        h("button", { className: "pk-btn", onClick: importJson }, "Import (from clipboard)")
      ),
      h(
        "div",
        { className: "pk-content mm-canvas", onPointerMove, onPointerUp },
        h(
          "svg",
          { className: "mm-lines" },
          nodes
            .filter((n) => n.parentId)
            .map((n) => {
              const parent = nodes.find((p) => p.id === n.parentId);
              if (!parent) return null;
              return h("line", { key: n.id, x1: parent.x, y1: parent.y, x2: n.x, y2: n.y, stroke: "var(--anchoran-border,#2a2c33)", strokeWidth: 1.5 });
            })
        ),
        nodes.map((n) =>
          h(
            "div",
            { key: n.id, className: "mm-node", "data-root": n.id === "root", style: { left: n.x, top: n.y }, onPointerDown: (e) => onPointerDown(e, n) },
            editingId === n.id
              ? h("input", { autoFocus: true, value: n.text, onChange: (e) => updateText(n.id, e.target.value), onBlur: () => setEditingId(null), onKeyDown: (e) => e.key === "Enter" && setEditingId(null) })
              : h("span", { onDoubleClick: () => setEditingId(n.id) }, n.text),
            h(
              "div",
              { className: "mm-node-actions" },
              h("button", { onClick: () => addChild(n.id), "aria-label": "Add child" }, Icon ? h(Icon, { name: "plus", size: 11 }) : "+"),
              n.id !== "root" && h("button", { onClick: () => removeNode(n.id), "aria-label": "Delete" }, Icon ? h(Icon, { name: "close", size: 11 }) : "×")
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
