import { useId, type Ref } from 'react'
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import { Button } from '../components/ui/button'

type Props = {
  sentences: string[]
  selected: number
  playing: boolean
  onBack: () => void
  onNext: () => void
  onPlayingChange: (playing: boolean) => void
  playRef: Ref<HTMLButtonElement>
}

/**
 * The guide tells the run as a story, one sentence per step. Back and Next move the same selection
 * as the list and the graph. Buttons at either end stay focusable (aria-disabled) so focus is never lost.
 * The button ladder: Next is the one yellow (primary) control, Back is tertiary, Play is a toggle.
 */
export function Guide({ sentences, selected, playing, onBack, onNext, onPlayingChange, playRef }: Props) {
  const headingId = useId()
  const atStart = selected === 0
  const atEnd = selected === sentences.length - 1
  return (
    <section className="trace-guide" aria-labelledby={headingId}>
      <h3 id={headingId} className="trace-guide__title">Guide</h3>
      <div className="trace-guide__body">
        <p className="trace-guide__count">Step {selected + 1} of {sentences.length}</p>
        <p className="trace-guide__sentence">{sentences[selected]}</p>
        <div className="trace-guide__controls">
          <Button type="button" variant="tertiary" className="trace-btn" aria-disabled={atStart || undefined} onClick={() => { if (!atStart) onBack() }}>
            <ChevronLeft aria-hidden="true" />Back
          </Button>
          <Button type="button" variant="primary" className="trace-btn" aria-disabled={atEnd || undefined} onClick={() => { if (!atEnd) onNext() }}>
            Next<ChevronRight aria-hidden="true" />
          </Button>
          <Button
            ref={playRef}
            type="button"
            variant="toggle"
            className="trace-btn trace-btn--toggle"
            aria-pressed={playing}
            onClick={() => onPlayingChange(!playing)}
          >
            {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}Play
          </Button>
        </div>
        <p className="trace-guide__hint">Play moves to the next step every 4.5 seconds. Any key or click in this panel stops it.</p>
      </div>
    </section>
  )
}
