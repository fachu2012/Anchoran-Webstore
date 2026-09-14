/**
 * Strips TypeScript's own syntax (type annotations, `as`/`satisfies`
 * casts, `interface`/`type` declarations, `enum`, …) down to the
 * plain JavaScript underneath, via Sucrase — a small, fast,
 * TYPE-ERASURE-ONLY transpiler (no real type CHECKING, same tradeoff
 * TypeScript's own `isolatedModules`/`--transpile-only` mode makes):
 * exactly the right-sized tool here, since Code Studio's job is
 * turning `.ts`/`.tsx` source into something the Preview can run and
 * something Anchoran OS can dynamically `import()` — Anchoran OS
 * itself never understands TypeScript syntax and never will (see
 * this repo's README: a plugin ships as one real, directly-runnable
 * JS file), so authoring in TypeScript is a Code Studio-only
 * convenience, not a change to what the ecosystem actually executes.
 * Real ESM `import`/`export` syntax is left completely untouched —
 * runtime.js's own transformEsmToCjs (for Preview) and Anchoran OS's
 * own loader (for a published plugin) both already handle that part.
 */
import { transform } from "sucrase";

/** True for any path Code Studio treats as TypeScript source. */
export function isTypeScriptPath(path) {
  return /\.(ts|tsx|mts|cts)$/i.test(path);
}

/**
 * Strips `path`'s TypeScript syntax down to plain JS. Non-TypeScript
 * paths pass through unchanged. Throws Sucrase's own SyntaxError on
 * genuinely invalid syntax — callers should checkSyntax() (lint.js,
 * which uses Prettier's real "typescript" parser) first for a nicer
 * error location than Sucrase's own gives.
 */
export function stripTypes(path, source) {
  if (!isTypeScriptPath(path)) return source;
  const jsx = /\.tsx$/i.test(path);
  const { code } = transform(source, { transforms: jsx ? ["typescript", "jsx"] : ["typescript"], jsxRuntime: "classic" });
  return code;
}

/** The plain-JS filename a TypeScript path becomes once stripped — "widget.tsx" -> "widget.js", used when Export needs to ship something Anchoran OS (or any plain browser) can actually run directly. */
export function jsPathFor(path) {
  return path.replace(/\.(ts|tsx|mts|cts)$/i, ".js");
}
