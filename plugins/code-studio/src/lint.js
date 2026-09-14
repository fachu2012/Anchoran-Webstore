/**
 * Real syntax checking + real formatting, via Prettier's browser
 * "standalone" build + its real language parser plugins — a genuine,
 * dependable tool bundled in (this is a real esbuild bundle, so a
 * real npm dependency is the right call here over a hand-rolled
 * formatter/parser). Prettier's parsers also give us "view errors"
 * for free and better than `new Function(...)`: `new Function` can't
 * parse ESM `import`/`export` syntax at all (throws on *every* real
 * plugin source file for the wrong reason), while these report a real
 * SyntaxError with `.loc.start.line` / `.loc.start.column`.
 *
 * The PARSER is chosen per file, by extension — a `.ts`/`.tsx` file
 * genuinely uses TypeScript's own parser (type annotations, `as`
 * casts, etc. are real syntax errors under the plain "babel" parser),
 * it does not just get silently treated as JavaScript. See
 * typescript.js for what happens to that file's TYPES before it can
 * actually run (Prettier only checks/formats — it never strips them).
 */
import * as prettier from "prettier/standalone";
import babelPlugin from "prettier/plugins/babel";
import typescriptPlugin from "prettier/plugins/typescript";
import estreePlugin from "prettier/plugins/estree";

const BASE_OPTIONS = {
  printWidth: 100,
  tabWidth: 2,
  semi: true,
  singleQuote: false,
};

/** Which Prettier parser + plugin set a path's real language needs. `null` for anything Code Studio doesn't understand as code (README.md, JSON, …). */
function optionsFor(path) {
  if (/\.(ts|tsx|mts|cts)$/i.test(path)) return { ...BASE_OPTIONS, parser: "typescript", plugins: [typescriptPlugin, estreePlugin] };
  if (/\.(js|jsx|mjs|cjs)$/i.test(path)) return { ...BASE_OPTIONS, parser: "babel", plugins: [babelPlugin, estreePlugin] };
  return null;
}

/**
 * Parses+formats `code` just to surface any real SyntaxError. Returns
 * `null` when the code is syntactically valid, otherwise
 * `{ message, line, column }` (line/column are 1-based, straight from
 * the parser's error location, or null when Prettier couldn't locate
 * one). Non-code files (e.g. README.md) are always reported valid.
 */
export async function checkSyntax(path, code) {
  const options = optionsFor(path);
  if (!options) return null;
  try {
    await prettier.format(code, options);
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

/** Formats `code` with Prettier, using the real parser for that path's actual language. Throws the same real SyntaxError checkSyntax would report — callers should checkSyntax (or catch) before trusting the result. Files Code Studio doesn't understand as code pass through unchanged. */
export async function formatCode(path, code) {
  const options = optionsFor(path);
  if (!options) return code;
  return prettier.format(code, options);
}
