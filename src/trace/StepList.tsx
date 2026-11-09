import { useRef, type KeyboardEvent } from 'react'
import type { LabRun } from '../../agent/run-contract'
import { formatTime, waterfall, type Step } from './steps'
import { ToneMark } from './ToneMark'

type Props = { run: LabRun; steps: Step[]; selected: number; onSelect: (index: number) => void; labelledBy: string }

/**
 * The keyboard and screen-reader path through the run: one button per step and one tab stop for
 * the whole list (roving tabindex). Arrow keys, Home and End move the selection and focus together.
 * Moving focus here never announces anything; the focused button's name already says where you are.
 */
export function StepList({ run, steps, selected, onSelect, labelledBy }: Props) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([])
  const last = steps.length - 1

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const target =
      event.key === 'ArrowDown' ? Math.min(index + 1, last)
      : event.key === 'ArrowUp' ? Math.max(index - 1, 0)
      : event.key === 'Home' ? 0
      : event.key === 'End' ? last
      : null
    if (target === null) return
    event.preventDefault()
    onSelect(target)
    buttons.current[target]?.focus()
  }

  return (
    <ol className="trace-steps" aria-labelledby={labelledBy}>
      {steps.map(step => {
        const bar = waterfall(run, step.index)
        const isSelected = step.index === selected
        return (
          <li key={step.event.seq}>
            <button
              type="button"
              ref={el => { buttons.current[step.index] = el }}
              className="trace-step"
              tabIndex={isSelected ? 0 : -1}
              aria-current={isSelected ? 'step' : undefined}
              onClick={() => onSelect(step.index)}
              onKeyDown={event => onKeyDown(event, step.index)}
            >
              <span className="trace-step__num" aria-hidden="true">{String(step.index + 1).padStart(2, '0')}</span>
              {/* Separators sit in text nodes between spans, so the button's name reads
                  "Step 4 of 9: Gate allowed one read, Allowed, +23.3 ms". */}
              <span className="trace-step__label">
                <span className="sr-only">{`Step ${step.index + 1} of ${steps.length}:`}</span>{' '}{step.label}
              </span>
              {step.tone !== 'neutral' && <span className="sr-only">,</span>}{' '}
              <ToneMark tone={step.tone} />
              <span className="sr-only">,</span>{' '}
              <span className="trace-step__time">{formatTime(step.event.tMs)}</span>
              <span className="trace-step__track" aria-hidden="true">
                <span
                  className={'trace-step__bar trace-step__bar--' + step.tone}
                  style={{ left: `${(bar.start * 100).toFixed(2)}%`, width: `max(3px, ${(bar.width * 100).toFixed(2)}%)` }}
                />
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
