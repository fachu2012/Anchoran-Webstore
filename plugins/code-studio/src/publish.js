/**
 * Turns a project's virtual file map into a real downloadable .zip
 * (JSZip — already a dependency of this repo, same download-trigger
 * pattern as ziptool/recorder's `downloadBlob`), plus the special
 * "Make It Official" package.
 *
 * "Make It Official" can NOT push to GitHub for you — there are no
 * (and must never be any) GitHub credentials embedded in code that
 * runs on any user's PC; that would be a real, serious security hole
 * in every install of this plugin. What it CAN safely do, and does,
 * is hand you a ready-to-hand-off package: your own files (already
 * formatted, already checked for syntax errors), the exact
 * catalog.json snippet a maintainer would paste into Anchoran-
 * Webstore's catalog.json, and a short README spelling out the 3
 * manual steps left. This is prepared for publishing, not published.
 */
import JSZip from "jszip";
import { isFolderMarker } from "./store.js";
import { formatCode } from "./lint.js";
import { isTypeScriptPath, stripTypes, jsPathFor } from "./typescript.js";

export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Builds a JSZip of every real file in `files` (folder markers excluded) rooted at `basePath` (e.g. "" for a plain export, or "plugins/<id>/src" for the official package). Returns the JSZip instance — callers decide whether to `generateAsync` and download it, or nest it into a bigger zip. */
export function addFilesToZip(zip, files, basePath = "") {
  for (const [path, content] of Object.entries(files)) {
    if (isFolderMarker(path)) continue;
    const fullPath = basePath ? `${basePath}/${path}` : path;
    zip.file(fullPath, content);
  }
  return zip;
}

/**
 * Plain export: a .zip of the project, no wrapper. Any `.ts`/`.tsx`
 * file is shipped as real, type-stripped `.js` (see typescript.js) —
 * Anchoran OS (and any plain browser) can only ever run JavaScript,
 * so the one file this repo's own README promises as a plugin's
 * `entry` must actually be that, even when it was authored in
 * TypeScript for Code Studio's own convenience. Every other file
 * (README.md, JSON, …) ships completely unchanged.
 */
export async function exportProjectZip(project) {
  const zip = new JSZip();
  const outFiles = {};
  for (const [path, content] of Object.entries(project.files)) {
    if (isFolderMarker(path)) {
      outFiles[path] = content;
      continue;
    }
    outFiles[isTypeScriptPath(path) ? jsPathFor(path) : path] = isTypeScriptPath(path) ? stripTypes(path, content) : content;
  }
  addFilesToZip(zip, outFiles);
  const blob = await zip.generateAsync({ type: "blob" });
  return { blob, filename: `${slug(project.name)}.zip` };
}

function slug(name) {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "project"
  );
}

/**
 * Builds the "Make It Official" package: every JS/JSX file in the
 * project run through Prettier first (throws if any file still has a
 * real syntax error — callers should checkSyntax across the project
 * and surface that in the UI before offering this button), plus
 * catalog-entry.json and a README with the 3 manual publishing steps.
 */
export async function buildOfficialPackage(project, { icon = "star", author = "Unknown", minAnchoranVersion = "3.4.0" } = {}) {
  const id = slug(project.name);
  const formattedFiles = {};
  for (const [path, content] of Object.entries(project.files)) {
    if (isFolderMarker(path)) continue;
    formattedFiles[path] = await formatCode(path, content);
  }

  const catalogEntry = {
    id,
    title: project.name,
    description: project.description || "A community plugin built with Anchoran Code Studio.",
    author,
    icon,
    version: "1.0.0",
    minAnchoranVersion,
    entry: "<REPLACE — real download URL once published>",
  };

  const readme = buildReadme(project, id, catalogEntry);

  const zip = new JSZip();
  addFilesToZip(zip, formattedFiles, `plugins/${id}/src`);
  zip.file("catalog-entry.json", JSON.stringify(catalogEntry, null, 2) + "\n");
  zip.file("README.md", readme);
  const blob = await zip.generateAsync({ type: "blob" });
  return { blob, filename: `${id}-official-package.zip`, catalogEntry };
}

function buildReadme(project, id, catalogEntry) {
  const forkNote = project.forkOf
    ? `\nThis project started as a fork of the official "${project.forkOf.title}" plugin (id: \`${project.forkOf.id}\`, version ${project.forkOf.version}) via Code Studio's "Import from Official" — review your changes against the original before publishing, since the original may have moved on since you forked it.\n`
    : "";

  return `# ${project.name} — Make It Official package

This is a **ready-to-publish package**, not a publication. Nothing has
been pushed anywhere — this .zip only exists on your own machine until
you (or whoever you hand it to) do the steps below by hand.
${forkNote}
## What's in here

- \`plugins/${id}/src/*\` — this project's files, already run through
  Prettier and already free of syntax errors (Code Studio checked
  before letting you generate this package).
- \`catalog-entry.json\` — the exact JSON object to add to this repo's
  \`plugins\` array in \`catalog.json\`.

## To actually publish this (3 manual steps)

1. A maintainer of the real \`Anchoran-Webstore\` repo (you, or anyone
   with push access — or hand this package to Claude and ask) copies
   \`plugins/${id}/src/\` from this zip into that repo at the same path,
   runs \`npm run build\` there to produce \`plugins/${id}/dist/index.js\`,
   and runs the test suite.
2. Add the object from \`catalog-entry.json\` to that repo's
   \`catalog.json\` \`plugins\` array. Note: the real catalog's \`icon\`
   field must be one of Anchoran's own built-in icon names (see
   Anchoran OS's \`src/components/Icon.tsx\`) — it can't be your custom
   project icon image, which only ever lived inside Code Studio's own
   project switcher. Pick whichever built-in icon fits best (this
   package suggests \`"${catalogEntry.icon}"\` as a starting point — feel
   free to change it), and double-check \`minAnchoranVersion\`
   (currently \`"${catalogEntry.minAnchoranVersion}"\`) against whatever
   Anchoran OS APIs your plugin actually needs.
3. Commit, tag a new \`v#.#.#\` release for that repo per its own
   README ("Publishing" section), and attach the built
   \`plugins/${id}/dist/index.js\` (and the updated \`catalog.json\`) as
   release assets. Once that release exists, replace
   \`catalog-entry.json\`'s \`entry\` placeholder with the real
   \`.../releases/download/v#.#.#/${id}.js\` URL.

Until step 3 is done, this plugin is NOT installable from the Webstore
by anyone — it only exists in your own local Code Studio project.
`;
}
