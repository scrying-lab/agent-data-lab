import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// WCAG 2.2 relative luminance and contrast ratio.
const channel = (c: number) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
const rgb = (hex: string) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] }
const luminance = (hex: string) => { const [r, g, b] = rgb(hex); return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b) }
const contrast = (a: string, b: string) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
const toHex = (c: number[]) => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('')
/** The colours a two-stop sRGB linear-gradient paints, sampled at `stops` evenly spaced points. */
const gradient = (from: string, to: string, stops = 21) => {
  const [a, b] = [rgb(from), rgb(to)]
  return Array.from({ length: stops }, (_, i) => toHex(a.map((v, k) => v + (b[k] - v) * (i / (stops - 1)))))
}

const root = new URL('..', import.meta.url).pathname
const css = readFileSync(join(root, 'src/tokens.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const blockBody = (selector: string) => {
  const start = css.indexOf(selector)
  expect(start, `tokens.css has no ${selector} block`).toBeGreaterThanOrEqual(0)
  return css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start))
}
const declarations = (body: string) => [...body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)].map(m => [m[1].slice(2), m[2].trim()] as const)
const colours = (body: string) => Object.fromEntries(declarations(body).filter(([, v]) => v.startsWith('#')).map(([k, v]) => [k, v.toLowerCase()]))

const LIGHT = ':root {', SYSTEM_DARK = ':root:not([data-theme="light"]) {', CHOSEN_DARK = ':root[data-theme="dark"] {'
const light = colours(blockBody(LIGHT))
const dark = { ...light, ...colours(blockBody(CHOSEN_DARK)) }
const themes = { light, dark } as const

const TEXT = 4.5, UI = 3
const washes = ['wash-blue', 'wash-magenta', 'wash-yellow', 'wash-red']
const surfaces = ['paper', 'surface', 'surface-sunken', 'surface-raised', 'surface-overlay']
const tiers = ['replay', 'simulated', 'live'] as const

// Every pairing the page uses: [foreground, background, minimum ratio, what it is]
const pairings: Array<[string, string, number, string]> = [
  ...surfaces.flatMap(s => [
    ['ink', s, TEXT, 'body text'], ['ink-muted', s, TEXT, 'secondary text'], ['focus', s, UI, 'focus ring'],
    ['rule', s, UI, 'frame and control borders'],
  ] as Array<[string, string, number, string]>),
  ...washes.flatMap(w => [
    ['ink', w, TEXT, 'text on a wash'], ['ink-muted', w, TEXT, 'secondary text on a wash'], ['focus', w, UI, 'focus ring on a wash'],
    ['rule', w, UI, 'border that marks a wash edge'],
  ] as Array<[string, string, number, string]>),
  ['link', 'paper', TEXT, 'links'],
  ['link', 'surface', TEXT, 'links on panels'],
  ['link', 'surface-raised', TEXT, 'links on raised'],
  ['text-blue', 'paper', TEXT, 'blue text tint'],
  ['text-blue', 'surface-raised', TEXT, 'blue text tint on raised'],
  ['text-blue', 'wash-blue', TEXT, 'blue zone subheader, replay stat'],
  ['text-magenta', 'paper', TEXT, 'magenta text tint'],
  ['text-magenta', 'surface-raised', TEXT, 'magenta text tint on raised'],
  ['text-magenta', 'wash-magenta', TEXT, 'magenta zone subheader, simulated stat'],
  ['edge-blue', 'paper', UI, 'blue zone edge'],
  ['edge-blue', 'wash-blue', UI, 'blue zone edge on its wash'],
  ['edge-magenta', 'paper', UI, 'magenta zone edge'],
  ['edge-magenta', 'wash-magenta', UI, 'magenta zone edge on its wash'],
  ['brand-red-text', 'paper', TEXT, 'red emphasis text'],
  ['brand-red-ink', 'brand-red', TEXT, 'text on red fill'],
  ['brand-yellow-ink', 'brand-yellow', TEXT, 'Run: black on yellow'],
  ['brand-yellow-ink', 'brand-yellow-pure', TEXT, 'black on pure yellow'],
  ['btn-primary-edge', 'brand-yellow', UI, 'primary button edge against its fill'],
  ['focus-on-fill', 'brand-yellow', UI, 'focus ring on or next to yellow'],
  ['focus-on-fill', 'brand-yellow-pure', UI, 'focus ring on pure yellow'],
  ['focus', 'shadow-color', UI, 'focus ring where it crosses an offset shadow'],
  ['btn-cancel-text', 'wash-red', TEXT, 'Cancel'],
  ['ink-muted', 'wash-red', TEXT, 'inactive Cancel'],
  ['btn-cancel-border', 'wash-red', UI, 'Cancel border'],
  ['btn-cancel-border', 'paper', UI, 'Cancel border on the page'],
  ['outcome-ok', 'outcome-ok-fill', TEXT, 'Allowed badge'],
  ['outcome-ok', 'paper', TEXT, 'allowed label'],
  ['outcome-ok', 'surface', TEXT, 'allowed label on panels'],
  ['outcome-refused', 'outcome-refused-fill', TEXT, 'Refused badge'],
  ['outcome-refused', 'paper', TEXT, 'refused label on page'],
  ['outcome-failed', 'outcome-failed-fill', TEXT, 'Failed badge'],
  ['outcome-failed', 'paper', TEXT, 'failed label'],
  ['outcome-failed', 'surface', TEXT, 'failed label on panels'],
  ['outcome-cancelled', 'outcome-cancelled-fill', TEXT, 'Cancelled badge'],
  ['outcome-cancelled', 'paper', TEXT, 'cancelled label on page'],
  ['mark-text', 'mark-bg', TEXT, 'section numeral, lesson chip'],
  ['series-1', 'paper', UI, 'chart series 1'],
  ['series-2', 'paper', UI, 'chart series 2'],
  ['series-1', 'surface', UI, 'chart series 1 on panels'],
  ['series-2', 'surface', UI, 'chart series 2 on panels'],
  ...tiers.flatMap(t => [
    [`tier-${t}-text`, `tier-${t}-from`, TEXT, `${t} label text, gradient start`],
    [`tier-${t}-text`, `tier-${t}-to`, TEXT, `${t} label text, gradient end`],
    [`tier-${t}-icon`, `tier-${t}-cell`, UI, `${t} icon on its cell`],
  ] as Array<[string, string, number, string]>),
  ...(['replay', 'simulated'] as const).flatMap(t => [
    [`tier-${t}-cell`, 'paper', UI, `${t} cell against the page`],
    [`tier-${t}-cell`, 'surface', UI, `${t} cell against panels`],
  ] as Array<[string, string, number, string]>),
]

