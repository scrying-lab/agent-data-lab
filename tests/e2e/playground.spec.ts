import { test, expect } from '@playwright/test'

// The playground runs the real Strands agent loop and gate on the published page, under the
// production Content-Security-Policy, with a simulated model and no outside requests.
test('the playground runs the real loop under the production CSP and the gate refuses a one-word change', async ({ page, baseURL }) => {
  const outside: string[] = []
  page.on('request', request => { if (!request.url().startsWith(baseURL!)) outside.push(request.url()) })
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', event => {
      ;(window as unknown as { __csp: string[] }).__csp ??= []
      ;(window as unknown as { __csp: string[] }).__csp.push(event.violatedDirective + ' ' + event.blockedURI)
    })
  })

  await page.goto('/')
  const result = page.locator('.pg-result')

  await page.getByRole('button', { name: 'Run', exact: true }).click()
  await expect(result).toHaveAttribute('data-outcome', 'ok', { timeout: 20_000 })
  await expect(result).toContainText('41250')
  await expect(page.locator('.pg-result-wrap')).toContainText('Simulated in your browser')

  await page.getByRole('button', { name: 'Try guest', exact: true }).click()
  await page.getByRole('button', { name: 'Run', exact: true }).click()
  await expect(result).toHaveAttribute('data-outcome', 'denied', { timeout: 20_000 })
  await expect(page.locator('.pg-result-wrap')).toContainText('TOOL_NOT_GRANTED')

  expect(await page.evaluate(() => (window as unknown as { __csp?: string[] }).__csp ?? [])).toEqual([])
  expect(outside).toEqual([])
})
