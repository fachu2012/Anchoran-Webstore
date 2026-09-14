/**
 * Code Studio's project store — everything here lives in
 * `localStorage` under the `anchoran-plugin:code-studio:*` namespace
 * (via pluginKit's `pluginStorage`), 100% local to this Anchoran user
 * profile and never synced anywhere unless the user explicitly exports
 * a project (see publish.js).
 *
 * PERSISTENCE ACROSS ANCHORAN OS UPDATES — verified, not assumed:
 * a plugin's `mount()` runs inside Anchoran OS's own main renderer
 * window (see Anchoran OS's PluginHost.tsx: the plugin module is
 * `import()`-ed directly into the host's existing document, not an
 * iframe or a separate partitioned webview), so `window.localStorage`
 * here IS the host's own default-session localStorage — the same
 * storage Anchoran's own UI state lives in, physically stored under
 * Electron's `userData` folder (`app.getPath("userData")` in
 * electron/main.ts), which an installer/updater does not wipe on
 * upgrade (only a full uninstall with "delete my data" would). Two
 * mechanisms that might *look* related do NOT touch this data:
 *   - The "Anchoran Local Apps" removal notice (src/core/
 *     upgradeAppRemoval.ts in Anchoran OS) only warns about legacy
 *     bundled apps being removed from the Start Menu/installed-apps
 *     list — it never reads or clears localStorage.
 *   - "Clear browsing data" in the Browser app only clears the
 *     `persist:anchoran-browser` *partition* — plugins are not loaded
 *     in that partition, so it can't touch this data either.
 * Installing/uninstalling OTHER plugins doesn't touch this data either
 * (each plugin's keys are namespaced by its own id via pluginStorage).
 * The one real risk: if a user literally uninstalls Code Studio itself
 * from the Webstore, its plugin *file* is removed from disk, but this
 * localStorage data is NOT — reinstalling Code Studio later reads it
 * right back, since the key namespace is the plugin id, not tied to
 * whether the plugin happens to be currently installed. Moot anyway:
 * Anchoran OS treats Code Studio as a protected/core plugin once
 * installed (its own PROTECTED_PLUGIN_IDS) — it can't be uninstalled
 * from the Webstore at all.
 *
 * STORAGE CONTRACT WITH ANCHORAN OS'S "MY CREATIONS" — exact shape,
 * not an implementation detail: Anchoran OS's Webstore reads/writes
 * these same two localStorage keys directly (same origin, no IPC) to
 * power its own "My Creations" sidebar section, so both the KEY NAMES
 * and the INDEX ENTRY SHAPE below are load-bearing, not just this
 * plugin's own choice:
 *   - `anchoran-plugin:code-studio:projects` — a JSON array of
 *     `{ id, name, description?, icon? }` (icon: a data URL, or
 *     omitted). This is the ONE index Anchoran OS reads to list
 *     "My Creations" cards; every create/rename/re-icon/delete this
 *     module does keeps it in sync.
 *   - `anchoran-plugin:code-studio:project:<id>` — that project's
 *     ENTIRE state (files, entryPath, forkOf, timestamps, etc.). This
 *     has to be the only place a project's data lives: when a user
 *     deletes a creation from the Webstore side (not from inside Code
 *     Studio), Anchoran OS deletes exactly this one key plus that
 *     project's index entry — any project state kept in some OTHER
 *     key would be orphaned forever by that path.
 * `activeProjectId` (below) is intentionally a THIRD, separate key:
 * it's not per-project state and Anchoran OS never reads or writes
 * it — just this plugin's own "which project to show by default when
 * opened normally (not via a My Creations pencil click)" pointer, and
 * mount() already tolerates it pointing at a since-deleted id (falls
 * back to another project, or creates a fresh one — see mount() below
 * and the "ctx.openPath" handling next to it).
 */
import { pluginStorage } from "../../_shared/pluginKit.js";

const storage = pluginStorage("code-studio");

