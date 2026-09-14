/**
 * Anchoran Code Studio — a small, local IDE for writing your OWN
 * Anchoran plugin, right inside Anchoran OS. Everything here is
 * 100% local to your user profile (see store.js's header for exactly
 * why that survives Anchoran OS updates) unless you explicitly Export
 * or "Make It Official".
 *
 * EDITOR CHOICE: a real CodeMirror 6 editor (editor.js), not a plain
 * <textarea> — this is a genuine esbuild bundle (not a size-capped
 * Artifact), CodeMirror mounts fine in Anchoran's real Chromium
 * renderer, and live JS autocomplete (required) is dramatically better
 * built on CM6's own `@codemirror/lang-javascript` + `@codemirror/
 * autocomplete` than hand-rolled over a textarea.
 *
 * MODULE SYSTEM FOR THE LIVE PREVIEW: see runtime.js's header — a
 * deliberately minimal, regex-based, in-memory CommonJS-ish resolver
 * covering relative requires/imports between a project's own files
 * only (no npm packages). Its limitations are documented there.
 *
 * LAYOUT: a simplified VS Code shape — a narrow file-explorer sidebar,
 * open-file tabs above the editor, the editor filling the center, and
 * a bottom panel with Problems/Preview tabs — using Anchoran's own
 * theme tokens (var(--anchoran-*)) throughout plus sdk.getAccentColor()
 * / sdk.getThemeMode() for the handful of places that need a literal
 * JS value (the CodeMirror theme, the accent-colored buttons), so it
 * reskins with the user's actual Anchoran theme rather than a fixed
 * dark palette of its own.
 */
import { injectStyle, SHELL_CSS, pluginStorage } from "../../_shared/pluginKit.js";
import * as store from "./store.js";
import { createCodeMirrorView, setViewContent, setViewTheme } from "./editor.js";
import { checkSyntax, formatCode } from "./lint.js";
import { runProject } from "./runtime.js";
import { exportProjectZip, buildOfficialPackage, downloadBlob } from "./publish.js";
import { fetchOfficialCatalog, fetchOfficialSource, forkToProjectOptions } from "./officialCatalog.js";

