import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type Ref } from 'react'
import { Textarea } from '@/components/ui/textarea'
import type { CodeEditor } from './codemirror'

export type EditorHandle = { focus(): void }
export type EditorModule = typeof import('./codemirror')
export type EditorLoader = () => Promise<EditorModule>

let shared: Promise<EditorModule> | undefined
/** Loads CodeMirror once per page, as its own chunk. A failed load is not retried: the textarea stays. */
export const loadCodeMirror: EditorLoader = () => (shared ??= import('./codemirror'))

const RUN_SHORTCUT = 'Control+Enter Meta+Enter'

type Props = {
  id: string
  label: string
  value: string
  /** Space-separated ids: hint lines, expected outcome, and the error when there is one. */
  describedBy: string
  invalid: boolean
  /** The visitor chose the plain text editor. */
  plainText: boolean
  onChange: (text: string) => void
  onRun: () => void
  load?: EditorLoader
  ref?: Ref<EditorHandle>
}

/**
 * One block's editor. Starts as a textarea and upgrades to CodeMirror once it has loaded, but only
 * while the textarea is not focused, carrying the text over. Stays a textarea if CodeMirror fails
 * to load or the visitor prefers plain text.
 */
export function BlockEditor({ id, label, value, describedBy, invalid, plainText, onChange, onRun, load = loadCodeMirror, ref }: Props) {
  const [kit, setKit] = useState<EditorModule | null>(null)
  const [failed, setFailed] = useState(false)
  const [upgraded, setUpgraded] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<CodeEditor | null>(null)
  const latest = useRef({ value, onChange, onRun })
  useLayoutEffect(() => { latest.current = { value, onChange, onRun } })

  const attributes = useMemo(() => ({
    id, 'aria-label': label, 'aria-describedby': describedBy, 'aria-keyshortcuts': RUN_SHORTCUT,
    ...(invalid ? { 'aria-invalid': 'true' } : {}),
  }), [id, label, describedBy, invalid])
  const attributesRef = useRef(attributes)
  useLayoutEffect(() => { attributesRef.current = attributes })

  useEffect(() => {
    if (plainText || kit || failed) return
    let alive = true
    load().then(m => { if (alive) setKit(m) }, () => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [plainText, kit, failed, load])

  const tryUpgrade = useCallback(() => {
    if (!kit || plainText || failed) return
    if (textareaRef.current && textareaRef.current === document.activeElement) return // wait for blur
    setUpgraded(true)
  }, [kit, plainText, failed])
  useEffect(() => {
    if (plainText) setUpgraded(false)
    else tryUpgrade()
  }, [plainText, tryUpgrade])

  useEffect(() => {
    if (!upgraded || !kit || !hostRef.current) return
    let editor: CodeEditor
    try {
      editor = kit.createCodeEditor({
        parent: hostRef.current,
        doc: latest.current.value,
        attributes: attributesRef.current,
        onChange: text => latest.current.onChange(text),
        onRun: () => latest.current.onRun(),
      })
    } catch {
      setFailed(true)
      setUpgraded(false)
      return
    }
    editorRef.current = editor
    return () => { editor.destroy(); editorRef.current = null }
  }, [upgraded, kit])
  useEffect(() => { editorRef.current?.setDoc(value) }, [value])
  useEffect(() => { editorRef.current?.setAttributes(attributes) }, [attributes])

  useImperativeHandle(ref, () => ({
    focus: () => { if (editorRef.current) editorRef.current.focus(); else textareaRef.current?.focus() },
  }), [])

  if (upgraded && kit && !failed) return <div ref={hostRef} className="pg-editor pg-cm" data-editor="codemirror" />
  return (
    <Textarea
      ref={textareaRef}
      id={id}
      className="pg-editor pg-textarea"
      data-editor="plain"
      aria-label={label}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      aria-keyshortcuts={RUN_SHORTCUT}
      value={value}
      rows={value.split('\n').length + 1}
      spellCheck={false}
      autoCapitalize="off"
      autoCorrect="off"
      onChange={event => onChange(event.target.value)}
      onKeyDown={event => {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); onRun() }
      }}
      onBlur={() => { if (kit && !plainText && !failed) setUpgraded(true) }}
    />
  )
}
