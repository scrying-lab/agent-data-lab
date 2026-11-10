// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { tierLabel, tiers, type LabRun } from '../agent/run-contract'
import { Callout, OutcomeBadge, outcomeWords, SectionOpener, StatTile, TierLabel, type OutcomeStatus } from '../src/shell/primitives'
import { Button } from '../src/components/ui/button'

afterEach(cleanup)

const runOf = (tier: LabRun['tier']): Pick<LabRun, 'tier' | 'provider' | 'recordedAt'> =>
  ({ tier, provider: { kind: 'bedrock', modelId: 'example-model-v1', region: 'us-east-1' }, recordedAt: '2026-01-02T03:04:05Z' })

describe('TierLabel', () => {
  it.each(tiers)('%s: renders exactly the text tierLabel() returns, with one hidden icon', tier => {
    const text = tierLabel(runOf(tier))
    const { container } = render(<TierLabel tier={tier}>{text}</TierLabel>)
    const label = container.querySelector('.lab-tier')!
    expect(label.getAttribute('data-tier')).toBe(tier)
    expect(label.textContent).toBe(text)
    const icons = label.querySelectorAll('svg')
    expect(icons).toHaveLength(1)
    expect(icons[0].getAttribute('aria-hidden')).toBe('true')
    expect(label.querySelectorAll('button, a, [tabindex], h1, h2, h3, h4, h5, h6')).toHaveLength(0)
  })

  it('gives each tier its own icon', () => {
    const shapes = tiers.map(tier => {
      const { container } = render(<TierLabel tier={tier}>{tierLabel(runOf(tier))}</TierLabel>)
      return container.querySelector('svg')!.getAttribute('class')
    })
    expect(new Set(shapes).size).toBe(tiers.length)
    expect(shapes[0]).toMatch(/history/)
    expect(shapes[1]).toMatch(/flask-conical/)
    expect(shapes[2]).toMatch(/radio/)
  })

  it('keeps the live label whole, including model, region and date', () => {
    const text = tierLabel(runOf('live'))
    expect(text).toBe('Recorded live run · Amazon Bedrock · example-model-v1 · us-east-1 · 2026-01-02')
    const { container } = render(<TierLabel tier="live">{text}</TierLabel>)
    expect(container.textContent).toBe(text)
  })
})

describe('OutcomeBadge', () => {
  const cases: Array<[OutcomeStatus, string, RegExp]> = [
    ['ok', 'Allowed', /circle-check/],
    ['denied', 'Refused', /shield-check/],
    ['failed', 'Failed', /triangle-alert/],
    ['cancelled', 'Cancelled', /circle-slash/],
  ]
  it.each(cases)('%s: shows the word %s and its icon, never colour alone', (status, word, icon) => {
    const { container } = render(<OutcomeBadge status={status} />)
    const badge = container.querySelector('.lab-outcome')!
    expect(badge.getAttribute('data-status')).toBe(status)
    expect(badge.textContent).toBe(word)
    const svgs = badge.querySelectorAll('svg')
    expect(svgs).toHaveLength(1)
    expect(svgs[0].getAttribute('aria-hidden')).toBe('true')
    expect(svgs[0].getAttribute('class')).toMatch(icon)
  })
  it('uses four distinct words', () => {
    expect(new Set(Object.values(outcomeWords)).size).toBe(4)
  })
})