const CSS =
  SHELL_CSS +
  `
.cs-root{height:100%;display:flex;flex-direction:column;color:var(--anchoran-text-primary,#F3F4F6);font-family:system-ui,sans-serif;font-size:12.5px;background:var(--anchoran-bg,#141519);}
.cs-topbar{display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid var(--anchoran-border,#2a2c33);background:var(--anchoran-surface,#1c1d22);flex-shrink:0;flex-wrap:wrap;}
.cs-project-select{background:var(--anchoran-surface,#1c1d22);color:var(--anchoran-text-primary,#F3F4F6);border:1px solid var(--anchoran-border,#2a2c33);border-radius:6px;font-size:12px;padding:5px 8px;max-width:180px;}
.cs-spacer{flex:1;}
.cs-btn{display:flex;align-items:center;gap:5px;padding:5px 9px;border:1px solid var(--anchoran-border,#2a2c33);border-radius:6px;background:var(--anchoran-surface,#1c1d22);color:var(--anchoran-text-primary,#F3F4F6);font-size:11.5px;cursor:pointer;}
.cs-btn:hover{background:var(--anchoran-border,#2a2c33);}
.cs-btn:disabled{opacity:.4;cursor:default;}
.cs-btn-accent{border-color:transparent;}
.cs-body{flex:1;min-height:0;display:flex;}
.cs-sidebar{width:190px;flex-shrink:0;display:flex;flex-direction:column;border-right:1px solid var(--anchoran-border,#2a2c33);background:var(--anchoran-surface,#191a1f);}
.cs-sidebar-header{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;opacity:.6;}
.cs-sidebar-actions{display:flex;gap:4px;}
.cs-icon-btn{display:flex;align-items:center;justify-content:center;width:20px;height:20px;border:none;background:transparent;color:inherit;cursor:pointer;border-radius:4px;opacity:.75;}
.cs-icon-btn:hover{opacity:1;background:var(--anchoran-border,#2a2c33);}
.cs-tree{flex:1;overflow:auto;padding:2px 4px 10px;}
.cs-tree-node{display:flex;align-items:center;gap:5px;padding:3px 6px;border-radius:4px;cursor:pointer;white-space:nowrap;}
.cs-tree-node:hover{background:var(--anchoran-border,#2a2c33);}
.cs-tree-node[data-active="true"]{background:var(--anchoran-accent-soft,rgba(91,141,239,.15));color:var(--anchoran-accent,#5B8DEF);}
.cs-tree-node-actions{margin-left:auto;display:none;gap:2px;}
.cs-tree-node:hover .cs-tree-node-actions{display:flex;}
.cs-editor-col{flex:1;min-width:0;display:flex;flex-direction:column;}
.cs-tabs{display:flex;overflow-x:auto;border-bottom:1px solid var(--anchoran-border,#2a2c33);background:var(--anchoran-surface,#1c1d22);flex-shrink:0;}
.cs-tab{display:flex;align-items:center;gap:6px;padding:7px 10px;font-size:11.5px;border-right:1px solid var(--anchoran-border,#2a2c33);cursor:pointer;white-space:nowrap;opacity:.7;}
.cs-tab[data-active="true"]{opacity:1;background:var(--anchoran-bg,#141519);border-bottom:2px solid var(--anchoran-accent,#5B8DEF);}
.cs-tab-close{opacity:.6;border-radius:3px;padding:1px;}
.cs-tab-close:hover{opacity:1;background:var(--anchoran-border,#2a2c33);}
.cs-tab-dirty-dot{width:6px;height:6px;border-radius:50%;background:currentColor;opacity:.5;}
.cs-editor-host{flex:1;min-height:0;overflow:auto;}
.cs-cm-host{height:100%;}
.cs-cm-host .cm-editor{height:100%;font-size:12.5px;}
.cs-empty-editor{height:100%;display:flex;align-items:center;justify-content:center;opacity:.45;font-size:12px;}
.cs-panel{height:190px;flex-shrink:0;display:flex;flex-direction:column;border-top:1px solid var(--anchoran-border,#2a2c33);background:var(--anchoran-surface,#17181c);}
.cs-panel-tabs{display:flex;gap:2px;padding:6px 8px 0;flex-shrink:0;}
.cs-panel-tab{padding:5px 10px;border-radius:6px 6px 0 0;cursor:pointer;font-size:11px;opacity:.65;}
.cs-panel-tab[data-active="true"]{opacity:1;background:var(--anchoran-bg,#141519);}
.cs-panel-badge{display:inline-block;min-width:14px;text-align:center;margin-left:5px;padding:0 4px;border-radius:8px;background:#E5484D;color:#fff;font-size:9.5px;}
.cs-panel-body{flex:1;min-height:0;overflow:auto;padding:8px 10px;}
.cs-problem-item{display:flex;flex-direction:column;gap:2px;padding:6px 4px;border-bottom:1px solid var(--anchoran-border,#2a2c33);cursor:pointer;}
.cs-problem-file{font-size:11px;font-weight:600;}
.cs-problem-msg{font-size:11px;color:#E5484D;}
.cs-problem-ok{opacity:.5;padding:10px 4px;}
.cs-preview-wrap{height:100%;display:flex;flex-direction:column;}
.cs-preview-toolbar{display:flex;align-items:center;gap:8px;margin-bottom:6px;}
.cs-preview-host{position:absolute;inset:0;border:1px dashed var(--anchoran-border,#2a2c33);border-radius:6px;overflow:auto;}
.cs-preview-placeholder{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:.4;font-size:11.5px;text-align:center;padding:10px;}
.cs-preview-error{color:#E5484D;font-size:11px;white-space:pre-wrap;padding:8px;}
.cs-console-toolbar{display:flex;justify-content:flex-end;margin-bottom:6px;}
.cs-console-list{display:flex;flex-direction:column;font-family:'Cascadia Code',Consolas,monospace;font-size:11px;}
.cs-console-line{display:flex;gap:8px;padding:3px 4px;border-bottom:1px solid var(--anchoran-border,#2a2c33);white-space:pre-wrap;word-break:break-word;color:var(--anchoran-text-primary,#F3F4F6);}
.cs-console-ts{opacity:.45;flex-shrink:0;}
.cs-console-line[data-level="error"]{color:#E5484D;}
.cs-console-line[data-level="warn"]{color:#F5A623;}
.cs-console-line[data-level="info"]{color:var(--anchoran-accent,#5B8DEF);}
.cs-modal-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:20;}
.cs-modal{width:320px;max-width:90%;background:var(--anchoran-surface,#1c1d22);border:1px solid var(--anchoran-border,#2a2c33);border-radius:10px;padding:16px;display:flex;flex-direction:column;gap:10px;}
.cs-modal-title{font-size:13px;font-weight:600;}
.cs-modal-label{font-size:11px;opacity:.7;margin-bottom:2px;}
.cs-modal-input,.cs-modal-textarea{width:100%;background:var(--anchoran-bg,#141519);border:1px solid var(--anchoran-border,#2a2c33);border-radius:6px;color:var(--anchoran-text-primary,#F3F4F6);font-size:12px;padding:6px 8px;box-sizing:border-box;}
.cs-modal-textarea{resize:vertical;min-height:50px;}
.cs-modal-icon-row{display:flex;align-items:center;gap:10px;}
.cs-modal-icon-preview{width:36px;height:36px;border-radius:8px;object-fit:cover;border:1px solid var(--anchoran-border,#2a2c33);}
.cs-modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:4px;}
.cs-modal-error{color:#E5484D;font-size:11px;}
.cs-official-list{display:flex;flex-direction:column;gap:4px;max-height:260px;overflow:auto;}
.cs-official-item{display:flex;flex-direction:column;gap:2px;padding:8px;border:1px solid var(--anchoran-border,#2a2c33);border-radius:6px;cursor:pointer;}
.cs-official-item:hover{background:var(--anchoran-border,#2a2c33);}
.cs-official-title{font-size:12px;font-weight:600;}
.cs-official-desc{font-size:10.5px;opacity:.65;}
.cs-fork-note{font-size:10.5px;opacity:.6;padding:4px 10px;}
`;

const SYNTAX_CHECK_DEBOUNCE_MS = 450;
const SAVE_DEBOUNCE_MS = 600;

/**
 * `ctx.openPath` normally carries a plain project id — "My Creations"
 * (Anchoran OS's Webstore sidebar) opens Code Studio straight into
 * that project's IDE this way. This prefix gives that SAME field a
 * second, distinct meaning: "Open in Window" (see the App component's
 * openInWindow()) opens a SECOND, independent Code Studio window whose
 * `ctx.openPath` is `PREVIEW_WINDOW_PREFIX + projectId` instead — this
 * plugin's own mount() recognizes that prefix below and, instead of
 * rendering the IDE at all, loads that one project from storage,
 * builds it via runProject() (the exact same in-memory module runner
 * the embedded Preview panel uses — see runtime.js), and mounts its
 * `mount()` directly into `container`, filling the whole window with
 * nothing but the running app. Genuinely a real, separate Anchoran
 * window (its own titlebar, its own taskbar entry, resizable/movable
 * independently of the Code Studio window that spawned it) — not a
 * simulation — but still running the project's CURRENT in-memory
 * source, not a published/downloaded plugin build.
 */
