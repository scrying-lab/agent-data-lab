import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { tierLabel, type LabRun } from '../../agent/run-contract'
import { narrate } from '../../content/narration'
import { announce } from '../announce'
import { Badge } from '../components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui/collapsible'
import { Guide } from './Guide'
import { StepDetails } from './StepDetails'
import { StepList } from './StepList'
import { toSteps } from './steps'
import { TraceGraph } from './TraceGraph'
import './trace.css'

export const PLAY_INTERVAL_MS = 4500
/** Keys that press a button. Only these, on the Play toggle, leave playback running. */
const TOGGLE_KEYS = new Set([' ', 'Spacebar', 'Enter'])

/**
 * One run, three synchronised views: an accessible step list (the keyboard path), a graph of the
 * same steps (visual only) and a guide that narrates the run in plain language. All three share a
 * single selected step.
 */
export function TracePanel({ run }: { run: LabRun }) {
  const steps = useMemo(() => toSteps(run), [run])
  const sentences = useMemo(() => narrate(run), [run])
  const headingId = useId()
  const listHeadingId = useId()
  const root = useRef<HTMLElement>(null)
  const playToggle = useRef<HTMLButtonElement>(null)

  // Selection and playback belong to one run; a new run starts again at step 1, paused.
  const [state, setState] = useState({ runId: run.runId, selected: 0, playing: false })
  const current = state.runId === run.runId ? state : { runId: run.runId, selected: 0, playing: false }
  const { selected, playing } = current
  const last = steps.length - 1
  const update = (patch: Partial<typeof current>) => setState({ ...current, ...patch })

  /** Move the guide and say the new sentence. Used only by Back, Next and Play, never by list focus. */
  function guideTo(index: number, playingAfter = playing) {
    update({ selected: index, playing: playingAfter })
    announce(`Step ${index + 1} of ${steps.length}. ${sentences[index]}`)
  }

  // Play: advance every 4.5 seconds and stop at the last step. Focus never moves.
  useEffect(() => {
    if (!playing) return
    const timer = window.setTimeout(() => {
      const next = Math.min(selected + 1, last)
      guideTo(next, next < last)
    }, PLAY_INTERVAL_MS)
    return () => window.clearTimeout(timer)
    // guideTo is recreated each render; the timer only needs restarting when these change.
  }, [playing, selected, last])

  // Any keyboard or pointer input in the panel stops playback, except operating the Play toggle
  // itself: a pointer press on it, or Space or Enter while it has focus. Tab away from it still stops.
  useEffect(() => {
    const el = root.current
    if (!el || !playing) return
    const stop = (event: Event) => {
      const onToggle = playToggle.current && event.target instanceof Node && playToggle.current.contains(event.target)
      const operatesToggle = event.type === 'pointerdown' || (event instanceof KeyboardEvent && TOGGLE_KEYS.has(event.key))
      if (onToggle && operatesToggle) return
      setState(s => ({ ...s, playing: false }))
    }
    el.addEventListener('keydown', stop, true)
    el.addEventListener('pointerdown', stop, true)
    return () => { el.removeEventListener('keydown', stop, true); el.removeEventListener('pointerdown', stop, true) }
  }, [playing])

  function onPlayingChange(next: boolean) {
    if (next && selected === last) guideTo(0, true) // replay from the start
    else update({ playing: next })
  }

  return (
    <section ref={root} className="trace" aria-labelledby={headingId}>
      <div className="trace__head">
        <h2 id={headingId} className="trace__title">What happened, step by step</h2>
        <Badge className="trace-tier">{tierLabel(run)}</Badge>
      </div>

      <div className="trace__body">
        <div className="trace__list">
          <h3 id={listHeadingId} className="trace__subtitle">Steps</h3>
          <StepList run={run} steps={steps} selected={selected} onSelect={i => update({ selected: i })} labelledBy={listHeadingId} />
          <StepDetails run={run} step={steps[selected]} total={steps.length} />
        </div>

        <div className="trace__side">
          <Guide
            sentences={sentences}
            selected={selected}
            playing={playing}
            onBack={() => guideTo(Math.max(selected - 1, 0), false)}
            onNext={() => guideTo(Math.min(selected + 1, last), false)}
            onPlayingChange={onPlayingChange}
            playRef={playToggle}
          />
          <Collapsible defaultOpen className="trace-graph-box">
            <CollapsibleTrigger className="trace-graph-box__toggle">
              <ChevronDown aria-hidden="true" className="trace-graph-box__chevron" />
              Graph of the same steps
            </CollapsibleTrigger>
            <CollapsibleContent>
              <TraceGraph steps={steps} selected={selected} onSelect={i => update({ selected: i })} />
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </section>
  )
}
