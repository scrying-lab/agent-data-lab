import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Check, ChevronDown, ChevronRight } from 'lucide-react'
import { pairs, sdk, workshop, type Pair, type Verified } from '../../examples/pairs'
import { gotchas } from '../../examples/gotchas'
import { sources } from '../../examples/sources'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { SectionOpener } from '../shell/primitives'
import { CodeBlock } from './CodeBlock'
import { EvidenceChip, type EvidenceLevel } from './EvidenceChip'
import { useMediaQuery } from './useMediaQuery'
import '../tokens.css'
import './lessons.css'

/** How far each TypeScript example is checked, in words a visitor can trust. */
export const verifiedBadge: Record<Verified, string> = {
  executed: 'Runs in tests',
  compiled: 'Type-checked',
  'names-only': 'Names checked only',
}

/** What each badge means, stated once above the pairs. */
export const verifiedDetail: Record<Verified, string> = {
  executed: 'A test runs this TypeScript with a scripted model and checks the outcome.',
  compiled: 'This TypeScript type-checks, but nothing runs it.',
  'names-only': 'Only the imported names were checked against the installed SDK.',
}

/** Full square for the strongest evidence, half for type-checked, empty for names only. */
export const verifiedLevel: Record<Verified, EvidenceLevel> = { executed: 'full', compiled: 'half', 'names-only': 'none' }

/** From this width the pair shows Python and TypeScript side by side; below it, as two tabs. */
export const sideBySideQuery = '(min-width: 768px)'

function Chip({ verified }: { verified: Verified }) {
  return <EvidenceChip level={verifiedLevel[verified]}>{verifiedBadge[verified]}</EvidenceChip>
}

const languages = [
  { key: 'python', label: 'Python' },
  { key: 'typescript', label: 'TypeScript' },
] as const

/**
 * Narrow screens: Python and TypeScript as two tabs (the APG tabs pattern with automatic
 * activation). Only the selected tab is a Tab stop; Left, Right, Home and End move between them.
 * Both panels stay in the page, the inactive one hidden, so the h4 outline never changes. The code
 * region inside each panel is focusable, so the panel itself is not a Tab stop.
 */
function LanguageTabs({ pair, panels }: { pair: Pair; panels: Record<'python' | 'typescript', ReactNode> }) {
  const baseId = useId()
  const [selected, setSelected] = useState(0)
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const select = (index: number) => {
    const next = (index + languages.length) % languages.length
    setSelected(next)
    tabs.current[next]?.focus()
  }
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const moves: Record<string, number> = { ArrowRight: selected + 1, ArrowLeft: selected - 1, Home: 0, End: languages.length - 1 }
    if (!(event.key in moves)) return
    event.preventDefault()
    select(moves[event.key])
  }
  return (
    <div className="lsn-tabs">
      <div className="lsn-tablist" role="tablist" aria-label={'Language for ' + pair.title}>
        {languages.map((lang, i) => (
          <button
            key={lang.key}
            ref={el => { tabs.current[i] = el }}
            type="button"
            role="tab"
            id={baseId + '-tab-' + lang.key}
            className="lsn-tab"
            aria-selected={i === selected}
            aria-controls={baseId + '-panel-' + lang.key}
            tabIndex={i === selected ? 0 : -1}
            data-state={i === selected ? 'active' : 'inactive'}
            onClick={() => select(i)}
            onKeyDown={onKeyDown}
          >
            <Check className="lsn-tab__mark" aria-hidden="true" />{lang.label}
          </button>
        ))}
      </div>
      {languages.map((lang, i) => (
        <div key={lang.key} role="tabpanel" id={baseId + '-panel-' + lang.key} aria-labelledby={baseId + '-tab-' + lang.key} className="lsn-tabpanel" hidden={i !== selected}>
          <h4 className="sr-only">{lang.label}</h4>
          {panels[lang.key]}
        </div>
      ))}
    </div>
  )
}

function PairCode({ pair, sideBySide }: { pair: Pair; sideBySide: boolean }) {
  const python = <CodeBlock label={'Python: ' + pair.pyFile} code={sources[pair.pyFile] ?? ''} language="python" />
  const typescript = <CodeBlock label={'TypeScript: ' + pair.tsFile} code={sources[pair.tsFile] ?? ''} language="typescript" />
  if (!sideBySide) return <LanguageTabs pair={pair} panels={{ python, typescript }} />
  return (
    <div className="lsn-columns">
      <div><h4>Python</h4>{python}</div>
      <div><h4>TypeScript</h4>{typescript}</div>
    </div>
  )
}

/**
 * One accordion item: the pair's h3 wraps a button that opens or closes its panel (the APG
 * accordion pattern). The panel stays in the page while closed, hidden, so the heading outline is
 * the same whichever pair is open.
 */
