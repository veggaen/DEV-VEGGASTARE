'use client'
import { TbLayoutSidebarLeftExpand, TbLayoutSidebarLeftCollapse } from "react-icons/tb";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button"

type Props = Omit<ComponentProps<typeof Button>, "variant" | "size"> & {
  /** Accessible label for screen readers */
  label?: string;
  /** Whether the sidebar is currently collapsed — drives the icon direction */
  isCollapsed?: boolean;
};

export function MySidebarToggleBtn({ label = "Toggle sidebar", isCollapsed, ...props }: Props) {
  return (
    <Button variant="outline" size="icon" {...props}>
      {isCollapsed ? (
        <TbLayoutSidebarLeftExpand className="h-[1.2rem] w-[1.2rem]" />
      ) : (
        <TbLayoutSidebarLeftCollapse className="h-[1.2rem] w-[1.2rem]" />
      )}
      <span className="sr-only">{label}</span>
    </Button>
  )
}