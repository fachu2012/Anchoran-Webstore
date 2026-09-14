/**
 * The Preview panel's module system — a MINIMAL, IN-MEMORY, CommonJS-
 * style module loader (`function(module, exports, require){...}`,
 * relative paths resolved against the project's own virtual file
 * tree) that links a project's own files to each other so a
 * multi-file plugin-in-progress can `import`/`require` its own
 * modules and preview live. It does NOT run a real bundler — but it
 * DOES support the two kinds of "outside the project" imports real
 * Anchoran plugin source actually uses:
 *
 *   - `../../_shared/pluginKit.js` (any relative depth — it's
 *     normalized away, see resolveRelative below): this repo's own
 *     shared helper module, bundled directly into this file at BUILD
 *     time (the static `import * as PluginKit` below — esbuild
 *     inlines its real source, same as it does for every other
 *     plugin's own build) and served back out of BUILTIN_MODULES as a
 *     virtual, already-loaded module. No network access involved.
 *   - any bare specifier ("jszip", "date-fns", anything a user's own
 *     project happens to `import`): resolved at PREVIEW time via a
 *     real dynamic `import()` of `https://esm.sh/<spec>` — a public,
 *     read-only ESM CDN that converts arbitrary npm packages to real
 *     browser ES modules on the fly. This is deliberately generic
 *     rather than an allowlist of specific packages: nobody can
 *     predict every library a user's own project will eventually
 *     reach for, so runPreview() pre-resolves every bare specifier a
 *     project's files mention (see preloadBareImports below) before
 *     the synchronous module graph below ever runs, and hands the
 *     results in as `bareModules`. A package that fails to resolve
 *     (offline, a typo, something esm.sh can't serve) surfaces as a
 *     normal "Cannot resolve" preview error naming exactly that
 *     package — it never silently breaks every other import.
 *
 * Anchoran plugins are authored (and published) in real ES module
 * syntax (`export function mount`, `import x from "./y"`) — matching
 * that exactly is what lets "Make It Official" ship a project's files
 * completely unchanged. So rather than force CommonJS syntax on the
 * user, this loader does a best-effort, REGEX-BASED (not a real
 * parser) ESM -> CommonJS-ish rewrite of each module's source before
 * wrapping and running it — it covers the subset of ES module syntax
 * Anchoran plugin source actually uses in practice:
 *   export function NAME(...) / export const NAME = ... / export class NAME
 *   export default EXPR
 *   export { a, b as c }
 *   import Default from "./x"   import { a, b } from "./x"
 *   import * as ns from "./x"   import "./x"
 * Anything fancier (re-exports, computed/dynamic import, destructured
 * export declarations) may not preview correctly — that's a known,
 * documented limitation of the preview only. It has no bearing on
 * "view errors" (lint.js parses the REAL source with a real parser)
 * or on the exported/published files (also the real, untouched
 * source) — only on whether this one in-app preview can execute it.
 */
import * as PluginKit from "../../_shared/pluginKit.js";
import { isTypeScriptPath, stripTypes } from "./typescript.js";

/** Virtual modules resolved without touching the network — see file header. Keyed by the normalized relative path resolveRelative() would produce for that import, no matter how many "../" a project file used to reach it. */
const BUILTIN_MODULES = {
  "_shared/pluginKit.js": PluginKit,
};

/**
 * The ONLY bare (non-relative) specifiers the Preview will ever fetch
 * and run — a deliberate allowlist, not an open resolver. A project
 * can `import` any of these by name and it resolves live via esm.sh
 * (a public, read-only ESM CDN); anything not on this list fails with
 * a clear error instead of silently fetching and executing whatever
 * string happens to appear in the user's own source. This is a
 * security boundary, not a technical one — letting arbitrary text
 * pulled out of a project's files decide what remote code gets
 * fetched and run would turn "import from official" and every
 * project's own files into a code-execution vector. Extend this list
 * deliberately (a real, vetted, well-known package) rather than
 * removing the allowlist itself.
 */
const ALLOWED_BARE_PACKAGES = new Set([
  "jszip", "uuid", "date-fns", "papaparse", "marked",
  // The 25 below are widely-used, general-purpose utility/UI/data
  // libraries with no filesystem, process, or network-credential
  // access of their own (axios/chart.js/d3 just do plain fetch/DOM
  // work the preview can already do anyway) — safe to hand to any
  // project someone builds here.
  "lodash", "dayjs", "zod", "clsx", "classnames", "immer", "axios",
  "chart.js", "d3", "dompurify", "nanoid", "qs", "ramda", "yup",
  "luxon", "numeral", "slugify", "validator", "tinycolor2", "mathjs",
  "fuse.js", "color", "pluralize", "currency.js", "chroma-js",
]);

