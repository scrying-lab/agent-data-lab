import { tokenize, type CodeLanguage } from './highlight'
import '../tokens.css'
import './lessons.css'

/**
 * A scrollable code listing. It is a named region with tabIndex 0 so keyboard users can focus it
 * and scroll long lines with the arrow keys (WCAG 2.1.1). With a language, comments, strings and
 * keywords take their colours from tokens (muted, blue text, magenta text); the text is unchanged.
 */
export function CodeBlock({ label, code, language }: { label: string; code: string; language?: CodeLanguage }) {
  const tokens = language ? tokenize(code, language) : [{ text: code }]
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scrollable region must be focusable to scroll by keyboard
    <div className="lsn-code" role="region" aria-label={label} tabIndex={0}>
      <pre><code>{tokens.map((t, i) => (t.kind ? <span key={i} className={'lsn-tok-' + t.kind}>{t.text}</span> : t.text))}</code></pre>
    </div>
  )
}
