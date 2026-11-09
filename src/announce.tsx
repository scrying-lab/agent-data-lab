import { useEffect, useState } from 'react'

// The page's single live region. Mount <Announcer /> once, outside any keyed subtree,
// and call announce(text) from anywhere. Components must not render their own live regions
// (enforced by the lint rule in eslint.config.js), so screen readers never hear a message twice.
let publish: ((text: string) => void) | null = null

export function announce(text: string) {
  if (!publish) return
  const send = publish
  send('') // clear first so repeating the same sentence is still announced
  requestAnimationFrame(() => send(text))
}

export function Announcer() {
  const [message, setMessage] = useState('')
  useEffect(() => {
    publish = setMessage
    return () => { if (publish === setMessage) publish = null }
  }, [])
  return <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">{message}</div>
}
