import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"


const LOG_PREFIX = '[frontend/components/ui/button.tsx]'
const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
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
        vegaThemeBtn: 'flex items-center justify-center rounded-lg p-2 transition duration-300 ease-in-out transform hover:scale-125 hover:bg-black/20 dark:hover:bg-zinc-700',
        vegaThemeBtnDefault: 'flex items-center justify-center rounded-lg p-2 transition duration-300 ease-in-out transform hover:bg-black/20/0 dark:hover:bg-zinc-700/0',
        vegaEmeraldBtn: 'border bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-700 border-emerald-300 dark:border-emerald-900 text-white transition duration-300 ease-in-out hover:scale-95 hover:text-md active:border active:border-sky-500',
        vegaNormalBtnBlank: 'text-black/80 hover:text-black dark:text-white/80 hover:dark:text-white transition duration-300 ease-in-out',
        vegaNormalBtn: 'border bg-gray-300/50 border-gray-500/10 dark:bg-slate-600 dark:border-slate-700 text-black/80 hover:text-black dark:text-white/80 hover:dark:text-white transition duration-300 ease-in-out hover:shadow-lg hover:border-blue-500 dark:hover:border-blue-500 active:border active:border-sky-500 hover:bg-sky-400 dark:hover:bg-sky-700',
        vegaNormalBtnRed: 'border bg-gray-400 border-gray-500/10 dark:bg-slate-600 dark:border-slate-700 text-black/80 hover:text-black dark:text-white/80 hover:dark:text-white transition duration-300 ease-in-out hover:shadow-lg hover:border-red-500 dark:hover:border-red-500 active:border active:border-sky-500 hover:bg-red-400 dark:hover:bg-red-700',
        vegaBuyBtn: 'bg-emerald-400 dark:bg-emerald-600 text-white transition duration-300 ease-in-out hover:scale-95 hover:text-md active:border active:border-sky-500 hover:bg-emerald-400 dark:hover:bg-emerald-700',
        vegaAddBasketBtn: 'bg-sky-400 dark:bg-sky-600 text-white transition duration-300 ease-in-out hover:scale-95 hover:text-md active:border active:border-sky-500 hover:bg-orange-400 dark:hover:bg-orange-700',
        vegaAddWishlistBtn: 'bg-slate-400 dark:bg-slate-600 text-white transition duration-300 ease-in-out hover:scale-95 hover:text-md active:border active:border-sky-500 hover:bg-sky-400 dark:hover:bg-sky-700',
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
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
