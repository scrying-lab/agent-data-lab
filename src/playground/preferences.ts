// The visitor's editor choice, remembered in this browser only. Storage can be missing or throw
// (private windows, blocked site data), so every access is guarded and the default is CodeMirror.
const KEY = 'agent-data-lab:playground-editor'

export function readPlainTextPreference(): boolean {
  try {
    return globalThis.localStorage?.getItem(KEY) === 'plain'
  } catch {
    return false
  }
}

export function writePlainTextPreference(plain: boolean): void {
  try {
    globalThis.localStorage?.setItem(KEY, plain ? 'plain' : 'code')
  } catch {
    // Storage unavailable: the choice still applies for this visit.
  }
}
