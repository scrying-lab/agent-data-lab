import { useCallback, useMemo, useState } from 'react'
import { runSchema, type LabRun } from '../../agent/run-contract'
import { announce } from '../announce'

/** The run a lesson is showing right now, and a way to show another one. */
export type LessonRunController = {
  /** The shown run, or null for the lesson's default recording. */
  run: LabRun | null
  /**
   * Show a run: a recorded example, or a run the playground just made. It is checked against
   * lab-run/v1 first; an invalid run is not shown and the visitor hears why. Returns whether it was shown.
   */
  show: (run: LabRun) => boolean
}

/**
 * Holds the run a lesson shows. Lift it above the lesson (as App does) so something else, such as
 * the playground's onRun, can set it. Showing a different run changes only this value: the lesson's
 * other state (selected example, the analytics lesson, the theme) stays as it is.
 */
export function useLessonRun(initial: LabRun | null = null): LessonRunController {
  const [run, setRun] = useState<LabRun | null>(initial)
  const show = useCallback((candidate: LabRun) => {
    const parsed = runSchema.safeParse(candidate)
    if (!parsed.success) {
      announce('That run could not be shown because it does not match the lab-run/v1 format.')
      return false
    }
    setRun(parsed.data)
    return true
  }, [])
  return useMemo(() => ({ run, show }), [run, show])
}
