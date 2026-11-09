import { useId } from 'react'
import { Check } from 'lucide-react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

type Props<T extends string> = {
  /** Visible label for the group; also its accessible name. */
  label: string
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  className?: string
}

/**
 * One choice from a few, as a shadcn ToggleGroup: arrow keys move between options, the chosen one
 * is marked with a check icon as well as a fill, so the state never depends on colour alone.
 */
export function ChoiceGroup<T extends string>({ label, options, value, onChange, className }: Props<T>) {
  const labelId = useId()
  return (
    <div className={'shell-choice-field ' + (className ?? '')}>
      <span id={labelId} className="shell-field-label">{label}</span>
      <ToggleGroup
        type="single"
        className="shell-choices"
        aria-labelledby={labelId}
        value={value}
        onValueChange={next => {
          // Pressing the chosen option again would clear a single ToggleGroup; keep the current choice.
          const option = options.find(o => o.value === next)
          if (option) onChange(option.value)
        }}
      >
        {options.map(o => (
          <ToggleGroupItem key={o.value} value={o.value} className="shell-choice">
            {o.value === value && <Check aria-hidden="true" className="shell-choice__mark" />}
            <span>{o.label}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}
