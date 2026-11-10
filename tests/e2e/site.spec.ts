import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']

/** Open the built index page, collecting CSP violations and requests to any other origin. */
async function openSite(page: Page, baseURL: string) {
  const outside: string[] = []
  const consoleCsp: string[] = []
  page.on('request', request => { if (!request.url().startsWith(baseURL)) outside.push(request.url()) })
  page.on('console', message => { if (message.type() === 'error' && /Content Security Policy/i.test(message.text())) consoleCsp.push(message.text()) })
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', event => {
      const w = window as unknown as { __csp?: string[] }
      ;(w.__csp ??= []).push(event.violatedDirective + ' ' + event.blockedURI)
    })
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  // The first chart and both traces have rendered once these exist.
  await expect(page.locator('#lesson-analytics .lab-chart svg').first()).toBeVisible()
  await expect(page.locator('.trace-steps')).toHaveCount(2)
  const csp = async () => [...consoleCsp, ...await page.evaluate(() => (window as unknown as { __csp?: string[] }).__csp ?? [])]
  return { outside, csp }
}

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
  return results.violations
    .filter(v => v.impact === 'serious' || v.impact === 'critical')
    .map(v => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | ')}`)
}

/**
 * Switch the theme and wait until the page has settled in it: the body paints the theme's paper and
 * no finite transition or animation is still running. Without the wait, axe can sample colours
 * half-way through a hover or background transition and report contrast that never really shows.
 */
async function setTheme(page: Page, theme: 'light' | 'dark') {
  await page.evaluate(t => document.documentElement.setAttribute('data-theme', t), theme)
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
  await page.waitForFunction(() => {
    const probe = document.createElement('div')
    probe.style.backgroundColor = 'var(--paper)'
    document.body.appendChild(probe)
    const paper = getComputedStyle(probe).backgroundColor
    probe.remove()
    const settled = document.getAnimations().every(a => a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity)
    return getComputedStyle(document.body).backgroundColor === paper && settled
  })
}

