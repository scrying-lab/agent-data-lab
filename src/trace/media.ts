// Small subscriptions to the page's theme and motion settings, shared by the trace components.
import { useSyncExternalStore } from 'react'

function mediaQuery(query: string): MediaQueryList | null {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query) : null
}

function subscribeMedia(query: string, onChange: () => void) {
  const mql = mediaQuery(query)
  mql?.addEventListener?.('change', onChange)
  return () => mql?.removeEventListener?.('change', onChange)
}

/** True when the visitor asked the system for less motion. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    cb => subscribeMedia('(prefers-reduced-motion: reduce)', cb),
    () => mediaQuery('(prefers-reduced-motion: reduce)')?.matches ?? false,
    () => false,
  )
}

/** How long the graph's viewport glides to a new step, in ms. Under reduced motion it jumps instead. */
export const glideMs = (reducedMotion: boolean) => (reducedMotion ? 0 : 250)

/**
 * The page theme: data-theme on <html> records a visitor's choice; without one the page follows
 * the system setting (src/tokens.css uses the same rule).
 */
export function currentColorMode(): 'light' | 'dark' {
  const chosen = typeof document !== 'undefined' ? document.documentElement.dataset.theme : undefined
  if (chosen === 'dark') return 'dark'
  if (chosen === 'light') return 'light'
  return mediaQuery('(prefers-color-scheme: dark)')?.matches ? 'dark' : 'light'
}

function subscribeTheme(onChange: () => void) {
  const stopMedia = subscribeMedia('(prefers-color-scheme: dark)', onChange)
  const observer = typeof MutationObserver !== 'undefined' ? new MutationObserver(onChange) : null
  observer?.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  return () => { stopMedia(); observer?.disconnect() }
}

export function useColorMode(): 'light' | 'dark' {
  return useSyncExternalStore(subscribeTheme, currentColorMode, () => 'light')
}
