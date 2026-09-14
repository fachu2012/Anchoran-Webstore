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

function themeExtension(themeMode) {
  return themeMode === "dark" ? oneDark : syntaxHighlighting(defaultHighlightStyle);
}

/**
 * Creates a CodeMirror EditorView mounted into `parent`.
 * `onChange(text)` fires on every document-changing edit — index.js
 * debounces the expensive bits (syntax check) itself, this stays sync.
 */
export function createCodeMirrorView({ parent, doc, themeMode, onChange, readOnly }) {
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
        javascript({ jsx: true }),
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
