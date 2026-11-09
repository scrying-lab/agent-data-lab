import { defineConfig } from 'vitest/config'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'
import { builtinModules } from 'node:module'
import { fileURLToPath } from 'node:url'

// The page holds no credentials and talks to nothing but its own origin.
// Meta-tag CSP cannot set frame-ancestors; framing protection is not possible on GitHub Pages.
const contentSecurityPolicy = [
  "default-src 'none'", "script-src 'self'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data:",
  "font-src 'self'", "connect-src 'self'", "base-uri 'none'", "form-action 'none'", "object-src 'none'",
].join('; ')

function cspMeta(): Plugin {
  return {
    name: 'lab-csp-meta',
    apply: 'build',
    transformIndexHtml: { order: 'post', handler: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: contentSecurityPolicy }, injectTo: 'head-prepend' }] },
  }
}

// The Strands SDK's browser entry still references Node-only modules (session file storage)
// and its Bedrock model. The lab never uses either in the browser, so both resolve to stubs
// that throw if anything ever calls them.
const builtins = new Set([...builtinModules, ...builtinModules.map(m => 'node:' + m)])
const stubs = {
  builtin: fileURLToPath(new URL('./src/browser-stubs/node-builtin.ts', import.meta.url)),
  bedrock: fileURLToPath(new URL('./src/browser-stubs/bedrock-model.ts', import.meta.url)),
}
function browserStubs(): Plugin {
  return {
    name: 'lab-browser-stubs',
    enforce: 'pre',
    apply: () => !process.env.VITEST,
    resolveId(id, importer) {
      if (!importer || !importer.includes('@strands-agents/sdk')) return null
      if (builtins.has(id)) return stubs.builtin
      if (/(^|\/)models\/bedrock\.js$/.test(id)) return stubs.bedrock
      return null
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [browserStubs(), react(), tailwind(), cspMeta()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: {
    manifest: true,
    rolldownOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        harness: fileURLToPath(new URL('./harness.html', import.meta.url)),
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts?(x)'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
  },
})