describe('SectionOpener', () => {
  it('renders the heading it is given and adds no other heading', () => {
    const { container } = render(
      <SectionOpener numeral="02" kicker="Lesson 1 · Governance" why="Why this matters." title={<h2 id="gov-title" className="x">Governance</h2>} />,
    )
    const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]')
    expect(headings).toHaveLength(1)
    expect(headings[0].tagName).toBe('H2')
    expect(headings[0].id).toBe('gov-title')
    expect(headings[0].textContent).toBe('Governance')
    expect(container.querySelector('p.lab-opener__kicker')!.textContent).toBe('Lesson 1 · Governance')
    expect(container.querySelector('.lab-opener__numeral')!.getAttribute('aria-hidden')).toBe('true')
    expect(container.querySelector('.lab-opener__why')!.textContent).toBe('Why this matters.')
  })
  it('keeps the level the caller chose and works without a numeral or why', () => {
    const { container } = render(<SectionOpener kicker="Credits" title={<h3>Credits</h3>} />)
    expect(container.querySelectorAll('h1, h2, h3, h4, h5, h6')).toHaveLength(1)
    expect(container.querySelector('h3')).not.toBeNull()
    expect(container.querySelector('.lab-opener__numeral')).toBeNull()
    expect(container.querySelector('.lab-opener__why')).toBeNull()
  })
})

describe('Callout', () => {
  it('predict: a kicker paragraph and the body, no heading', () => {
    const { container } = render(<Callout kind="predict" kicker="Predict"><p>What will the gate do?</p></Callout>)
    const callout = container.querySelector('.lab-callout')!
    expect(callout.getAttribute('data-kind')).toBe('predict')
    expect(callout.querySelector('p.lab-callout__kicker')!.textContent).toBe('Predict')
    expect(callout.textContent).toContain('What will the gate do?')
    expect(callout.querySelectorAll('h1, h2, h3, h4, h5, h6')).toHaveLength(0)
  })
  it('why: a Shield icon, hidden from assistive technology', () => {
    const { container } = render(<Callout kind="why" kicker="Why it matters"><p>Body</p></Callout>)
    const svg = container.querySelector('.lab-callout__kicker svg')!
    expect(svg.getAttribute('class')).toMatch(/shield/)
    expect(svg.getAttribute('aria-hidden')).toBe('true')
  })
  it('dev: a disclosure that starts closed, with the kicker as its summary', () => {
    const { container } = render(<Callout kind="dev" kicker="For developers"><p>Details</p></Callout>)
    const details = container.querySelector('details')!
    expect(details.getAttribute('data-kind')).toBe('dev')
    expect(details.open).toBe(false)
    expect(details.querySelector('summary')!.textContent).toBe('For developers')
  })
})

describe('StatTile', () => {
  it.each(['blue', 'magenta'] as const)('%s: shows the value and its label', tone => {
    const { container } = render(<StatTile tone={tone} value="1,234" label="Peak rentals" />)
    const tile = container.querySelector('.lab-stat')!
    expect(tile.getAttribute('data-tone')).toBe(tone)
    expect(tile.querySelector('.lab-stat__value')!.textContent).toBe('1,234')
    expect(tile.querySelector('.lab-stat__label')!.textContent).toBe('Peak rentals')
  })
})

describe('Button ladder', () => {
  it.each([
    ['primary', 'lab-btn--primary'], ['cancel', 'lab-btn--cancel'], ['tertiary', 'lab-btn--tertiary'], ['toggle', 'lab-btn--toggle'],
    ['default', 'lab-btn--primary'], ['outline', 'lab-btn--tertiary'], ['secondary', 'lab-btn--cancel'], ['destructive', 'lab-btn--cancel'],
  ] as const)('%s maps to %s, and every variant shares the base class', (variant, cls) => {
    const { getByRole } = render(<Button variant={variant}>Go</Button>)
    const button = getByRole('button', { name: 'Go' })
    expect(button.classList.contains('lab-btn')).toBe(true)
    expect(button.classList.contains(cls)).toBe(true)
    expect(button.getAttribute('data-variant')).toBe(variant)
  })
  it('keeps caller classes and the pressed state of a toggle', () => {
    const { getByRole } = render(<Button variant="toggle" aria-pressed="true" className="pg-toggle">Plain text editor</Button>)
    const button = getByRole('button', { name: 'Plain text editor', pressed: true })
    expect(button.classList.contains('pg-toggle')).toBe(true)
  })
})
