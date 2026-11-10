import { useId } from 'react'
import { accessed, concepts, matchLabel, notConfirmed, type Concept, type Match } from '../../content/hints'
import { SectionOpener } from '../shell/primitives'
import { EvidenceChip, type EvidenceLevel } from './EvidenceChip'
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

/** Full square for a close match, half for approximate, empty for not confirmed. */
export const matchLevel: Record<Match, EvidenceLevel> = { close: 'full', approximate: 'half', unconfirmed: 'none' }

/** What each match badge means, stated once above the cards. */
export const matchMeaning: Record<Match, string> = {
  close: 'means the same job',
  approximate: 'means a different scope or model',
  unconfirmed: 'means it could not be confirmed on that date',
}

const [aws, ...otherVendors] = vendors

function Cell({ text }: { text: string }) {
  return text === notConfirmed ? <span className="lsn-unconfirmed">Not confirmed</span> : <>{text}</>
}

function VendorRow({ c, v }: { c: Concept; v: (typeof vendors)[number] }) {
  return (
    <div className="lsn-vendor-row">
      <dt>{v.label}</dt>
      <dd><Cell text={c[v.key]} /></dd>
    </div>
  )
}

function ConceptItem({ c }: { c: Concept }) {
  return (
    <li className="lsn-concept">
      <div className="lsn-concept-head">
        <h3>{c.concept}</h3>
        <EvidenceChip level={matchLevel[c.match]}>{matchLabel[c.match]}</EvidenceChip>
      </div>
      <div className="lsn-concept-body">
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
          <VendorRow c={c} v={aws} />
        </dl>
        <details className="lsn-more">
          <summary>Other platforms and sources</summary>
          <div className="lsn-more__body">
            <dl className="lsn-vendors">
              {otherVendors.map(v => <VendorRow key={v.key} c={c} v={v} />)}
            </dl>
            <h4>Sources (read {accessed})</h4>
            <ul className="lsn-sources">
              {c.sources.map(s => (
                <li key={s.url}><a href={s.url} rel="noreferrer">{s.title}</a></li>
              ))}
            </ul>
          </div>
        </details>
      </div>
    </li>
  )
}

/** The lab's ideas mapped to AWS, other clouds and open source, from each vendor's own documentation. */
export function Elsewhere({ numeral = '05' }: { numeral?: string }) {
  const titleId = useId()
  const legendId = useId()
  return (
    <section className="lsn-panel" aria-labelledby={titleId}>
      <SectionOpener numeral={numeral} kicker="Elsewhere" title={<h2 id={titleId}>The same ideas on other platforms</h2>} />
      <p>This lab is AWS-flavoured; here is the same idea elsewhere.</p>
      <p className="lsn-muted">
        {disclaimer} “On AWS” means the equivalent on AWS, not something this lab runs on.
      </p>
      <div className="lsn-legend">
        <div className="lsn-label" id={legendId}>What the badges mean</div>
        <dl aria-labelledby={legendId}>
          {(Object.keys(matchLabel) as Match[]).map(m => (
            <div key={m} className="lsn-legend-row">
              <dt><EvidenceChip level={matchLevel[m]}>{matchLabel[m]}</EvidenceChip></dt>
              <dd>“{matchLabel[m]}” {matchMeaning[m]}.</dd>
            </div>
          ))}
        </dl>
      </div>
      <details className="lsn-more lsn-method">
        <summary>Where each row comes from</summary>
        <div className="lsn-more__body">
          <p className="lsn-muted">
            Each vendor row was read from that vendor’s own documentation on {accessed}. A row headed “{inLabLabel}”
            says what the lab itself uses and names the files that show it.
          </p>
        </div>
      </details>
      <ul className="lsn-concepts">
        {concepts.map(c => <ConceptItem key={c.id} c={c} />)}
      </ul>
    </section>
  )
}
