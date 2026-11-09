// Shared wording and number formats for the three charts. The caption, the hidden description,
// the "Show the numbers" table and the summary sentence all format through these helpers,
// so a number never reads differently in two places.
import type { Period } from '../../analytics/contracts'

export const SOURCE = 'UCI Bike Sharing, Capital Bikeshare'
export const MEAN_UNIT = 'mean rentals per observed hour'
export const TOTAL_UNIT = 'total rentals'

/** Below this many observed hours a group is flagged as a small sample. */
export const SMALL_SAMPLE = 30
export const SMALL_SAMPLE_TEXT = 'Too few hours to compare reliably.'

export const MEAN_VS_TOTAL =
  'A mean per observed hour lets days with fewer recorded hours compare fairly; a total would favour working days simply because there are more of them.'

export function periodLabel(period: Period): string {
  return period === 'both' ? '2011–2012' : period
}

/** The visible source / period / aggregation line under every chart title. */
export function sourceLabel(period: Period, unit: string = MEAN_UNIT): string {
  return `${SOURCE}, ${periodLabel(period)} · ${unit}`
}

const oneDecimal = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const whole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

/** A measured mean, always to one decimal place (e.g. 525.3). */
export const one = (value: number): string => oneDecimal.format(value)
/** A whole count, such as observed hours or total rentals (e.g. 499, 2,338,173). */
export const count = (value: number): string => whole.format(value)
/** An hour of the day as a clock time (e.g. 17:00). */
export const clock = (hour: number): string => String(hour).padStart(2, '0') + ':00'

/** Day names in full for sentences; the short forms (Sun, Mon …) stay on axes and table headers. */
const DAY_NAMES: Record<string, string> = {
  Sun: 'Sunday', Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday',
}
export const dayName = (day: string): string => DAY_NAMES[day] ?? day
