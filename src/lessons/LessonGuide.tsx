import { useId } from 'react'
import type { Lesson } from '../../agent/run-contract'
import { lessonContent } from '../../content/lessons'
import '../tokens.css'
import './lessons.css'

/** One lesson's plain-language introduction: summary, a prediction to make first, two routes and the code. */
export function LessonGuide({ lesson }: { lesson: Lesson }) {
  const c = lessonContent[lesson]
  const id = useId()
  return (
    <section className="lsn-panel" aria-labelledby={id}>
      <span className="lsn-kicker">Lesson</span>
      <h2 id={id}>{c.title}</h2>
      <p>{c.summary}</p>
      <div className="lsn-prediction">
        <h3 className="lsn-kicker">Before you run it, predict</h3>
        <p>{c.prediction}</p>
      </div>
      <div className="lsn-routes">
        <div>
          <h3>If you are new to this</h3>
          <ol>{c.beginner.map(step => <li key={step}>{step}</li>)}</ol>
        </div>
        <div>
          <h3>If you write code</h3>
          <ol>{c.extension.map(step => <li key={step}>{step}</li>)}</ol>
        </div>
      </div>
      <h3>Where the code lives</h3>
      <ul className="lsn-pointers">
        {c.codePointers.map(p => <li key={p.path}><code>{p.path}</code>: {p.what}</li>)}
      </ul>
    </section>
  )
}
