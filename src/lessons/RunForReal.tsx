import { useId } from 'react'
import { ChevronRight, Copy } from 'lucide-react'
import { links } from '../../content/links'
import { announce } from '../announce'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Callout, SectionOpener } from '../shell/primitives'
import { CodeBlock } from './CodeBlock'
import '../tokens.css'
import './lessons.css'

/** Used only while content/links.ts has no `project.repositoryClone`; it must equal that value once set. */
export const fallbackCloneUrl = 'https://github.com/scrying-lab/agent-data-lab.git'

/** The clone address from content/links.ts, the single source of truth for public links. */
export function cloneUrl(): string {
  const project: Record<string, unknown> = links.project
  const clone = project.repositoryClone
  return typeof clone === 'string' && clone.length > 0 ? clone : fallbackCloneUrl
}

/** Run the lab on your own computer. No cloud account needed. In this order. */
export const runCommands: readonly string[] = [
  'git clone ' + cloneUrl(),
  'cd agent-data-lab',
  'npm ci',
  'npm test',
  'npm run dev',
]

/** Optional: record a run with a real model in your own AWS account. Costs money. */
export const liveCommands = [
  'aws sso login --profile your-profile',
  'AWS_PROFILE=your-profile npm run record:bedrock -- hourly --model novaMicro',
] as const

export const noKeysSentence = 'No keys go in the browser or the repository. The page you are on never calls a model.'

async function copy(lines: readonly string[]) {
  try {
    await navigator.clipboard.writeText(lines.join('\n'))
    announce('Commands copied')
  } catch {
    announce('Copying failed. Select the commands and copy them by hand.')
  }
}

function Commands({ lines, label }: { lines: readonly string[]; label: string }) {
  return (
    <div className="lsn-commands">
      <CodeBlock label={label} code={lines.join('\n')} />
      <div>
        <Button type="button" variant="primary" onClick={() => void copy(lines)}>
          <Copy aria-hidden="true" />
          {'Copy '}
          <span className="sr-only">{label.toLowerCase()}</span>
        </Button>
      </div>
    </div>
  )
}

/**
 * How to run the lab yourself: the commands to clone and start it, then (behind a disclosure) the
 * commands to record a run with a real model in your own AWS account, then why no keys are needed here.
 */
export function RunForReal({ numeral = '06' }: { numeral?: string }) {
  const titleId = useId()
  return (
    <aside className="lsn-panel lsn-run" aria-labelledby={titleId}>
      <SectionOpener numeral={numeral} kicker="For developers" title={<h2 id={titleId}>Run it for real</h2>} />
      <p>
        This page plays recordings and runs the agent with a simulated model; it never calls a real one. To run the agent yourself, you need git and Node.js 24. These commands download
        the lab, run its tests and start it on your computer.
      </p>
      <div className="lsn-run-step">
        <div className="lsn-label">On your computer</div>
        <Commands lines={runCommands} label="Commands to run the lab" />
      </div>
      <Collapsible className="lsn-disclosure">
        <CollapsibleTrigger asChild>
          <Button variant="tertiary" className="lsn-trigger">
            <ChevronRight className="lsn-chevron" aria-hidden="true" />
            With a real model (your own AWS account)
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="lsn-run-live">
          <p>
            This calls Amazon Bedrock in your own AWS account and may cost money. Sign in with a short-lived session
            first; the recorder refuses long-lived access keys and Bedrock API keys. It saves the run to a git-ignored
            folder so you can review it before sharing anything.
          </p>
          <Commands lines={liveCommands} label="Commands for a real model" />
        </CollapsibleContent>
      </Collapsible>
      <Callout kind="why" kicker="Why it matters">
        <p>{noKeysSentence}</p>
      </Callout>
    </aside>
  )
}
