/**
 * Real syntax checking + real formatting, both via Prettier's browser
 * "standalone" build + its babel parser plugin — a genuine, dependable
 * tool bundled in (this is a real esbuild bundle, so a real npm
 * dependency is the right call here over a hand-rolled formatter).
 * Prettier's babel parser also gives us "view errors" for free and
 * better than `new Function(...)`: `new Function` can't parse ESM
 * `import`/`export` syntax at all (throws on *every* real plugin
 * source file for the wrong reason), while Prettier's babel parser
 * handles modern JS/JSX/ESM and reports a real SyntaxError with
 * `.loc.start.line` / `.loc.start.column`.
 */
import * as prettier from "prettier/standalone";
import babelPlugin from "prettier/plugins/babel";
import estreePlugin from "prettier/plugins/estree";

const PRETTIER_OPTIONS = {
  parser: "babel",
  plugins: [babelPlugin, estreePlugin],
  printWidth: 100,
  tabWidth: 2,
  semi: true,
  singleQuote: false,
};

function isJsLikePath(path) {
  return /\.(js|jsx|mjs|cjs)$/i.test(path);
}

/**
 * Parses+formats `code` just to surface any real SyntaxError. Returns
 * `null` when the code is syntactically valid, otherwise
 * `{ message, line, column }` (line/column are 1-based, straight from
 * Babel's error location, or null when Prettier couldn't locate one).
 * Non-JS files (e.g. README.md) are always reported valid — Code
 * Studio only understands JS/JSX syntax, not markdown/JSON grammar.
 */
export async function checkSyntax(path, code) {
  if (!isJsLikePath(path)) return null;
  try {
    await prettier.format(code, PRETTIER_OPTIONS);
    return null;
  } catch (err) {
    const loc = err && (err.loc?.start || err.loc);
    return {
      message: err instanceof Error ? err.message.split("\n")[0] : String(err),
      line: loc?.line ?? null,
      column: loc?.column ?? null,
    };
  }
}

/** Formats `code` with Prettier. Throws the same real SyntaxError checkSyntax would report — callers should checkSyntax (or catch) before trusting the result. Non-JS files pass through unchanged (Prettier's babel parser can't help them, and this plugin doesn't ship a markdown/JSON printer). */
export async function formatCode(path, code) {
  if (!isJsLikePath(path)) return code;
  return prettier.format(code, PRETTIER_OPTIONS);
}
