import { useId } from 'react'
import { ChevronRight } from 'lucide-react'
import { pairs, sdk, workshop, type Pair, type Verified } from '../../examples/pairs'
import { gotchas } from '../../examples/gotchas'
import { sources } from '../../examples/sources'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { CodeBlock } from './CodeBlock'
import '../tokens.css'
import './lessons.css'

/** How far each TypeScript example is checked, in words a visitor can trust. */
export const verifiedBadge: Record<Verified, string> = {
  executed: 'Runs in tests',
  compiled: 'Type-checked',
  'names-only': 'Names checked only',
}

const verifiedDetail: Record<Verified, string> = {
  executed: 'A test runs this TypeScript with a scripted model and checks the outcome.',
  compiled: 'This TypeScript type-checks, but nothing runs it.',
  'names-only': 'Only the imported names were checked against the installed SDK.',
}

function PairView({ pair }: { pair: Pair }) {
  const headingId = useId()
  return (
    <article className="lsn-pair" aria-labelledby={headingId}>
      <div className="lsn-pair-head">
        <h3 id={headingId}>{pair.title}</h3>
        <Badge className="lsn-badge">{verifiedBadge[pair.verified]}</Badge>
      </div>
      <p>{pair.whatChanges}</p>
      <p className="lsn-muted">{verifiedDetail[pair.verified]}</p>
      <div className="lsn-columns">
        <div>
          <h4>Python</h4>
          <CodeBlock label={'Python: ' + pair.pyFile} code={sources[pair.pyFile] ?? ''} />
        </div>
        <div>
          <h4>TypeScript</h4>
          <CodeBlock label={'TypeScript: ' + pair.tsFile} code={sources[pair.tsFile] ?? ''} />
        </div>
      </div>
    </article>
  )
}

function Gotchas() {
  return (
    <Collapsible className="lsn-disclosure">
      <CollapsibleTrigger asChild>
        <Button variant="outline" className="lsn-trigger">
          <ChevronRight className="lsn-chevron" aria-hidden="true" />
          Things that trip up Python developers
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="lsn-gotchas">
          {gotchas.map(g => (
            <li key={g.id}>
              <strong>{g.title}</strong>
              <dl>
                <dt>Python</dt>
                <dd><code>{g.python}</code></dd>
                <dt>TypeScript</dt>
                <dd><code>{g.typescript}</code></dd>
                <dt>Checked against</dt>
                <dd><code>{sdk.name}/{g.evidence.file}</code></dd>
              </dl>
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  )
}

/** Every Python example from the workshop beside its TypeScript translation. */
export function TranslationPanel() {
  const titleId = useId()
  return (
    <section className="lsn-panel" aria-labelledby={titleId}>
      <span className="lsn-kicker">For Python developers</span>
      <h2 id={titleId}>Python → TypeScript</h2>
      <p>
        If you learned Strands Agents in Python, here is the same code in the TypeScript SDK. Each pair says what
        changes and how far the TypeScript side is checked.
      </p>
      <p className="lsn-muted">
        Python examples adapted from the <a href={workshop.repo}>AWS sample Strands Agents workshop</a> ({workshop.license}),
        commit <code>{workshop.commit}</code>. TypeScript targets <code>{sdk.name}</code> {sdk.version}.
      </p>
      <Gotchas />
      {pairs.map(pair => <PairView key={pair.id} pair={pair} />)}
    </section>
  )
}
