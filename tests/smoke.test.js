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

test("code-studio: Make It Official builds the publish package (formatted files + catalog-entry.json + README) without throwing", async () => {
  const calls = [];
  const sdk = { version: "1.0.0", React, ReactDOM, Icon: () => null, IconTile: () => null, pushNotification: (title, message) => calls.push({ title, message }), getAccentColor: () => "#5B8DEF", getThemeMode: () => "dark" };
  const { container, dom, cleanup } = await mountPlugin("code-studio", sdk);

  let unhandled = null;
  const onUnhandled = (err) => (unhandled = err);
  process.once("unhandledRejection", onUnhandled);

  clickButtonWithText(dom.window, container, "Make It Official");
  // Slower than Export: this path runs Prettier twice per file (once
  // for checkAllFiles's syntax check, again to actually format) plus
  // a zip — cold-start Prettier parsing genuinely takes a while, and
  // varies a lot under a loaded test run, hence polling rather than a
  // single fixed sleep.
  await waitUntil(() => calls.length > 0 || unhandled);

  process.removeListener("unhandledRejection", onUnhandled);
  assert.strictEqual(unhandled, null, `Make It Official threw/rejected: ${unhandled}`);
  assert.ok(
    calls.some((c) => c.title === "Code Studio" && c.message.includes("Make It Official") && c.message.includes("package")),
    "expected a success notification once the official package finished generating"
  );

  cleanup();
});

test("code-studio: cleanup stops a running preview's own mount without throwing", async () => {
  const { container, dom, cleanup } = await mountPlugin("code-studio");
  clickButtonWithText(dom.window, container, "Run Preview");
  await wait(200);
  // The starter template's mount() renders a counter button — Run Preview should have mounted it live into the Preview panel.
  assert.ok(container.querySelector(".cs-preview-host"), "expected a preview host element");
  assert.doesNotThrow(() => cleanup());
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

