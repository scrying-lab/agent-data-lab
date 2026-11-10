import { useSyncExternalStore } from 'react'

const media = (query: string) => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query) : null)

/** True while the media query matches; false where matchMedia is missing. Follows changes live. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    onChange => {
      const list = media(query)
      list?.addEventListener?.('change', onChange)
      return () => list?.removeEventListener?.('change', onChange)
    },
    () => media(query)?.matches ?? false,
    () => false,
  )
}
