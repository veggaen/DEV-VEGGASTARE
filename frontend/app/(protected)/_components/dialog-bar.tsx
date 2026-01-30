"use client";

import { TbHexagons } from "react-icons/tb";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { AiOutlineSetting } from "react-icons/ai";
import { MdAddCircleOutline, MdBusiness } from "react-icons/md";
import { CiCircleCheck, CiInboxIn } from "react-icons/ci";
import { TiMessages } from "react-icons/ti";
import { FaStore } from "react-icons/fa";
import { FiRss, FiSend, FiUser } from "react-icons/fi";

type MyDialogbarNavigatorProps = {
  /** Optional hook for parents (e.g. user dropdown) to close themselves before opening the dialog */
  onOpen?: () => void;
	/**
	 * Visual style for the trigger.
	 * - default: sidebar/mobile usage (full-width row)
	 * - topbar: minimal, no boxed background
	 */
	variant?: "default" | "topbar";
  /**
   * Controlled open state (optional).
   * If provided, the dialog open/close is controlled by the parent.
   */
  open?: boolean;
  /**
   * Controlled open state change handler.
   */
  onOpenChange?: (open: boolean) => void;
  /**
   * Render only the dialog (no trigger button). Useful when the trigger lives elsewhere.
   */
  hideTrigger?: boolean;
};

export const MyDialogbarNavigator = ({ onOpen, variant = "default", open, onOpenChange, hideTrigger }: MyDialogbarNavigatorProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const setOpen = onOpenChange ?? setIsDialogOpen;
  const actualOpen = open ?? isDialogOpen;

  const openDialog = useCallback(() => {
    onOpen?.();
    setOpen(true);
  }, [onOpen, setOpen]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Guard against undefined key (can happen with some input methods)
      if (!e.key) return;
      const isK = e.key.toLowerCase() === "k";
      const hasCmd = e.metaKey;
      const hasCtrl = e.ctrlKey;
      if (!isK || (!hasCmd && !hasCtrl)) return;
      e.preventDefault();
      openDialog();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openDialog]);

  const actions = useMemo(
    () => [
      {
        group: "Marketplace",
        items: [
          { href: "/products", label: "Marketplace", icon: <FaStore className="h-4 w-4" /> },
          { href: "/products/create", label: "Create listing", icon: <MdAddCircleOutline className="h-4 w-4" /> },
        ],
      },
      {
        group: "Job Board",
        items: [
          { href: "/jobs", label: "Browse Requests", icon: <CiInboxIn className="h-4 w-4" /> },
          { href: "/jobs/post", label: "Post a Request", icon: <FiSend className="h-4 w-4" /> },
        ],
      },
      {
        group: "Community",
        items: [
          { href: "/pulse", label: "Pulse", icon: <FiRss className="h-4 w-4" /> },
          { href: "/conversations", label: "Messages", icon: <TiMessages className="h-4 w-4" /> },
        ],
      },
      {
        group: "Company",
        items: [{ href: "/companies", label: "Company", icon: <MdBusiness className="h-4 w-4" /> }],
      },
      {
        group: "Account",
        items: [
          { href: "/profile", label: "My Profile", icon: <FiUser className="h-4 w-4" /> },
          { href: "/settings", label: "Settings", icon: <AiOutlineSetting className="h-4 w-4" /> },
        ],
      },
    ],
    []
  );

  const handleNavigate = (href: string) => {
		setOpen(false);
    router.push(href);
  };

  return (
		<div className={variant === "topbar" ? "shrink-0" : "w-full"}>
      {hideTrigger ? null : (
        <button
          type="button"
          onClick={openDialog}
          className={
            variant === "topbar"
              ? "group inline-flex h-10 w-10 items-center justify-center bg-transparent text-slate-700 hover:bg-transparent hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 dark:text-slate-200 dark:hover:text-slate-50"
              : "flex w-full items-center gap-2 rounded-md px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          }
          aria-label="Open Nexus command palette"
          title="Open Nexus (Ctrl/Cmd + K)"
        >
          <TbHexagons className="h-5 w-5" />
          {variant === "topbar" ? null : (
            <>
              <span>Nexus</span>
              <span className="ml-auto hidden text-xs opacity-60 md:inline">Ctrl K</span>
            </>
          )}
        </button>
      )}

      <CommandDialog open={actualOpen} onOpenChange={setOpen}>
        <CommandInput placeholder="Search actions…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          {actions.map((group, idx) => (
            <div key={group.group}>
              {idx > 0 ? <CommandSeparator /> : null}
              <CommandGroup heading={group.group}>
                {group.items.map((item) => (
                  <CommandItem
                    key={item.href}
                    value={item.label}
                    onSelect={() => handleNavigate(item.href)}
                    className={
                      pathname === item.href || pathname.startsWith(`${item.href}/`)
                        ? "bg-accent"
                        : undefined
                    }
                  >
                    {item.icon}
                    <span className="flex-1">{item.label}</span>
                    {pathname === item.href || pathname.startsWith(`${item.href}/`) ? (
                      <CiCircleCheck className="h-4 w-4 opacity-70" />
                    ) : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            </div>
          ))}
        </CommandList>
      </CommandDialog>
    </div>
  );
};