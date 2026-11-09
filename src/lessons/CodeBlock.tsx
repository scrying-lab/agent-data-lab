import '../tokens.css'
import './lessons.css'

/**
 * A scrollable code listing. It is a named region with tabIndex 0 so keyboard users can focus it
 * and scroll long lines with the arrow keys (WCAG 2.1.1).
 */
export function CodeBlock({ label, code }: { label: string; code: string }) {
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scrollable region must be focusable to scroll by keyboard
    <div className="lsn-code" role="region" aria-label={label} tabIndex={0}>
      <pre><code>{code}</code></pre>
    </div>
  )
}
