# Changelog

All notable changes to the Anchoran Webstore's plugin catalog are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this repo adheres to classic [Semantic Versioning](https://semver.org/) (`v#.#.#`) —
a separate, independent version line from Anchoran OS's own "Version # | Build #H#.#" one.

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
