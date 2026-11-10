import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronDown, Code } from 'lucide-react'
import { tierLabel, type LabRun, type Lesson } from '../../agent/run-contract'
import { narrate } from '../../content/narration'
import { announce } from '../announce'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui/collapsible'
import { TierLabel } from '../shell/primitives'
import { Guide } from './Guide'
import { isPhone } from './media'
import { StepDetails } from './StepDetails'
import { StepList } from './StepList'
import { toSteps } from './steps'
import { TraceGraph } from './TraceGraph'
import './trace.css'

export const PLAY_INTERVAL_MS = 4500
/** Each lesson's trace has its own title, so the page outline never repeats a heading. */
export const traceTitles: Record<Lesson, string> = {
  governance: 'What happened at the gate, step by step',
  analytics: 'What happened in this analytics run, step by step',
}
export const DEV_DISCLOSURE_TITLE = 'Every step with timings (for developers)'
/** Keys that press a button. Only these, on the Play toggle, leave playback running. */
const TOGGLE_KEYS = new Set([' ', 'Spacebar', 'Enter'])

/**
 * One run, three synchronised views: a guide that narrates the run in plain language, an accessible
 * step list (the keyboard path) and a graph of the same steps (visual only). All three share a single
 * selected step. Reading order: the guide, then the selected step's details, then a disclosure for
 * developers holding the step list with timings and the graph. The disclosure starts open on wider
 * screens and closed on phones, where the guide's Back and Next walk the same steps.
 */
type Props = {
  run: LabRun
  /**
   * Show the run's tier label in the head band. Turn it off when a result card for the same run sits
   * right above, so one result carries one label.
   */
  showTier?: boolean
}

export function TracePanel({ run, showTier = true }: Props) {
  const steps = useMemo(() => toSteps(run), [run])
  const sentences = useMemo(() => narrate(run), [run])
  const headingId = useId()
  const listHeadingId = useId()
  const root = useRef<HTMLElement>(null)
  const playToggle = useRef<HTMLButtonElement>(null)
  const [devOpen, setDevOpen] = useState(() => !isPhone())

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
    <section ref={root} className="trace" data-tier={run.tier} aria-labelledby={headingId}>
      <div className="trace__head">
        <h2 id={headingId} className="trace__title">{traceTitles[run.lesson]}</h2>
        {showTier && <TierLabel tier={run.tier}>{tierLabel(run)}</TierLabel>}
      </div>

      <div className="trace__body">
        <Guide
          sentences={sentences}
          selected={selected}
          playing={playing}
          onBack={() => guideTo(Math.max(selected - 1, 0), false)}
          onNext={() => guideTo(Math.min(selected + 1, last), false)}
          onPlayingChange={onPlayingChange}
          playRef={playToggle}
        />
        <StepDetails run={run} step={steps[selected]} total={steps.length} />
      </div>

      <details className="trace-dev" open={devOpen} onToggle={event => setDevOpen(event.currentTarget.open)}>
        <summary className="trace-dev__summary">
          <Code aria-hidden="true" focusable="false" />
          {DEV_DISCLOSURE_TITLE}
        </summary>
        <div className="trace-dev__body">
          <div className="trace__list">
            <h3 id={listHeadingId} className="trace__subtitle">Steps</h3>
            <StepList run={run} steps={steps} selected={selected} onSelect={i => update({ selected: i })} labelledBy={listHeadingId} />
          </div>
          <Collapsible className="trace-graph-box">
            <CollapsibleTrigger className="lab-btn lab-btn--tertiary trace-graph-box__toggle">
              <ChevronDown aria-hidden="true" className="trace-graph-box__chevron" />
              Graph of the same steps
            </CollapsibleTrigger>
            <CollapsibleContent>
              <TraceGraph steps={steps} selected={selected} onSelect={i => update({ selected: i })} />
            </CollapsibleContent>
          </Collapsible>
        </div>
      </details>
    </section>
  )
}
