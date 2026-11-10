import { useState } from 'react'
import { ChevronRight, HelpCircle } from 'lucide-react'
import type { Lesson } from '../../agent/run-contract'
import { lessonContent } from '../../content/lessons'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Callout, SectionOpener } from './primitives'

type Props = {
  lesson: Lesson
  /** The section's place in the page index, e.g. "02". Decoration only. */
  numeral: string
  /** e.g. "Lesson 1 · Governance" */
  kicker: string
  title: string
  headingId: string
}

/**
 * A lesson's opening: the numbered opener with its heading, the summary as labelled fact tiles,
 * a question to answer first, and routes in.
 */
export function LessonIntro({ lesson, numeral, kicker, title, headingId }: Props) {
  const c = lessonContent[lesson]
  const [open, setOpen] = useState(false)
  return (
    <div className="shell-lesson__intro">
      <SectionOpener numeral={numeral} kicker={kicker} title={<h2 id={headingId}>{title}</h2>} />
      <dl className="shell-facts">
        {c.facts.map(fact => (
          <div key={fact.label} className="shell-fact">
            <dt>{fact.label}</dt>
            <dd>{fact.text}</dd>
          </div>
        ))}
      </dl>
      <Callout kind="predict" className="shell-predict" kicker={<><HelpCircle aria-hidden="true" focusable="false" />Before you look, predict</>}>
        <p>{c.prediction}</p>
      </Callout>
      <Collapsible open={open} onOpenChange={setOpen} className="shell-routes">
        <CollapsibleTrigger asChild>
          <Button variant="tertiary" className="shell-routes__toggle">
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
