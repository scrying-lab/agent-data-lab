import type { Ref } from 'react'
import { TriangleAlert } from 'lucide-react'
import type { ParseError } from './parse'

export type SummaryItem = { href: string; title: string; error: ParseError; focus: () => void }

/** Lists every block that could not be read, with a link to each. Receives focus when Run finds problems. */
export function ErrorSummary({ items, titleId, ref }: { items: SummaryItem[]; titleId: string; ref?: Ref<HTMLDivElement> }) {
  if (items.length === 0) return null
  return (
    <div ref={ref} tabIndex={-1} className="pg-error-summary" aria-labelledby={titleId}>
      <h3 id={titleId} className="pg-error-title">
        <TriangleAlert aria-hidden="true" size={20} />
        {items.length === 1 ? 'Fix 1 problem before running' : `Fix ${items.length} problems before running`}
      </h3>
      <p>Nothing ran. Your text is kept exactly as you wrote it.</p>
      <ul>
        {items.map(item => (
          <li key={item.href}>
            <a href={item.href} onClick={event => { event.preventDefault(); item.focus() }}>
              {item.title}: {item.error.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
