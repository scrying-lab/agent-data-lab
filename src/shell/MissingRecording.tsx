import { FileQuestion } from 'lucide-react'

/** Shown in place of a result when no valid recording exists for it. Never a crash, never a guess. */
export function MissingRecording({ what, command }: { what: string; command: string }) {
  return (
    <div className="shell-missing">
      <p className="shell-missing__title"><FileQuestion aria-hidden="true" />Recording missing</p>
      <p>
        There is no valid saved run for {what}, so there is nothing to show here. Nothing was run in its place. To
        create it, clone the repository, run <code>{command}</code> and rebuild.
      </p>
    </div>
  )
}
