import { useEffect, useState } from 'react'
import { ChoiceGroup } from './ChoiceGroup'
import { applyTheme, readStoredTheme, storeTheme, themeLabels, themes, type Theme } from './theme'

const options = themes.map(value => ({ value, label: themeLabels[value] }))

/** System / Light / Dark. Sets data-theme and color-scheme on <html>; remembered when storage allows. */
export function ThemeControl() {
  const [theme, setTheme] = useState<Theme>(readStoredTheme)
  useEffect(() => applyTheme(theme), [theme])
  return (
    <ChoiceGroup
      label="Theme"
      className="shell-theme"
      options={options}
      value={theme}
      onChange={next => {
        storeTheme(next)
        setTheme(next)
      }}
    />
  )
}
