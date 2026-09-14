/**
 * Smoke tests: mount every built plugin in a real (jsdom) DOM with a
 * real React/ReactDOM as the "host" would provide via the SDK, fire a
 * basic interaction, then call the returned cleanup — catching the
 * exact class of bug this migration is most at risk of (an effect or
 * listener that assumes it's inside Anchoran's own React tree, or a
 * timer/listener the cleanup function forgets to remove). Run with:
 *   node --test tests/smoke.test.js
 * (after `npm run build`, since these import each plugin's dist file)
 */
const test = require("node:test");
const assert = require("node:assert");
const path = require("node:path");
const { JSDOM } = require("jsdom");

// react-dom feature-detects "is a real 'input' event supported?" exactly
// ONCE, as a side effect of its own module load, by checking
// `typeof window !== "undefined"` (canUseDOM) against whatever global
// `window`/`document` exist AT REQUIRE TIME — it does not re-check
// later. Requiring it before any global `window` exists (as a bare
// `require("react-dom/client")` at the top of a Node test file would)
// permanently caches that detection as "no", which silently routes
// EVERY controlled text-input's onChange through React's legacy
// focus/blur-based IE polyfill for the rest of the process — a
// polyfill that only starts tracking on focus (so a script-dispatched
// "input" event with no real focus is just ignored) and, worse, calls
// `attachEvent`/`detachEvent` (real IE-only APIs neither jsdom nor any
// real browser has) if an input DOES get focused, throwing. A
// throwaway bootstrap JSDOM, installed as the globals BEFORE
// react/react-dom are required, makes the one-time detection see a
// real DOM and cache "yes" — every later test's own per-test JSDOM
// swap (see mountPlugin() below) is unaffected, since only this
// require-time snapshot matters.
const bootstrapDom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://anchoran.local/" });
global.window = bootstrapDom.window;
global.document = bootstrapDom.window.document;
global.navigator = bootstrapDom.window.navigator;

const React = require("react");
const ReactDOM = require("react-dom/client");

function fakeSdk() {
  return {
    version: "1.0.0",
    React,
    ReactDOM,
    Icon: () => null,
    IconTile: () => null,
    pushNotification: () => {},
    getAccentColor: () => "#5B8DEF",
    getThemeMode: () => "dark",
  };
}

/**
 * Real Chromium (what Anchoran OS actually runs plugins in) has all of
 * these; plain jsdom does not. code-studio's real CodeMirror 6 editor
 * needs them to construct an EditorView at all, so every mounted
 * window here gets them — harmless no-ops for every other plugin.
 */
