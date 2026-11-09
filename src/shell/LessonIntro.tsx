import { useState } from 'react'
import { ChevronRight, HelpCircle } from 'lucide-react'
import type { Lesson } from '../../agent/run-contract'
import { lessonContent } from '../../content/lessons'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

type Props = {
  lesson: Lesson
  /** e.g. "Lesson 1 · Governance" */
  kicker: string
  title: string
  headingId: string
}

/** A lesson's opening: its heading, the plain summary, a question to answer first, and routes in. */
export function LessonIntro({ lesson, kicker, title, headingId }: Props) {
  const c = lessonContent[lesson]
  const [open, setOpen] = useState(false)
  return (
    <div className="shell-lesson__intro">
      <p className="shell-kicker">{kicker}</p>
      <h2 id={headingId} className="shell-section__title">{title}</h2>
      <p className="shell-prose">{c.summary}</p>
      <div className="shell-predict">
        <p className="shell-predict__label"><HelpCircle aria-hidden="true" />Before you look, predict</p>
        <p className="shell-predict__question">{c.prediction}</p>
      </div>
      <Collapsible open={open} onOpenChange={setOpen} className="shell-routes">
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="shell-button shell-button--quiet">
            <ChevronRight aria-hidden="true" className="shell-chevron" />
            Things to try, and where the code lives
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="shell-routes__body">
          <div className="shell-routes__grid">
            <div>
              <h3 className="shell-subtitle">If you are new to this</h3>
              <ol>{c.beginner.map(step => <li key={step}>{step}</li>)}</ol>
            </div>
            <div>
              <h3 className="shell-subtitle">If you write code</h3>
              <ol>{c.extension.map(step => <li key={step}>{step}</li>)}</ol>
            </div>
          </div>
          <h3 className="shell-subtitle">Where the code lives</h3>
          <ul className="shell-pointers">
            {c.codePointers.map(p => <li key={p.path}><code>{p.path}</code>: {p.what}</li>)}
          </ul>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