const INDEX_KEY = "projects";
const ACTIVE_PROJECT_KEY = "activeProjectId";
const projectKey = (id) => `project:${id}`;

export const DEFAULT_ENTRY_PATH = "index.js";

const EMPTY_APP_TEMPLATE = `/**
 * A new Anchoran plugin, written the same way every real plugin in the
 * Anchoran-Webstore catalog is: one exported mount(container, sdk, ctx)
 * function. Use the Preview panel to see it run live, then Format /
 * check Problems, then Export or Make It Official when it's ready.
 */
export function mount(container, sdk, ctx) {
  const { React, ReactDOM } = sdk;
  const { createElement: h, useState } = React;

  function App() {
    const [count, setCount] = useState(0);
    return h(
      "div",
      { style: { padding: 20, fontFamily: "system-ui, sans-serif", color: sdk.getThemeMode() === "dark" ? "#F3F4F6" : "#14161B" } },
      h("div", { style: { fontSize: 14, fontWeight: 600, marginBottom: 10 } }, "My New Plugin"),
      h(
        "button",
        {
          onClick: () => setCount((c) => c + 1),
          style: { padding: "6px 12px", borderRadius: 6, border: "none", background: sdk.getAccentColor(), color: "#fff", cursor: "pointer" },
        },
        "Clicked " + count + " times"
      )
    );
  }

  const root = ReactDOM.createRoot(container);
  root.render(h(App));
  return () => root.unmount();
}
`;

const COUNTER_TEMPLATE = `/**
 * Counter — a classic React local-state example: a count with +/-
 * buttons and a reset, built the same way every real Anchoran plugin
 * is (sdk.React / sdk.ReactDOM, sdk.getAccentColor() / getThemeMode()
 * for the couple of places that need a literal JS value). A good
 * starting point for learning useState before building something
 * bigger.
 */
export function mount(container, sdk, ctx) {
  const { React, ReactDOM } = sdk;
  const { createElement: h, useState } = React;
  const accent = sdk.getAccentColor ? sdk.getAccentColor() : "#5B8DEF";
  const dark = (sdk.getThemeMode ? sdk.getThemeMode() : "dark") === "dark";

  function roundBtnStyle() {
    return { width: 34, height: 34, borderRadius: 8, border: "none", background: accent, color: "#fff", fontSize: 18, lineHeight: 1, cursor: "pointer" };
  }

  function App() {
    const [count, setCount] = useState(0);

    return h(
      "div",
      { style: { padding: 20, fontFamily: "system-ui, sans-serif", color: dark ? "#F3F4F6" : "#14161B", display: "flex", flexDirection: "column", gap: 14, alignItems: "flex-start" } },
      h("div", { style: { fontSize: 14, fontWeight: 600 } }, "Counter"),
      h(
        "div",
        { style: { display: "flex", alignItems: "center", gap: 14 } },
        h("button", { onClick: () => setCount((c) => c - 1), style: roundBtnStyle() }, "−"),
        h("div", { style: { fontSize: 28, fontWeight: 700, minWidth: 44, textAlign: "center" } }, count),
        h("button", { onClick: () => setCount((c) => c + 1), style: roundBtnStyle() }, "+")
      ),
      h(
        "button",
        { onClick: () => setCount(0), style: { padding: "4px 2px", border: "none", background: "transparent", color: accent, cursor: "pointer", fontSize: 11.5 } },
        "Reset"
      )
    );
  }

  const root = ReactDOM.createRoot(container);
  root.render(h(App));
  return () => root.unmount();
}
`;

