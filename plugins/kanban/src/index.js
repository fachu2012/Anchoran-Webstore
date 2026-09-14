/**
 * Kanban — ported from Anchoran OS's bundled "kanban" app (same
 * drag-and-drop between To Do/Doing/Done columns). New for this
 * migration: cards can carry an optional color label (click the
 * colored dot to cycle it) for lightweight visual grouping.
 */
import { injectStyle, SHELL_CSS, pluginStorage } from "../../_shared/pluginKit.js";

const CSS =
  SHELL_CSS +
  `
.kb-content{display:flex;gap:12px;height:100%;overflow-x:auto;}
.kb-column{flex:1;min-width:200px;display:flex;flex-direction:column;background:var(--anchoran-surface,#1c1d22);border:1px solid var(--anchoran-border,#2a2c33);border-radius:10px;padding:10px;}
.kb-column[data-drag-over="true"]{border-color:var(--anchoran-accent,#5B8DEF);}
.kb-column-header{font-size:12.5px;font-weight:600;margin-bottom:8px;}
.kb-count{color:var(--anchoran-text-secondary,#9aa0ab);font-weight:400;}
.kb-cards{flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:6px;}
.kb-card{display:flex;align-items:center;gap:8px;background:var(--anchoran-bg,#141519);border:1px solid var(--anchoran-border,#2a2c33);border-radius:6px;padding:8px;font-size:12.5px;cursor:grab;}
.kb-card-label{width:10px;height:10px;border-radius:50%;flex-shrink:0;cursor:pointer;border:1px solid var(--anchoran-border,#2a2c33);}
.kb-card span{flex:1;word-break:break-word;}
.kb-remove{background:transparent;border:none;color:var(--anchoran-text-secondary,#9aa0ab);cursor:pointer;}
.kb-add{display:flex;gap:4px;margin-top:8px;}
`;

const COLUMNS = [
  { id: "todo", label: "To Do" },
  { id: "doing", label: "Doing" },
  { id: "done", label: "Done" },
];
const STORAGE_KEY = "kanbanBoard";
const DEFAULT_BOARD = { todo: [], doing: [], done: [] };
const DRAG_MIME = "application/x-anchoran-kanban-card";
const LABEL_COLORS = [null, "#5B8DEF", "#30A46C", "#F5C518", "#E5484D"];

export function mount(container, sdk) {
  injectStyle("kanban", CSS);
  const store = pluginStorage("kanban");
  const { React, ReactDOM, Icon } = sdk;
  const { createElement: h, useState } = React;

  function App() {
    const [board, setBoard] = useState(() => store.get(STORAGE_KEY, DEFAULT_BOARD));
    const [drafts, setDrafts] = useState({ todo: "", doing: "", done: "" });
    const [dragOverCol, setDragOverCol] = useState(null);

    function save(next) {
      setBoard(next);
      store.set(STORAGE_KEY, next);
    }

    function addCard(col) {
      const text = drafts[col].trim();
      if (!text) return;
      save({ ...board, [col]: [...board[col], { id: `${Date.now()}`, text, label: null }] });
      setDrafts((d) => ({ ...d, [col]: "" }));
    }

    function removeCard(col, id) {
      save({ ...board, [col]: board[col].filter((c) => c.id !== id) });
    }

    function cycleLabel(col, id) {
      save({
        ...board,
        [col]: board[col].map((c) => {
          if (c.id !== id) return c;
          const idx = LABEL_COLORS.indexOf(c.label ?? null);
          return { ...c, label: LABEL_COLORS[(idx + 1) % LABEL_COLORS.length] };
        }),
      });
    }

    function onDrop(e, targetCol) {
      e.preventDefault();
      setDragOverCol(null);
      const raw = e.dataTransfer.getData(DRAG_MIME);
      if (!raw) return;
      const [sourceCol, cardId] = raw.split(":");
      if (sourceCol === targetCol) return;
      const card = board[sourceCol].find((c) => c.id === cardId);
      if (!card) return;
      save({ ...board, [sourceCol]: board[sourceCol].filter((c) => c.id !== cardId), [targetCol]: [...board[targetCol], card] });
    }

    return h(
      "div",
      { className: "pk-root" },
      h(
        "div",
        { className: "pk-content kb-content" },
        COLUMNS.map((col) =>
          h(
            "div",
            {
              key: col.id,
              className: "kb-column",
              "data-drag-over": dragOverCol === col.id,
              onDragOver: (e) => { e.preventDefault(); setDragOverCol(col.id); },
              onDragLeave: () => setDragOverCol((c) => (c === col.id ? null : c)),
              onDrop: (e) => onDrop(e, col.id),
            },
            h("div", { className: "kb-column-header" }, col.label, " ", h("span", { className: "kb-count" }, board[col.id].length)),
            h(
              "div",
              { className: "kb-cards" },
              board[col.id].map((card) =>
                h(
                  "div",
                  { key: card.id, className: "kb-card", draggable: true, onDragStart: (e) => e.dataTransfer.setData(DRAG_MIME, `${col.id}:${card.id}`) },
                  h("span", { className: "kb-card-label", style: { background: card.label ?? "transparent" }, onClick: () => cycleLabel(col.id, card.id), title: "Click to change label color" }),
                  h("span", null, card.text),
                  h("button", { className: "kb-remove", onClick: () => removeCard(col.id, card.id), "aria-label": "Delete" }, Icon ? h(Icon, { name: "close", size: 12 }) : "×")
                )
              )
            ),
            h(
              "div",
              { className: "kb-add" },
              h("input", { className: "pk-input", style: { flex: 1 }, placeholder: "Add card…", value: drafts[col.id], onChange: (e) => setDrafts((d) => ({ ...d, [col.id]: e.target.value })), onKeyDown: (e) => e.key === "Enter" && addCard(col.id) }),
              h("button", { className: "pk-btn", onClick: () => addCard(col.id) }, Icon ? h(Icon, { name: "plus", size: 13 }) : "+")
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
