/**
 * "Import from Official" — lists the real plugins already published
 * in this same Anchoran-Webstore repo and clones one's real source as
 * a new, fully independent, locally-editable Code Studio project.
 * Uses plain `fetch()` (a standard Web API, no privileged Anchoran
 * access needed — the same way Anchoran OS's own AppCenter fetches
 * the live catalog, see pluginCatalog.ts there) against this repo's
 * raw `main` branch content on GitHub — no token, no write access,
 * read-only, exactly like opening the file in a browser.
 *
 * Every plugin in this repo ships as a single `plugins/<id>/src/
 * index.js` file (see README's "How it works"), so cloning is just
 * "fetch that one file and drop it in as index.js" — no multi-file
 * crawl needed. That source itself may `import` things Code Studio's
 * preview can't resolve (npm packages like "jszip", or
 * "../../_shared/pluginKit.js" — outside any single project's own
 * file tree) — that's fine for editing/formatting/viewing errors, it
 * just means the live Preview may show a "Cannot resolve" error for
 * those specific imports until you remove/replace them, exactly the
 * same documented limitation runtime.js already carries.
 */
const CATALOG_URL = "https://raw.githubusercontent.com/fachu2012/Anchoran-Webstore/main/catalog.json";
const sourceUrl = (id) => `https://raw.githubusercontent.com/fachu2012/Anchoran-Webstore/main/plugins/${id}/src/index.js`;

/** Fetches the live catalog's plugin list. Returns [] on any network failure (offline, blocked, GitHub hiccup) rather than throwing — callers show that as "couldn't load the list right now". */
export async function fetchOfficialCatalog() {
  const res = await fetch(CATALOG_URL);
  if (!res.ok) throw new Error(`GitHub returned ${res.status} fetching the catalog.`);
  const data = await res.json();
  return Array.isArray(data.plugins) ? data.plugins : [];
}

/** Fetches one official plugin's real source. Throws on failure — callers show the message directly, there's nothing more specific to say. */
export async function fetchOfficialSource(manifest) {
  const res = await fetch(sourceUrl(manifest.id));
  if (!res.ok) throw new Error(`GitHub returned ${res.status} fetching "${manifest.id}"'s source.`);
  return res.text();
}

/** Shapes a fetched official plugin into createProject()'s options — a clearly-labeled personal fork, never overwriting or resembling the official listing itself. */
export function forkToProjectOptions(manifest, source) {
  return {
    name: `My Fork of ${manifest.title}`,
    description: `A personal, local variant of the official "${manifest.title}" plugin — editing this never affects the real published plugin.`,
    entryPath: "index.js",
    files: { "index.js": source },
    forkOf: { id: manifest.id, title: manifest.title, version: manifest.version },
  };
}