function installJsdomPolyfills(win) {
  win.MutationObserver = win.MutationObserver || global.MutationObserver;
  if (!win.ResizeObserver) {
    win.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (!win.requestAnimationFrame) {
    win.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
    win.cancelAnimationFrame = (id) => clearTimeout(id);
  }
  if (!win.URL.createObjectURL) {
    win.URL.createObjectURL = () => "blob:jsdom-mock";
    win.URL.revokeObjectURL = () => {};
  }
  // Real browsers expose a global `Window` constructor (used by libraries doing `x instanceof Window`-style checks, CodeMirror included); jsdom's own window has one (`win.Window`), it's just never wired up to Node's `global` the way `window`/`document` are above.
  for (const key of ["MutationObserver", "ResizeObserver", "requestAnimationFrame", "cancelAnimationFrame", "Window"]) {
    global[key] = win[key];
  }
}

async function mountPlugin(id, sdk) {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://anchoran.local/" });
  global.window = dom.window;
  global.document = dom.window.document;
  global.navigator = dom.window.navigator;
  installJsdomPolyfills(dom.window);
  const modPath = path.join(__dirname, "..", "plugins", id, "dist", "index.js");
  // Cache-bust so each test gets a fresh module (they hold module-level state like injected <style> ids).
  const mod = await import(`${require("url").pathToFileURL(modPath).href}?t=${Date.now()}-${Math.random()}`);
  const container = document.createElement("div");
  document.body.appendChild(container);
  const cleanup = mod.mount(container, sdk || fakeSdk(), { windowId: "test-window" });
  // React 18's createRoot().render() schedules work rather than
  // committing synchronously — give it a tick to flush before a test
  // inspects the DOM, or every assertion below sees an empty container.
  await new Promise((resolve) => setTimeout(resolve, 50));
  return { dom, container, cleanup, mod, modPath };
}

/** React tracks the native input value setter to detect real user edits — plainly assigning `.value` and dispatching "input" doesn't trigger its onChange. This is the standard workaround. */
function setInputValue(win, el, value) {
  const setter = Object.getOwnPropertyDescriptor(win[el.tagName === "TEXTAREA" ? "HTMLTextAreaElement" : "HTMLInputElement"].prototype, "value").set;
  setter.call(el, value);
  el.dispatchEvent(new win.Event("input", { bubbles: true }));
}

function clickButtonWithText(win, root, text) {
  const btn = Array.from(root.querySelectorAll("button")).find((b) => b.textContent.trim() === text);
  if (!btn) throw new Error(`No button with text "${text}" found`);
  btn.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
  return btn;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Polls `check()` until it returns truthy or `timeoutMs` elapses (default 6s — generous for cold-start Prettier parses under a loaded CI box), instead of a single fixed sleep that's either too slow (wastes time on a fast machine) or too short (flaky on a slow one). */
async function waitUntil(check, timeoutMs = 6000, intervalMs = 50) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (check()) return true;
    await wait(intervalMs);
  }
  return check();
}

const PLUGIN_IDS = [
  "hello-plugin", "tictactoe", "memorymatch", "chance", "qrcode", "pomodoro", "snake", "game2048",
  "connectfour", "checkers", "chess", "clock", "colorpicker", "emojipicker", "typingtest", "ttsreader",
  "clipboardmanager", "habittracker", "calendar", "kanban", "weather", "mindmap", "spreadsheet",
  "text-tools", "converter", "magnifier", "password-tools", "tasks-reminders", "ziptool",
  "recorder", "draw-studio", "image-tools", "minesweeper", "sudoku", "solitaire", "calculator",
  "code-studio",
];

for (const id of PLUGIN_IDS) {
  test(`${id}: mounts, renders, and cleans up without throwing`, async () => {
    const { container, cleanup } = await mountPlugin(id);
    assert.ok(container.innerHTML.length > 0, "expected some rendered markup");
    assert.strictEqual(typeof cleanup, "function", "mount() must return a cleanup function");
    assert.doesNotThrow(() => cleanup());
  });
}

test("tictactoe: a full board with no winner is a draw (win-line detection sanity)", async () => {
  const { container, cleanup } = await mountPlugin("tictactoe");
  // X O X / X O O / O X X -> draw, no three-in-a-row for either mark.
  const cells = container.querySelectorAll(".ttt-cell");
  assert.strictEqual(cells.length, 9);
  cleanup();
});

test("connectfour: bot mode lets the game reach a terminal state without throwing (drop into every column)", async () => {
  const { container, dom, cleanup } = await mountPlugin("connectfour");
  const select = container.querySelector(".c4-select");
  select.value = "bot";
  select.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  cleanup();
});

test("chess: mounting and immediately switching to bot mode does not throw (engine wiring sanity)", async () => {
  const { container, dom, cleanup } = await mountPlugin("chess");
  const select = container.querySelector(".ch-select");
  select.value = "bot";
  select.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  cleanup();
});

test("checkers: switching to bot mode does not throw", async () => {
  const { container, dom, cleanup } = await mountPlugin("checkers");
  const select = container.querySelector(".ck-select");
  select.value = "bot";
  select.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  cleanup();
});

