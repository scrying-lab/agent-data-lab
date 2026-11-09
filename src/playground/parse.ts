// Turns a playground block's text into plain data. Nothing here runs the visitor's text as code.
//
// Plain version: comments are ignored, the rest must be plain data (text in quotes, numbers,
// true/false, { } and [ ]). Mistakes come back as one friendly sentence with a line number.
//
// Developer notes:
// - Comments are blanked (not removed) so line and column numbers stay true to what the visitor sees.
// - JSON5 parses data only; it has no way to call a function or read a variable.
// - Zod checks only the SHAPE of each block. The role value and the tool input are deliberately
//   not checked here: the gate must be the thing that refuses them, because that is the lesson.
import JSON5 from 'json5'
import { z } from 'zod'
import { blockIds, type BlockId } from '../../content/block-hints'

export type ParseError = Readonly<{ line?: number; message: string }>
export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: ParseError }

export const callerBlockSchema = z.strictObject({ role: z.string(), readsLeft: z.number().int().min(0).max(3) })
const requestSchema = z.strictObject({ tool: z.string().min(1), input: z.unknown() })
export const requestsBlockSchema = z.array(requestSchema).min(1).max(3)

export type CallerBlock = z.infer<typeof callerBlockSchema>
export type RequestsBlock = { tool: string; input: unknown }[]
export type BlockValues = { caller: CallerBlock; requests: RequestsBlock }

const MAX_LENGTH = 4000
const MAX_DEPTH = 8
const forbiddenKeys = new Set(['__proto__', 'constructor', 'prototype'])

const fail = (message: string, line?: number): { ok: false; error: ParseError } =>
  ({ ok: false, error: line ? { line, message: `Line ${line}: ${message}` } : { message: message[0].toUpperCase() + message.slice(1) } })

/** Replace `//` and `/* *\/` comments outside strings with spaces, keeping every newline. */
export function stripComments(text: string): string {
  let out = ''
  let quote: string | null = null
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quote) {
      out += ch
      if (ch === '\\' && i + 1 < text.length) { out += text[++i]; continue }
      if (ch === quote || ch === '\n') quote = null
      continue
    }
    if (ch === '"' || ch === "'") { quote = ch; out += ch; continue }
    if (ch === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') { out += ' '; i++ }
      if (i < text.length) out += '\n'
      continue
    }
    if (ch === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2)
      const stop = end === -1 ? text.length : end + 2
      for (; i < stop; i++) out += text[i] === '\n' ? '\n' : ' '
      i--
      continue
    }
    out += ch
  }
  return out
}

const closer: Record<string, string> = { '{': '}', '[': ']' }
const bracketName: Record<string, string> = { '{': 'brace “}”', '[': 'bracket “]”' }

/** Find unclosed quotes and unbalanced brackets first: they produce the clearest messages. */
function checkStructure(text: string): ParseError | null {
  const stack: { ch: string; line: number }[] = []
  let line = 1
  let quote: string | null = null
  let quoteLine = 0
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quote) {
      if (ch === '\\') { i++; continue }
      if (ch === quote) quote = null
      else if (ch === '\n') return fail('a text value is missing its closing quote.', quoteLine).error
      continue
    }
    if (ch === '\n') { line++; continue }
    if (ch === '"' || ch === "'") { quote = ch; quoteLine = line; continue }
    if (ch === '{' || ch === '[') { stack.push({ ch, line }); continue }
    if (ch === '}' || ch === ']') {
      const open = stack.pop()
      if (!open) return fail(`there is an extra “${ch}” with nothing to close.`, line).error
      if (closer[open.ch] !== ch) return fail(`expected a closing ${bracketName[open.ch]} before “${ch}”.`, line).error
    }
  }
  if (quote) return fail('a text value is missing its closing quote.', quoteLine).error
  const open = stack.at(-1)
  if (open) return fail(`expected a closing ${bracketName[open.ch]}.`, lastDataLine(text)).error
  return null
}

