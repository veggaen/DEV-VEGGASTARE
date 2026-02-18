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
import { MdAddCircleOutline, MdBusiness, MdDashboard, MdNotifications } from "react-icons/md";
import { CiCircleCheck, CiInboxIn } from "react-icons/ci";
import { TiMessages } from "react-icons/ti";
import { FaStore, FaHome, FaInfoCircle, FaShieldAlt, FaPalette, FaWallet, FaDollarSign } from "react-icons/fa";
import { FiSend, FiUser, FiShoppingCart, FiCreditCard, FiSun, FiMoon, FiBell, FiLock, FiGlobe } from "react-icons/fi";
import { PulseHeart } from "@/components/uicustom/icons/PulseIcons";
import { useTheme } from "next-themes";

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
  const { resolvedTheme, setTheme } = useTheme();
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

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
    setOpen(false);
  }, [resolvedTheme, setTheme, setOpen]);

  const actions = useMemo(
    () => [
      {
        group: "Quick Navigation",
        items: [
          { href: "/", label: "Home", icon: <FaHome className="h-4 w-4" />, keywords: ["main", "start", "landing"] },
          { href: "/dashboard", label: "Dashboard", icon: <MdDashboard className="h-4 w-4" />, keywords: ["overview", "stats"] },
          { href: "/pulse", label: "Pulse", icon: <PulseHeart className="h-4 w-4" />, keywords: ["feed", "posts", "social", "vibe"] },
          { href: "/conversations", label: "Messages", icon: <TiMessages className="h-4 w-4" />, keywords: ["chat", "dm", "inbox"] },
        ],
      },
      {
        group: "Marketplace",
        items: [
          { href: "/products", label: "Browse Products", icon: <FaStore className="h-4 w-4" />, keywords: ["shop", "store", "buy", "browse"] },
          { href: "/products/create", label: "Create Product Listing", icon: <MdAddCircleOutline className="h-4 w-4" />, keywords: ["sell", "new", "add", "create"] },
          { href: "/cart", label: "Shopping Cart", icon: <FiShoppingCart className="h-4 w-4" />, keywords: ["basket", "items"] },
          { href: "/checkout", label: "Checkout", icon: <FiCreditCard className="h-4 w-4" />, keywords: ["pay", "order", "purchase"] },
        ],
      },
      {
        group: "Job Board",
        items: [
          { href: "/jobs", label: "Browse Requests", icon: <CiInboxIn className="h-4 w-4" />, keywords: ["jobs", "work", "gigs"] },
          { href: "/jobs/post", label: "Post a Request", icon: <FiSend className="h-4 w-4" />, keywords: ["create", "new", "hire"] },
        ],
      },
      {
        group: "Company & Teams",
        items: [
          { href: "/companies", label: "Browse Companies", icon: <MdBusiness className="h-4 w-4" />, keywords: ["business", "firms", "organizations"] },
          { href: "/companies/create", label: "Create Company", icon: <MdAddCircleOutline className="h-4 w-4" />, keywords: ["new", "register", "business", "create"] },
        ],
      },
      {
        group: "Account",
        items: [
          { href: "/profile", label: "My Profile", icon: <FiUser className="h-4 w-4" />, keywords: ["account", "me", "user"] },
          { href: "/settings", label: "Settings", icon: <AiOutlineSetting className="h-4 w-4" />, keywords: ["preferences", "options", "config"] },
        ],
      },
      {
        group: "Settings",
        items: [
          { href: "/settings?section=appearance", label: "Appearance", description: "Customize theme & look", icon: <FaPalette className="h-4 w-4" />, keywords: ["theme", "dark", "light", "mode", "color", "style", "look", "appearance"] },
          { href: "/settings?section=notifications", label: "Notifications", description: "Manage alerts & updates", icon: <FiBell className="h-4 w-4" />, keywords: ["alerts", "notify", "noti", "notifications", "updates", "messages"] },
          { href: "/settings?section=privacy", label: "Privacy & Security", description: "Control your data", icon: <FiLock className="h-4 w-4" />, keywords: ["security", "private", "data", "safety"] },
          { href: "/settings?section=wallet", label: "Wallet & Crypto", description: "Manage connected wallets", icon: <FaWallet className="h-4 w-4" />, keywords: ["crypto", "wallet", "web3", "ethereum", "connect"] },
          { href: "/settings?section=currency", label: "Currency", description: "Set preferred currency", icon: <FaDollarSign className="h-4 w-4" />, keywords: ["money", "currency", "usd", "eur", "nok", "price"] },
        ],
      },
      {
        group: "Info & Support",
        items: [
          { href: "/info", label: "About / Contact", icon: <FaInfoCircle className="h-4 w-4" />, keywords: ["help", "support", "contact", "about"] },
          { href: "/privacy", label: "Privacy & Cookies", icon: <FaShieldAlt className="h-4 w-4" />, keywords: ["gdpr", "cookies", "policy", "terms"] },
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
              ? "group inline-flex h-10 w-10 items-center justify-center bg-transparent text-zinc-700 hover:bg-transparent hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 dark:text-zinc-200 dark:hover:text-zinc-50"
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
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-4 py-3">
          <div className="flex items-center gap-3">
            <TbHexagons className="h-5 w-5 text-emerald-500 shrink-0" />
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Nexus</span>
          </div>
          <kbd className="text-[10px] text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">⌘K</kbd>
        </div>
        <CommandInput placeholder="Search actions, pages, settings..." className="h-12" />
        <CommandList className="max-h-[400px] p-2">
          <CommandEmpty className="py-8 text-center">
            <div className="text-zinc-400 dark:text-zinc-500">No results found.</div>
            <div className="text-xs text-zinc-300 dark:text-zinc-600 mt-1">Try a different search term</div>
          </CommandEmpty>

          {/* Quick Actions */}
          <CommandGroup heading="Quick Actions">
            <CommandItem
              value="Toggle Theme"
              onSelect={toggleTheme}
              className="rounded-lg px-3 py-2.5 cursor-pointer"
            >
              {resolvedTheme === "dark" ? (
                <FiSun className="h-4 w-4 text-amber-500" />
              ) : (
                <FiMoon className="h-4 w-4 text-indigo-500" />
              )}
              <span className="flex-1">Toggle Theme</span>
              <span className="text-[10px] text-zinc-400">{resolvedTheme === "dark" ? "Light" : "Dark"}</span>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator className="my-2" />

          {actions.map((group, idx) => (
            <div key={group.group}>
              {idx > 0 ? <CommandSeparator className="my-2" /> : null}
              <CommandGroup heading={group.group}>
                {group.items.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href.split('?')[0]}/`);
                  return (
                    <CommandItem
                      key={item.href}
                      value={`${item.label} ${(item as any).keywords?.join(' ') || ''}`}
                      onSelect={() => handleNavigate(item.href)}
                      className={`rounded-lg px-3 py-2.5 cursor-pointer ${isActive ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300" : ""
                        }`}
                    >
                      <span className={isActive ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-500 dark:text-zinc-400"}>
                        {item.icon}
                      </span>
                      <div className="flex-1 flex flex-col">
                        <span>{item.label}</span>
                        {(item as any).description && (
                          <span className="text-xs text-zinc-400 dark:text-zinc-500">{(item as any).description}</span>
                        )}
                      </div>
                      {isActive && (
                        <CiCircleCheck className="h-4 w-4 text-emerald-500" />
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </div>
          ))}
        </CommandList>
      </CommandDialog>
    </div>
  );
};