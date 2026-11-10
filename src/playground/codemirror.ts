// CodeMirror 6 for the playground blocks. Loaded lazily (src/playground/BlockEditor.tsx imports it
// dynamically), so the page works with a plain textarea until, or unless, this arrives.
//
// Accessibility notes: Tab is never bound (indentWithTab is not used), so Tab always leaves the
// editor. The editable element carries the label, the description ids and aria-invalid. Colours
// come from CSS variables, so the editor follows the page's light and dark themes.
//
// Highlighting uses a small tokenizer for the blocks' data (comments, quoted text, names before a
// colon, numbers), not the JavaScript grammar: to JavaScript, { role: 'guest', readsLeft: 1 } is a
// statement block, so its names came out as a label and a variable. The tokenizer only colours
// text; src/playground/parse.ts still decides what the text means. @codemirror/language and
// @lezer/highlight are declared as direct dependencies at the versions already in the lockfile.
import { Compartment, EditorState } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { HighlightStyle, StreamLanguage, syntaxHighlighting, type StringStream } from '@codemirror/language'
import { tags } from '@lezer/highlight'

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

// The editor sits on the raised surface (lighter than the page in dark, as elevation should be),
// inside a 2px rule: an input.
const theme = EditorView.theme({
  '&': {
    color: 'var(--ink)',
    backgroundColor: 'var(--surface-raised)',
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

/**
 * Token colours, all CSS variables, so both themes follow tokens.css. Every pair is contrast-tested
 * there against --surface-raised (at least 4.5:1): comments muted, text values in --text-blue,
 * names (keys) in --text-magenta, everything else ink. Comments are also italic and keys bold, so
 * colour is never the only difference.
 */
export const tokenStyle = HighlightStyle.define([
  { tag: tags.comment, color: 'var(--ink-muted)', fontStyle: 'italic' },
  { tag: tags.string, color: 'var(--text-blue)' },
  { tag: tags.propertyName, color: 'var(--text-magenta)', fontWeight: '600' },
  { tag: [tags.number, tags.variableName], color: 'var(--ink)' },
  { tag: tags.punctuation, color: 'var(--ink-muted)' },
])

type DataState = { inComment: boolean }

/** Reads to the end of a block comment, or to the end of the line if it carries on. */
function blockComment(stream: StringStream, state: DataState): string {
  if (stream.skipTo('*/')) { stream.match('*/'); state.inComment = false }
  else stream.skipToEnd()
  return 'comment'
}

/** The blocks' data: JSON5-like objects and lists with line and block comments. Token names map to @lezer/highlight tags. */
export const blockData = StreamLanguage.define<DataState>({
  name: 'lab-block-data',
  startState: () => ({ inComment: false }),
  copyState: state => ({ ...state }),
  token(stream, state) {
    if (state.inComment) return blockComment(stream, state)
    if (stream.eatSpace()) return null
    if (stream.match('//')) { stream.skipToEnd(); return 'comment' }
    if (stream.match('/*')) { state.inComment = true; return blockComment(stream, state) }
    const quote = stream.peek()
    if (quote === "'" || quote === '"' || quote === '`') {
      stream.next()
      let escaped = false
      for (let ch = stream.next(); ch != null; ch = stream.next()) {
        if (ch === quote && !escaped) break
        escaped = !escaped && ch === '\\'
      }
      return 'string'
    }
    if (stream.match(/^[A-Za-z_$][\w$]*(?=\s*:)/)) return 'propertyName'
    if (stream.match(/^[+-]?\.?\d[\w.]*/)) return 'number'
    if (stream.match(/^[A-Za-z_$][\w$]*/)) return 'variableName'
    stream.next()
    return 'punctuation'
  },
  languageData: { commentTokens: { line: '//', block: { open: '/*', close: '*/' } } },
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
        blockData,
        syntaxHighlighting(tokenStyle),
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
