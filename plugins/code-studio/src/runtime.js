/**
 * The Preview panel's module system — a MINIMAL, IN-MEMORY, CommonJS-
 * style module loader (`function(module, exports, require){...}`,
 * relative paths resolved against the project's own virtual file
 * tree), exactly as scoped: it links a project's own files to each
 * other so a multi-file plugin-in-progress can `import`/`require` its
 * own modules and preview live — it does NOT support importing npm
 * packages (no "jszip", no "react" as a bare specifier — the host
 * React instance is handed in as `sdk.React` instead, same as every
 * real Anchoran plugin) and it does NOT run a real bundler.
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

/** Resolves a require()/import specifier against the project's files map. Only relative specifiers ("./x", "../x") are supported — a bare specifier ("jszip", "react") always fails to resolve, by design. */
export function resolveModule(fromPath, spec, files) {
  if (!spec.startsWith(".")) return null;
  const base = resolveRelative(fromPath, spec);
  const candidates = [base, `${base}.js`, `${base}.jsx`, `${base}/index.js`];
  return candidates.find((c) => Object.prototype.hasOwnProperty.call(files, c)) ?? null;
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
 */
export function runProject(files, entryPath) {
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
    const transformed = transformEsmToCjs(files[path]);
    const localRequire = (spec) => {
      const resolved = resolveModule(path, spec, files);
      if (!resolved) {
        throw new Error(`Cannot resolve "${spec}" from "${path}" — Code Studio's preview only resolves relative paths within this project (no npm packages, no shared repo helpers).`);
      }
      return requireModule(resolved, [...stack, path]);
    };
    // eslint-disable-next-line no-new-func
    const factory = new Function("module", "exports", "require", "console", transformed);
    factory(mod, mod.exports, localRequire, console);
    return mod.exports;
  }

  return requireModule(entryPath, []);
}
