// The visitor's colour theme. "system" follows the operating system (no data-theme on <html>);
// "light" and "dark" set data-theme and color-scheme. The choice is remembered in localStorage when
// the browser allows it; every storage call is wrapped, because private windows and blocked site
// data make it throw.
export const themes = ['system', 'light', 'dark'] as const
export type Theme = typeof themes[number]
export const themeLabels: Record<Theme, string> = { system: 'System', light: 'Light', dark: 'Dark' }

export const THEME_KEY = 'agent-data-lab:theme'

export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (themes as readonly string[]).includes(value)
}

export function readStoredTheme(): Theme {
  try {
    const value = window.localStorage.getItem(THEME_KEY)
    return isTheme(value) ? value : 'system'
  } catch {
    return 'system'
  }
}

export function storeTheme(theme: Theme): void {
  try {
    if (theme === 'system') window.localStorage.removeItem(THEME_KEY)
    else window.localStorage.setItem(THEME_KEY, theme)
  } catch {
    // Not remembered; the page still works.
  }
}

/** Sets data-theme and color-scheme on <html>, and keeps the browser's theme-color in step. */
export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement): void {
  if (theme === 'system') {
    root.removeAttribute('data-theme')
    root.style.removeProperty('color-scheme')
  } else {
    root.setAttribute('data-theme', theme)
    root.style.colorScheme = theme
  }
  // theme-color comes from the --paper token, so no colour value lives here.
  const paper = typeof getComputedStyle === 'function' ? getComputedStyle(root).getPropertyValue('--paper').trim() : ''
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    if (meta.dataset.systemContent === undefined) meta.dataset.systemContent = meta.content
    meta.content = theme === 'system' || !paper ? meta.dataset.systemContent : paper
  }
}
