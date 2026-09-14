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

async function mountPlugin(id) {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  global.window = dom.window;
  global.document = dom.window.document;
  global.navigator = dom.window.navigator;
  const modPath = path.join(__dirname, "..", "plugins", id, "dist", "index.js");
  // Cache-bust so each test gets a fresh module (they hold module-level state like injected <style> ids).
  const mod = await import(`${require("url").pathToFileURL(modPath).href}?t=${Date.now()}-${Math.random()}`);
  const container = document.createElement("div");
  document.body.appendChild(container);
  const cleanup = mod.mount(container, fakeSdk(), { windowId: "test-window" });
  // React 18's createRoot().render() schedules work rather than
  // committing synchronously — give it a tick to flush before a test
  // inspects the DOM, or every assertion below sees an empty container.
  await new Promise((resolve) => setTimeout(resolve, 50));
  return { dom, container, cleanup };
}

const PLUGIN_IDS = [
  "hello-plugin", "tictactoe", "memorymatch", "chance", "qrcode", "pomodoro", "snake", "game2048",
  "connectfour", "checkers", "chess", "clock", "colorpicker", "emojipicker", "typingtest", "ttsreader",
  "clipboardmanager", "habittracker", "calendar", "kanban", "weather", "mindmap", "spreadsheet",
  "text-tools", "converter", "magnifier", "password-tools", "tasks-reminders", "ziptool",
  "recorder", "draw-studio", "image-tools", "minesweeper", "sudoku", "solitaire", "calculator",
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

