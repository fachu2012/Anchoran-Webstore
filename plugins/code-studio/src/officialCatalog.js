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
 * crawl needed. That source itself may `import`
 * "../../_shared/pluginKit.js" (resolved as a built-in virtual
 * module) or a package from runtime.js's own ALLOWED_BARE_PACKAGES
 * list (e.g. "jszip", fetched live from esm.sh) — both preview fine
 * out of the box. An import outside those two cases still shows a
 * clear "Cannot resolve"/"not a supported preview library" error in
 * the Console until you remove/replace it — see runtime.js's header
 * for exactly what is and isn't supported.
 */
const CATALOG_URL = "https://raw.githubusercontent.com/fachu2012/Anchoran-Webstore/main/catalog.json";
const sourceUrl = (id) => `https://raw.githubusercontent.com/fachu2012/Anchoran-Webstore/main/plugins/${id}/src/index.js`;

/**
 * Anchoran Code Studio's own id — deliberately excluded from what
 * "Import from Official" ever offers to clone, and refused outright
 * if something still tries to fetch its source directly. Code
 * Studio's own source is the IDE itself (the module resolver, the
 * exact localStorage contract "My Creations" reads on the Anchoran OS
 * side, how "Make It Official"/publishing work, …) — handing that out
 * as an editable starting point would let anyone read it end to end
 * looking for ways to abuse the mechanism, which no other plugin's
 * source exposes.
 */
const RESTRICTED_IDS = new Set(["code-studio"]);

/** Fetches the live catalog's plugin list, with Code Studio itself always excluded — see RESTRICTED_IDS. Returns [] on any network failure (offline, blocked, GitHub hiccup) rather than throwing — callers show that as "couldn't load the list right now". */
export async function fetchOfficialCatalog() {
  const res = await fetch(CATALOG_URL);
  if (!res.ok) throw new Error(`GitHub returned ${res.status} fetching the catalog.`);
  const data = await res.json();
  const plugins = Array.isArray(data.plugins) ? data.plugins : [];
  return plugins.filter((p) => !RESTRICTED_IDS.has(p.id));
}

/** Fetches one official plugin's real source. Throws on failure (including a restricted id, so a caller that somehow bypasses the catalog filter above still can't clone it) — callers show the message directly, there's nothing more specific to say. */
export async function fetchOfficialSource(manifest) {
  if (RESTRICTED_IDS.has(manifest.id)) {
    throw new Error(`"${manifest.title}" can't be imported as a starting point for a fork.`);
  }
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
