// The lab's interactive heart: editable blocks that run the REAL Strands agent loop and gate in the
// browser with a simulated model. Visitor edits are data: parsed and validated, never executed.
//
// Mount it once: <Playground onRun={run => …} />. It renders its own <section> with an h2.
import { useEffect, useId, useRef, useState } from 'react'
import { Code, Play, RotateCcw, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Toggle } from '@/components/ui/toggle'
import { announce } from '../announce'
import type { LabRun } from '../../agent/run-contract'
import { applyChip, blockIds, playgroundBlocks, textsWith, type BlockChip, type BlockId, type PlaygroundBlock } from '../../content/block-hints'
import { BlockPanel, blockIdsFor } from './BlockPanel'
import type { EditorHandle, EditorLoader } from './BlockEditor'
import { ErrorSummary, type SummaryItem } from './ErrorSummary'
import { parseAll, parseBlock, type ParseError } from './parse'
import { readPlainTextPreference, writePlainTextPreference } from './preferences'
import { createPlaygroundRunner, type PlaygroundRunner } from './runner'
import { RunResult, outcomeSentence } from './RunResult'
import './playground.css'

export type PlaygroundProps = {
  /** Called with every run that finishes while it is still the newest, e.g. to show it in the trace panel. */
  onRun?: (run: LabRun) => void
  /** Tests only: a runner with a custom runtime loader. Defaults to the real lazy-loaded runtime. */
  runner?: PlaygroundRunner
  /** Tests only: how CodeMirror is loaded. */
  loadEditor?: EditorLoader
}

type Phase = 'idle' | 'running' | 'finished' | 'stopped'
type Errors = Partial<Record<BlockId, ParseError>>

