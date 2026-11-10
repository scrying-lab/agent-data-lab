import type { ReactNode } from 'react'
import { Code, Shield } from 'lucide-react'
import './Callout.css'

export type CalloutKind = 'predict' | 'why' | 'dev'

/**
 * Three callouts, all with copy passed in by the caller.
 * - predict: a yellow kicker strip over the yellow wash, a 2px ink border, the body in the voice style.
 * - why: paper with a 6px ink left rule and a Shield icon beside the kicker.
 * - dev: the surface tint, as a disclosure that starts closed; the kicker is its summary.
 * The kicker is a paragraph (or the summary), never a heading.
 */
export function Callout({ kind, kicker, children, className }: { kind: CalloutKind; kicker: ReactNode; children: ReactNode; className?: string }) {
  const cls = className ? `lab-callout ${className}` : 'lab-callout'
  if (kind === 'dev') {
    return (
      <details className={cls} data-kind="dev">
        <summary className="lab-callout__kicker"><Code aria-hidden="true" focusable="false" />{kicker}</summary>
        <div className="lab-callout__body">{children}</div>
      </details>
    )
  }
  return (
    <div className={cls} data-kind={kind}>
      <p className="lab-callout__kicker">{kind === 'why' && <Shield aria-hidden="true" focusable="false" />}{kicker}</p>
      <div className="lab-callout__body">{children}</div>
    </div>
  )
}
