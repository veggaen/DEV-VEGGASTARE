import * as React from "react"

import { cn } from "@/lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-border/70 bg-input px-3 py-2 text-sm text-foreground transition-[border-color,box-shadow] duration-200 placeholder:text-muted-foreground outline-none focus-visible:border-brand-accent/60 focus-visible:shadow-[0_0_0_3px_hsl(var(--brand-accent)/0.14)] aria-[invalid=true]:border-destructive/60 aria-[invalid=true]:focus-visible:shadow-[0_0_0_3px_hsl(var(--destructive)/0.16)] disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
