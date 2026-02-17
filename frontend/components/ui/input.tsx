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
          "flex h-10 w-full rounded-md border border-input bg-zinc-50 dark:bg-zinc-900 px-3 py-2 text-sm transition-[border-color,box-shadow] duration-200 placeholder:text-muted-foreground file:border-0 file:bg-transparent file:text-sm file:font-medium focus:outline-none focus:border-emerald-500/50 dark:focus:border-emerald-500/30 focus:shadow-[0_0_0_3px_rgba(16,185,129,0.1)] dark:focus:shadow-[inset_0_1px_4px_rgba(0,0,0,0.3),0_0_0_3px_rgba(16,185,129,0.08)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
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
