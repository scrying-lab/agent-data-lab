import { useId } from 'react'
import { ArrowRight, Bike, Code2, ShieldCheck } from 'lucide-react'
import type { Tier } from '../../agent/run-contract'
import { links } from '../../content/links'
import { SectionOpener, TierLabel } from './primitives'
import { ThemeControl } from './ThemeControl'
import { baseLabel } from './tiers'

export const LAB_ID = 'lab'
export const LABELS_ID = 'labels'

/** The page index under the hero: every numbered section, in reading order. */
export const sectionIndex = [
  { numeral: '01', href: '#' + LABELS_ID, name: 'Labels' },
  { numeral: '02', href: '#lesson-governance', name: 'Governance' },
  { numeral: '03', href: '#lesson-analytics', name: 'Analytics' },
  { numeral: '04', href: '#python-to-typescript', name: 'Python → TypeScript' },
  { numeral: '05', href: '#elsewhere', name: 'Elsewhere' },
  { numeral: '06', href: '#run-for-real', name: 'Run it for real' },
] as const

/** Focus the lab after the skip link's own jump, so the next Tab starts inside it in every browser. */
function focusLab() {
  document.getElementById(LAB_ID)?.focus({ preventScroll: true })
}

export function SiteHeader() {
  return (
    <header className="shell-header">
      <a className="shell-skip" href={'#' + LAB_ID} onClick={focusLab}>Skip to the lab</a>
      <div className="shell-header__inner">
        <p className="shell-wordmark">
          <span className="shell-wordmark__name">Agent Data Lab</span>
          <span className="shell-wordmark__org">scrying-lab</span>
        </p>
        <ThemeControl />
      </div>
    </header>
  )
}

const paths = [
  { href: '#lesson-analytics', who: 'Curious?', what: 'Start with the bike data', Icon: Bike },
  { href: '#lesson-governance', who: 'Building with AI?', what: 'Change one word and watch the gate', Icon: ShieldCheck },
  { href: '#run-for-real', who: 'Developer?', what: 'Run it for real', Icon: Code2 },
] as const

export function Hero() {
  const headingId = useId()
  const pathsId = useId()
  return (
    <section className="shell-hero" aria-labelledby={headingId}>
      <p className="shell-kicker">A teaching lab for AWS Strands Agents · TypeScript</p>
      <h1 id={headingId} className="shell-hero__title">An AI agent asks for data. A gate decides.</h1>
      <p className="shell-hero__lede">
        This is a small AI agent that answers questions about real bike-sharing data. Before any data is read, a
        gate checks every tool call the agent makes.
      </p>
      <h2 id={pathsId} className="sr-only">Where to start</h2>
      <nav className="shell-paths" aria-labelledby={pathsId}>
        {paths.map(({ href, who, what, Icon }) => (
          <a key={href} className="shell-path" href={href}>
            <span className="shell-path__who"><Icon aria-hidden="true" />{who}</span>
            <span className="shell-path__what">{what}<ArrowRight aria-hidden="true" className="shell-path__arrow" /></span>
          </a>
        ))}
      </nav>
      <nav className="shell-index" aria-label="Sections">
        <ol className="shell-index__list">
          {sectionIndex.map(({ numeral, href, name }) => (
            <li key={href}>
              <a className="shell-index__chip" href={href}>
                <span className="shell-index__num" aria-hidden="true">{numeral}</span>
                <span className="shell-index__name">{name}</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </section>
  )
}

const tierNotes: { tier: Tier; text: string }[] = [
  { tier: 'replay', text: 'A saved run of the real agent code, played back here. A scripted stand-in played the AI model’s part, so no AI model was involved.' },
  { tier: 'simulated', text: 'The agent code ran just now in this page, with a simulated model and invented data. Nothing left your browser.' },
  { tier: 'live', text: 'A run with a real AI model on Amazon Bedrock, recorded earlier and played back here. The label also names the model, region and date.' },
]

type LabelGuideProps = {
  /** True when the playground is mounted: then some results on the page are made just now, not recorded. */
  hasPlayground?: boolean
}

/**
 * 01: how results are made. The opener says where everything on the page runs; then one column
 * per tier, each on its own tint, with the live column holding the note that none exist yet.
 */
export function LabelGuide({ hasPlayground = false }: LabelGuideProps) {
  const headingId = useId()
  return (
    <section id={LABELS_ID} className="shell-section shell-labels" aria-labelledby={headingId}>
      <SectionOpener
        numeral="01"
        kicker="Before you start"
        title={<h2 id={headingId}>How to read the labels</h2>}
        why={
          <>
            Everything on this page runs in your browser, and no AI model is called here.{' '}
            {hasPlayground
              ? 'The recorded examples are saved runs of the real agent code; the playground runs that same code just now, with a simulated model.'
              : 'The results you see are saved recordings of the real agent code.'}{' '}
            The real thing runs when you clone the repository.
          </>
        }
      />
      <p className="shell-prose">Every result on this page carries exactly one of these labels. It says how the result was made.</p>
      <dl className="shell-labels__list">
        {tierNotes.map(({ tier, text }) => (
          <div key={tier} className="shell-labels__item" data-tier={tier}>
            <dt><TierLabel tier={tier}>{baseLabel(tier)}</TierLabel></dt>
            <dd>{text}</dd>
            {tier === 'live' && (
              <dd className="shell-labels__note">Live recordings with real models are planned for a later release (see the changelog). Until then, no result on this page comes from a real AI model.</dd>
            )}
          </div>
        ))}
      </dl>
    </section>
  )
}

const repository = links.project.repository
const changelog = repository ? repository + '/blob/main/CHANGELOG.md' : null

export function Credits() {
  const headingId = useId()
  return (
    <section id="credits" className="shell-section shell-credits" aria-labelledby={headingId}>
      <SectionOpener kicker="About this lab" title={<h2 id={headingId}>Credits and licences</h2>} />
      <dl className="shell-credits__list">
        <div>
          <dt>Data</dt>
          <dd>
            Bike Sharing dataset by Hadi Fanaee-T, UCI Machine Learning Repository,{' '}
            <a href={links.data.bikeSharingDoi}>doi.org/10.24432/C5W894</a>, licensed{' '}
            <a href={links.licences.ccBy4}>CC BY 4.0</a>. The governance lesson’s co-op, people and figures are invented.
          </dd>
        </div>
        <div>
          <dt>Code</dt>
          <dd><a href={links.licences.mit}>MIT licence</a></dd>
        </div>
        <div>
          <dt>Writing</dt>
          <dd><a href={links.licences.ccBy4}>CC BY 4.0</a></dd>
        </div>
        <div>
          <dt>Third-party licences</dt>
          <dd><a href="./NOTICE.txt">Third-party licences (NOTICE.txt)</a></dd>
        </div>
        {repository && (
          <div>
            <dt>Source</dt>
            <dd>
              <a href={repository}>Repository on GitHub</a>
              {changelog && <> · <a href={changelog}>Changelog on GitHub</a></>}
            </dd>
          </div>
        )}
      </dl>
      <p className="shell-prose shell-muted">Built with AI assistance.</p>
    </section>
  )
}

export function SiteFooter() {
  return (
    <footer className="shell-footer">
      <p>
        <span className="shell-wordmark__name">Agent Data Lab</span>
        <span className="shell-footer__note">No AI model is called on this page.</span>
      </p>
    </footer>
  )
}
