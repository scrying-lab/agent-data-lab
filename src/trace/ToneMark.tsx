import { Check, CircleX, Shield } from 'lucide-react'
import type { Tone } from './steps'

const marks = {
  ok: { Icon: Check, text: 'Allowed' },
  refused: { Icon: Shield, text: 'Refused' },
  failed: { Icon: CircleX, text: 'Failed' },
} as const

/** An outcome shown as icon plus word, never colour alone. A refusal is neutral: the gate doing its job. */
export function ToneMark({ tone }: { tone: Tone }) {
  if (tone === 'neutral') return null
  const { Icon, text } = marks[tone]
  return (
    <span className={'trace-tone trace-tone--' + tone}>
      <Icon size={14} aria-hidden="true" />
      {text}
    </span>
  )
}
