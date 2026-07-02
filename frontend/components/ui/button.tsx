import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"


const LOG_PREFIX = '[frontend/components/ui/button.tsx]'
const buttonVariants = cva(
  // Base: every variant inherits a subtle, consistent "alive" press feel —
  // a gentle scale-down on click (motion-safe so reduced-motion users opt out)
  // and a tuned transition. This gives all buttons tactile feedback app-wide
  // without editing each call site.
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-[color,background-color,border-color,box-shadow,transform] duration-200 ease-out motion-safe:active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        /* ─── Vega legacy variant names, reimplemented on semantic tokens ─────
         * Same names (call sites untouched), modern behaviour:
         *  • colors come from --brand-accent & friends → correct in BOTH themes
         *  • hover = lift (-translate-y) + shadow bloom, never a shrink
         *  • press = the base active:scale for tactile feedback
         * ──────────────────────────────────────────────────────────────────── */
        vegaThemeBtn:
          'flex items-center justify-center rounded-lg p-2 hover:bg-accent',
        vegaThemeBtnDefault:
          'flex items-center justify-center rounded-lg p-2',
        // Primary CTA — solid brand accent (sky in light / emerald in dark)
        vegaEmeraldBtn:
          'bg-brand-accent text-brand-accent-foreground border border-brand-accent/20 shadow-sm hover:bg-brand-accent-hover motion-safe:hover:-translate-y-px hover:shadow-[0_4px_14px_hsl(var(--brand-accent)/0.35)]',
        // Quiet text button
        vegaNormalBtnBlank:
          'text-foreground/75 hover:text-foreground',
        // Neutral secondary — stays neutral on hover, accent only on the border
        vegaNormalBtn:
          'border border-border bg-secondary text-secondary-foreground hover:border-brand-accent/50 hover:bg-accent motion-safe:hover:-translate-y-px hover:shadow-sm',
        // Neutral secondary that signals a destructive path
        vegaNormalBtnRed:
          'border border-border bg-secondary text-secondary-foreground hover:border-destructive/60 hover:bg-destructive/10 hover:text-destructive motion-safe:hover:-translate-y-px hover:shadow-sm',
        // Commerce: Buy = the loudest thing on the page
        vegaBuyBtn:
          'bg-brand-accent text-brand-accent-foreground font-semibold shadow-sm hover:bg-brand-accent-hover motion-safe:hover:-translate-y-px hover:shadow-[0_4px_16px_hsl(var(--brand-accent)/0.4)]',
        // Commerce: Add to basket = confident but one step quieter (accent outline)
        vegaAddBasketBtn:
          'border border-brand-accent/50 bg-brand-accent/10 text-brand-accent-hover dark:text-brand-accent-light hover:bg-brand-accent/15 hover:border-brand-accent motion-safe:hover:-translate-y-px hover:shadow-[0_2px_10px_hsl(var(--brand-accent)/0.25)]',
        // Commerce: Wishlist = quietest of the trio
        vegaAddWishlistBtn:
          'border border-border bg-transparent text-muted-foreground hover:text-brand-accent hover:border-brand-accent/40 hover:bg-brand-accent/5',
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        // `touch` — 48px, the comfortable thumb target for mobile-primary CTAs
        // (WCAG 2.2 §2.5.8 / Fitts' Law). Use for the main action on touch-first
        // surfaces; default/lg stay for dense desktop layouts.
        touch: "h-12 rounded-md px-6 text-[15px]",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
