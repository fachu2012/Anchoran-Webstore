# Changelog

All notable changes to the Anchoran Webstore's plugin catalog are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this repo adheres to classic [Semantic Versioning](https://semver.org/) (`v#.#.#`) —
a separate, independent version line from Anchoran OS's own "Version # | Build #H#.#" one.

## [2.5.0] - 2026-09-14

### Security
- **Code Studio's "Import from Official" can no longer clone Code
  Studio's own source.** It always offered every published plugin as
  a forkable starting point, Code Studio itself included — exposing
  its own internals (module resolver, the exact `localStorage`
  contract "My Creations" reads, how publishing works) would let
  anyone study it end-to-end looking for ways to abuse the mechanism.
  `officialCatalog.js` now excludes it from the list and refuses to
  fetch its source even if called directly.

### Added
- **Code Studio's Preview can now run projects that import
  `_shared/pluginKit.js`** (this repo's own shared helper, used by
  most real plugins) **or a curated allowlist of ~30 common npm
  packages** (jszip, lodash, dayjs, zod, date-fns, papaparse, marked,
  and more — see `runtime.js`'s `ALLOWED_BARE_PACKAGES`), fetched live
  from esm.sh. Deliberately an allowlist, not an open resolver, so a
  project's own source can never make the Preview fetch and run
  arbitrary remote code.
- **Real TypeScript support**: `.ts`/`.tsx` files get real TypeScript
  syntax highlighting, checking and formatting (Prettier's own
  `typescript` parser), and their types are stripped (via Sucrase) so
  they run in Preview and ship as real, plain `.js` in Export — this
  repo, and Anchoran OS itself, only ever run JavaScript, so authoring
  in TypeScript is a Code Studio-only convenience.
- **"Run test on window"** replaces the old separate "Run Preview" /
  "Open in Window" buttons: one button opens the project in a real,
  separate Anchoran window (in the foreground) while Code Studio's own
  Console tab (in the background) shows that window's console output
  and runtime errors live.
- **Copy** button on the Console panel, to copy its full output.
- Removed the **"Make It Official"** button — Export already covers
  getting your project's files out of Code Studio.

## [2.4.0] - 2026-09-14

### Added
- **Anchoran Code Studio gains starter templates for New Project.**
  Creating a project now offers a Template selector instead of always
  starting from a blank file:
  - **Empty App** (default) — the same minimal `mount()` New Project
    always opened with.
  - **Counter** — a classic React local-state example (+/- buttons,
    reset), using `sdk.React`/`sdk.ReactDOM` the same way every real
    Anchoran plugin does.
  - **Task List** — add/complete/delete tasks, persisted to the
    project's own namespaced `localStorage` (the same pattern real
    catalog plugins use), deliberately split into two files
    (`logic.js` for data/persistence, `index.js` for UI) as a small,
    real example of a multi-file plugin — Code Studio's own module
    resolver already links a project's own files together.
  - Every template's files are real, valid, and preview-runnable
    immediately with no edits required — no empty placeholders.
- **`catalog.json` gains a `category` field on every plugin entry**
  (`Games`, `Productivity`, `Utilities`, `Internet`, `System`), and an
  optional `recentChanges` field (a short per-plugin version history,
  distinct from this shared changelog) — both purely additive data for
  Anchoran OS's own Webstore UI to read; this repo's own manifest
  loading and build are unaffected.

## [2.3.0] - 2026-09-14

### Added
- **Anchoran Code Studio gains a Console/Output panel**, next to
  Problems and Preview — captures the project's own `console.log`/
  `warn`/`error`/`info` calls and real runtime errors (both synchronous
  and async, via `error`/`unhandledrejection` listeners) while the
  embedded Preview is running, each entry timestamped and color-coded
  by level, with a "Clear" button. All interception is installed only
  while a preview is actually running and always torn down afterward.
- **"Open in Window"** — runs the project's current in-memory code in
  a real, separate Anchoran window (no IDE chrome at all), not just
  the embedded Preview panel — the same `pluginHost` + `ctx.openPath`
  mechanism "My Creations" already uses to open a specific project,
  given a second meaning (`"preview:<projectId>"`) that Code Studio's
  own `mount()` recognizes and renders directly. Needs Anchoran OS's
  new `sdk.openApp` (Anchoran OS v3.5.0+) — shows clear guidance in the
  Preview panel instead of failing silently on an older host.

## [2.2.0] - 2026-09-14

