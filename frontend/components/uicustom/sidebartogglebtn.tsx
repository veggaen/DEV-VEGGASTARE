'use client'
import { TbLayoutSidebarLeftExpand } from "react-icons/tb";
import { TbLayoutSidebarInactive } from "react-icons/tb";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button"

type Props = Omit<ComponentProps<typeof Button>, "variant" | "size"> & {
  /** Accessible label for screen readers */
  label?: string;
};

export function MySidebarToggleBtn({ label = "Toggle sidebar", ...props }: Props) {

  return (
    <Button variant="outline" size="icon" {...props}>
      <TbLayoutSidebarLeftExpand className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <TbLayoutSidebarInactive className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">{label}</span>
    </Button>
  )
}