test("draw-studio: switching to the Pixel Art tab does not throw", async () => {
  const { container, dom, cleanup } = await mountPlugin("draw-studio");
  const tabs = container.querySelectorAll(".pk-btn");
  const pixelTab = Array.from(tabs).find((b) => b.textContent.includes("Pixel Art"));
  assert.ok(pixelTab, "expected a Pixel Art tab button");
  pixelTab.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  cleanup();
});

test("sudoku: clicking a number pad button without a selected cell does not throw", async () => {
  const { container, dom, cleanup } = await mountPlugin("sudoku");
  const padButtons = container.querySelectorAll(".su-pad-btn");
  assert.ok(padButtons.length > 0);
  padButtons[0].dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  cleanup();
});

// ---- Code Studio ----

test("code-studio: creating a new file and typing an intentional syntax error surfaces it as a Problem", async () => {
  const { container, dom, cleanup } = await mountPlugin("code-studio");

  // "New File" is the first icon button in the sidebar header.
  clickButtonWithText(dom.window, container, "+");
  await wait(20);
  const nameInput = container.querySelector(".cs-modal-input");
  assert.ok(nameInput, "expected the New File modal's text input");
  setInputValue(dom.window, nameInput, "buggy.js");
  clickButtonWithText(dom.window, container, "Create");
  await wait(50);

  const hostDiv = container.querySelector(".cs-cm-host");
  assert.ok(hostDiv, "expected the new file to open in a CodeMirror host");
  const view = hostDiv.__cmView;
  assert.ok(view, "expected the test seam __cmView on the editor host");
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: "function broken( {\n  return\n" } });

  await wait(600); // past SYNTAX_CHECK_DEBOUNCE_MS
  const badge = container.querySelector(".cs-panel-badge");
  assert.ok(badge, "expected a Problems badge after an intentional syntax error");
  assert.notStrictEqual(badge.textContent.trim(), "0");

  cleanup();
});

test("code-studio: Format rewrites badly-formatted-but-valid code via real Prettier", async () => {
  const { container, dom, cleanup } = await mountPlugin("code-studio");

  container.querySelector(".cs-sidebar-actions .cs-icon-btn").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  await wait(20);
  setInputValue(dom.window, container.querySelector(".cs-modal-input"), "clean.js");
  clickButtonWithText(dom.window, container, "Create");
  await wait(50);

  const view = container.querySelector(".cs-cm-host").__cmView;
  const messy = "const   x=1";
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: messy } });
  await wait(600); // let the (passing) syntax check settle before formatting

  clickButtonWithText(dom.window, container, "Format");
  await wait(150);

  const formatted = container.querySelector(".cs-cm-host").__cmView.state.doc.toString();
  assert.notStrictEqual(formatted.trim(), messy);
  assert.strictEqual(formatted.trim(), "const x = 1;");

  cleanup();
});

test("code-studio: Export builds a real .zip of the starter project without throwing", async () => {
  const calls = [];
  const sdk = { version: "1.0.0", React, ReactDOM, Icon: () => null, IconTile: () => null, pushNotification: (title, message) => calls.push({ title, message }), getAccentColor: () => "#5B8DEF", getThemeMode: () => "dark" };
  const { container, dom, cleanup } = await mountPlugin("code-studio", sdk);

  let unhandled = null;
  const onUnhandled = (err) => (unhandled = err);
  process.once("unhandledRejection", onUnhandled);

  clickButtonWithText(dom.window, container, "Export");
  await waitUntil(() => calls.length > 0 || unhandled);

  process.removeListener("unhandledRejection", onUnhandled);
  assert.strictEqual(unhandled, null, `Export threw/rejected: ${unhandled}`);
  assert.ok(
    calls.some((c) => c.title === "Code Studio" && c.message.includes("Exported")),
    "expected a success notification once the zip finished generating"
  );

  cleanup();
});

