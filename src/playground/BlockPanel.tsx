import type { Ref } from 'react'
import { RotateCcw, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { OutcomeBadge } from '../shell/primitives'
import { defaultExpected, describeExpected, type BlockChip, type ExpectedOutcome, type PlaygroundBlock } from '../../content/block-hints'
import { BlockEditor, type EditorHandle, type EditorLoader } from './BlockEditor'
import type { ParseError } from './parse'

export type BlockIds = { editor: string; title: string; hints: string; expect: string; error: string }

/** The ids one block uses, so links (error summary) and descriptions agree. */
export function blockIdsFor(prefix: string, block: PlaygroundBlock): BlockIds {
  const base = `${prefix}-${block.id}`
  return { editor: `${base}-editor`, title: `${base}-title`, hints: `${base}-hints`, expect: `${base}-expect`, error: `${base}-error` }
}

/**
 * One expected result: the outcome badge, then the plain-language summary, or the stage and reason
 * code in muted mono. The hidden separator keeps the cell's text exactly describeExpected(expected), so a screen
 * reader hears the same sentence as before.
 */
export function ExpectedCell({ expected }: { expected: ExpectedOutcome }) {
  return (
    <span className="pg-expected">
      <OutcomeBadge status={expected.status} />
      <span className="sr-only"> · </span>
      {expected.status === 'ok'
        ? <span className="pg-summary">{expected.summary}</span>
        : <code className="pg-reason">{breakable(`${expected.stage} · ${expected.code}`)}</code>}
    </span>
  )
}

/** Lets a long reason code wrap after an underscore on a phone, without changing its text. */
function breakable(text: string) {
  return text.split(/(?<=_)/).map((part, i) => i === 0 ? part : <span key={i}><wbr />{part}</span>)
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

/**
 * One editable block, as a card: a head band with the title, then the plain intro, the editor,
 * the "try this" table with expected results, and Reset.
 */
export function BlockPanel({ block, ids, value, error, plainText, loadEditor, editorRef, onChange, onChip, onReset, onRun, onPrefetch }: Props) {
  const describedBy = [ids.hints, ids.expect, error ? ids.error : ''].filter(Boolean).join(' ')
  return (
    <div className="pg-block" role="group" aria-labelledby={ids.title} onFocus={onPrefetch} onPointerEnter={onPrefetch}>
      <div className="pg-block-head">
        <h3 id={ids.title} className="pg-block-title">{block.title}</h3>
      </div>
      <div className="pg-block-body">
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
            <tr><td>As written</td><td><ExpectedCell expected={defaultExpected} /></td></tr>
            {block.chips.map(chip => (
              <tr key={chip.id}>
                <td><Button type="button" variant="tertiary" size="sm" className="pg-chip" onClick={() => onChip(chip)}>Try {chip.label}</Button></td>
                <td><ExpectedCell expected={chip.expected} /></td>
              </tr>
            ))}
            {block.combos.map(combo => <tr key={combo.label}><td>{combo.label}</td><td><ExpectedCell expected={combo.expected} /></td></tr>)}
          </tbody>
        </table>
        <Button type="button" variant="tertiary" className="pg-reset" aria-label={`Reset this block: ${block.title}`} onClick={onReset}>
          <RotateCcw aria-hidden="true" /> Reset this block
        </Button>
      </div>
    </div>
  )
}