function resolveRelative(fromPath, spec) {
  const fromDir = fromPath.includes("/") ? fromPath.slice(0, fromPath.lastIndexOf("/")) : "";
  const parts = `${fromDir}/${spec}`.split("/").filter((s) => s.length > 0 && s !== ".");
  const stack = [];
  for (const part of parts) {
    if (part === "..") stack.pop();
    else stack.push(part);
  }
  return stack.join("/");
}

/** Resolves a require()/import specifier against the project's files map. Only relative specifiers ("./x", "../x") are handled here — a bare specifier ("jszip", "react") is resolved separately, see resolveBuiltin/preloadBareImports. */
export function resolveModule(fromPath, spec, files) {
  if (!spec.startsWith(".")) return null;
  const base = resolveRelative(fromPath, spec);
  const candidates = [base, `${base}.js`, `${base}.jsx`, `${base}.ts`, `${base}.tsx`, `${base}/index.js`, `${base}/index.ts`];
  return candidates.find((c) => Object.prototype.hasOwnProperty.call(files, c)) ?? null;
}

/** Resolves a RELATIVE specifier against BUILTIN_MODULES (e.g. "../../_shared/pluginKit.js" from any project file). Returns the module's exports object, or null if this relative path isn't one of the builtins. */
function resolveBuiltinRelative(fromPath, spec) {
  if (!spec.startsWith(".")) return null;
  const base = resolveRelative(fromPath, spec);
  return BUILTIN_MODULES[base] ?? BUILTIN_MODULES[`${base}.js`] ?? null;
}

/**
 * Scans every file in the project for bare import/require specifiers
 * ("jszip", not "./x") and resolves each one that's on
 * ALLOWED_BARE_PACKAGES via a real dynamic import() of esm.sh, in
 * parallel. Call this BEFORE runProject() and pass its result in as
 * `bareModules` — it's what lets bare-specifier requires below stay
 * synchronous despite needing a real network fetch to satisfy them.
 * A specifier NOT on the allowlist is recorded as "not allowed"
 * rather than fetched at all. A package that fails to resolve
 * (offline, esm.sh hiccup) is recorded as its error, not thrown here,
 * so one bad import never blocks every other file's preview from
 * starting.
 *
 * `importer` defaults to a real dynamic `import()` of the esm.sh URL
 * (what Anchoran OS's real Chromium runtime uses) — overridable so
 * tests can inject a stub instead of needing plain Node's `import()`
 * to support `https:` specifiers, which it doesn't (that's a real
 * browser/Electron capability, not a bare-Node one).
 */
export async function preloadBareImports(files, importer = (url) => import(/* @vite-ignore */ url)) {
  const specs = new Set();
  const bareImportRe = /\bimport\s+(?:[\w$*{}\s,]+\s+from\s+)?["']([^./"'][^"']*)["']/g;
  const bareRequireRe = /\brequire\(\s*["']([^./"'][^"']*)["']\s*\)/g;
  for (const source of Object.values(files)) {
    for (const re of [bareImportRe, bareRequireRe]) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(source))) specs.add(m[1]);
    }
  }
  const entries = await Promise.all(
    Array.from(specs).map(async (spec) => {
      if (!ALLOWED_BARE_PACKAGES.has(spec)) {
        const allowed = Array.from(ALLOWED_BARE_PACKAGES).join(", ");
        return [spec, { ok: false, error: `not a supported preview library. Supported: ${allowed}.` }];
      }
      try {
        const mod = await importer(`https://esm.sh/${spec}`);
        return [spec, { ok: true, module: mod }];
      } catch (err) {
        return [spec, { ok: false, error: err?.message || String(err) }];
      }
    })
  );
  return new Map(entries);
}

