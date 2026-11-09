// Stands in for Node built-ins that the Strands SDK's browser entry references but the lab
// never calls in the browser (session file storage). Any use throws a clear error.
const unavailable = (): never => { throw new Error('Node built-ins are not available in the browser build of this lab.') }
const stub: Record<string, unknown> = new Proxy({}, { get: (_t, key) => (key === 'then' ? undefined : unavailable) })
export default stub
export const join = unavailable
export const dirname = unavailable
export const resolve = unavailable
export const promises = stub
export const readFile = unavailable
export const writeFile = unavailable
export const mkdir = unavailable
export const readdir = unavailable
export const rm = unavailable
export const stat = unavailable
export const unlink = unavailable
export const existsSync = unavailable
export const homedir = unavailable
export const tmpdir = unavailable
export const randomUUID = (): string => globalThis.crypto.randomUUID()
