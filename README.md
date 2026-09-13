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

## Publishing

Bump `catalog.json`'s relevant plugin `version` (and `package.json`'s own
version for this repo, its overall release), commit, tag `v#.#.#` classically
(no `Version # | Build …` styling — that convention is Anchoran OS's own),
and push. A GitHub Release at that tag, with `catalog.json` and every
`plugins/*/dist/index.js` attached, is what Anchoran OS actually reads.