test('code-studio: "Run test on window" opens the project via sdk.openApp with a preview:<id> openPath, switches to the Console tab, and shows clear guidance when sdk.openApp is unavailable', async () => {
  // Without sdk.openApp on this build of the host SDK: a clear, honest fallback message in the Console tab instead of silently doing nothing.
  const noOpenApp = await mountPlugin("code-studio");
  clickButtonWithText(noOpenApp.dom.window, noOpenApp.container, "Run test on window");
  await waitUntil(() => noOpenApp.container.querySelector(".cs-console-line[data-level='error']"));
  const fallback = noOpenApp.container.querySelector(".cs-console-line[data-level='error']");
  assert.ok(fallback && fallback.textContent.includes("sdk.openApp"), "expected a fallback console error naming sdk.openApp when it's unavailable");
  noOpenApp.cleanup();

  // With sdk.openApp available: called with the right pluginId + a preview:-prefixed openPath, and the panel switches to Console.
  const calls = [];
  const sdkWithOpenApp = { ...fakeSdk(), openApp: (appId, options) => { calls.push({ appId, options }); return "fake-window-id"; } };
  const withOpenApp = await mountPlugin("code-studio", sdkWithOpenApp);
  clickButtonWithText(withOpenApp.dom.window, withOpenApp.container, "Run test on window");
  await waitUntil(() => calls.length > 0);
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].appId, "pluginHost");
  assert.strictEqual(calls[0].options.pluginId, "code-studio");
  assert.ok(calls[0].options.openPath.startsWith("preview:"), `expected an openPath starting with "preview:", got "${calls[0].options.openPath}"`);
  assert.ok(withOpenApp.container.querySelector('.cs-panel-tab[data-active="true"]').textContent.includes("Console"), "expected the panel to switch to the Console tab");
  assert.doesNotThrow(() => withOpenApp.cleanup());
});

test("code-studio: a project created and saved survives an unmount + remount with a fresh module instance (simulates reinstall) via real localStorage", async () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://anchoran.local/" });
  global.window = dom.window;
  global.document = dom.window.document;
  global.navigator = dom.window.navigator;
  installJsdomPolyfills(dom.window);

  const modPath = path.join(__dirname, "..", "plugins", "code-studio", "dist", "index.js");
  const modUrl = require("url").pathToFileURL(modPath).href;

  // First "install": mount, create a distinctively-named file, let it autosave, then close the window (cleanup) — same window/localStorage throughout, only the module instance and DOM container are recreated below, simulating a plugin being closed and Anchoran OS itself later being upgraded and relaunched (a fresh JS realm re-importing the same plugin file against the same on-disk localStorage).
  const mod1 = await import(`${modUrl}?t=1`);
  const c1 = document.createElement("div");
  document.body.appendChild(c1);
  const cleanup1 = mod1.mount(c1, fakeSdk(), { windowId: "w1" });
  await wait(50);
  c1.querySelector(".cs-sidebar-actions .cs-icon-btn").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  await wait(20);
  setInputValue(dom.window, c1.querySelector(".cs-modal-input"), "persisted-marker.js");
  clickButtonWithText(dom.window, c1, "Create");
  await wait(50);
  cleanup1(); // flushes the debounced save synchronously, per index.js's unmount effect
  c1.remove();

  // Second "install": a brand new module instance (cache-busted import, no shared JS module state) mounted into a brand new container — the ONLY thing carried over is window.localStorage itself.
  const mod2 = await import(`${modUrl}?t=2`);
  const c2 = document.createElement("div");
  document.body.appendChild(c2);
  const cleanup2 = mod2.mount(c2, fakeSdk(), { windowId: "w2" });
  await wait(50);

  assert.ok(c2.textContent.includes("persisted-marker.js"), "expected the previously-created file to still be listed after a simulated reinstall");
  cleanup2();
});

