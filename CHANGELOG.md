# Changelog

All notable changes to the Anchoran Webstore's plugin catalog are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this repo adheres to classic [Semantic Versioning](https://semver.org/) (`v#.#.#`) —
a separate, independent version line from Anchoran OS's own "Version # | Build #H#.#" one.

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
