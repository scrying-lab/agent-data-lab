import type { ReactNode } from 'react'
import type { LabRun } from '../agent/run-contract'
import { Announcer } from './announce'
import { Elsewhere } from './lessons/Elsewhere'
import { RunForReal } from './lessons/RunForReal'
import { TranslationPanel } from './lessons/TranslationPanel'
import { AnalyticsLesson } from './shell/AnalyticsLesson'
import { Credits, Hero, LabelGuide, LAB_ID, SiteFooter, SiteHeader } from './shell/Frame'
import { GovernanceLesson } from './shell/GovernanceLesson'
import { RUN_FOR_REAL_ID } from './shell/ResultCard'
import { useLessonRun, type LessonRunController } from './shell/useLessonRun'
import './shell/shell.css'

export type AppProps = {
  /**
   * The governance lesson's shown run. Pass one from useLessonRun() to set it from outside the
   * lesson, e.g. from the playground's onRun. Without it, App keeps its own.
   */
  governance?: LessonRunController
  /** The governance playground (two editable blocks). Nothing is rendered in its slot without it. */
  governancePlayground?: ReactNode
  /** Recordings to play instead of the saved fixtures (tests use this). */
  analyticsRuns?: readonly LabRun[]
  governanceRuns?: readonly LabRun[]
}

/**
 * The whole page, in reading order: header, hero (with the 01-06 index), the label guide, the two lessons, the Python to
 * TypeScript translation, the same ideas elsewhere, how to run it for real, credits and footer.
 * The one live region (Announcer) sits here, outside every keyed subtree.
 */
export function App({ governance, governancePlayground, analyticsRuns, governanceRuns }: AppProps) {
  const own = useLessonRun()
  const controller = governance ?? own
  return (
    <>
      <Announcer />
      <SiteHeader />
      <main id={LAB_ID} tabIndex={-1} className="shell-main">
        <Hero />
        <LabelGuide hasPlayground={governancePlayground != null} />
        <GovernanceLesson controller={controller} playground={governancePlayground} runs={governanceRuns} />
        <AnalyticsLesson runs={analyticsRuns} />
        <div id="python-to-typescript" className="shell-section shell-panel">
          <TranslationPanel />
        </div>
        <div id="elsewhere" className="shell-section shell-panel">
          <Elsewhere />
        </div>
        <div id={RUN_FOR_REAL_ID} className="shell-section shell-panel shell-panel--narrow">
          <RunForReal />
        </div>
        <Credits />
      </main>
      <SiteFooter />
    </>
  )
}