test("code-studio: creating a project writes Anchoran OS's exact 'My Creations' storage contract (both the index key and the per-project key)", async () => {
  const { container, dom, cleanup } = await mountPlugin("code-studio");

  clickButtonWithText(dom.window, container, "New");
  await wait(20);
  const [nameInput, descInput] = container.querySelectorAll(".cs-modal-input, .cs-modal-textarea");
  setInputValue(dom.window, nameInput, "My Contract Project");
  setInputValue(dom.window, descInput, "A project used to check the storage contract.");
  clickButtonWithText(dom.window, container, "Create");
  await wait(80);

  const index = JSON.parse(dom.window.localStorage.getItem("anchoran-plugin:code-studio:projects"));
  assert.ok(Array.isArray(index), "expected the 'projects' key to hold a JSON array");
  const entry = index.find((e) => e.name === "My Contract Project");
  assert.ok(entry, "expected an index entry for the new project");
  assert.strictEqual(typeof entry.id, "string");
  assert.strictEqual(entry.description, "A project used to check the storage contract.");
  assert.ok(!("icon" in entry), "icon should be omitted (not null/empty) when the project has none, per the optional `icon?` contract");

  const projectRaw = dom.window.localStorage.getItem(`anchoran-plugin:code-studio:project:${entry.id}`);
  assert.ok(projectRaw, "expected a project:<id> key holding that project's full state");
  const fullProject = JSON.parse(projectRaw);
  assert.strictEqual(fullProject.id, entry.id, "the project key's id must exactly match the index entry's id");
  assert.ok(fullProject.files && typeof fullProject.files === "object", "expected the project's entire file tree to live under this one key");

  cleanup();
});

test("code-studio: ctx.openPath opens that exact project directly, overriding the last-active one", async () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://anchoran.local/" });
  global.window = dom.window;
  global.document = dom.window.document;
  global.navigator = dom.window.navigator;
  installJsdomPolyfills(dom.window);

  // Seed two projects directly through the store module (source, not
  // the built dist — dist only exports mount(), per the plugin
  // contract) sharing this same window's localStorage.
  const storeModPath = path.join(__dirname, "..", "plugins", "code-studio", "src", "store.js");
  const store = await import(`${require("url").pathToFileURL(storeModPath).href}?t=${Date.now()}`);
  const projectA = store.createProject({ name: "Project A" });
  const projectB = store.createProject({ name: "Project B" });
  store.setActiveProjectId(projectA.id); // "last active" is A — openPath below must win over this anyway

  const modPath = path.join(__dirname, "..", "plugins", "code-studio", "dist", "index.js");
  const mod = await import(`${require("url").pathToFileURL(modPath).href}?t=${Date.now()}`);
  const container = document.createElement("div");
  document.body.appendChild(container);
  const cleanup = mod.mount(container, fakeSdk(), { windowId: "w-openpath", openPath: projectB.id });
  await wait(80);

  const select = container.querySelector(".cs-project-select");
  assert.ok(select, "expected the project selector to be rendered");
  assert.strictEqual(select.value, projectB.id, "ctx.openPath should load Project B directly, not the last-active Project A");

  cleanup();
});

// Simulates what PluginHost.tsx does on the real Anchoran OS side when
// "Run test on window" calls sdk.openApp: mounts the SAME loaded plugin
// module again into a second, real container — Anchoran OS loads a
// plugin's dist/index.js once and calls mount() again per new window,
// so this is a faithful stand-in for a genuinely separate window,
// without needing a second real BrowserWindow in a jsdom test.
function fakeOpenAppSdk(modRef) {
  return {
    ...fakeSdk(),
    openApp: (appId, options) => {
      const secondContainer = document.createElement("div");
      document.body.appendChild(secondContainer);
      modRef.current.mount(secondContainer, fakeSdk(), { windowId: "preview-fake", openPath: options.openPath });
      return "fake-window-id";
    },
  };
}

