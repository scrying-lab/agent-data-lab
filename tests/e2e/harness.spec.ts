import { test, expect, type Page } from '@playwright/test'

type Summary = {
  scenario: string; tier: string; outcome: { status: string; code?: string }
  decisions: { tool?: string; decision?: string; stage?: string; code?: string }[]
  ledgerSize: number; modelId: string
}

/** Load a preset, collecting outside requests and CSP violations while it runs. */
async function runPreset(page: Page, baseURL: string, preset: string) {
  const outside: string[] = []
  const cspViolations: string[] = []
  page.on('request', request => { if (!request.url().startsWith(baseURL)) outside.push(request.url()) })
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', event => {
      ;(window as unknown as { __csp: string[] }).__csp ??= []
      ;(window as unknown as { __csp: string[] }).__csp.push(event.violatedDirective + ' ' + event.blockedURI + ' ' + event.sourceFile.split('/').pop() + ':' + event.lineNumber + ':' + event.columnNumber)
    })
  })
  page.on('console', message => { if (message.type() === 'error' && /Content Security Policy/i.test(message.text())) cspViolations.push(message.text()) })

  await page.goto('/harness.html?preset=' + preset)
  await expect(page.locator('#result')).toContainText('"outcome"')
  const summary = await page.evaluate(() => (window as unknown as { __harness: Summary }).__harness)
  const csp = await page.evaluate(() => (window as unknown as { __csp?: string[] }).__csp ?? [])
  return { summary, outside, cspViolations, csp }
}

test('the real Strands agent loop runs in the browser with no outside requests', async ({ page, baseURL }) => {
  const { summary, outside, cspViolations, csp } = await runPreset(page, baseURL!, 'gov-default')
  expect(summary).toEqual({
    scenario: 'gov-default', tier: 'simulated', outcome: { status: 'ok' },
    decisions: [{ tool: 'getSyntheticMetric', decision: 'allow' }],
    ledgerSize: 1, modelId: 'playground-simulated',
  })
  await expect(page.locator('#label')).toHaveText('Simulated in your browser')
  await expect(page.locator('#answer')).toHaveText('Trips completed for 2026-Q1: 41250 trips (synthetic data, 90 observations).')
  expect(csp).toEqual([])
  expect(cspViolations).toEqual([])
  expect(outside).toEqual([])
})

test('the gate refuses a forged scope in the browser and nothing is read', async ({ page, baseURL }) => {
  const { summary, outside, cspViolations, csp } = await runPreset(page, baseURL!, 'gov-forged-scope')
  expect(summary).toMatchObject({
    scenario: 'gov-forged-scope', tier: 'simulated', outcome: { status: 'denied', code: 'SCOPE_NOT_GRANTED' },
    decisions: [{ tool: 'getSyntheticMetric', decision: 'deny', stage: 'caller', code: 'SCOPE_NOT_GRANTED' }],
    ledgerSize: 0, modelId: 'playground-simulated',
  })
  await expect(page.locator('#label')).toHaveText('Simulated in your browser')
  await expect(page.locator('#answer')).toHaveText('The requested scope is wider than your role allows.')
  expect(csp).toEqual([])
  expect(cspViolations).toEqual([])
  expect(outside).toEqual([])
})