### Added
- **Anchoran Code Studio** — a new community plugin, a local mini-IDE
  for building your OWN Anchoran plugin from inside Anchoran OS: a
  virtual file explorer (multiple projects, folders, rename/delete),
  a real CodeMirror 6 editor with JS/JSX syntax highlighting and live
  autocomplete (keywords plus already-declared names, via
  `@codemirror/lang-javascript`'s own local-scope completion source),
  real syntax checking and real Prettier formatting (both via
  Prettier's browser "standalone" build), a live Preview panel that
  runs the project's own `mount()` through a minimal in-memory
  CommonJS-ish module resolver (relative `require`/`import` between a
  project's own files only — see the plugin's own `runtime.js`), a
  plain `.zip` export, and a "Make It Official" button that builds a
  ready-to-publish package (formatted files, a `catalog-entry.json`
  snippet, and a README with the manual publishing steps) — it never
  pushes to GitHub itself, by design, since a plugin running on a
  user's own PC must never carry publishing credentials.
  - "Import from Official" clones any of this catalog's own published
    plugins' real source as a new local, editable project (a personal
    fork — the original is untouched) by fetching it straight from
    this repo's own `main` branch.
  - Every project (from-scratch or forked) can carry its own name,
    description, and a custom icon imported from an image file, and
    is 100% local to the user's Anchoran profile — see the plugin's
    `store.js` for exactly how (and why) that data survives Anchoran
    OS updates.
  - Its `localStorage` project index/data shape is a small, stable
    contract Anchoran OS's own Webstore "My Creations" section reads
    directly (same origin, no IPC) to list and manage these projects
    without opening Code Studio at all — see `store.js`'s header.
  - A **Console** panel next to Problems/Preview: while a preview is
    running, it mirrors every `console.log`/`warn`/`error`/`info` call
    the project's own code makes, plus real runtime errors — both a
    synchronous throw from `mount()` itself and an async one (an
    uncaught exception or rejected promise after mount, via `window`
    "error"/"unhandledrejection" listeners) — each timestamped and
    color-coded by level, with a Clear button. The interception is
    installed only while a preview is actually running and fully
    undone when it stops or the window closes.
  - An **"Open in Window"** button opens the project's CURRENT
    in-memory source in a second, real, independent Anchoran window
    (its own titlebar/taskbar entry) — not a downloaded/published
    plugin, the same in-memory `runProject()` the embedded Preview
    panel already uses, just mounted straight into that window with no
    IDE chrome at all. Reuses the exact same `pluginHost` window +
    `ctx.openPath` mechanism "My Creations" already uses to open Code
    Studio itself, giving that same field a second meaning (a
    `"preview:"`-prefixed project id) that Code Studio's own `mount()`
    recognizes — no Anchoran OS changes needed. Calls the host's
    `sdk.openApp`, which isn't part of the documented App SDK as of
    this writing; the button degrades to a clear explanation instead
    of silently doing nothing on a build that doesn't expose it yet.
- An `author` field on every catalog entry (including Code Studio's),
  defaulting to `"Fachun Corporation"` for everything published here
  so far — shown by Anchoran OS's Webstore UI.

## [2.1.0] - 2026-09-14

### Added
- `CHANGELOG.md` itself — this file, now read live by Anchoran OS's
  Webstore Community section (its new "Changelog" button) instead of
  only living in this repo's own commit history.

## [2.0.0] - 2026-09-14

### Added
- **36 new plugins**, ported and improved from Anchoran OS's own bundled
  app list as of its v3.4.0 release: 28 apps ported 1:1 (calculator,
  chat, pomodoro, qrcode, snake, game2048, tictactoe, memorymatch,
  checkers, connectfour, minesweeper, sudoku, solitaire, chess,
  calendar, kanban, habittracker, weather, mindmap, spreadsheet,
  emojipicker, typingtest, ttsreader, clipboardmanager, ziptool,
  colorpicker, clock, magnifier), and 8 groups fused from apps that
  shared the same real purpose instead of shipping near-duplicate
  plugins: `chance` (dice + coin), `text-tools` (JSON formatter + word
  counter + text diff + encode/decode), `converter` (units + currency,
  plus new Area and Speed categories), `password-tools` (generator +
  vault, plus a new strength checker), `recorder` (screen + voice),
  `draw-studio` (paint + pixel art, plus new layers, custom color,
  fill, shapes, undo/redo), `image-tools` (screenshot + wallpaper
  maker), and `tasks-reminders` (todo + reminders).
- **Bot opponents (Easy/Medium/Hard)** on every 2-player game in the
  roster — `tictactoe`, `checkers`, `connectfour`, `chess` — random
  moves on Easy, a simple win/block heuristic on Medium, minimax with
  alpha-beta pruning on Hard (exhaustive and unbeatable on Tic-Tac-Toe).
- Small real improvements added to most plugins beyond a straight port,
  not only the fused ones — see each plugin's own header comment for
  what changed.
- Real adaptations where the plugin sandbox has no privileged host
  API: `recorder`'s screen capture uses the standard
  `getDisplayMedia()` instead of Electron's internal screenshot API,
  every "save" flow is a real file download instead of a write into
  Anchoran's own virtual filesystem, and `clipboardmanager` is a manual
  "shelf" (paste in, keep a history) since plugins have no global
  clipboard-change hook available.
- `tests/smoke.test.js` — mounts every plugin in a real jsdom + React 18
  DOM (with the `canvas` package for real `<canvas>` support), fires a
  basic interaction, and calls the returned cleanup function.

## [1.0.0] - 2026-09-13

### Added
- The pilot plugin pipeline: `catalog.json`, the Anchoran App SDK
  contract (`sdk.React`, `sdk.ReactDOM`, `sdk.Icon`, `sdk.IconTile`,
  `sdk.pushNotification`, `sdk.getAccentColor`, `sdk.getThemeMode`),
  and one real plugin (`hello-plugin`) proving the whole download →
  install → run pipeline end to end against Anchoran OS's new
  `anchoran-plugin://` protocol and Community section.