const TASK_LIST_LOGIC_TEMPLATE = `/**
 * Task List — data layer, kept separate from index.js's UI on purpose:
 * a small, real example of splitting a plugin into "logic" + "UI"
 * files. Code Studio's preview resolves relative imports between a
 * project's own files (see runtime.js in the Anchoran-Webstore repo),
 * the same way multi-file plugins in the real catalog are structured.
 *
 * Persistence: plain localStorage, namespaced the same way every real
 * Anchoran plugin does it (see plugins/_shared/pluginKit.js's
 * pluginStorage helper) — an "anchoran-plugin:<id>:<key>" key, wrapped
 * in try/catch since localStorage can be unavailable (private
 * browsing, quota, etc). Swap "task-list-example" below for your real
 * plugin id once you publish this project.
 */
const STORAGE_KEY = "anchoran-plugin:task-list-example:tasks";

export function loadTasks() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveTasks(tasks) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch {
    /* private/blocked localStorage — tasks just won't persist this session */
  }
}

export function addTask(tasks, text) {
  const trimmed = text.trim();
  if (!trimmed) return tasks;
  return [...tasks, { id: \`t-\${Date.now().toString(36)}-\${Math.random().toString(36).slice(2, 6)}\`, text: trimmed, done: false }];
}

export function toggleTask(tasks, id) {
  return tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
}

export function removeTask(tasks, id) {
  return tasks.filter((t) => t.id !== id);
}
`;

const TASK_LIST_INDEX_TEMPLATE = `/**
 * Task List — add, mark done, delete, with tasks persisted in this
 * plugin's own namespaced localStorage. The actual data + persistence
 * logic lives in logic.js; this file is just the UI (see logic.js's
 * header for why they're split).
 */
import { loadTasks, saveTasks, addTask, toggleTask, removeTask } from "./logic.js";

export function mount(container, sdk, ctx) {
  const { React, ReactDOM } = sdk;
  const { createElement: h, useState } = React;
  const accent = sdk.getAccentColor ? sdk.getAccentColor() : "#5B8DEF";
  const dark = (sdk.getThemeMode ? sdk.getThemeMode() : "dark") === "dark";

  function App() {
    const [tasks, setTasks] = useState(() => loadTasks());
    const [text, setText] = useState("");

    function commit(next) {
      setTasks(next);
      saveTasks(next);
    }

    function handleAdd() {
      const next = addTask(tasks, text);
      if (next !== tasks) {
        commit(next);
        setText("");
      }
    }

    return h(
      "div",
      { style: { padding: 20, fontFamily: "system-ui, sans-serif", color: dark ? "#F3F4F6" : "#14161B", display: "flex", flexDirection: "column", gap: 10, maxWidth: 320 } },
      h("div", { style: { fontSize: 14, fontWeight: 600 } }, "Task List"),
      h(
        "div",
        { style: { display: "flex", gap: 6 } },
        h("input", {
          value: text,
          onChange: (e) => setText(e.target.value),
          onKeyDown: (e) => e.key === "Enter" && handleAdd(),
          placeholder: "Add a task…",
          style: { flex: 1, padding: "6px 8px", borderRadius: 6, border: "1px solid rgba(128,128,128,.35)", background: "transparent", color: "inherit" },
        }),
        h("button", { onClick: handleAdd, style: { padding: "6px 12px", borderRadius: 6, border: "none", background: accent, color: "#fff", cursor: "pointer" } }, "Add")
      ),
      tasks.length === 0
        ? h("div", { style: { opacity: 0.5, fontSize: 12 } }, "No tasks yet — add one above.")
        : h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: 4 } },
            tasks.map((t) =>
              h(
                "div",
                { key: t.id, style: { display: "flex", alignItems: "center", gap: 8, padding: "4px 2px" } },
                h("input", { type: "checkbox", checked: t.done, onChange: () => commit(toggleTask(tasks, t.id)) }),
                h("span", { style: { flex: 1, textDecoration: t.done ? "line-through" : "none", opacity: t.done ? 0.55 : 1 } }, t.text),
                h(
                  "button",
                  { onClick: () => commit(removeTask(tasks, t.id)), style: { border: "none", background: "transparent", color: "#E5484D", cursor: "pointer", fontSize: 13 } },
                  "✕"
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
`;