/** Best-effort ESM -> CommonJS-ish rewrite. See file header for exactly what's covered. */
export function transformEsmToCjs(source) {
  const exportedNames = [];
  let out = source;

  // import Default, { a, b as c }, * as ns from "./x";  (handled piecemeal below, broad patterns first)
  out = out.replace(/import\s+\*\s+as\s+([A-Za-z0-9_$]+)\s+from\s*["']([^"']+)["'];?/g, (_m, ns, spec) => `const ${ns} = require(${JSON.stringify(spec)});`);

  out = out.replace(/import\s+([A-Za-z0-9_$]+)\s*,\s*\{([^}]*)\}\s+from\s*["']([^"']+)["'];?/g, (_m, def, named, spec) => {
    const namedJs = named
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.replace(/\s+as\s+/, ": "))
      .join(", ");
    return `const __m_${def} = require(${JSON.stringify(spec)}); const ${def} = __m_${def}.default ?? __m_${def}; const {${namedJs}} = __m_${def};`;
  });

  out = out.replace(/import\s+\{([^}]*)\}\s+from\s*["']([^"']+)["'];?/g, (_m, named, spec) => {
    const namedJs = named
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.replace(/\s+as\s+/, ": "))
      .join(", ");
    return `const {${namedJs}} = require(${JSON.stringify(spec)});`;
  });

  out = out.replace(/import\s+([A-Za-z0-9_$]+)\s+from\s*["']([^"']+)["'];?/g, (_m, def, spec) => `const ${def} = (() => { const __m = require(${JSON.stringify(spec)}); return __m.default ?? __m; })();`);

  out = out.replace(/import\s*["']([^"']+)["'];?/g, (_m, spec) => `require(${JSON.stringify(spec)});`);

  // export function NAME / export async function NAME / export class NAME
  out = out.replace(/export\s+(async\s+function\*?|function\*?|class)\s+([A-Za-z0-9_$]+)/g, (_m, kind, name) => {
    exportedNames.push(name);
    return `${kind} ${name}`;
  });

  // export const/let/var NAME = ... (simple identifier only — destructuring exports are a known gap)
  out = out.replace(/export\s+(const|let|var)\s+([A-Za-z0-9_$]+)\s*=/g, (_m, kind, name) => {
    exportedNames.push(name);
    return `${kind} ${name} =`;
  });

  // export { a, b as c };
  out = out.replace(/export\s*\{([^}]*)\}\s*;?/g, (_m, names) => {
    const pairs = names
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const [local, exportedAs] = s.split(/\s+as\s+/).map((x) => x.trim());
        exportedNames.push(exportedAs || local);
        return `exports[${JSON.stringify(exportedAs || local)}] = ${local};`;
      });
    return pairs.join(" ");
  });

  // export default EXPR;  — best-effort: only handles a single-line/simple expression or a named function/class.
  out = out.replace(/export\s+default\s+(function\*?|class)\s+([A-Za-z0-9_$]+)/g, (_m, kind, name) => {
    exportedNames.push("default");
    return `${kind} ${name}`;
  });
  out = out.replace(/^export\s+default\s+/m, "module.exports.default = ");

  const assignments = exportedNames.filter((n) => n !== "default").map((n) => `try { exports[${JSON.stringify(n)}] = ${n}; } catch(e) {}`);
  if (assignments.length) out += `\n${assignments.join("\n")}\n`;

  return out;
}

/**
 * Runs `entryPath` from `files` (a {path: content} map) as a
 * CommonJS-ish module graph and returns its `module.exports`. Detects
 * circular requires with a clear error instead of infinite-looping.
 * Every module gets `console`, `require`, `module`, `exports` — no
 * other globals are injected (a module that touches `window`/
 * `document` directly still can, same as any real plugin can).
 *
 * `bareModules` (optional) is the Map preloadBareImports() returns —
 * pass it whenever a project might `import` a bare npm-style
 * specifier; without it, every bare specifier fails to resolve (the
 * original, network-free behavior).
 */
export function runProject(files, entryPath, bareModules) {
  const cache = new Map();

  function requireModule(path, stack) {
    if (stack.includes(path)) {
      throw new Error(`Circular require detected: ${[...stack, path].join(" -> ")}`);
    }
    if (cache.has(path)) return cache.get(path).exports;
    if (!Object.prototype.hasOwnProperty.call(files, path)) {
      throw new Error(`Module not found: "${path}"`);
    }
    const mod = { exports: {} };
    cache.set(path, mod);
    const jsSource = isTypeScriptPath(path) ? stripTypes(path, files[path]) : files[path];
    const transformed = transformEsmToCjs(jsSource);
    const localRequire = (spec) => {
      const resolved = resolveModule(path, spec, files);
      if (resolved) return requireModule(resolved, [...stack, path]);

      const builtin = resolveBuiltinRelative(path, spec);
      if (builtin) return builtin;

      if (!spec.startsWith(".")) {
        const preloaded = bareModules?.get(spec);
        if (preloaded?.ok) return preloaded.module;
        if (preloaded && !preloaded.ok) {
          throw new Error(`Couldn't load "${spec}" (fetched live from esm.sh for preview) — ${preloaded.error}`);
        }
        throw new Error(`"${spec}" isn't available in this preview yet — close and reopen Run Preview so it can be fetched.`);
      }

      throw new Error(`Cannot resolve "${spec}" from "${path}" — no such file in this project.`);
    };
    // eslint-disable-next-line no-new-func
    const factory = new Function("module", "exports", "require", "console", transformed);
    factory(mod, mod.exports, localRequire, console);
    return mod.exports;
  }

  return requireModule(entryPath, []);
}
