// Browser plumbing shared by the charts: theme colours read from src/tokens.css at render time,
// and the width of the chart's container.
import { useEffect, useState, type RefObject } from 'react'

/**
 * SVG presentation attributes cannot use var(--token), so the charts read each token's
 * current value from the document and redraw when the theme changes.
 * Missing tokens (for example in a test document) fall back to currentColor / none.
 */
const tokens = {
  series1: ['--series-1', 'currentColor'],
  series2: ['--series-2', 'currentColor'],
  ink: ['--ink', 'currentColor'],
  inkMuted: ['--ink-muted', 'currentColor'],
  paper: ['--paper', 'none'],
} as const
export type ChartColors = Record<keyof typeof tokens, string>

export function readChartColors(): ChartColors {
  const style = typeof document === 'undefined' ? null : getComputedStyle(document.documentElement)
  const entries = Object.entries(tokens).map(([key, [name, fallback]]) => [key, style?.getPropertyValue(name).trim() || fallback])
  return Object.fromEntries(entries) as ChartColors
}

const same = (a: ChartColors, b: ChartColors) => (Object.keys(tokens) as (keyof ChartColors)[]).every(k => a[k] === b[k])

/** Current token colours; re-read when <html data-theme> changes or the system colour scheme flips. */
export function useChartColors(): ChartColors {
  const [colors, setColors] = useState(readChartColors)
  useEffect(() => {
    const update = () => setColors(previous => {
      const next = readChartColors()
      return same(previous, next) ? previous : next
    })
    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] })
    const scheme = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null
    scheme?.addEventListener('change', update)
    update()
    return () => {
      observer.disconnect()
      scheme?.removeEventListener('change', update)
    }
  }, [])
  return colors
}

/** The element's content width in CSS pixels, kept current with a ResizeObserver. 0 until measured. */
export function useWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const measure = () => setWidth(Math.round(element.clientWidth))
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
  return width
}