/**
 * Starting-point templates offered by "New Project" — chosen once, up
 * front, purely to seed the new project's virtual file tree with real,
 * runnable content (never empty placeholders): every template's files
 * are valid syntax and preview-runnable with no edits required. "empty"
 * is the default/first option and matches exactly what "New Project"
 * always did before templates existed.
 */
export const PROJECT_TEMPLATES = [
  {
    id: "empty",
    label: "Empty App",
    description: "A minimal mount() with a single button — the classic blank starting point.",
    entryPath: "index.js",
    files: { "index.js": EMPTY_APP_TEMPLATE },
  },
  {
    id: "counter",
    label: "Counter",
    description: "A +/- counter — a small example of local state with React's useState.",
    entryPath: "index.js",
    files: { "index.js": COUNTER_TEMPLATE },
  },
  {
    id: "tasklist",
    label: "Task List",
    description: "Add / complete / delete tasks, persisted to localStorage — split into logic.js + index.js.",
    entryPath: "index.js",
    files: { "index.js": TASK_LIST_INDEX_TEMPLATE, "logic.js": TASK_LIST_LOGIC_TEMPLATE },
  },
];

const DEFAULT_TEMPLATE_ID = "empty";

function getTemplate(templateId) {
  return PROJECT_TEMPLATES.find((t) => t.id === templateId) || PROJECT_TEMPLATES.find((t) => t.id === DEFAULT_TEMPLATE_ID);
}