function lastDataLine(text: string): number {
  const lines = text.split('\n')
  for (let i = lines.length - 1; i >= 0; i--) if (lines[i].trim()) return i + 1
  return 1
}
function firstDataLine(text: string): number {
  const index = text.split('\n').findIndex(line => line.trim())
  return index === -1 ? 1 : index + 1
}
/** The line where `word` first appears as a whole word, if it does. */
function lineOf(text: string, word: string, occurrence = 0): number | undefined {
  const re = new RegExp(`(^|[^\\w-])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`, 'g')
  let match: RegExpExecArray | null
  let seen = 0
  while ((match = re.exec(text))) {
    if (seen++ === occurrence) return text.slice(0, match.index).split('\n').length
  }
  return undefined
}

/** Explain a JSON5 syntax error in plain words. Never passes the library's own message through. */
function explainSyntax(error: unknown, text: string): ParseError {
  const e = error as { lineNumber?: unknown; columnNumber?: unknown; message?: unknown }
  const line = typeof e.lineNumber === 'number' ? e.lineNumber : undefined
  const column = typeof e.columnNumber === 'number' ? e.columnNumber : undefined
  const message = typeof e.message === 'string' ? e.message : ''
  if (/invalid end of input/.test(message)) return fail('the block ends too soon. Check for a missing value or bracket.', line).error
  if (line && column) {
    const rest = (text.split('\n')[line - 1] ?? '').slice(column - 1)
    const word = /^[A-Za-z_$][\w$-]*/.exec(rest)?.[0]
    if (word && /^\s*\(/.test(rest.slice(word.length))) {
      return fail(`“${word}(…)” looks like code. Only plain data runs here: text in quotes, numbers, true or false.`, line).error
    }
    if (word) return fail(`“${word}” needs quotes. Write text values in quotes, like 'guest'.`, line).error
    const ch = rest[0]
    if (ch === '(' || ch === '`' || ch === '=') return fail(`“${ch}” looks like code. Only plain data runs here: text in quotes, numbers, true or false.`, line).error
    if (ch) return fail(`unexpected “${ch}”. Check for a missing comma, colon or quote.`, line).error
  }
  return fail('this is not plain data. Use text in quotes, numbers, true or false, { } and [ ].', line).error
}

/** Plain data only: finite numbers, no special property names, not nested too deeply. */
function checkPlain(value: unknown, text: string, depth = 0): ParseError | null {
  if (depth > MAX_DEPTH) return fail('this block is nested too deeply.').error
  if (typeof value === 'number' && !Number.isFinite(value)) {
    return fail('numbers must be ordinary numbers, like 1. NaN and Infinity are not allowed.', lineOf(text, Number.isNaN(value) ? 'NaN' : 'Infinity')).error
  }
  if (Array.isArray(value)) {
    for (const item of value) { const problem = checkPlain(item, text, depth + 1); if (problem) return problem }
    return null
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (forbiddenKeys.has(key)) return fail(`“${key}” cannot be used as a name here.`, lineOf(text, key)).error
      const problem = checkPlain(item, text, depth + 1)
      if (problem) return problem
    }
  }
  return null
}

/** Parse a block's text into plain data, without checking its shape. */
export function parseData(text: string): ParseResult<unknown> {
  if (text.length > MAX_LENGTH) return fail(`this block is too long. Keep it under ${MAX_LENGTH} characters.`)
  const data = stripComments(text)
  if (!data.trim()) return fail('This block is empty. Press Reset to bring back the example.')
  const structural = checkStructure(data)
  if (structural) return { ok: false, error: structural }
  let value: unknown
  try {
    value = JSON5.parse(data)
  } catch (error) {
    return { ok: false, error: explainSyntax(error, data) }
  }
  const problem = checkPlain(value, data)
  if (problem) return { ok: false, error: problem }
  return { ok: true, value }
}

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)

