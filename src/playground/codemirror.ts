// CodeMirror 6 for the playground blocks. Loaded lazily (src/playground/BlockEditor.tsx imports it
// dynamically), so the page works with a plain textarea until, or unless, this arrives.
//
// Accessibility notes: Tab is never bound (indentWithTab is not used), so Tab always leaves the
// editor. The editable element carries the label, the description ids and aria-invalid. Colours
// come from CSS variables, so the editor follows the page's light and dark themes.
import { Compartment, EditorState } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { javascript } from '@codemirror/lang-javascript'

export type CodeEditorAttributes = Record<string, string>
export type CodeEditorOptions = {
  parent: HTMLElement
  doc: string
  attributes: CodeEditorAttributes
  onChange: (text: string) => void
  /** Ctrl+Enter or Cmd+Enter. */
  onRun: () => void
}
export type CodeEditor = {
  setDoc(text: string): void
  setAttributes(attributes: CodeEditorAttributes): void
  focus(): void
  destroy(): void
}

const theme = EditorView.theme({
  '&': {
    color: 'var(--ink)',
    backgroundColor: 'var(--paper)',
    border: 'var(--border-width) solid var(--rule)',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.9rem',
  },
  '&.cm-focused': { outline: '3px solid var(--focus)', outlineOffset: '2px' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.5' },
  '.cm-content': { caretColor: 'var(--ink)', padding: '10px 0' },
  '.cm-line': { padding: '0 12px' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--ink)', borderLeftWidth: '2px' },
  '.cm-selectionBackground, &.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground': {
    backgroundColor: 'color-mix(in srgb, var(--focus) 30%, transparent)',
  },
  '.cm-content ::selection': { backgroundColor: 'color-mix(in srgb, var(--focus) 30%, transparent)' },
})

export function createCodeEditor(options: CodeEditorOptions): CodeEditor {
  const attributes = new Compartment()
  let applyingExternal = false
  const view = new EditorView({
    parent: options.parent,
    state: EditorState.create({
      doc: options.doc,
      extensions: [
        // Run comes first so it wins over defaultKeymap's Mod-Enter (insertBlankLine).
        keymap.of([{ key: 'Mod-Enter', run: () => { options.onRun(); return true } }, ...defaultKeymap, ...historyKeymap]),
        history(),
        javascript(),
        EditorView.lineWrapping,
        theme,
        attributes.of(EditorView.contentAttributes.of(options.attributes)),
        EditorView.updateListener.of(update => {
          if (update.docChanged && !applyingExternal) options.onChange(update.state.doc.toString())
        }),
      ],
    }),
  })
  return {
    setDoc(text) {
      if (view.state.doc.toString() === text) return
      applyingExternal = true
      try { view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } }) } finally { applyingExternal = false }
    },
    setAttributes(next) {
      view.dispatch({ effects: attributes.reconfigure(EditorView.contentAttributes.of(next)) })
    },
    focus() { view.focus() },
    destroy() { view.destroy() },
  }
}