function genId() {
  return `cs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** The exact index-entry shape Anchoran OS's "My Creations" reads: `{ id, name, description?, icon? }` — description/icon OMITTED (not null/empty) when unset, matching their "optional" contract. Extra fields (updatedAt, forkOf) ride along too — Anchoran OS's own reader just ignores keys it doesn't know, and this plugin's own project switcher uses them. */
function toIndexEntry(project) {
  const entry = { id: project.id, name: project.name };
  if (project.description) entry.description = project.description;
  if (project.icon) entry.icon = project.icon;
  entry.updatedAt = project.updatedAt;
  if (project.forkOf) entry.forkOf = project.forkOf;
  return entry;
}

function readIndex() {
  return storage.get(INDEX_KEY, []);
}

function writeIndex(entries) {
  storage.set(INDEX_KEY, entries);
}

/** Every saved project's lightweight index entry (for the project switcher, and the same data Anchoran OS's "My Creations" reads), newest-updated first. Reading this never has to load every project's full file map. */
export function listProjectSummaries() {
  return [...readIndex()].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}

export function getProject(id) {
  return storage.get(projectKey(id), null);
}

export function getActiveProjectId() {
  return storage.get(ACTIVE_PROJECT_KEY, null);
}

export function setActiveProjectId(id) {
  storage.set(ACTIVE_PROJECT_KEY, id);
}

/** Persists a full project (files included) under its own single `project:<id>` key and keeps its index entry in sync. Stamps `updatedAt`. */
export function saveProject(project) {
  const saved = { ...project, updatedAt: Date.now() };
  storage.set(projectKey(saved.id), saved);
  const index = readIndex().filter((e) => e.id !== saved.id);
  index.push(toIndexEntry(saved));
  writeIndex(index);
  return saved;
}

export function deleteProject(id) {
  try {
    window.localStorage.removeItem(`anchoran-plugin:code-studio:${projectKey(id)}`);
  } catch {
    /* private/blocked localStorage — nothing persisted to remove either */
  }
  const remaining = readIndex().filter((e) => e.id !== id);
  writeIndex(remaining);
  if (getActiveProjectId() === id) setActiveProjectId(remaining[0]?.id ?? null);
}

/**
 * Creates a new project. `opts.files` is a flat { path: content } map;
 * when omitted, a fresh project is seeded from a starting-point
 * template (`opts.templateId`, see PROJECT_TEMPLATES above — defaults
 * to "empty", matching the old always-blank behavior). `opts.forkOf`
 * (when this project was cloned from a real Webstore plugin via
 * "Import from Official") records { id, title, version } for
 * provenance — shown in the UI and carried into the "Make It Official"
 * package's README. `opts.icon` is a data URL (from an imported image
 * file) or omitted.
 */
export function createProject(opts = {}) {
  const id = genId();
  const now = Date.now();
  const template = opts.files ? null : getTemplate(opts.templateId);
  const entryPath = opts.entryPath || template?.entryPath || DEFAULT_ENTRY_PATH;
  const files = opts.files || template.files;
  const project = {
    id,
    name: opts.name || "Untitled Project",
    description: opts.description || "",
    icon: opts.icon || null,
    entryPath,
    forkOf: opts.forkOf || null,
    files,
    createdAt: now,
    updatedAt: now,
  };
  saveProject(project);
  setActiveProjectId(id);
  return project;
}

// ---- Virtual file tree helpers (operate on a project's `files` map) ----

const FOLDER_MARKER = ".keep";

function normalizePath(path) {
  return path
    .split("/")
    .filter((seg) => seg.length > 0 && seg !== ".")
    .join("/");
}

export function isFolderMarker(path) {
  return path.endsWith(`/${FOLDER_MARKER}`);
}

/** Builds a nested tree ({name, path, type, children}) from a flat files map, folders first then files, alphabetically within each group. Folder-marker files are hidden but still make their (possibly empty) folder appear. */
export function buildTree(files) {
  const root = { name: "", path: "", type: "folder", children: [] };
  const folderNodes = new Map([["", root]]);

  function ensureFolder(path) {
    if (folderNodes.has(path)) return folderNodes.get(path);
    const parentPath = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
    const parent = ensureFolder(parentPath);
    const name = path.slice(path.lastIndexOf("/") + 1);
    const node = { name, path, type: "folder", children: [] };
    parent.children.push(node);
    folderNodes.set(path, node);
    return node;
  }

  for (const path of Object.keys(files)) {
    const parentPath = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
    const parent = ensureFolder(parentPath);
    if (isFolderMarker(path)) continue; // the folder itself was already created by ensureFolder above
    const name = path.slice(path.lastIndexOf("/") + 1);
    parent.children.push({ name, path, type: "file", children: null });
  }

  function sortNode(node) {
    node.children.sort((a, b) => (a.type !== b.type ? (a.type === "folder" ? -1 : 1) : a.name.localeCompare(b.name)));
    node.children.forEach((c) => c.type === "folder" && sortNode(c));
  }
  sortNode(root);
  return root;
}

export function createFile(files, path, content = "") {
  const p = normalizePath(path);
  if (!p || files[p] !== undefined) return files;
  return { ...files, [p]: content };
}

export function createFolder(files, path) {
  const p = normalizePath(path);
  if (!p) return files;
  const marker = `${p}/${FOLDER_MARKER}`;
  if (files[marker] !== undefined) return files;
  return { ...files, [marker]: "" };
}

export function deleteFile(files, path) {
  const next = { ...files };
  delete next[path];
  return next;
}

export function deleteFolder(files, path) {
  const prefix = `${path}/`;
  const next = {};
  for (const [p, content] of Object.entries(files)) {
    if (p !== path && !p.startsWith(prefix)) next[p] = content;
  }
  return next;
}

export function renameFile(files, oldPath, newPath) {
  const p = normalizePath(newPath);
  if (!p || files[p] !== undefined || files[oldPath] === undefined) return files;
  const next = { ...files };
  next[p] = next[oldPath];
  delete next[oldPath];
  return next;
}

export function renameFolder(files, oldPath, newPath) {
  const np = normalizePath(newPath);
  if (!np) return files;
  const prefix = `${oldPath}/`;
  const next = {};
  for (const [p, content] of Object.entries(files)) {
    if (p === oldPath) next[np] = content;
    else if (p.startsWith(prefix)) next[np + p.slice(oldPath.length)] = content;
    else next[p] = content;
  }
  return next;
}