function PairItem({ pair, panelId, open, onToggle, sideBySide, triggerRef }: {
  pair: Pair
  /** Shared with the pair's index card, which controls the same panel. */
  panelId: string
  open: boolean
  onToggle: () => void
  sideBySide: boolean
  triggerRef: (el: HTMLButtonElement | null) => void
}) {
  const headingId = useId()
  const state = open ? 'open' : 'closed'
  return (
    <article className="lsn-acc-item" aria-labelledby={headingId} data-state={state}>
      <h3 id={headingId} className="lsn-acc-head">
        <button ref={triggerRef} type="button" className="lsn-acc-trigger" aria-expanded={open} aria-controls={panelId} data-state={state} onClick={onToggle}>
          <span>{pair.title}</span>
          <ChevronDown className="lsn-chevron" aria-hidden="true" />
        </button>
      </h3>
      <div id={panelId} className="lsn-acc-panel" hidden={!open}>
        <div className="lsn-acc-meta"><Chip verified={pair.verified} /></div>
        <PairCode pair={pair} sideBySide={sideBySide} />
      </div>
    </article>
  )
}

function Gotchas() {
  return (
    <Collapsible className="lsn-disclosure">
      <CollapsibleTrigger asChild>
        <Button variant="tertiary" className="lsn-trigger">
          <ChevronRight className="lsn-chevron" aria-hidden="true" />
          Things that trip up Python developers
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="lsn-gotchas">
          {gotchas.map(g => (
            <li key={g.id}>
              <strong className="lsn-gotcha-title">{g.title}</strong>
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

/**
 * Every Python example from the workshop beside its TypeScript translation: an index of cards
 * (title, evidence, what changes), then one pair open at a time. Choosing a card opens its pair
 * and moves focus to that pair's heading button.
 */
export function TranslationPanel({ numeral = '04' }: { numeral?: string }) {
  const titleId = useId()
  const legendId = useId()
  const sideBySide = useMediaQuery(sideBySideQuery)
  const [open, setOpen] = useState<string>(pairs[0]?.id ?? '')
  const pairsId = useId()
  const panelIdFor = (id: string) => `${pairsId}-pair-${id}`
  const triggers = useRef(new Map<string, HTMLButtonElement>())
  const pendingFocus = useRef<string | null>(null)

  useEffect(() => {
    if (pendingFocus.current === null) return
    triggers.current.get(pendingFocus.current)?.focus()
    pendingFocus.current = null
  }, [open])

  const show = (id: string) => {
    if (open === id) { triggers.current.get(id)?.focus(); return }
    pendingFocus.current = id
    setOpen(id)
  }
  const used = (Object.keys(verifiedBadge) as Verified[]).filter(v => pairs.some(p => p.verified === v))

  return (
    <section className="lsn-panel" aria-labelledby={titleId}>
      <SectionOpener numeral={numeral} kicker="For Python developers" title={<h2 id={titleId}>Python → TypeScript</h2>} />
      <p>
        If you learned Strands Agents in Python, here is the same code in the TypeScript SDK. Each pair says what
        changes and how far the TypeScript side is checked.
      </p>
      <p className="lsn-muted">
        Python examples adapted from the <a href={workshop.repo}>AWS sample Strands Agents workshop</a> ({workshop.license}),
        commit <code>{workshop.commit}</code>. TypeScript targets <code>{sdk.name}</code> {sdk.version}.
      </p>

      <div className="lsn-legend">
        <div className="lsn-label" id={legendId}>What the badges mean</div>
        <dl aria-labelledby={legendId}>
          {used.map(v => (
            <div key={v} className="lsn-legend-row">
              <dt><Chip verified={v} /></dt>
              <dd>{verifiedDetail[v]}</dd>
            </div>
          ))}
        </dl>
      </div>

      <ul className="lsn-index" aria-label="Python and TypeScript pairs">
        {pairs.map(pair => (
          <li key={pair.id} className="lsn-index-card" data-open={open === pair.id ? '' : undefined}>
            <div className="lsn-card-head">
              <button type="button" className="lsn-card-title" aria-current={open === pair.id ? 'true' : undefined} aria-controls={panelIdFor(pair.id)} onClick={() => show(pair.id)}>
                {open === pair.id && <Check className="lsn-card-mark" aria-hidden="true" />}
                {pair.title}
              </button>
              <Chip verified={pair.verified} />
            </div>
            <p className="lsn-card-body">{pair.whatChanges}</p>
          </li>
        ))}
      </ul>

      <Gotchas />

      <div className="lsn-accordion">
        {pairs.map(pair => (
          <PairItem
            key={pair.id}
            pair={pair}
            panelId={panelIdFor(pair.id)}
            open={open === pair.id}
            onToggle={() => setOpen(current => (current === pair.id ? '' : pair.id))}
            sideBySide={sideBySide}
            triggerRef={el => { if (el) triggers.current.set(pair.id, el); else triggers.current.delete(pair.id) }}
          />
        ))}
      </div>
    </section>
  )
}
