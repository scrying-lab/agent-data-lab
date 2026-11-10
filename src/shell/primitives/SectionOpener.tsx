import type { ReactElement, ReactNode } from 'react'
import './SectionOpener.css'

/**
 * Opens a page section: an optional numeral square, the kicker as a paragraph, the section's own
 * heading, and an optional one-line "why". The heading is passed in as an element (its level, id
 * and text stay the caller's), so the opener never adds a heading. The numeral is decoration: the
 * kicker and heading carry the meaning.
 */
export function SectionOpener({ numeral, kicker, title, why, className }: {
  numeral?: string
  kicker: ReactNode
  title: ReactElement
  why?: ReactNode
  className?: string
}) {
  return (
    <div className={className ? `lab-opener ${className}` : 'lab-opener'} data-numbered={numeral ? '' : undefined}>
      {numeral && <span className="lab-opener__numeral" aria-hidden="true">{numeral}</span>}
      <div className="lab-opener__text">
        <p className="lab-opener__kicker">{kicker}</p>
        {title}
        {why && <p className="lab-opener__why">{why}</p>}
      </div>
    </div>
  )
}
