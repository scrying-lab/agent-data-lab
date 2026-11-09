// The source text of every example, for display. Vite inlines each file as a string (?raw),
// so the page shows exactly the code the tests run. Keys are repository-relative paths,
// matching Pair.tsFile and Pair.pyFile in ./pairs.
const modules = import.meta.glob<string>(['./ts/*.ts', './py/*.py'], { query: '?raw', import: 'default', eager: true })

export const sources: Record<string, string> = Object.fromEntries(
  Object.entries(modules).map(([path, text]) => ['examples/' + path.slice(2), text]),
)

export function sourceOf(path: string): string {
  const text = sources[path]
  if (text === undefined) throw Error('No example source at ' + path)
  return text
}