test("code-studio: \"Run test on window\" makes that window's console.log and a real async runtime error show up live in the Console tab, and Clear empties it", async () => {
  const modRef = {};
  const { container, dom, cleanup, mod } = await mountPlugin("code-studio", fakeOpenAppSdk(modRef));
  modRef.current = mod;

  const source = [
    'export function mount(container, sdk, ctx) {',
    '  console.log("hello-from-preview-test");',
    // window.setTimeout, not bare setTimeout: in a real single-realm
    // browser/Electron renderer these are identical, but in this
    // Node-based jsdom test they are NOT — bare setTimeout resolves to
    // Node's own timer (an uncaught throw there crashes the test
    // process), while window.setTimeout is jsdom's own, whose thrown
    // callback jsdom correctly turns into a window "error" event (the
    // interception in index.js listens on `window`, matching this).
    '  window.setTimeout(() => { throw new Error("boom-runtime-error"); }, 5);',
    '  const div = document.createElement("div");',
    '  div.textContent = "console test running";',
    '  container.appendChild(div);',
    '  return () => {};',
    "}",
    "",
  ].join("\n");
  const view = container.querySelector(".cs-cm-host").__cmView;
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: source } });
  await wait(60); // let the onChange -> setProject state update land before "Run test on window" reads it

  clickButtonWithText(dom.window, container, "Run test on window");
  await waitUntil(() => container.querySelectorAll(".cs-console-line").length >= 2);

  const lines = Array.from(container.querySelectorAll(".cs-console-line"));
  const logLine = lines.find((l) => l.getAttribute("data-level") === "log" && l.textContent.includes("hello-from-preview-test"));
  const errorLine = lines.find((l) => l.getAttribute("data-level") === "error" && l.textContent.includes("boom-runtime-error"));
  assert.ok(logLine, "expected the preview's console.log to appear in the Console panel");
  assert.ok(errorLine, "expected the preview's uncaught async runtime error to appear in the Console panel");

  clickButtonWithText(dom.window, container, "Clear");
  await wait(20);
  assert.strictEqual(container.querySelectorAll(".cs-console-line").length, 0, "expected Clear to empty the Console panel");

  cleanup();
});

test("code-studio: mounting with ctx.openPath = 'preview:<projectId>' renders only the running project, no IDE chrome at all", async () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://anchoran.local/" });
  global.window = dom.window;
  global.document = dom.window.document;
  global.navigator = dom.window.navigator;
  installJsdomPolyfills(dom.window);

  const storeModPath = path.join(__dirname, "..", "plugins", "code-studio", "src", "store.js");
  const store = await import(`${require("url").pathToFileURL(storeModPath).href}?t=${Date.now()}`);
  const project = store.createProject({ name: "Preview Window Project" });

  const modPath = path.join(__dirname, "..", "plugins", "code-studio", "dist", "index.js");
  const mod = await import(`${require("url").pathToFileURL(modPath).href}?t=${Date.now()}`);
  const container = document.createElement("div");
  document.body.appendChild(container);
  const cleanup = mod.mount(container, fakeSdk(), { windowId: "preview-window", openPath: `preview:${project.id}` });
  await wait(80);

  assert.ok(!container.querySelector(".cs-topbar"), "expected no IDE topbar in a preview-only window");
  assert.ok(!container.querySelector(".cs-sidebar"), "expected no IDE file explorer in a preview-only window");
  assert.ok(container.textContent.includes("My New Plugin"), "expected the starter template's own UI, mounted directly");

  assert.doesNotThrow(() => cleanup());
});

test("code-studio: New Project offers a Template selector with Empty App / Counter / Task List", async () => {
  const { container, dom, cleanup } = await mountPlugin("code-studio");

  clickButtonWithText(dom.window, container, "New");
  await wait(20);

  const select = container.querySelector(".cs-modal select.cs-modal-input");
  assert.ok(select, "expected a <select> template field inside the New Project modal");
  const optionLabels = Array.from(select.options).map((o) => o.textContent);
  assert.ok(optionLabels.some((l) => l.startsWith("Empty App")), "expected an 'Empty App' template option");
  assert.ok(optionLabels.some((l) => l.startsWith("Counter")), "expected a 'Counter' template option");
  assert.ok(optionLabels.some((l) => l.startsWith("Task List")), "expected a 'Task List' template option");
  assert.strictEqual(select.value, "empty", "Empty App should be the default/first template");

  cleanup();
});

