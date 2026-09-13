#!/usr/bin/env node
/**
 * Bundles every plugin under plugins/<id>/src/index.js into a single
 * plugins/<id>/dist/index.js, downloadable and dynamically import()-able
 * as-is by a running Anchoran OS install — see the root README for the
 * full contract. react/react-dom are never bundled in: a plugin talks
 * to the host's own React/ReactDOM through the SDK object mount()
 * receives, so its own bundle only ever needs to contain its own code.
 */
const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const pluginsDir = path.join(__dirname, "..", "plugins");

for (const id of fs.readdirSync(pluginsDir)) {
  const srcEntry = path.join(pluginsDir, id, "src", "index.js");
  if (!fs.existsSync(srcEntry)) continue;
  const outFile = path.join(pluginsDir, id, "dist", "index.js");
  esbuild.buildSync({
    entryPoints: [srcEntry],
    outfile: outFile,
    bundle: true,
    format: "esm",
    target: "es2020",
    minify: true,
  });
  console.log(`[build] ${id} -> ${path.relative(process.cwd(), outFile)}`);
}