const PREVIEW_WINDOW_PREFIX = "preview:";

/** The "Open in Window" side of PREVIEW_WINDOW_PREFIX above: renders nothing but the previewed project's own mount() output, filling `container` — no IDE chrome (explorer/tabs/Problems/Console) at all. */
function mountPreviewOnlyWindow(container, sdk, ctx) {
  const projectId = ctx.openPath.slice(PREVIEW_WINDOW_PREFIX.length);
  const project = store.getProject(projectId);
  if (!project) {
    container.textContent = "This project no longer exists — it may have been deleted from Code Studio or from the Webstore's My Creations.";
    return () => {};
  }
  try {
    const exported = runProject(project.files, project.entryPath);
    if (typeof exported.mount !== "function") {
      throw new Error(`"${project.entryPath}" doesn't export a mount() function.`);
    }
    const cleanup = exported.mount(container, sdk, { windowId: ctx.windowId });
    return typeof cleanup === "function" ? cleanup : () => {};
  } catch (err) {
    container.textContent = `Couldn't run "${project.name}": ${err instanceof Error ? err.message : String(err)}`;
    return () => {};
  }
}

export function mount(container, sdk, ctx) {
  if (ctx?.openPath && ctx.openPath.startsWith(PREVIEW_WINDOW_PREFIX)) {
    return mountPreviewOnlyWindow(container, sdk, ctx);
  }
  injectStyle("code-studio", CSS);
  const { React, ReactDOM, Icon } = sdk;
  const { createElement: h, useState, useEffect, useRef, useCallback, useMemo } = React;
  const themeMode = sdk.getThemeMode ? sdk.getThemeMode() : "dark";
  const accent = sdk.getAccentColor ? sdk.getAccentColor() : "#5B8DEF";

  function icon(name, size) {
    return Icon ? h(Icon, { name, size: size || 14 }) : null;
  }

  // ---- Small inline modal used for New File / New Folder / Rename / New Project / Edit Project ----
  function TextModal({ title, fields, submitLabel, onCancel, onSubmit }) {
    const [values, setValues] = useState(() => Object.fromEntries(fields.map((f) => [f.key, f.initial ?? ""])));
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);
    // No autofocus() on mount here on purpose: it's the one thing that
    // reliably triggers a known jsdom + React 18 incompatibility in
    // this repo's own test environment (React's legacy "IE input
    // event polyfill" tries to attachEvent/detachEvent — APIs real
    // Chromium and jsdom both lack — the moment a controlled text
    // input receives focus via a programmatic .focus() call). Real
    // Anchoran OS (real Chromium) wouldn't hit this, but it's a minor
    // UX nicety, not required functionality, so it's not worth this
    // plugin's tests fighting a jsdom-only quirk over.

    async function submit() {
      setError(null);
      setBusy(true);
      try {
        await onSubmit(values);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    }

    return h(
      "div",
      { className: "cs-modal-backdrop", onClick: (e) => e.target === e.currentTarget && onCancel() },
      h(
        "div",
        { className: "cs-modal" },
        h("div", { className: "cs-modal-title" }, title),
        fields.map((f, i) =>
          h(
            "div",
            { key: f.key },
            h("div", { className: "cs-modal-label" }, f.label),
            f.type === "textarea"
              ? h("textarea", {
                  className: "cs-modal-textarea",
                  value: values[f.key],
                  onChange: (e) => setValues((v) => ({ ...v, [f.key]: e.target.value })),
                })
              : f.type === "select"
                ? h(
                    "select",
                    {
                      className: "cs-modal-input",
                      "aria-label": f.label,
                      value: values[f.key],
                      onChange: (e) => setValues((v) => ({ ...v, [f.key]: e.target.value })),
                    },
                    f.options.map((opt) => h("option", { key: opt.value, value: opt.value }, opt.label))
                  )
                : f.type === "file-image"
                ? h(
                    "div",
                    { className: "cs-modal-icon-row" },
                    values[f.key] ? h("img", { className: "cs-modal-icon-preview", src: values[f.key], alt: "" }) : null,
                    h("input", {
                      type: "file",
                      accept: "image/*",
                      className: "cs-modal-input",
                      onChange: (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => setValues((v) => ({ ...v, [f.key]: String(reader.result) }));
                        reader.readAsDataURL(file);
                      },
                    })
                  )
                : h("input", {
                    className: "cs-modal-input",
                    type: "text",
                    value: values[f.key],
                    onKeyDown: (e) => {
                      if (e.key === "Enter" && fields.length === 1) submit();
                      if (e.key === "Escape") onCancel();
                    },
                    onChange: (e) => setValues((v) => ({ ...v, [f.key]: e.target.value })),
                  })
          )
        ),
        error && h("div", { className: "cs-modal-error" }, error),
        h(
          "div",
          { className: "cs-modal-actions" },
          h("button", { className: "cs-btn", onClick: onCancel, disabled: busy }, "Cancel"),
          h("button", { className: "cs-btn cs-btn-accent", style: { background: accent, color: "#fff" }, onClick: submit, disabled: busy }, submitLabel || "Create")
        )
      )
    );
  }

  // ---- File tree node ----
  function TreeNode({ node, depth, activePath, onOpenFile, onRename, onDelete, onNewChildFile, onNewChildFolder }) {
    if (node.type === "file") {
      return h(
        "div",
        {
          className: "cs-tree-node",
          "data-active": String(node.path === activePath),
          style: { paddingLeft: 8 + depth * 14 },
          onClick: () => onOpenFile(node.path),
          title: node.path,
        },
        icon("file", 13),
        h("span", null, node.name),
        h(
          "span",
          { className: "cs-tree-node-actions" },
          h(
            "button",
            {
              className: "cs-icon-btn",
              title: "Rename",
              onClick: (e) => {
                e.stopPropagation();
                onRename(node.path, false);
              },
            },
            "✎"
          ),
          h(
            "button",
            {
              className: "cs-icon-btn",
              title: "Delete",
              onClick: (e) => {
                e.stopPropagation();
                onDelete(node.path, false);
              },
            },
            "✕"
          )
        )
      );
    }
    // folder (root folder has empty name, no row of its own — just its children)
    return h(
      React.Fragment,
      null,
      node.path &&
        h(
          "div",
          { className: "cs-tree-node", style: { paddingLeft: 8 + depth * 14, fontWeight: 600 }, title: node.path },
          icon("folder", 13),
          h("span", null, node.name),
          h(
            "span",
            { className: "cs-tree-node-actions" },
            h(
              "button",
              {
                className: "cs-icon-btn",
                title: "New file here",
                onClick: (e) => {
                  e.stopPropagation();
                  onNewChildFile(node.path);
                },
              },
              "+"
            ),
            h(
              "button",
              {
                className: "cs-icon-btn",
                title: "Rename",
                onClick: (e) => {
                  e.stopPropagation();
                  onRename(node.path, true);
                },
              },
              "✎"
            ),
            h(
              "button",
              {
                className: "cs-icon-btn",
                title: "Delete",
                onClick: (e) => {
                  e.stopPropagation();
                  onDelete(node.path, true);
                },
              },
              "✕"
            )
          )
        ),
      node.children.map((child) =>
        h(TreeNode, {
          key: child.path,
          node: child,
          depth: node.path ? depth + 1 : depth,
          activePath,
          onOpenFile,
          onRename,
          onDelete,
          onNewChildFile,
          onNewChildFolder,
        })
      )
    );
  }

  // ---- The CodeMirror-backed editor pane ----
  function EditorPane({ path, value, onChange }) {
    const hostRef = useRef(null);
    const viewRef = useRef(null);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    useEffect(() => {
      const view = createCodeMirrorView({
        parent: hostRef.current,
        doc: value,
        themeMode,
        onChange: (text) => onChangeRef.current && onChangeRef.current(text),
      });
      viewRef.current = view;
      // Test seam: exposes the live EditorView on its host node so
      // smoke tests can drive real document edits via view.dispatch()
      // instead of fighting jsdom's very limited input-event/IME
      // emulation — harmless in production (nothing else reads it).
      hostRef.current.__cmView = view;
      return () => {
        delete hostRef.current?.__cmView;
        view.destroy();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [path]);

    useEffect(() => {
      if (viewRef.current) setViewContent(viewRef.current, value);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, path]);

    return h("div", { className: "cs-cm-host", ref: hostRef });
  }

  // ---- Problems panel ----
  function ProblemsPanel({ problems, onJump }) {
    const entries = Object.entries(problems).filter(([, p]) => p);
    if (entries.length === 0) return h("div", { className: "cs-problem-ok" }, "No syntax problems found.");
    return h(
      "div",
      null,
      entries.map(([path, p]) =>
        h(
          "div",
          { key: path, className: "cs-problem-item", onClick: () => onJump(path) },
          h("div", { className: "cs-problem-file" }, path + (p.line ? ` (line ${p.line}${p.column != null ? `, col ${p.column}` : ""})` : "")),
          h("div", { className: "cs-problem-msg" }, p.message)
        )
      )
    );
  }

  // ---- Main App ----
  function App() {
    const [summaries, setSummaries] = useState(() => store.listProjectSummaries());
    const [project, setProject] = useState(null);
    const [openTabs, setOpenTabs] = useState([]);
    const [activePath, setActivePath] = useState(null);
    const [problems, setProblems] = useState({});
    const [panelTab, setPanelTab] = useState("problems");
    const [modal, setModal] = useState(null);
    const [previewState, setPreviewState] = useState("idle"); // idle | running | error
    const [previewError, setPreviewError] = useState(null);
    const [consoleLines, setConsoleLines] = useState([]);
    const previewHostRef = useRef(null);
    const previewCleanupRef = useRef(null);
    const consoleRestoreRef = useRef(null); // set while a preview is running: undoes the console.*/window listener interception below
    const saveTimerRef = useRef(null);
    const checkTimersRef = useRef({});
    const projectRef = useRef(null);
    projectRef.current = project;

    // Unmount (window closed): flush any debounced save still pending
    // so the last few keystrokes aren't lost, clear every pending
    // syntax-check timer, and stop a running preview's own cleanup —
    // otherwise a preview'd plugin's timers/listeners would outlive
    // this window, exactly the class of bug this repo's own smoke
    // tests exist to catch (see tests/smoke.test.js's header).
    useEffect(() => {
      return () => {
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
          if (projectRef.current) store.saveProject(projectRef.current);
        }
        Object.values(checkTimersRef.current).forEach(clearTimeout);
        try {
          previewCleanupRef.current?.();
        } catch {
          /* a broken preview cleanup shouldn't block this window from closing */
        }
        try {
          consoleRestoreRef.current?.();
        } catch {
          /* same — restoring console/listener interception must never block closing */
        }
      };
    }, []);

    // Bootstraps which project to load. Two entry points:
    //  - ctx.openPath set (Anchoran OS's Webstore "My Creations" opened
    //    this window with a specific project's id via
    //    openApp("pluginHost", {..., openPath: creation.id}) — see
    //    PluginHost.tsx/anchoranSDK.ts on the Anchoran OS side) ->
    //    load DIRECTLY into that one project, skipping the normal
    //    "last active or starter" logic. A since-deleted id (the user
    //    removed that creation from the Webstore between clicking the
    //    pencil and this window opening) falls back to the normal path
    //    below rather than showing a dead window.
    //  - otherwise -> the normal "last active project, or the first
    //    one, or create a starter project on a brand new install" path.
    useEffect(() => {
      let all = store.listProjectSummaries();
      let id = null;

      if (ctx?.openPath && all.some((s) => s.id === ctx.openPath)) {
        id = ctx.openPath;
        store.setActiveProjectId(id);
      } else {
        id = store.getActiveProjectId();
        if (!id || !all.some((s) => s.id === id)) {
          if (all.length === 0) {
            const created = store.createProject({ name: "My First Plugin" });
            all = store.listProjectSummaries();
            id = created.id;
          } else {
            id = all[0].id;
            store.setActiveProjectId(id);
          }
        }
      }

      const full = store.getProject(id);
      setSummaries(all);
      setProject(full);
      setOpenTabs(full ? [full.entryPath] : []);
      setActivePath(full ? full.entryPath : null);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Runs a syntax check for one path against its CURRENT content, debounced.
    const scheduleCheck = useCallback((path, content) => {
      clearTimeout(checkTimersRef.current[path]);
      checkTimersRef.current[path] = setTimeout(async () => {
        const result = await checkSyntax(path, content);
        setProblems((p) => ({ ...p, [path]: result }));
      }, SYNTAX_CHECK_DEBOUNCE_MS);
    }, []);

    // Checks every file in the project right away (used before Run Preview / Make It Official).
    const checkAllFiles = useCallback(async (proj) => {
      const entries = await Promise.all(
        Object.entries(proj.files)
          .filter(([p]) => !store.isFolderMarker(p))
          .map(async ([p, content]) => [p, await checkSyntax(p, content)])
      );
      const next = Object.fromEntries(entries);
      setProblems(next);
      return next;
    }, []);

    useEffect(() => {
      if (project) checkAllFiles(project);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [project?.id]);

    function persist(nextProject) {
      setProject(nextProject);
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        const saved = store.saveProject(nextProject);
        setSummaries(store.listProjectSummaries());
        return saved;
      }, SAVE_DEBOUNCE_MS);
    }

    function switchProject(id) {
      stopPreview();
      store.setActiveProjectId(id);
      const full = store.getProject(id);
      setProject(full);
      setOpenTabs(full ? [full.entryPath] : []);
      setActivePath(full ? full.entryPath : null);
      setProblems({});
      setModal(null);
    }

    function openFile(path) {
      setOpenTabs((tabs) => (tabs.includes(path) ? tabs : [...tabs, path]));
      setActivePath(path);
    }

    function closeTab(path) {
      setOpenTabs((tabs) => {
        const next = tabs.filter((t) => t !== path);
        if (activePath === path) setActivePath(next[next.length - 1] ?? null);
        return next;
      });
    }

    function updateFileContent(path, content) {
      if (!project) return;
      const nextFiles = { ...project.files, [path]: content };
      persist({ ...project, files: nextFiles });
      scheduleCheck(path, content);
    }

    function withProject(mutator) {
      if (!project) return;
      persist({ ...project, files: mutator(project.files) });
    }

    function handleNewFile(parentPath) {
      setModal({
        title: "New File",
        fields: [{ key: "name", label: "File path (relative to project root)", initial: parentPath ? `${parentPath}/` : "" }],
        submitLabel: "Create",
        onSubmit: ({ name }) => {
          if (!name.trim()) throw new Error("Enter a file name.");
          if (project.files[store_normalize(name)] !== undefined) throw new Error("A file already exists at that path.");
          withProject((files) => store.createFile(files, name, ""));
          openFile(store_normalize(name));
          setModal(null);
        },
      });
    }

    function handleNewFolder(parentPath) {
      setModal({
        title: "New Folder",
        fields: [{ key: "name", label: "Folder path (relative to project root)", initial: parentPath ? `${parentPath}/` : "" }],
        submitLabel: "Create",
        onSubmit: ({ name }) => {
          if (!name.trim()) throw new Error("Enter a folder name.");
          withProject((files) => store.createFolder(files, name));
          setModal(null);
        },
      });
    }

    function handleRename(path, isFolder) {
      setModal({
        title: isFolder ? "Rename Folder" : "Rename File",
        fields: [{ key: "name", label: "New path", initial: path }],
        submitLabel: "Rename",
        onSubmit: ({ name }) => {
          if (!name.trim()) throw new Error("Enter a path.");
          withProject((files) => (isFolder ? store.renameFolder(files, path, name) : store.renameFile(files, path, name)));
          if (isFolder) {
            setOpenTabs((tabs) => tabs.map((t) => (t === path || t.startsWith(`${path}/`) ? name + t.slice(path.length) : t)));
            if (activePath === path || activePath?.startsWith(`${path}/`)) setActivePath(name + activePath.slice(path.length));
          } else {
            setOpenTabs((tabs) => tabs.map((t) => (t === path ? store_normalize(name) : t)));
            if (activePath === path) setActivePath(store_normalize(name));
          }
          setModal(null);
        },
      });
    }

    function handleDelete(path, isFolder) {
      withProject((files) => (isFolder ? store.deleteFolder(files, path) : store.deleteFile(files, path)));
      setOpenTabs((tabs) => tabs.filter((t) => (isFolder ? t !== path && !t.startsWith(`${path}/`) : t !== path)));
      if (activePath === path || (isFolder && activePath?.startsWith(`${path}/`))) setActivePath(null);
    }

    async function handleFormat() {
      if (!project || !activePath) return;
      try {
        const formatted = await formatCode(activePath, project.files[activePath] ?? "");
        updateFileContent(activePath, formatted);
      } catch (err) {
        setPanelTab("problems");
        setProblems((p) => ({ ...p, [activePath]: { message: err instanceof Error ? err.message.split("\n")[0] : String(err), line: err?.loc?.start?.line ?? null, column: err?.loc?.start?.column ?? null } }));
      }
    }

    // Appends one line to the Console/Output panel. Used both by the
    // console.*/window-error interception runPreview() installs below,
    // and directly for a synchronous mount() throw (caught in
    // runPreview's own catch) — so every way a preview can fail shows
    // up in one place, not split between "Problems" (static syntax
    // only) and some errors silently only hitting the Preview banner.
    function pushConsole(level, message) {
      setConsoleLines((lines) => [...lines, { level, message, ts: Date.now() }]);
    }

    function formatConsoleArgs(args) {
      return Array.from(args)
        .map((a) => {
          if (typeof a === "string") return a;
          if (a instanceof Error) return a.stack || a.message;
          try {
            return JSON.stringify(a);
          } catch {
            return String(a);
          }
        })
        .join(" ");
    }

    /**
     * Wraps console.log/warn/error/info (the SAME global `console`
     * object runtime.js's module factories are handed as their own
     * `console` parameter, so this catches a project's console calls
     * either way) to mirror every call into the Console panel while
     * still calling the real console method, and adds `window`
     * "error"/"unhandledrejection" listeners for runtime errors that
     * happen AFTER mount() returns (a click handler that throws, a
     * rejected promise, etc — mount() itself throwing SYNCHRONOUSLY is
     * caught directly in runPreview's own try/catch instead, since
     * that happens before these listeners would even be attached).
     * Returns a restore() function — callers MUST call it exactly
     * once when the preview stops (stopPreview, or this window
     * closing) or the interception leaks past the preview's lifetime.
     */
    function interceptPreviewConsole() {
      const originalConsole = { log: console.log, warn: console.warn, error: console.error, info: console.info };
      for (const level of ["log", "warn", "error", "info"]) {
        console[level] = (...args) => {
          originalConsole[level].apply(console, args);
          pushConsole(level, formatConsoleArgs(args));
        };
      }
      const onWindowError = (e) => {
        pushConsole("error", `Uncaught: ${e?.error?.stack || e?.error?.message || e?.message || "unknown error"}`);
      };
      const onUnhandledRejection = (e) => {
        const reason = e?.reason;
        pushConsole("error", `Unhandled promise rejection: ${reason instanceof Error ? reason.stack || reason.message : String(reason)}`);
      };
      window.addEventListener("error", onWindowError);
      window.addEventListener("unhandledrejection", onUnhandledRejection);
      return () => {
        console.log = originalConsole.log;
        console.warn = originalConsole.warn;
        console.error = originalConsole.error;
        console.info = originalConsole.info;
        window.removeEventListener("error", onWindowError);
        window.removeEventListener("unhandledrejection", onUnhandledRejection);
      };
    }

    function stopPreview() {
      try {
        previewCleanupRef.current?.();
      } catch {
        /* a broken cleanup shouldn't block stopping the preview */
      }
      previewCleanupRef.current = null;
      try {
        consoleRestoreRef.current?.();
      } catch {
        /* same — must not block stopping the preview */
      }
      consoleRestoreRef.current = null;
      if (previewHostRef.current) previewHostRef.current.innerHTML = "";
      setPreviewState("idle");
      setPreviewError(null);
    }

    async function runPreview() {
      if (!project) return;
      stopPreview();
      setConsoleLines([]);
      setPanelTab("preview");
      const fresh = await checkAllFiles(project);
      const hasErrors = Object.values(fresh).some(Boolean);
      if (hasErrors) {
        setPanelTab("problems");
        setPreviewState("error");
        setPreviewError("Fix the syntax problems listed in the Problems tab before running the preview.");
        return;
      }
      const restoreConsole = interceptPreviewConsole();
      try {
        const exported = runProject(project.files, project.entryPath);
        if (typeof exported.mount !== "function") {
          throw new Error(`"${project.entryPath}" doesn't export a mount() function — nothing to preview yet.`);
        }
        const previewSdk = { ...sdk };
        const cleanup = exported.mount(previewHostRef.current, previewSdk, { windowId: `${ctx?.windowId ?? "code-studio"}:preview` });
        previewCleanupRef.current = typeof cleanup === "function" ? cleanup : null;
        consoleRestoreRef.current = restoreConsole; // keep interception live for as long as the preview keeps running
        setPreviewState("running");
      } catch (err) {
        const message = err instanceof Error ? err.stack || err.message : String(err);
        pushConsole("error", message);
        restoreConsole(); // mount() never actually started running, so nothing to keep intercepting
        setPreviewState("error");
        setPreviewError(message);
      }
    }

    /**
     * Opens a SECOND, real, independent Anchoran window running this
     * project's current in-memory source — see PREVIEW_WINDOW_PREFIX
     * and mountPreviewOnlyWindow() above for how that window renders.
     * `sdk.openApp` is not part of the documented App SDK (see this
     * repo's README / anchoranSDK.ts) as of this writing — it's called
     * defensively so this button degrades to a clear explanation
     * instead of silently doing nothing on an Anchoran OS build that
     * doesn't expose it yet.
     */
    function openInWindow() {
      if (!project) return;
      if (typeof sdk.openApp !== "function") {
        setPanelTab("preview");
        setPreviewError(
          'Opening a separate window needs a small addition to the Anchoran App SDK ("sdk.openApp") that this build of Anchoran OS doesn\'t expose yet — use the embedded Preview panel above for now.'
        );
        return;
      }
      sdk.openApp("pluginHost", { pluginId: "code-studio", title: project.name, openPath: `${PREVIEW_WINDOW_PREFIX}${project.id}` });
    }

    async function handleExport() {
      if (!project) return;
      const { blob, filename } = await exportProjectZip(project);
      downloadBlob(filename, blob);
      sdk.pushNotification?.("Code Studio", `Exported "${project.name}" as ${filename}.`);
    }

    async function handleMakeOfficial() {
      if (!project) return;
      const fresh = await checkAllFiles(project);
      if (Object.values(fresh).some(Boolean)) {
        setPanelTab("problems");
        return;
      }
      const { blob, filename } = await buildOfficialPackage(project);
      downloadBlob(filename, blob);
      sdk.pushNotification?.("Code Studio", `Built the "Make It Official" package for "${project.name}" — see its README.md for the manual publishing steps.`);
    }

    function handleNewProject() {
      setModal({
        title: "New Project",
        fields: [
          { key: "name", label: "Name", initial: "" },
          { key: "description", label: "Description", type: "textarea", initial: "" },
          { key: "icon", label: "Icon (optional image file)", type: "file-image", initial: null },
          {
            key: "template",
            label: "Template",
            type: "select",
            initial: store.PROJECT_TEMPLATES[0].id,
            options: store.PROJECT_TEMPLATES.map((t) => ({ value: t.id, label: `${t.label} — ${t.description}` })),
          },
        ],
        submitLabel: "Create",
        onSubmit: ({ name, description, icon, template }) => {
          if (!name.trim()) throw new Error("Enter a project name.");
          const created = store.createProject({ name, description, icon, templateId: template });
          switchProject(created.id);
        },
      });
    }

    function handleEditProject() {
      if (!project) return;
      setModal({
        title: "Project Settings",
        fields: [
          { key: "name", label: "Name", initial: project.name },
          { key: "description", label: "Description", type: "textarea", initial: project.description },
          { key: "icon", label: "Icon (optional image file)", type: "file-image", initial: project.icon },
        ],
        submitLabel: "Save",
        onSubmit: ({ name, description, icon }) => {
          if (!name.trim()) throw new Error("Enter a project name.");
          const saved = store.saveProject({ ...project, name, description, icon });
          setProject(saved);
          setSummaries(store.listProjectSummaries());
          setModal(null);
        },
      });
    }

    function handleDeleteProject() {
      if (!project) return;
      store.deleteProject(project.id);
      const remaining = store.listProjectSummaries();
      if (remaining.length > 0) switchProject(remaining[0].id);
      else {
        const created = store.createProject({ name: "My First Plugin" });
        switchProject(created.id);
      }
    }

    function ImportOfficialModal() {
      const [list, setList] = useState(null);
      const [error, setError] = useState(null);
      const [loadingId, setLoadingId] = useState(null);
      useEffect(() => {
        fetchOfficialCatalog()
          .then(setList)
          .catch((err) => setError(err instanceof Error ? err.message : String(err)));
      }, []);

      async function clone(manifest) {
        setLoadingId(manifest.id);
        try {
          const source = await fetchOfficialSource(manifest);
          const created = store.createProject(forkToProjectOptions(manifest, source));
          switchProject(created.id);
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setLoadingId(null);
        }
      }

      return h(
        "div",
        { className: "cs-modal-backdrop", onClick: (e) => e.target === e.currentTarget && setModal(null) },
        h(
          "div",
          { className: "cs-modal", style: { width: 380 } },
          h("div", { className: "cs-modal-title" }, "Import from Official"),
          h("div", { className: "cs-fork-note" }, "Clones a real published plugin's source as your own local, editable project — the original is never touched."),
          error && h("div", { className: "cs-modal-error" }, error),
          !list && !error && h("div", { className: "cs-problem-ok" }, "Loading the official catalog…"),
          list &&
            h(
              "div",
              { className: "cs-official-list" },
              list.map((m) =>
                h(
                  "div",
                  { key: m.id, className: "cs-official-item", onClick: () => clone(m) },
                  h("div", { className: "cs-official-title" }, loadingId === m.id ? `Cloning "${m.title}"…` : m.title),
                  h("div", { className: "cs-official-desc" }, m.description)
                )
              )
            ),
          h("div", { className: "cs-modal-actions" }, h("button", { className: "cs-btn", onClick: () => setModal(null) }, "Close"))
        )
      );
    }

    const tree = useMemo(() => (project ? store.buildTree(project.files) : null), [project]);
    const problemCount = Object.values(problems).filter(Boolean).length;
    const consoleErrorCount = consoleLines.filter((l) => l.level === "error").length;

    if (!project) return h("div", { className: "cs-empty-editor" }, "Loading Code Studio…");

    return h(
      "div",
      { className: "cs-root", style: { position: "relative" } },
      h(
        "div",
        { className: "cs-topbar" },
        h(
          "select",
          {
            className: "cs-project-select",
            value: project.id,
            onChange: (e) => switchProject(e.target.value),
          },
          summaries.map((s) => h("option", { key: s.id, value: s.id }, s.name))
        ),
        h("button", { className: "cs-btn", onClick: handleNewProject, title: "New Project" }, icon("plus", 13), "New"),
        h("button", { className: "cs-btn", onClick: () => setModal({ type: "import-official" }), title: "Import from Official" }, "Import from Official"),
        h("button", { className: "cs-btn", onClick: handleEditProject, title: "Project Settings" }, icon("settings", 13)),
        h("button", { className: "cs-btn", onClick: handleDeleteProject, title: "Delete Project" }, icon("close", 13)),
        h("div", { className: "cs-spacer" }),
        h("button", { className: "cs-btn", onClick: handleFormat, disabled: !activePath }, "Format"),
        previewState === "running"
          ? h("button", { className: "cs-btn", onClick: stopPreview }, "Stop Preview")
          : h("button", { className: "cs-btn", onClick: runPreview }, "Run Preview"),
        h("button", { className: "cs-btn", onClick: openInWindow, title: "Open this project in its own real Anchoran window" }, "Open in Window"),
        h("button", { className: "cs-btn", onClick: handleExport }, "Export"),
        h("button", { className: "cs-btn cs-btn-accent", style: { background: accent, color: "#fff" }, onClick: handleMakeOfficial }, "Make It Official")
      ),
      h(
        "div",
        { className: "cs-body" },
        h(
          "div",
          { className: "cs-sidebar" },
          h(
            "div",
            { className: "cs-sidebar-header" },
            h("span", null, project.name),
            h(
              "span",
              { className: "cs-sidebar-actions" },
              h("button", { className: "cs-icon-btn", title: "New File", onClick: () => handleNewFile("") }, "+"),
              h("button", { className: "cs-icon-btn", title: "New Folder", onClick: () => handleNewFolder("") }, icon("folder", 12))
            )
          ),
          h(TreeNode, {
            node: tree,
            depth: 0,
            activePath,
            onOpenFile: openFile,
            onRename: handleRename,
            onDelete: handleDelete,
            onNewChildFile: handleNewFile,
            onNewChildFolder: handleNewFolder,
          })
        ),
        h(
          "div",
          { className: "cs-editor-col" },
          h(
            "div",
            { className: "cs-tabs" },
            openTabs.map((path) =>
              h(
                "div",
                { key: path, className: "cs-tab", "data-active": String(path === activePath), onClick: () => setActivePath(path) },
                problems[path] && h("span", { style: { color: "#E5484D" } }, "●"),
                h("span", null, path),
                h(
                  "span",
                  {
                    className: "cs-tab-close",
                    onClick: (e) => {
                      e.stopPropagation();
                      closeTab(path);
                    },
                  },
                  "✕"
                )
              )
            )
          ),
          h(
            "div",
            { className: "cs-editor-host" },
            activePath && project.files[activePath] !== undefined
              ? h(EditorPane, {
                  key: activePath,
                  path: activePath,
                  value: project.files[activePath],
                  onChange: (text) => updateFileContent(activePath, text),
                })
              : h("div", { className: "cs-empty-editor" }, "Select a file from the explorer to start editing.")
          ),
          h(
            "div",
            { className: "cs-panel" },
            h(
              "div",
              { className: "cs-panel-tabs" },
              h(
                "div",
                { className: "cs-panel-tab", "data-active": String(panelTab === "problems"), onClick: () => setPanelTab("problems") },
                "Problems",
                problemCount > 0 && h("span", { className: "cs-panel-badge" }, problemCount)
              ),
              h("div", { className: "cs-panel-tab", "data-active": String(panelTab === "preview"), onClick: () => setPanelTab("preview") }, "Preview"),
              h(
                "div",
                { className: "cs-panel-tab", "data-active": String(panelTab === "console"), onClick: () => setPanelTab("console") },
                "Console",
                consoleErrorCount > 0 && h("span", { className: "cs-panel-badge" }, consoleErrorCount)
              )
            ),
            h(
              "div",
              { className: "cs-panel-body", style: { display: panelTab === "problems" ? "block" : "none" } },
              h(ProblemsPanel, { problems, onJump: openFile })
            ),
            h(
              "div",
              { className: "cs-panel-body", style: { display: panelTab === "console" ? "block" : "none" } },
              h(
                "div",
                { className: "cs-console-toolbar" },
                h("button", { className: "cs-btn", onClick: () => setConsoleLines([]) }, "Clear")
              ),
              consoleLines.length === 0
                ? h("div", { className: "cs-problem-ok" }, "No output yet — run the preview to see console logs and runtime errors here, live.")
                : h(
                    "div",
                    { className: "cs-console-list" },
                    consoleLines.map((entry, i) =>
                      h(
                        "div",
                        { key: i, className: "cs-console-line", "data-level": entry.level },
                        h("span", { className: "cs-console-ts" }, new Date(entry.ts).toISOString().slice(11, 23)),
                        h("span", { className: "cs-console-msg" }, entry.message)
                      )
                    )
                  )
            ),
            h(
              "div",
              { className: "cs-panel-body", style: { display: panelTab === "preview" ? "block" : "none" } },
              h(
                "div",
                { className: "cs-preview-wrap" },
                previewError && h("div", { className: "cs-preview-error" }, previewError),
                h(
                  "div",
                  { style: { position: "relative", flex: 1, minHeight: 0 } },
                  // The preview host's CHILDREN are exclusively owned by the
                  // previewed plugin's OWN ReactDOM.createRoot() call (runPreview()
                  // below) once it mounts — this outer App must never also render
                  // JSX children into this exact node, or the two independent
                  // React reconcilers fight over the same DOM subtree (one sees a
                  // node the other already removed/replaced) and throw
                  // "NotFoundError: node to be removed is not a child of this
                  // node" the moment either side's next commit disagrees with the
                  // other's last one. The "click to run" placeholder is therefore
                  // a SIBLING, absolutely positioned on top, not a child.
                  h("div", { className: "cs-preview-host", ref: previewHostRef }),
                  previewState === "idle" && !previewError && h("div", { className: "cs-preview-placeholder" }, `Click "Run Preview" above to mount "${project.entryPath}" here, live.`)
                )
              )
            )
          )
        )
      ),
      modal && modal.type === "import-official" && h(ImportOfficialModal),
      modal &&
        !modal.type &&
        h(TextModal, {
          title: modal.title,
          fields: modal.fields,
          submitLabel: modal.submitLabel,
          onCancel: () => setModal(null),
          onSubmit: modal.onSubmit,
        })
    );
  }

  function store_normalize(p) {
    return p
      .split("/")
      .filter((seg) => seg.length > 0 && seg !== ".")
      .join("/");
  }

  const root = ReactDOM.createRoot(container);
  root.render(h(App));
  return () => {
    root.unmount();
  };
}
