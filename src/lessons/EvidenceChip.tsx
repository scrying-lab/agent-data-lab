import type { ReactNode } from 'react'
import '../tokens.css'
import './lessons.css'

/** How much evidence a chip reports: a full square, a half square, or an empty square. */
export type EvidenceLevel = 'full' | 'half' | 'none'

/**
 * An evidence chip: no fill, a 1px muted border, a square glyph and the words. The glyph repeats
 * what the words say and is hidden from assistive technology; the chip is never coloured, so it
 * cannot be mistaken for an outcome or a tier label.
 */
export function EvidenceChip({ level, children }: { level: EvidenceLevel; children: ReactNode }) {
  return (
    <span className="lsn-chip" data-level={level}>
      <svg className="lsn-chip__glyph" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
        <rect x="0.75" y="0.75" width="10.5" height="10.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        {level === 'full' && <rect x="0.75" y="0.75" width="10.5" height="10.5" fill="currentColor" />}
        {level === 'half' && <rect x="0.75" y="0.75" width="5.25" height="10.5" fill="currentColor" />}
      </svg>
      <span>{children}</span>
    </span>
  )
}
