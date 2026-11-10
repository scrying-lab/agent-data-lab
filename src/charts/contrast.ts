// Colour arithmetic for chart marks that must stay visible on the page in both themes.
// Colours arrive as computed token values or Plot's interpolated "rgb(r, g, b)" strings;
// nothing here holds a colour of its own.

type RGB = readonly [number, number, number]

/** Parses a 3- or 6-digit hex value or an rgb()/rgba() string. Anything else (e.g. "none") is null. */
export function parseColor(value: string): RGB | null {
  const v = value.trim()
  const long = /^#([0-9a-f]{6})$/i.exec(v)
  if (long) {
    const n = parseInt(long[1], 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(v)
  if (short) return [parseInt(short[1] + short[1], 16), parseInt(short[2] + short[2], 16), parseInt(short[3] + short[3], 16)]
  const fn = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(v)
  if (fn) return [Number(fn[1]), Number(fn[2]), Number(fn[3])]
  return null
}

/** WCAG relative luminance of an sRGB colour. */
export function luminance([r, g, b]: RGB): number {
  const lin = (c: number) => {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

/** WCAG contrast ratio between two colours (1 to 21). */
export function contrast(a: RGB, b: RGB): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** Graphical objects that carry meaning need 3:1 against what is next to them (WCAG 1.4.11). */
export const MARK_CONTRAST = 3

/**
 * Where a sequential scheme should start so that its lowest colour still reaches `min` contrast
 * against the page. Cividis grows lighter from 0 to 1, so on a light page this is 0 (the scheme
 * is unchanged); on a dark page it moves the low end up until the quietest cells stay visible.
 * Returns 0 when the background cannot be read (for example in a test document without tokens).
 */
export function schemeStart(interpolate: (t: number) => string, background: string, min = MARK_CONTRAST): number {
  const page = parseColor(background)
  if (!page) return 0
  const clears = (t: number) => {
    const mark = parseColor(interpolate(t))
    return !mark || contrast(mark, page) >= min
  }
  if (clears(0)) return 0
  if (!clears(1)) return 0 // the scheme never clears it here; leave it whole rather than collapse it
  let lo = 0
  let hi = 1
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2
    if (clears(mid)) hi = mid
    else lo = mid
  }
  return Math.ceil(hi * 100) / 100
}
