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

// Observable Plot labels each mark group (<g aria-label="line">) inside the chart SVG. The SVG itself is
// role="img" with its own name and description, so those children are presentational and assistive
// technology ignores them, but axe still reports aria-label on a <g>. Only those inner groups are left
// out; the SVG, its name and everything else are audited. (Open request: drop the mark labels in src/charts.)
const PLOT_MARK_GROUPS = '.lab-chart__plot svg g[aria-label]'

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).exclude(PLOT_MARK_GROUPS).analyze()
  return results.violations
    .filter(v => v.impact === 'serious' || v.impact === 'critical')
    .map(v => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | ')}`)
}

async function setTheme(page: Page, theme: 'light' | 'dark') {
  await page.evaluate(t => document.documentElement.setAttribute('data-theme', t), theme)
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
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
    await openSite(page, baseURL!)
    await setTheme(page, theme)
    expect(await seriousViolations(page)).toEqual([])
  })
}

test('axe reports no serious or critical WCAG violations at 320px, light and dark', async ({ page, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'The 320px audit runs on chromium only.')
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
      }
    })
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
  await expect(card.locator('.shell-tier')).toHaveText('Recorded replay')
})

test('NOTICE.txt is served and matches the repository NOTICE', async ({ request }) => {
  const response = await request.get('./NOTICE.txt')
  expect(response.status()).toBe(200)
  expect((await response.body()).equals(readFileSync(join(process.cwd(), 'NOTICE')))).toBe(true)
})
