import './browser-init'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Space Grotesk (--font-ui), self-hosted. The package has no latin-only entry, so this is the weight
// axis for all its subsets; unicode-range means a browser downloads only the latin file for this page.
import '@fontsource-variable/space-grotesk/wght.css'
import './tokens.css'
import './style.css'
import { App } from './App'
import { applyTheme, readStoredTheme } from './shell/theme'
import { useLessonRun } from './shell'
import { Playground } from './playground/Playground'

// Apply the remembered theme before the first render, so the page does not flash the other one.
applyTheme(readStoredTheme())

// The governance lesson shows whichever run is current: a recorded example, or the visitor's own
// run from the playground. The playground reports only its newest finished run.
function Root() {
  const governance = useLessonRun()
  return <App governance={governance} governancePlayground={<Playground onRun={run => { governance.show(run) }} />} />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