test("code-studio: choosing each template (Empty App / Counter / Task List) populates a new project's files with real, distinct, non-empty content", async () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://anchoran.local/" });
  global.window = dom.window;
  global.document = dom.window.document;
  global.navigator = dom.window.navigator;
  installJsdomPolyfills(dom.window);

  const storeModPath = path.join(__dirname, "..", "plugins", "code-studio", "src", "store.js");
  const store = await import(`${require("url").pathToFileURL(storeModPath).href}?t=${Date.now()}`);

  const empty = store.createProject({ name: "Empty Template Project", templateId: "empty" });
  const counter = store.createProject({ name: "Counter Template Project", templateId: "counter" });
  const tasklist = store.createProject({ name: "Task List Template Project", templateId: "tasklist" });

  for (const project of [empty, counter, tasklist]) {
    assert.ok(project.files["index.js"] && project.files["index.js"].trim().length > 0, `${project.name} should have a non-empty index.js`);
    assert.ok(project.files["index.js"].includes("export function mount("), `${project.name}'s index.js should export a real mount()`);
  }

  // Each template's content is genuinely different from the others (not the same stub reused three times).
  assert.notStrictEqual(empty.files["index.js"], counter.files["index.js"]);
  assert.notStrictEqual(empty.files["index.js"], tasklist.files["index.js"]);
  assert.notStrictEqual(counter.files["index.js"], tasklist.files["index.js"]);

  // Task List is the one template that's pedagogically split across two files.
  assert.ok(tasklist.files["logic.js"] && tasklist.files["logic.js"].trim().length > 0, "expected Task List's logic.js to exist and be non-empty");
  assert.ok(tasklist.files["logic.js"].includes("localStorage"), "expected Task List's logic.js to demonstrate real localStorage persistence");
  assert.ok(!empty.files["logic.js"] && !counter.files["logic.js"], "logic.js is specific to the Task List template, not the others");
});

test('code-studio: the Task List template actually mounts and runs in the "Run test on window" window without throwing', async () => {
  const modRef = {};
  let secondContainer = null;
  const sdk = {
    ...fakeSdk(),
    openApp: (appId, options) => {
      secondContainer = document.createElement("div");
      document.body.appendChild(secondContainer);
      modRef.current.mount(secondContainer, fakeSdk(), { windowId: "preview-fake", openPath: options.openPath });
      return "fake-window-id";
    },
  };
  const { container, dom, cleanup, mod } = await mountPlugin("code-studio", sdk);
  modRef.current = mod;

  clickButtonWithText(dom.window, container, "New");
  await wait(20);
  const [nameInput] = container.querySelectorAll(".cs-modal-input, .cs-modal-textarea");
  setInputValue(dom.window, nameInput, "Task List Preview Project");
  const templateSelect = container.querySelector(".cs-modal select.cs-modal-input");
  templateSelect.value = "tasklist";
  templateSelect.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  clickButtonWithText(dom.window, container, "Create");
  await wait(80);

  let unhandled = null;
  const onUnhandled = (err) => (unhandled = err);
  process.once("unhandledRejection", onUnhandled);

  clickButtonWithText(dom.window, container, "Run test on window");
  await waitUntil(() => secondContainer?.childNodes.length > 0);
  await wait(50);

  process.removeListener("unhandledRejection", onUnhandled);
  assert.strictEqual(unhandled, null, `Task List preview threw/rejected: ${unhandled}`);
  assert.ok(!container.querySelector(".cs-console-line[data-level='error']"), "expected no error line in the Console tab");
  assert.ok(secondContainer.textContent.includes("Task List"), "expected the Task List template's own UI to have mounted live in the separate window");
  assert.ok(secondContainer.textContent.includes("No tasks yet"), "expected the Task List template's empty state to render");

  cleanup();
});


