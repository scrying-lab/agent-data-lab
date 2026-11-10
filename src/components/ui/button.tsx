import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

/*
  The button ladder. The look lives in src/style.css (.lab-btn, components layer) and every colour
  in src/tokens.css.
  - primary: Run, Next, Copy. Yellow with black text, a black edge and a 4px offset shadow.
    The only yellow in its row.
  - cancel (alias secondary, destructive): the red wash, no shadow. aria-disabled makes it dashed and
    muted; data-action="retry" turns it into a neutral outline.
  - tertiary (alias outline): Reset and quiet actions. Paper, a 2px rule, the blue wash on hover.
  - toggle: borderless and underlined; pass aria-pressed. Pressed adds the blue wash.
  The v1.0 names keep working: default is primary, outline is tertiary.
*/
const buttonVariants = cva("lab-btn", {
  variants: {
    variant: {
      primary: "lab-btn--primary",
      cancel: "lab-btn--cancel",
      tertiary: "lab-btn--tertiary",
      toggle: "lab-btn--toggle",
      default: "lab-btn--primary",
      secondary: "lab-btn--cancel",
      destructive: "lab-btn--cancel",
      outline: "lab-btn--tertiary",
      ghost: "lab-btn--ghost",
      link: "lab-btn--link",
    },
    size: {
      default: "",
      xs: "lab-btn--xs",
      sm: "lab-btn--sm",
      lg: "lab-btn--lg",
      icon: "lab-btn--icon",
      "icon-xs": "lab-btn--icon-xs",
      "icon-sm": "lab-btn--icon-sm",
      "icon-lg": "lab-btn--icon-lg",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
})

type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants, type ButtonVariant }