/** WCAG contrast of two computed rgb() colours. */
function contrast(a: string, b: string) {
  const lum = (c: string) => {
    const [r, g, bl] = (c.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number).map(v => {
      const s = v / 255
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const noHorizontalScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

test('the built page loads with zero CSP violations and zero requests to other origins', async ({ page, baseURL }) => {
  const { outside, csp } = await openSite(page, baseURL!)
  await page.getByLabel('Recorded example').selectOption({ label: 'Injection in a retrieved document' })
  await page.locator('#lesson-analytics').getByRole('radio', { name: 'Which weekday and hour see the most rentals?' }).click()
  await expect(page.locator('#lesson-analytics .lab-chart svg').first()).toBeVisible()
  expect(await csp()).toEqual([])
  expect(outside).toEqual([])
})

for (const theme of ['light', 'dark'] as const) {
  test(`axe reports no serious or critical WCAG violations in ${theme}`, async ({ page, baseURL }) => {
    test.slow() // a full-page axe audit takes about 25 s on an idle laptop
    await openSite(page, baseURL!)
    await setTheme(page, theme)
    expect(await seriousViolations(page)).toEqual([])
  })
}

test('axe reports no serious or critical WCAG violations at 320px, light and dark', async ({ page, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'The 320px audit runs on chromium only.')
  test.slow() // two full-page axe audits
  await page.setViewportSize({ width: 320, height: 720 })
  await openSite(page, baseURL!)
  for (const theme of ['light', 'dark'] as const) {
    await setTheme(page, theme)
    expect(await seriousViolations(page), theme).toEqual([])
  }
})

for (const width of [390, 320]) {
  test(`no horizontal scroll at ${width}px`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width, height: 800 })
    await openSite(page, baseURL!)
    expect(await noHorizontalScroll(page)).toBeLessThanOrEqual(0)
    await page.getByLabel('Recorded example').selectOption({ label: 'Forged scope' })
    await page.locator('#lesson-analytics').getByRole('radio', { name: 'Which weekday and hour see the most rentals?' }).click()
    await expect(page.locator('#lesson-analytics .lab-chart svg').first()).toBeVisible()
    expect(await noHorizontalScroll(page)).toBeLessThanOrEqual(0)
  })
}

// WebKit, like Safari, skips links on Tab unless full keyboard access is on; Option+Tab reaches them.
const tabKey = (browserName: string) => (browserName === 'webkit' ? 'Alt+Tab' : 'Tab')

test('the skip link is the first Tab stop and moves focus to the lab', async ({ page, baseURL, browserName }) => {
  await openSite(page, baseURL!)
  await page.keyboard.press(tabKey(browserName))
  const skip = page.getByRole('link', { name: 'Skip to the lab' })
  await expect(skip).toBeFocused()
  await expect(skip).toBeInViewport()
  await page.keyboard.press('Enter')
  await expect(page.locator('main#lab')).toBeFocused()
  await page.keyboard.press(tabKey(browserName))
  expect(await page.evaluate(() => !!document.activeElement?.closest('main#lab'))).toBe(true)
})

// On phones the developer disclosure starts closed, so a keyboard user opens it with Enter on its summary.
test('Tab reaches the recorded-example selector and the trace step list', async ({ page, baseURL, browserName }) => {
  await openSite(page, baseURL!)
  const reached = { select: false, steps: false }
  for (let i = 0; i < 150 && !(reached.select && reached.steps); i++) {
    await page.keyboard.press(tabKey(browserName))
    const where = await page.evaluate(() => {
      const el = document.activeElement
      return {
        select: el?.tagName === 'SELECT' && !!el.closest('#lesson-governance'),
        steps: !!el?.closest('#lesson-governance .trace-steps'),
        closedSummary: !!el?.matches('#lesson-governance details.trace-dev:not([open]) > summary'),
      }
    })
    if (where.closedSummary) await page.keyboard.press('Enter')
    reached.select ||= where.select
    reached.steps ||= where.steps
  }
  expect(reached).toEqual({ select: true, steps: true })
})

test('selecting "Forged scope" shows SCOPE_NOT_GRANTED and the label Recorded replay', async ({ page, baseURL }) => {
  await openSite(page, baseURL!)
  await page.getByLabel('Recorded example').selectOption({ label: 'Forged scope' })
  const card = page.locator('#lesson-governance article.shell-result')
  await expect(card).toContainText('SCOPE_NOT_GRANTED')
  await expect(card).toContainText('Stopped at caller')
  await expect(card.locator('.lab-tier')).toHaveText('Recorded replay')
  await expect(card.locator('.shell-result__head .lab-outcome')).toHaveText('Refused')
})

for (const theme of ['light', 'dark'] as const) {
  test(`tier labels are visible and readable in ${theme}`, async ({ page, baseURL }) => {
    await openSite(page, baseURL!)
    await setTheme(page, theme)
    const labels = page.locator('#labels .lab-tier, article.shell-result .lab-tier')
    // Three in the guide and one on each of the two result cards.
    expect(await labels.count()).toBe(5)
    await expect(page.locator('#labels .lab-tier')).toHaveText(['Recorded replay', 'Simulated in your browser', 'Recorded live run'])
    for (const label of await labels.all()) {
      await label.scrollIntoViewIfNeeded()
      await expect(label).toBeVisible()
      await expect(label.locator('.lab-tier__cell svg')).toBeVisible()
      const box = await label.boundingBox()
      expect(box!.height).toBeGreaterThanOrEqual(28)
      const colours = await label.locator('.lab-tier__text').evaluate(el => {
        const style = getComputedStyle(el)
        return { text: style.color, from: style.backgroundColor }
      })
      expect(contrast(colours.text, colours.from), `${theme}: ${await label.textContent()}`).toBeGreaterThanOrEqual(4.5)
    }
  })
}

for (const width of [390, 320]) {
  test(`the section index scrolls on its own at ${width}px, never the page`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width, height: 800 })
    await openSite(page, baseURL!)
    const index = page.getByRole('navigation', { name: 'Sections' })
    const chips = index.getByRole('link')
    await expect(chips).toHaveCount(6)
    // The row sits under the path cards, below the fold on a phone.
    await index.scrollIntoViewIfNeeded()
    await expect(chips.first()).toBeInViewport()
    await expect(chips.last()).not.toBeInViewport()
    expect(await noHorizontalScroll(page)).toBeLessThanOrEqual(0)
    // Every chip can be reached, by scrolling the row itself, and is a full-height target.
    const last = chips.last()
    await last.scrollIntoViewIfNeeded()
    await expect(last).toBeInViewport()
    for (const chip of await chips.all()) expect((await chip.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    expect(await noHorizontalScroll(page)).toBeLessThanOrEqual(0)
    expect(await page.evaluate(() => window.scrollX)).toBe(0)
    await last.click()
    await expect(page).toHaveURL(/#run-for-real$/)
  })
}

test('NOTICE.txt is served and matches the repository NOTICE', async ({ request }) => {
  const response = await request.get('./NOTICE.txt')
  expect(response.status()).toBe(200)
  expect((await response.body()).equals(readFileSync(join(process.cwd(), 'NOTICE')))).toBe(true)
  const font = await request.get('./licenses/space-grotesk-OFL.txt')
  expect(font.status()).toBe(200)
  expect(await font.text()).toContain('SIL OPEN FONT LICENSE Version 1.1')
})
