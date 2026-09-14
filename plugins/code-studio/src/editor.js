/**
 * A real code editor — CodeMirror 6 — instead of a plain <textarea>.
 * This IS a real bundled plugin (esbuild, not an Artifact), so genuine
 * npm dependencies are fair game, and "Code Studio" without real
 * editing ergonomics (line numbers, bracket matching, undo, and —
 * required — live autocomplete of JS keywords and already-declared
 * names) would be a weak match for the name. `@codemirror/
 * lang-javascript` ships its own scope-aware local-variable/keyword
 * completion source, wired in below via `autocompletion()` — that's
 * what powers "variables/funciones ya declaradas" completion, no
 * custom completer needed.
 *
 * CodeMirror is DOM-based, not a React component — this file exposes
 * a small imperative `createCodeMirrorView()` and index.js wraps it in
 * a thin React component (a ref'd host div + useEffect) so it lives
 * inside the host's own React tree like everything else in this
 * plugin.
 */
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, highlightSpecialChars } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { javascript } from "@codemirror/lang-javascript";
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from "@codemirror/autocomplete";
import { indentOnInput, bracketMatching, syntaxHighlighting, defaultHighlightStyle, indentUnit } from "@codemirror/language";
import { oneDark } from "@codemirror/theme-one-dark";

const themeCompartment = new Compartment();
const languageCompartment = new Compartment();

function themeExtension(themeMode) {
  return themeMode === "dark" ? oneDark : syntaxHighlighting(defaultHighlightStyle);
}

/** Real TypeScript language support (types, `as`/`satisfies`, `interface`, …) for `.ts`/`.tsx`, plain JS/JSX for everything else — same `@codemirror/lang-javascript` package covers both, it just needs telling which grammar a given file actually is. */
function languageExtensionFor(path) {
  const typescript = /\.(ts|tsx)$/i.test(path || "");
  const jsx = typescript ? /\.tsx$/i.test(path) : true;
  return javascript({ jsx, typescript });
}

/**
 * Creates a CodeMirror EditorView mounted into `parent`.
 * `onChange(text)` fires on every document-changing edit — index.js
 * debounces the expensive bits (syntax check) itself, this stays sync.
 * `path` picks the initial language grammar (see setViewLanguage to
 * change it later, e.g. when switching to a different open file).
 */
export function createCodeMirrorView({ parent, doc, path, themeMode, onChange, readOnly }) {
  const view = new EditorView({
    state: EditorState.create({
      doc,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        history(),
        indentUnit.of("  "),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        autocompletion(),
        languageCompartment.of(languageExtensionFor(path)),
        themeCompartment.of(themeExtension(themeMode)),
        EditorView.lineWrapping,
        EditorView.editable.of(!readOnly),
        keymap.of([...closeBracketsKeymap, ...completionKeymap, ...historyKeymap, indentWithTab, ...defaultKeymap]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && onChange) onChange(update.state.doc.toString());
        }),
      ],
    }),
    parent,
  });
  return view;
}

/** Replaces the whole document — used when switching to a value that didn't come from this view's own onChange (Format, opening a different file's already-loaded content, etc). */
export function setViewContent(view, text) {
  const current = view.state.doc.toString();
  if (current === text) return;
  view.dispatch({ changes: { from: 0, to: current.length, insert: text } });
}

export function setViewTheme(view, themeMode) {
  view.dispatch({ effects: themeCompartment.reconfigure(themeExtension(themeMode)) });
}

/** Reconfigures the editor's language grammar for `path` — call whenever the visible file changes (opening a different tab), same pattern as setViewTheme above. */
export function setViewLanguage(view, path) {
  view.dispatch({ effects: languageCompartment.reconfigure(languageExtensionFor(path)) });
}
