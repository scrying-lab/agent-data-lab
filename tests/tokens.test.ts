import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// WCAG 2.2 relative luminance and contrast ratio.
const channel = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
const luminance = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
}
const contrast = (a: string, b: string) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }

const css = readFileSync(new URL('../src/tokens.css', import.meta.url), 'utf8')
const block = (selector: string) => {
  const start = css.indexOf(selector)
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start))
  return Object.fromEntries([...body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})/gi)].map(m => [m[1], m[2].toLowerCase()]))
}
const light = block(':root {')
const dark = { ...light, ...block(':root[data-theme="dark"]') }
const themes = { light, dark }

// Every pairing the page uses: [foreground, background, minimum ratio, what it is]
const TEXT = 4.5, UI = 3
const pairings: Array<[string, string, number, string]> = [
  ['ink', 'paper', TEXT, 'body text'],
  ['ink', 'surface', TEXT, 'text on panels'],
  ['ink-muted', 'paper', TEXT, 'secondary text'],
  ['ink-muted', 'surface', TEXT, 'secondary text on panels'],
  ['link', 'paper', TEXT, 'links'],
  ['link', 'surface', TEXT, 'links on panels'],
  ['brand-red-text', 'paper', TEXT, 'red emphasis text'],
  ['brand-red-ink', 'brand-red', TEXT, 'text on red fill'],
  ['brand-yellow-ink', 'brand-yellow', TEXT, 'text on yellow fill'],
  ['outcome-ok', 'paper', TEXT, 'allowed label'],
  ['outcome-ok', 'surface', TEXT, 'allowed label on panels'],
  ['outcome-refused', 'outcome-refused-fill', TEXT, 'refused label'],
  ['outcome-refused', 'paper', TEXT, 'refused label on page'],
  ['outcome-failed', 'paper', TEXT, 'failed label'],
  ['outcome-failed', 'surface', TEXT, 'failed label on panels'],
  ['rule', 'paper', UI, 'borders'],
  ['focus', 'paper', UI, 'focus outline'],
  ['focus', 'surface', UI, 'focus outline on panels'],
  ['series-1', 'paper', UI, 'chart series 1'],
  ['series-2', 'paper', UI, 'chart series 2'],
  ['series-1', 'surface', UI, 'chart series 1 on panels'],
  ['series-2', 'surface', UI, 'chart series 2 on panels'],
]

describe('design tokens meet WCAG 2.2 AA in both themes', () => {
  for (const [name, tokens] of Object.entries(themes)) {
    it.each(pairings)(`${name}: %s on %s ≥ %s (%s)`, (fg, bg, min) => {
      expect(tokens[fg], `${name} missing --${fg}`).toBeTruthy()
      expect(tokens[bg], `${name} missing --${bg}`).toBeTruthy()
      expect(contrast(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(min)
    })
  }
  it('keeps the two chart series far apart in hue (a colour-blind-safe blue/orange pair; charts also add dashes and labels)', () => {
    const hue = (hex: string) => {
      const n = parseInt(hex.slice(1), 16), r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255
      const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
      const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
      return (h * 60 + 360) % 360
    }
    for (const tokens of Object.values(themes)) {
      const gap = Math.abs(hue(tokens['series-1']) - hue(tokens['series-2']))
      expect(Math.min(gap, 360 - gap)).toBeGreaterThan(120)
    }
  })
  it('uses the same token names in the system-dark and chosen-dark blocks', () => {
    const systemDark = css.slice(css.indexOf('@media (prefers-color-scheme: dark)'), css.indexOf(':root[data-theme="dark"]'))
    for (const key of Object.keys(block(':root[data-theme="dark"]'))) expect(systemDark).toContain(`--${key}: ${dark[key]}`)
  })
})