// Inside a zone the page surfaces are remapped to the card surfaces (src/shell/shell.css), so every
// pairing on paper or raised must also hold on the card and its raised level.
const onCard: Record<string, string> = { paper: 'surface-card', surface: 'surface-card-raised', 'surface-raised': 'surface-card-raised' }
// Tier cells are left out: inside a zone the label's own 2px --rule border is what bounds it, and
// rule on the card surfaces is checked here.
pairings.push(...pairings.filter(([fg, bg]) => bg in onCard && !/^tier-.*-cell$/.test(fg)).map(([fg, bg, min, what]) => [fg, onCard[bg], min, `${what}, inside a zone`] as [string, string, number, string]))

describe('design tokens meet WCAG 2.2 AA in both themes', () => {
  for (const [name, tokens] of Object.entries(themes)) {
    it.each(pairings)(`${name}: %s on %s ≥ %s (%s)`, (fg, bg, min) => {
      expect(tokens[fg], `${name} missing --${fg}`).toBeTruthy()
      expect(tokens[bg], `${name} missing --${bg}`).toBeTruthy()
      expect(contrast(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(min)
    })

    it.each(tiers)(`${name}: %s label text stays at 4.5:1 across 21 sRGB stops of its gradient`, tier => {
      const text = tokens[`tier-${tier}-text`]
      for (const stop of gradient(tokens[`tier-${tier}-from`], tokens[`tier-${tier}-to`])) {
        expect(contrast(text, stop), `${tier} text on ${stop}`).toBeGreaterThanOrEqual(TEXT)
      }
    })

    it(`${name}: where a fill or gradient end matches the page, the 2px rule carries the edge`, () => {
      // A label or yellow control is always visible against the page: either its fill or its border reaches 3:1.
      const edge = (fill: string, border: string, page: string) => Math.max(contrast(tokens[fill], tokens[page]), contrast(tokens[border], tokens[page]))
      for (const page of ['paper', 'surface']) {
        for (const t of tiers) for (const part of ['cell', 'from', 'to']) expect(edge(`tier-${t}-${part}`, 'rule', page), `${t} ${part} on ${page}`).toBeGreaterThanOrEqual(UI)
        expect(edge('brand-yellow', 'btn-primary-edge', page), `primary button on ${page}`).toBeGreaterThanOrEqual(UI)
        expect(edge('mark-bg', 'rule', page), `numeral square on ${page}`).toBeGreaterThanOrEqual(UI)
      }
    })

    it(`${name}: decorative dividers stay visible (1.4:1) without competing with frame rules`, () => {
      for (const bg of ['paper', 'surface']) expect(contrast(tokens['rule-divider'], tokens[bg])).toBeGreaterThanOrEqual(1.4)
      expect(contrast(tokens['rule-divider'], tokens.paper)).toBeLessThan(contrast(tokens.rule, tokens.paper))
    })
  }

  it('keeps the two chart series far apart in hue (a colour-blind-safe blue/orange pair; charts also add dashes and labels)', () => {
    const hue = (hex: string) => {
      const [r, g, b] = rgb(hex).map(v => v / 255)
      const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
      const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
      return (h * 60 + 360) % 360
    }
    for (const tokens of Object.values(themes)) {
      const gap = Math.abs(hue(tokens['series-1']) - hue(tokens['series-2']))
      expect(Math.min(gap, 360 - gap)).toBeGreaterThan(120)
    }
  })
})

describe('dark mode is designed in its own right', () => {
  it('elevation gets lighter in dark and darker-to-lighter order holds: sunken < paper < raised < overlay', () => {
    const order = ['surface-sunken', 'paper', 'surface-raised', 'surface-overlay'].map(k => luminance(dark[k]))
    for (let i = 1; i < order.length; i++) expect(order[i]).toBeGreaterThan(order[i - 1])
    expect(dark.surface).toBe(dark['surface-raised'])
    expect(light.surface).toBe(light['surface-raised'])
  })
  it('a card in a zone is lighter than the zone in dark, and its raised level lighter again', () => {
    for (const wash of ['wash-blue', 'wash-magenta']) expect(luminance(dark['surface-card'])).toBeGreaterThan(luminance(dark[wash]))
    expect(luminance(dark['surface-card-raised'])).toBeGreaterThan(luminance(dark['surface-card']))
    expect(light['surface-card']).toBe(light.paper)
    expect(light['surface-card-raised']).toBe(light['surface-raised'])
  })
  it('uses the addendum values for ink, rules and surfaces', () => {
    expect(dark).toMatchObject({ ink: '#e8e8e8', 'ink-muted': '#b3b3b3', rule: '#d6d6d6', 'rule-divider': '#3a3a3a', paper: '#121212', 'surface-sunken': '#0a0a0a', 'surface-raised': '#1e1e1e', 'surface-overlay': '#2a2a2a' })
    expect(light).toMatchObject({ paper: '#ffffff', 'surface-sunken': '#f0f0f0', 'surface-raised': '#f0f0f0', 'surface-overlay': '#e6e6e6' })
  })
  it('never casts a white shadow: dark shadows are a quiet grey slab, light shadows are black', () => {
    expect(light['shadow-color']).toBe('#000000')
    const [r, g, b] = rgb(dark['shadow-color'])
    expect(r === g && g === b, 'neutral grey').toBe(true)
    expect(r).toBeGreaterThanOrEqual(0x4a)
    expect(r).toBeLessThanOrEqual(0x5a)
  })
  it('keeps a black edge on yellow controls in both themes', () => {
    expect(light['btn-primary-edge']).toBe('#000000')
    expect(dark['btn-primary-edge']).toBe('#000000')
    expect(light['focus-on-fill']).toBe('#000000')
    expect(dark['focus-on-fill']).toBe('#000000')
  })
  it('uses the decided tier icon cells in both themes', () => {
    for (const tokens of Object.values(themes)) {
      expect(tokens).toMatchObject({
        'tier-replay-cell': '#0066ff', 'tier-replay-icon': '#ffffff',
        'tier-simulated-cell': '#cc00cc', 'tier-simulated-icon': '#ffffff',
        'tier-live-cell': '#ffff00', 'tier-live-icon': '#000000',
        'brand-yellow-pure': '#ffff00', 'mark-bg': '#000000', 'mark-text': '#ffff00',
      })
    }
    expect(light['brand-yellow']).toBe('#ffeb1a')
    expect(dark['brand-yellow']).toBe('#f2e600')
  })
})

describe('token file hygiene', () => {
  const blocks = { light: blockBody(LIGHT), 'system dark': blockBody(SYSTEM_DARK), 'chosen dark': blockBody(CHOSEN_DARK) }
  const COLOUR_NAME = /^(paper|surface|ink|rule|shadow-color|brand|link|focus|wash|text-|edge|tier|btn|outcome|mark|series)/
  const COLOUR_VALUE = /#|rgba?\(|hsla?\(|hwb\(|lab\(|lch\(|oklab\(|oklch\(|color\(|color-mix\(|light-dark\(|transparent|currentcolor|\b(black|white|red|yellow|blue|green|grey|gray)\b/i

  it.each(Object.entries(blocks))('%s: every colour token is an opaque 6-digit hex value', (_, body) => {
    const decls = declarations(body)
    expect(decls.length).toBeGreaterThan(0)
    for (const [name, value] of decls) {
      if (COLOUR_NAME.test(name) || COLOUR_VALUE.test(value)) {
        expect(value, `--${name}`).toMatch(/^#[0-9a-f]{6}$/i)
      }
    }
  })

  it('the system-dark and chosen-dark blocks are identical', () => {
    const normalise = (body: string) => body.split('\n').map(l => l.trim()).filter(Boolean).join('\n')
    expect(normalise(blocks['system dark'])).toBe(normalise(blocks['chosen dark']))
  })

  it('dark blocks only override names the light block defines', () => {
    for (const key of Object.keys(colours(blocks['chosen dark']))) expect(light[key], `--${key}`).toBeTruthy()
  })

  it('keeps every v1.0 token name that other parts of the site still use', () => {
    for (const name of ['paper', 'surface', 'ink', 'ink-muted', 'rule', 'focus', 'link', 'brand-red', 'brand-red-ink', 'brand-red-text', 'brand-yellow', 'brand-yellow-ink', 'outcome-ok', 'outcome-refused', 'outcome-refused-fill', 'outcome-failed', 'series-1', 'series-2']) {
      expect(light[name], `--${name}`).toBeTruthy()
    }
    for (const name of ['font-display', 'font-body', 'font-mono', 'font-ui', 'border-width', 'shadow-offset', 'radius', 'step-hero', 'step-section', 'step-panel', 'step-sub', 'step-voice']) {
      expect(blocks.light, `--${name}`).toMatch(new RegExp(`--${name}\\s*:`))
    }
  })

  it('never uses the raw brand colours #00cc00, #ffff00 or #ff3333 as text tokens', () => {
    const TEXT_TOKEN = /(^ink|^link$|^text-|-text$|^outcome-(ok|refused|failed|cancelled)$|^series-)/
    // The one sanctioned exception: pure yellow as text on near-black (the live label and the numeral square).
    const onBlack: Record<string, string[]> = { 'tier-live-text': ['tier-live-from', 'tier-live-to'], 'mark-text': ['mark-bg'] }
    for (const [name, tokens] of Object.entries(themes)) {
      for (const [key, value] of Object.entries(tokens)) {
        if (!TEXT_TOKEN.test(key) || !['#00cc00', '#ffff00', '#ff3333'].includes(value)) continue
        expect(onBlack[key], `${name} --${key} uses a raw brand colour as text`).toBeTruthy()
        for (const bg of onBlack[key]) expect(luminance(tokens[bg]), `${name} --${bg}`).toBeLessThan(0.05)
      }
    }
  })

  it('no file in src/ outside tokens.css holds a hex colour', () => {
    const walk = (dir: string): string[] => readdirSync(dir).flatMap(f => {
      const p = join(dir, f)
      return statSync(p).isDirectory() ? walk(p) : /\.(css|tsx?)$/.test(f) ? [p] : []
    })
    for (const file of walk(join(root, 'src'))) {
      if (file.endsWith('tokens.css')) continue
      const text = readFileSync(file, 'utf8')
      expect(text.match(/#[0-9a-f]{3}(?:[0-9a-f]{3})?(?:[0-9a-f]{2})?\b(?![-\w])/gi), file.slice(root.length)).toBeNull()
    }
  })
})
