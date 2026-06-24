import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        spellCheck="false"
        className={cn(
          // Base: 44px tall (h-11) meets the WCAG 2.2 touch-target floor on mobile.
          "flex h-11 w-full rounded-md border border-input bg-zinc-50 px-3 py-2 text-sm transition-[border-color,box-shadow] duration-200 dark:bg-zinc-900",
          // Placeholder + native file-input styling preserved.
          "placeholder:text-muted-foreground file:border-0 file:bg-transparent file:text-sm file:font-medium",
          // Focus: semantic brand-accent ring (auto sky in light / emerald in dark)
          // via the --ring/--brand-accent tokens — no hardcoded hex, theme-correct.
          // focus-visible so the ring is keyboard/intentional, not on every click.
          "outline-none focus-visible:border-brand-accent/60 focus-visible:shadow-[0_0_0_3px_hsl(var(--brand-accent)/0.14)]",
          // Invalid state (when the field sets aria-invalid) reads as destructive.
          "aria-[invalid=true]:border-destructive/60 aria-[invalid=true]:focus-visible:shadow-[0_0_0_3px_hsl(var(--destructive)/0.16)]",
          "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
