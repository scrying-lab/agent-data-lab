import type { Ref } from 'react'
import { RotateCcw, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { defaultExpected, describeExpected, type BlockChip, type PlaygroundBlock } from '../../content/block-hints'
import { BlockEditor, type EditorHandle, type EditorLoader } from './BlockEditor'
import type { ParseError } from './parse'

export type BlockIds = { editor: string; title: string; hints: string; expect: string; error: string }

/** The ids one block uses, so links (error summary) and descriptions agree. */
export function blockIdsFor(prefix: string, block: PlaygroundBlock): BlockIds {
  const base = `${prefix}-${block.id}`
  return { editor: `${base}-editor`, title: `${base}-title`, hints: `${base}-hints`, expect: `${base}-expect`, error: `${base}-error` }
}

type Props = {
  block: PlaygroundBlock
  ids: BlockIds
  value: string
  error?: ParseError
  plainText: boolean
  loadEditor?: EditorLoader
  editorRef: Ref<EditorHandle>
  onChange: (text: string) => void
  onChip: (chip: BlockChip) => void
  onReset: () => void
  onRun: () => void
  onPrefetch: () => void
}

/** One editable block: title, plain intro, editor, hint lines, "try this" chips with expected results, reset. */
export function BlockPanel({ block, ids, value, error, plainText, loadEditor, editorRef, onChange, onChip, onReset, onRun, onPrefetch }: Props) {
  const describedBy = [ids.hints, ids.expect, error ? ids.error : ''].filter(Boolean).join(' ')
  return (
    <div className="pg-block" role="group" aria-labelledby={ids.title} onFocus={onPrefetch} onPointerEnter={onPrefetch}>
      <h3 id={ids.title} className="pg-block-title">{block.title}</h3>
      <p className="pg-intro">{block.intro}</p>
      <BlockEditor
        ref={editorRef}
        id={ids.editor}
        label={`${block.title} (editable data)`}
        value={value}
        describedBy={describedBy}
        invalid={!!error}
        plainText={plainText}
        load={loadEditor}
        onChange={onChange}
        onRun={onRun}
      />
      {error && <p id={ids.error} className="pg-inline-error"><TriangleAlert aria-hidden="true" size={16} /><span>{error.message}</span></p>}
      {/* The hints are already visible as comments in the editor; this copy is for aria-describedby only. */}
      <ul id={ids.hints} className="pg-hints sr-only" aria-label="Hints">
        {block.hints.map(hint => <li key={hint}><code>{hint}</code></li>)}
      </ul>
      <p id={ids.expect} className="pg-expect">As written: {describeExpected(defaultExpected)}. Each “Try” button changes one word.</p>
      <table className="pg-table">
        <caption className="sr-only">{block.title}: what each change should do</caption>
        <thead><tr><th scope="col">Change</th><th scope="col">Expected result</th></tr></thead>
        <tbody>
          <tr><td>As written</td><td>{describeExpected(defaultExpected)}</td></tr>
          {block.chips.map(chip => (
            <tr key={chip.id}>
              <td><Button type="button" variant="outline" size="sm" className="pg-chip" onClick={() => onChip(chip)}>Try {chip.label}</Button></td>
              <td>{describeExpected(chip.expected)}</td>
            </tr>
          ))}
          {block.combos.map(combo => <tr key={combo.label}><td>{combo.label}</td><td>{describeExpected(combo.expected)}</td></tr>)}
        </tbody>
      </table>
      <Button type="button" variant="outline" size="sm" className="pg-button pg-reset" aria-label={`Reset this block: ${block.title}`} onClick={onReset}>
        <RotateCcw aria-hidden="true" /> Reset this block
      </Button>
    </div>
  )
}