export function Playground({ onRun, runner: injected, loadEditor }: PlaygroundProps) {
  const [runner] = useState(() => injected ?? createPlaygroundRunner())
  const [texts, setTexts] = useState(() => textsWith())
  const [errors, setErrors] = useState<Errors>({})
  const [phase, setPhase] = useState<Phase>('idle')
  const [run, setRun] = useState<LabRun | null>(null)
  const [status, setStatus] = useState('')
  const [plainText, setPlainText] = useState(readPlainTextPreference)
  const [summaryFocus, setSummaryFocus] = useState(0)
  const summaryRef = useRef<HTMLDivElement>(null)
  const editors = useRef<Partial<Record<BlockId, EditorHandle | null>>>({})
  const prefix = 'pg' + useId().replace(/[^a-zA-Z0-9_-]/g, '')

  useEffect(() => { if (summaryFocus) summaryRef.current?.focus() }, [summaryFocus])

  const prefetch = () => { runner.prefetch().catch(() => {}) }
  const say = (text: string) => { setStatus(text); announce(text) }

  function setBlockText(id: BlockId, text: string) {
    setTexts(current => ({ ...current, [id]: text }))
    // Once a block has shown an error, keep its message current while the visitor fixes it.
    setErrors(current => {
      if (!current[id]) return current
      const result = parseBlock(id, text)
      const next = { ...current }
      if (result.ok) delete next[id]
      else next[id] = result.error
      return next
    })
  }

  function pickChip(block: PlaygroundBlock, chip: BlockChip) {
    setBlockText(block.id, applyChip(block, chip))
    announce(chip.announcement)
  }

  function reset(block: PlaygroundBlock) {
    setBlockText(block.id, block.defaultText)
    announce(`${block.title} reset to the example`)
  }

  async function start() {
    const parsed = parseAll(texts)
    if (!parsed.ok) {
      // Nothing runs, so nothing older may land under the error summary either.
      runner.invalidate()
      setRun(null)
      setPhase('idle')
      setErrors(parsed.errors)
      const count = Object.keys(parsed.errors).length
      say(count === 1 ? 'Nothing ran. 1 block needs fixing.' : `Nothing ran. ${count} blocks need fixing.`)
      setSummaryFocus(n => n + 1)
      return
    }
    setErrors({})
    setRun(null)
    setPhase('running')
    say('Running…')
    const outcome = await runner.run(parsed.values)
    if (outcome.kind === 'stale') return
    if (outcome.kind === 'error') {
      setPhase('stopped')
      say('The run could not finish, so there is no result. Press Retry to try again.')
      return
    }
    setRun(outcome.run)
    const { status: end } = outcome.run.outcome
    setPhase(end === 'ok' || end === 'denied' ? 'finished' : 'stopped')
    say(outcomeSentence(outcome.run))
    onRun?.(outcome.run)
  }

  function togglePlainText(plain: boolean) {
    setPlainText(plain)
    writePlainTextPreference(plain)
    announce(plain ? 'Plain text editor on' : 'Code editor on')
  }

  const summaryItems: SummaryItem[] = playgroundBlocks.flatMap(block => {
    const error = errors[block.id]
    if (!error) return []
    return [{ href: '#' + blockIdsFor(prefix, block).editor, title: block.title, error, focus: () => editors.current[block.id]?.focus() }]
  })

  return (
    <section className="pg" aria-labelledby={`${prefix}-title`}>
      <h2 id={`${prefix}-title`} className="pg-title">Change one word. Run the real loop.</h2>
      <p className="pg-lede">
        Edit a block, often by one word, then press Run. The real Strands agent loop and its gate run here in your browser; a script plays the model, so nothing leaves the page.
      </p>
      <div className="pg-blocks">
        {blockIds.map(id => {
          const block = playgroundBlocks.find(b => b.id === id)!
          return (
            <BlockPanel
              key={id}
              block={block}
              ids={blockIdsFor(prefix, block)}
              value={texts[id]}
              error={errors[id]}
              plainText={plainText}
              loadEditor={loadEditor}
              editorRef={handle => { editors.current[id] = handle }}
              onChange={text => setBlockText(id, text)}
              onChip={chip => pickChip(block, chip)}
              onReset={() => reset(block)}
              onRun={() => { void start() }}
              onPrefetch={prefetch}
            />
          )
        })}
      </div>
      <div className="pg-controls">
        <Button type="button" className="pg-button pg-run" onClick={() => { void start() }} onFocus={prefetch} onPointerEnter={prefetch}>
          <Play aria-hidden="true" /> Run
        </Button>
        {/* One slot, always mounted: Cancel while running, Retry after a failure or cancel, and an
            inactive Cancel otherwise. Pressing it changes the phase, so a button that came and went
            would drop keyboard focus to the page; this one keeps it. */}
        <Button
          type="button"
          variant="outline"
          className="pg-button pg-stop"
          aria-disabled={phase === 'running' || phase === 'stopped' ? undefined : true}
          onClick={() => {
            if (phase === 'running') runner.cancel()
            else if (phase === 'stopped') void start()
          }}
        >
          {phase === 'stopped'
            ? <><RotateCcw aria-hidden="true" /> Retry</>
            : <><Square aria-hidden="true" /> Cancel</>}
        </Button>
        <Toggle variant="outline" className="pg-button pg-toggle" pressed={plainText} onPressedChange={togglePlainText}>
          <Code aria-hidden="true" /> Plain text editor
        </Toggle>
      </div>
      <p className="pg-shortcut">Shortcut: Ctrl+Enter (Cmd+Enter on a Mac) inside a block runs it.</p>
      <p className="pg-status">{status}</p>
      <ErrorSummary ref={summaryRef} items={summaryItems} titleId={`${prefix}-errors`} />
      {run && (
        <div className="pg-result-wrap" aria-labelledby={`${prefix}-result`} role="group">
          <h3 id={`${prefix}-result`} className="pg-block-title">Result</h3>
          <RunResult run={run} />
        </div>
      )}
    </section>
  )
}