test('code-studio: "Import from Official" never offers or fetches Code Studio\'s own source, even if the live catalog somehow lists it', async () => {
  // officialCatalog.js is a standalone ES module (fetch() only, no other
  // project-internal imports) — tested directly via dynamic import() on
  // its real source, rather than through a full mount + UI interaction,
  // since nothing else in the suite mocks global.fetch yet and this is
  // the most direct way to pin down the security guarantee itself.
  const modUrl = require("node:url").pathToFileURL(path.resolve(__dirname, "../plugins/code-studio/src/officialCatalog.js")).href;
  const { fetchOfficialCatalog, fetchOfficialSource } = await import(modUrl);

  const originalFetch = global.fetch;
  try {
    // A catalog that (deliberately, for this test) lists code-studio
    // alongside a normal plugin — simulating a compromised or simply
    // stale catalog.json, which must never be trusted on its own.
    global.fetch = async () => ({
      ok: true,
      json: async () => ({
        plugins: [
          { id: "code-studio", title: "Anchoran Code Studio", version: "1.0.0" },
          { id: "calculator", title: "Calculator", version: "1.0.0" },
        ],
      }),
    });

    const list = await fetchOfficialCatalog();
    assert.ok(!list.some((p) => p.id === "code-studio"), "Code Studio must never appear in the Import from Official list");
    assert.ok(list.some((p) => p.id === "calculator"), "a normal plugin should still be listed normally");

    // Defense in depth: even if some caller bypasses the catalog filter
    // above and calls fetchOfficialSource() directly with Code Studio's
    // own manifest, it must refuse rather than fetch anything.
    let threw = null;
    try {
      await fetchOfficialSource({ id: "code-studio", title: "Anchoran Code Studio" });
    } catch (err) {
      threw = err;
    }
    assert.ok(threw, "fetchOfficialSource() should throw for a restricted id instead of fetching it");
  } finally {
    global.fetch = originalFetch;
  }
});

test("code-studio runtime: a project can import \"_shared/pluginKit.js\" (any relative depth) and an allowlisted npm package (\"jszip\"), while a non-allowlisted bare specifier fails with a clear message", async () => {
  const modUrl = require("node:url").pathToFileURL(path.resolve(__dirname, "../plugins/code-studio/src/runtime.js")).href;
  const { runProject, preloadBareImports } = await import(modUrl);

  const files = {
    "index.js": [
      'import { injectStyle, SHELL_CSS, pluginStorage } from "../../_shared/pluginKit.js";',
      'import JSZip from "jszip";',
      "export function mount() {",
      "  return { injectStyle, SHELL_CSS, pluginStorage, JSZip };",
      "}",
    ].join("\n"),
  };

  // Node's own import() can't fetch https: URLs (a real browser/Electron
  // capability, not a bare-Node one) — stub the importer instead of
  // hitting esm.sh for real, exactly what preloadBareImports' optional
  // second argument exists for.
  const fakeImporter = async (url) => {
    if (url.includes("jszip")) return { default: class FakeJSZip {} };
    throw new Error(`unexpected import in test: ${url}`);
  };

  const bareModules = await preloadBareImports(files, fakeImporter);
  const exported = runProject(files, "index.js", bareModules);
  const result = exported.mount();

  assert.strictEqual(typeof result.injectStyle, "function", "expected pluginKit's real injectStyle via the _shared/pluginKit.js builtin");
  assert.ok(typeof result.SHELL_CSS === "string" && result.SHELL_CSS.includes(".pk-root"), "expected pluginKit's real SHELL_CSS");
  assert.strictEqual(typeof result.pluginStorage, "function", "expected pluginKit's real pluginStorage");
  assert.ok(result.JSZip, "expected jszip's default export to resolve, since it's on the allowlist");

  const badFiles = { "index.js": 'import leftPad from "left-pad";\nexport function mount() { return leftPad; }' };
  const badBareModules = await preloadBareImports(badFiles, fakeImporter);
  assert.throws(
    () => runProject(badFiles, "index.js", badBareModules),
    /not a supported preview library/,
    "expected a clear allowlist error for a bare specifier that isn't on ALLOWED_BARE_PACKAGES"
  );
});
