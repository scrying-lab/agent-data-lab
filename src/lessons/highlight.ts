// A tiny, dependency-free tokenizer for the short listings on the page: it only marks comments,
// strings and keywords so CodeBlock can colour them from tokens. Every character of the input ends
// up in exactly one token, in order, so the joined text is always the original source.

export type CodeLanguage = 'python' | 'typescript'
export type TokenKind = 'comment' | 'string' | 'keyword'
export type Token = { text: string; kind?: TokenKind }

const keywords: Record<CodeLanguage, ReadonlySet<string>> = {
  python: new Set(['and', 'as', 'async', 'await', 'class', 'def', 'elif', 'else', 'except', 'False', 'finally', 'for', 'from', 'if', 'import', 'in', 'is', 'lambda', 'None', 'not', 'or', 'pass', 'raise', 'return', 'self', 'True', 'try', 'while', 'with', 'yield']),
  typescript: new Set(['as', 'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'default', 'else', 'export', 'extends', 'false', 'finally', 'for', 'from', 'function', 'if', 'import', 'in', 'interface', 'let', 'new', 'null', 'of', 'return', 'switch', 'this', 'throw', 'true', 'try', 'type', 'typeof', 'undefined', 'var', 'while', 'yield']),
}

// One alternation per language: (comment) | (string) | (word). Strings never span a line except
// Python triple quotes and TypeScript template literals.
const patterns: Record<CodeLanguage, RegExp> = {
  python: /(#[^\n]*)|("""[\s\S]*?"""|'''[\s\S]*?'''|\b[rRbBfFuU]{1,2}"(?:\\.|[^"\\\n])*"|\b[rRbBfFuU]{1,2}'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|([A-Za-z_]\w*)/g,
  typescript: /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|([A-Za-z_$][\w$]*)/g,
}

/** Splits source into plain and marked tokens; adjacent plain text is merged. */
export function tokenize(code: string, language: CodeLanguage): Token[] {
  const tokens: Token[] = []
  const plain = (text: string) => {
    if (!text) return
    const last = tokens.at(-1)
    if (last && !last.kind) last.text += text
    else tokens.push({ text })
  }
  let at = 0
  for (const match of code.matchAll(patterns[language])) {
    const start = match.index
    plain(code.slice(at, start))
    const [text, comment, string, word] = match
    if (comment) tokens.push({ text, kind: 'comment' })
    else if (string) tokens.push({ text, kind: 'string' })
    else if (word && keywords[language].has(word)) tokens.push({ text, kind: 'keyword' })
    else plain(text)
    at = start + text.length
  }
  plain(code.slice(at))
  return tokens
}
