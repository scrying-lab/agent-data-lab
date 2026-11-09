#!/usr/bin/env node
// Captures the README screenshots from the built site. Run after `npm run build`:
//   node scripts/screenshots.mjs
// Starts `vite preview` on a free port, drives Chromium with Playwright, writes docs/images/*.png.
import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const port = Number(process.env.PORT ?? 4499)
const base = `http://127.0.0.1:${port}/`
const out = new URL('../docs/images/', import.meta.url)
await mkdir(out, { recursive: true })

const server = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: 'ignore' })
const ready = async () => { for (let i = 0; i < 60; i++) { try { if ((await fetch(base)).ok) return } catch { /* not up yet */ } await new Promise(r => setTimeout(r, 250)) } throw Error('preview server did not start') }

const browser = await chromium.launch()
try {
  await ready()
  const shoot = async (name, { width, height, theme = 'light' }, prepare, locator) => {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2, colorScheme: theme, reducedMotion: 'reduce' })
    await page.goto(base)
    await page.evaluate(t => { document.documentElement.dataset.theme = t; document.documentElement.style.colorScheme = t }, theme)
    if (prepare) await prepare(page)
    const target = locator ? page.locator(locator).first() : page
    await target.screenshot({ path: new URL(`${name}.png`, out).pathname, animations: 'disabled' })
    await page.close()
    console.log('wrote', `docs/images/${name}.png`)
  }

  await shoot('hero', { width: 1280, height: 860 })
  await shoot('playground-refused', { width: 1280, height: 900, theme: 'dark' }, async page => {
    await page.getByRole('button', { name: 'Try guest', exact: true }).click()
    await page.getByRole('button', { name: 'Run', exact: true }).click()
    await page.locator('.pg-result[data-outcome="denied"]').waitFor({ timeout: 20_000 })
  }, 'section.pg')
  await shoot('trace-guide', { width: 1280, height: 900 }, async page => {
    await page.getByLabel('Recorded example').selectOption({ index: 2 })
  }, '#lesson-governance .tp, #lesson-governance [class*="trace"]')
  await shoot('chart-hourly', { width: 1280, height: 900 }, null, 'figure.lab-chart')
  await shoot('phone', { width: 390, height: 844 })
} finally {
  await browser.close()
  server.kill()
}
