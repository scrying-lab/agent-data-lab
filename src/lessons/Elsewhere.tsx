import { useId } from 'react'
import { accessed, concepts, matchLabel, notConfirmed, type Concept } from '../../content/hints'
import { Badge } from '@/components/ui/badge'
import '../tokens.css'
import './lessons.css'

/** Vendor headings describe each vendor, never the lab: "On AWS" is the equivalent on AWS. */
export const vendors: { key: 'aws' | 'google' | 'azure' | 'openSource'; label: string }[] = [
  { key: 'aws', label: 'On AWS' },
  { key: 'google', label: 'Google Cloud' },
  { key: 'azure', label: 'Microsoft Azure' },
  { key: 'openSource', label: 'Open source' },
]

/** The only heading that speaks about the lab itself; shown only where `inLab` says what is true. */
export const inLabLabel = 'What this lab uses'

export const disclaimer = 'Apart from Amazon Bedrock, which the optional recorder calls, the lab uses none of the cloud services named here.'

function Cell({ text }: { text: string }) {
  return text === notConfirmed ? <span className="lsn-unconfirmed">Not confirmed</span> : <>{text}</>
}

function ConceptItem({ c }: { c: Concept }) {
  return (
    <li className="lsn-concept">
      <div className="lsn-pair-head">
        <h3>{c.concept}</h3>
        <Badge className="lsn-badge">{matchLabel[c.match]}</Badge>
      </div>
      <p>{c.plain}</p>
      {c.matchNote && <p className="lsn-muted">{c.matchNote}</p>}
      <dl className="lsn-vendors">
        {c.inLab && (
          <div className="lsn-vendor-row lsn-in-lab">
            <dt>{inLabLabel}</dt>
            <dd>
              {c.inLab.text}{' '}
              <span className="lsn-muted">(see {c.inLab.paths.map((path, i) => (
                <span key={path}>{i > 0 && ', '}<code>{path}</code></span>
              ))})</span>
            </dd>
          </div>
        )}
        {vendors.map(v => (
          <div key={v.key} className="lsn-vendor-row">
            <dt>{v.label}</dt>
            <dd><Cell text={c[v.key]} /></dd>
          </div>
        ))}
      </dl>
      <h4>Sources (read {accessed})</h4>
      <ul className="lsn-sources">
        {c.sources.map(s => (
          <li key={s.url}><a href={s.url} rel="noreferrer">{s.title}</a></li>
        ))}
      </ul>
    </li>
  )
}

/** The lab's ideas mapped to AWS, other clouds and open source, from each vendor's own documentation. */
export function Elsewhere() {
  const titleId = useId()
  return (
    <section className="lsn-panel" aria-labelledby={titleId}>
      <span className="lsn-kicker">Elsewhere</span>
      <h2 id={titleId}>The same ideas on other platforms</h2>
      <p>This lab is AWS-flavoured; here is the same idea elsewhere.</p>
      <p className="lsn-muted">
        Each vendor row was read from that vendor’s own documentation on {accessed}. “On AWS” means the equivalent
        on AWS, not something this lab runs on. A row headed “{inLabLabel}” says what the lab itself uses and names
        the files that show it. {disclaimer} “Close match” means the same job; “Approximate” means a different scope
        or model; “Not confirmed” means it could not be confirmed on that date.
      </p>
      <ul className="lsn-concepts">
        {concepts.map(c => <ConceptItem key={c.id} c={c} />)}
      </ul>
    </section>
  )
}
