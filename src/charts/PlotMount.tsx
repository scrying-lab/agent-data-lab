import { useEffect, useRef } from 'react'
import { useWidth } from './hooks'

/** Width used before the container has been measured (and in test documents, which have no layout). */
export const FALLBACK_WIDTH = 640

/**
 * Mounts an Observable Plot element and redraws it when the container is resized or `render` changes.
 * `render` receives the available width; memoise it (useCallback) so it changes only with its inputs.
 * The SVG is exposed as one image with an aria-label and aria-description; the same numbers are
 * available as a real table next to it.
 */
export function PlotMount({ render, className }: { render: (width: number) => Element; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const width = useWidth(ref)
  useEffect(() => {
    const container = ref.current
    if (!container) return
    const node = render(width > 0 ? width : FALLBACK_WIDTH)
    if (node.tagName.toLowerCase() === 'svg') node.setAttribute('role', 'img')
    container.replaceChildren(node)
    return () => container.replaceChildren()
  }, [render, width])
  return <div ref={ref} className={className ?? 'lab-chart__plot'} />
}