function shapeOfCaller(value: unknown, text: string): ParseResult<CallerBlock> {
  const parsed = callerBlockSchema.safeParse(value)
  if (parsed.success) return { ok: true, value: parsed.data }
  const at = (key: string) => lineOf(text, key) ?? firstDataLine(text)
  if (!isRecord(value)) return fail('this block must be one { … } with a role and readsLeft.', firstDataLine(text))
  const extra = Object.keys(value).filter(key => key !== 'role' && key !== 'readsLeft')
  if (extra.length) return fail(`only role and readsLeft belong here. Remove “${extra[0]}”.`, at(extra[0]))
  if (!('role' in value)) return fail('role is missing. Add one, like role: \'guest\'.', firstDataLine(text))
  if (typeof value.role !== 'string') return fail('role must be text in quotes, like \'guest\'.', at('role'))
  if (!('readsLeft' in value)) return fail('readsLeft is missing. Add one, like readsLeft: 1.', firstDataLine(text))
  return fail('readsLeft must be a whole number from 0 to 3.', at('readsLeft'))
}

function shapeOfRequests(value: unknown, text: string): ParseResult<RequestsBlock> {
  const parsed = requestsBlockSchema.safeParse(value)
  if (parsed.success && parsed.data.every((_, i) => Object.hasOwn((value as unknown[])[i] as object, 'input'))) {
    return { ok: true, value: parsed.data.map(request => ({ tool: request.tool, input: request.input })) }
  }
  if (!Array.isArray(value)) return fail('this block must be a list in [ … ] of one to three requests.', firstDataLine(text))
  if (value.length === 0) return fail('add at least one request, like { tool: \'getSyntheticMetric\', input: { … } }.', firstDataLine(text))
  if (value.length > 3) return fail('one run takes at most three requests.', lineOf(text, 'tool', 3) ?? firstDataLine(text))
  for (const [i, item] of value.entries()) {
    const line = lineOf(text, 'tool', i) ?? firstDataLine(text)
    const name = `request ${i + 1}`
    if (!isRecord(item)) return fail(`${name} must be a { … } with a tool and an input.`, line)
    const extra = Object.keys(item).filter(key => key !== 'tool' && key !== 'input')
    if (extra.length) return fail(`${name} may only have a tool and an input. Remove “${extra[0]}”.`, lineOf(text, extra[0]) ?? line)
    if (typeof item.tool !== 'string' || !item.tool) return fail(`${name} needs a tool name in quotes, like 'getSyntheticMetric'.`, line)
    if (!Object.hasOwn(item, 'input')) return fail(`${name} needs an input, like input: { … }.`, line)
  }
  return fail('this block must be a list of requests, each with a tool and an input.', firstDataLine(text))
}

/** One shape check per block. A new block adds its entry here and its data in content/block-hints.ts. */
const shapes: { [K in BlockId]: (value: unknown, text: string) => ParseResult<BlockValues[K]> } = {
  caller: shapeOfCaller,
  requests: shapeOfRequests,
}

/** Parse one block and check only its shape. Returns a friendly, line-numbered error on failure. */
export function parseBlock<K extends BlockId>(id: K, text: string): ParseResult<BlockValues[K]> {
  const data = parseData(text)
  if (!data.ok) return data
  return shapes[id](data.value, stripComments(text))
}

export type ParseAllResult =
  | { ok: true; values: BlockValues }
  | { ok: false; errors: Partial<Record<BlockId, ParseError>> }

/** Parse every block. Fails if any block fails, reporting each block's first problem. */
export function parseAll(texts: Record<BlockId, string>): ParseAllResult {
  const values: Partial<Record<BlockId, unknown>> = {}
  const errors: Partial<Record<BlockId, ParseError>> = {}
  for (const id of blockIds) {
    const result = parseBlock(id, texts[id])
    if (result.ok) values[id] = result.value
    else errors[id] = result.error
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, values: values as BlockValues }
}
