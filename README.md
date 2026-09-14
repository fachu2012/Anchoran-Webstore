# Anchoran Webstore

The plugin catalog for [Anchoran OS](https://github.com/fachu2012/Anchoran-OS)'s
Webstore — versioned and released independently of Anchoran OS itself, so a new
or updated app never requires a new Anchoran OS release. Anchoran OS fetches
`catalog.json` from this repo's latest `v#.#.#` release live, every time the
Webstore's Community section opens.

## How it works

- `catalog.json` lists every published plugin: `id`, `title`, `version`,
  `minAnchoranVersion` (the oldest Anchoran OS build that can run it), and
  `entry` — a direct URL to that plugin's built, downloadable JS file.
- Each plugin lives under `plugins/<id>/`, with its real source in `src/` and
  its built, minified output in `dist/index.js` — that `dist` file is exactly
  what Anchoran OS downloads and runs, nothing else.
- Anchoran OS never bundles this code. When someone clicks Install in the
  Webstore, Anchoran downloads that one file to its own local plugin storage
  and dynamically loads it from there.

## The Anchoran App SDK

A plugin never imports Anchoran OS's own internal modules — those have no
compatibility promise and change freely between Anchoran versions. Instead,
a plugin's built file exports one function:

```js
export function mount(container, sdk, ctx) {
  // container: a real DOM element, sized to the plugin's own window
  // sdk: the Anchoran App SDK (see below) — the only host API surface
  // ctx: { windowId } — this window's id, e.g. for logging/debugging
  //
  // Return a cleanup function, called when the window closes.
  return () => {
    /* unmount / stop timers / etc. */
  };
}
```

`sdk` (shape versioned by `sdk.version`, currently `"1.0.0"` — see
`catalog.json`'s own `sdkVersion`, which is the SDK version every plugin here
is built against) currently exposes:

- `sdk.React`, `sdk.ReactDOM` — the *host's own* React/ReactDOM. A plugin
  renders through these (e.g. `sdk.ReactDOM.createRoot(container).render(...)`)
  instead of shipping its own copy — smaller downloads, and no risk of two
  React instances on one page.
- `sdk.Icon`, `sdk.IconTile` — Anchoran's own icon components, for a plugin
  that wants to look native.
- `sdk.pushNotification(title, message)` — pushes a real Anchoran
  notification.
- `sdk.getAccentColor()`, `sdk.getThemeMode()` — read the user's current
  theme, so a plugin's own UI can match it.

The SDK only ever grows in backward-compatible ways. A plugin built against
SDK 1.0 keeps working on every later Anchoran OS release.

## Building a plugin

```bash
npm install
npm run build
```

Bundles every `plugins/<id>/src/index.js` into `plugins/<id>/dist/index.js`
via esbuild — `react`/`react-dom` are never bundled in, since a plugin talks
to the host's copy through `sdk` instead of importing them itself.

## Plugin roster (v2.0.0)

37 plugins as of this release: the pilot `hello-plugin`, 28 apps ported
1:1 from Anchoran OS's old bundled app list (calculator, chat, pomodoro,
qrcode, snake, game2048, tictactoe, memorymatch, checkers, connectfour,
minesweeper, sudoku, solitaire, chess, calendar, kanban, habittracker,
weather, mindmap, spreadsheet, emojipicker, typingtest, ttsreader,
clipboardmanager, ziptool, colorpicker, clock, magnifier), and 8 groups
fused from apps that shared the same real purpose instead of shipping
near-duplicate plugins: `chance` (dice + coin), `text-tools` (JSON
formatter + word counter + text diff + encode/decode), `converter`
(units + currency), `password-tools` (generator + vault + strength
checker), `recorder` (screen + voice), `draw-studio` (paint + pixel
art, with layers/fill/shapes/undo added), `image-tools` (screenshot +
wallpaper maker), and `tasks-reminders` (todo + reminders).

`tictactoe`, `checkers`, `connectfour` and `chess` — every 2-player
game in the roster — also ship a bot opponent (Easy/Medium/Hard).

Four apps that used to be bundled apps stay core to Anchoran OS instead
of becoming plugins: `notes`, `photoViewer`, `mediaPlayer` and
`browser` are wired in as Files'/Launcher's own default file-type and
URL handlers, not user-installable apps, so they're not in this catalog.
A further group (systemMonitor, networkMonitor, storageUsage,
eventViewer, startupApps, recycleBin, onScreenKeyboard, narrator,
embeddedApp) stayed core because they need privileged host access
(real CPU/network/disk stats, the internal event log, startup-app
config, the virtual filesystem, system-level input hooks) that the App
SDK deliberately doesn't expose to third-party code.

## Testing a plugin

```bash
npm install
npm run build
npm test
```

`tests/smoke.test.js` mounts every plugin in a real jsdom + React 18
DOM (with the `canvas` package for real `<canvas>` support) using a
fake SDK, fires a basic interaction, and calls the returned cleanup —
catching the class of bug this repo's plugins are most at risk of: an
effect or listener written as if it's still inside Anchoran's own React
tree, or a timer/listener the cleanup function forgets to remove.

## Publishing

Bump `catalog.json`'s relevant plugin `version` (and `package.json`'s own
version for this repo, its overall release), commit, tag `v#.#.#` classically
(no `Version # | Build …` styling — that convention is Anchoran OS's own),
and push. A GitHub Release at that tag, with `catalog.json` and every
`plugins/*/dist/index.js` attached, is what Anchoran OS actually reads.
