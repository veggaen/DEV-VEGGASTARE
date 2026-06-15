/**
 * @fileOverview  Floating dashboard dock — Windows 11-style floating taskbar.
 *                Can be repositioned to any edge (left, right, top, bottom).
 *                Floats over content with glass backdrop, rounded corners, shadow.
 *                Uses React portal for the dock-picker dropdown so it never clips.
 *
 * @stability     evolving
 */

"use client";

import Link from "next/link";
import { MyThemeBtn } from "./themebtn";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useCleanLogout } from "@/hooks/use-clean-logout";
import { usePathname } from "next/navigation";
import {
  FiGrid,
  FiMessageSquare,
  FiPackage,
  FiSettings,
  FiShoppingCart,
  FiCreditCard,
  FiLogOut,
  FiZap,
  FiHome,
  FiDownload,
  FiShield,
  FiUsers,
  FiBox,
  FiClipboard,
  FiDollarSign,
  FiHexagon,
  FiChevronLeft,
  FiChevronRight,
  FiChevronUp,
  FiChevronDown,
  FiMove,
} from "react-icons/fi";
import { PulseHeart } from "@/components/uicustom/icons/PulseIcons";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  useDashboardDock,
  type DockPosition,
} from "@/contexts/dashboard-dock-context";

/* ── Types ─────────────────────────────────────────────── */

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

/* ── Constants (exported for dashboard-shell padding) ──── */

export const FLOATING_GAP = 8;
export const COLLAPSED_SIZE = 52;
export const EXPANDED_V_WIDTH = 240;
export const DOCK_H_APPROX = 48;

/* ── Position option data ──────────────────────────────── */

const POSITION_OPTIONS: {
  pos: DockPosition;
  icon: typeof FiChevronLeft;
  label: string;
}[] = [
  { pos: "left", icon: FiChevronLeft, label: "Left" },
  { pos: "top", icon: FiChevronUp, label: "Top" },
  { pos: "right", icon: FiChevronRight, label: "Right" },
  { pos: "bottom", icon: FiChevronDown, label: "Bottom" },
];

/* ── Main Component ────────────────────────────────────── */

export const MyMenuSide = () => {
  const {
    position,
    isExpanded,
    setPosition,
    toggleExpanded,
    isHorizontal,
  } = useDashboardDock();

  const [isPending, setIsPending] = useState(false);
  const [showDockPicker, setShowDockPicker] = useState(false);
  const cleanLogout = useCleanLogout();
  const pathname = usePathname();
  const currentUser = useCurrentUser();
  const isAdmin =
    currentUser?.role === "OWNER" || currentUser?.role === "ADMIN";

  /* ── Nav groups ────────────────────────────────────── */

  const navGroups = useMemo<NavGroup[]>(() => {
    const groups: NavGroup[] = [
      {
        label: "Explore",
        items: [
          { href: "/", label: "Home", icon: FiHome },
          { href: "/products", label: "Products", icon: FiPackage },
          { href: "/pulse", label: "Pulse", icon: PulseHeart },
          { href: "/ai", label: "AI Chat", icon: FiZap },
        ],
      },
      {
        label: "Trading",
        items: [
          { href: "/dashboard/trading", label: "Trading Hub", icon: FiHexagon },
        ],
      },
      {
        label: "Shopping",
        items: [
          { href: "/cart", label: "Cart", icon: FiShoppingCart },
          { href: "/checkout", label: "Checkout", icon: FiCreditCard },
          { href: "/my-orders", label: "My Orders", icon: FiClipboard },
          { href: "/my-downloads", label: "Downloads", icon: FiDownload },
        ],
      },
      {
        label: "Selling",
        items: [
          { href: "/my-sales", label: "My Sales", icon: FiDollarSign },
          { href: "/nexus", label: "Business Hub", icon: FiBox },
        ],
      },
      {
        label: "Account",
        items: [
          { href: "/dashboard", label: "Dashboard", icon: FiGrid },
          {
            href: "/conversations",
            label: "Messages",
            icon: FiMessageSquare,
          },
          { href: "/settings", label: "Settings", icon: FiSettings },
        ],
      },
    ];

    if (isAdmin) {
      groups.push({
        label: "Admin",
        items: [
          { href: "/admin", label: "Admin Panel", icon: FiShield },
          { href: "/admin/users", label: "Users", icon: FiUsers },
          {
            href: "/admin/repo-access",
            label: "Repo Access",
            icon: FiPackage,
          },
        ],
      });
    }

    return groups;
  }, [isAdmin]);

  const isActive = useCallback(
    (href: string) => {
      if (href === "/") return pathname === "/";
      return pathname === href || pathname.startsWith(`${href}/`);
    },
    [pathname],
  );

  const handleLogout = async () => {
    if (isPending) return;
    setIsPending(true);
    await cleanLogout();
    setIsPending(false);
  };

  const profileHref = currentUser?.id
    ? `/profile/${currentUser.id}`
    : "/profile";
  const profileActive = pathname.startsWith("/profile");

  /* ── Floating dock position styles ─────────────────── */

  const dockStyle = useMemo((): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: "fixed",
      zIndex: 40,
    };

    switch (position) {
      case "bottom":
        return {
          ...base,
          bottom: FLOATING_GAP,
          left: "50%",
          transform: "translateX(-50%)",
          maxWidth: `calc(100vw - ${FLOATING_GAP * 2}px)`,
        };
      case "top":
        return {
          ...base,
          top: `calc(var(--app-header, 72px) + ${FLOATING_GAP}px)`,
          left: "50%",
          transform: "translateX(-50%)",
          maxWidth: `calc(100vw - ${FLOATING_GAP * 2}px)`,
        };
      case "left":
        return {
          ...base,
          top: `calc(var(--app-header, 72px) + ${FLOATING_GAP}px)`,
          left: FLOATING_GAP,
          bottom: FLOATING_GAP,
          width: isExpanded ? EXPANDED_V_WIDTH : COLLAPSED_SIZE,
          transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        };
      case "right":
        return {
          ...base,
          top: `calc(var(--app-header, 72px) + ${FLOATING_GAP}px)`,
          right: FLOATING_GAP,
          bottom: FLOATING_GAP,
          width: isExpanded ? EXPANDED_V_WIDTH : COLLAPSED_SIZE,
          transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        };
    }
  }, [position, isExpanded]);

  /* ── Collapse/expand chevron ───────────────────────── */

  const CollapseIcon = useMemo(() => {
    if (isHorizontal) {
      return isExpanded
        ? position === "bottom"
          ? FiChevronDown
          : FiChevronUp
        : position === "bottom"
          ? FiChevronUp
          : FiChevronDown;
    }
    return isExpanded
      ? position === "left"
        ? FiChevronLeft
        : FiChevronRight
      : position === "left"
        ? FiChevronRight
        : FiChevronLeft;
  }, [isHorizontal, isExpanded, position]);

  /* ── Glass pill classes ────────────────────────────── */

  const glassClasses =
    "bg-white/70 dark:bg-zinc-900/80 backdrop-blur-2xl border border-white/20 dark:border-white/10 shadow-lg shadow-black/5 dark:shadow-black/30 rounded-2xl";

  /* ═══════════════════════════════════════════════════════
   *  Render: Horizontal dock (top / bottom)
   * ═══════════════════════════════════════════════════════ */

  if (isHorizontal) {
    return (
      <div className={glassClasses} style={dockStyle}>
        <div className="flex items-center h-full px-1.5 py-1.5 gap-0.5">
          {/* ── Controls: collapse + position picker ── */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={toggleExpanded}
              className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/8 transition-colors text-zinc-500 dark:text-zinc-400"
              title={isExpanded ? "Collapse dock" : "Expand dock"}
            >
              <CollapseIcon className="w-3.5 h-3.5" />
            </button>
            <DockPositionPicker
              currentPosition={position}
              onSelect={setPosition}
              show={showDockPicker}
              onToggle={() => setShowDockPicker((v) => !v)}
              dockPosition={position}
            />
          </div>

          {/* ── Separator ── */}
          <div className="w-px self-stretch my-1 bg-black/8 dark:bg-white/8 shrink-0" />

          {/* ── Nav items — horizontal scroll ── */}
          <nav className="flex items-center gap-0.5 flex-1 min-w-0 overflow-x-auto scrollbar-none">
            {navGroups.map((group, gi) => (
              <div
                key={group.label}
                className="flex items-center gap-0.5 shrink-0"
              >
                {group.items.map((item) => {
                  const active = isActive(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-1.5 rounded-xl whitespace-nowrap transition-all ${
                        isExpanded ? "px-2.5 py-1.5" : "p-2"
                      } ${
                        active
                          ? "bg-white/80 dark:bg-white/15 text-sky-600 dark:text-sky-400 shadow-sm font-medium"
                          : "hover:bg-black/5 dark:hover:bg-white/8 text-zinc-600 dark:text-zinc-400"
                      }`}
                      title={item.label}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {isExpanded && (
                        <span className="text-xs">{item.label}</span>
                      )}
                    </Link>
                  );
                })}
                {gi < navGroups.length - 1 && (
                  <div className="w-px self-stretch my-2 bg-black/5 dark:bg-white/5 mx-0.5 shrink-0" />
                )}
              </div>
            ))}
          </nav>

          {/* ── Separator ── */}
          <div className="w-px self-stretch my-1 bg-black/8 dark:bg-white/8 shrink-0" />

          {/* ── User + actions ── */}
          <div className="flex items-center gap-0.5 shrink-0">
            {currentUser && (
              <Link
                href={profileHref}
                className={`flex items-center gap-1.5 p-1.5 rounded-xl transition-colors ${
                  profileActive
                    ? "bg-white/80 dark:bg-white/15 shadow-sm"
                    : "hover:bg-black/5 dark:hover:bg-white/8"
                }`}
                title={currentUser.name || "Profile"}
              >
                <Avatar className="h-6 w-6 shrink-0">
                  <AvatarImage
                    src={currentUser.image || undefined}
                    className="object-cover"
                  />
                  <AvatarFallback className="text-[10px] font-semibold bg-sky-500 text-white">
                    {currentUser.name?.[0]?.toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
              </Link>
            )}
            <MyThemeBtn />
            <button
              onClick={handleLogout}
              disabled={isPending}
              className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-500 text-zinc-500 transition-colors disabled:opacity-50"
              title="Sign out"
            >
              <FiLogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════
   *  Render: Vertical dock (left / right)
   * ═══════════════════════════════════════════════════════ */

  return (
    <aside className={glassClasses} style={dockStyle}>
      <div className="flex flex-col h-full">
        {/* ── Header (outside scroll zone — dropdown won't clip) ── */}
        <div
          className={`flex items-center shrink-0 px-1.5 pt-1.5 ${
            !isExpanded ? "justify-center" : "justify-between"
          }`}
        >
          {isExpanded && (
            <span className="text-[11px] font-semibold tracking-widest uppercase text-zinc-400 dark:text-zinc-500 select-none pl-2">
              Veggat
            </span>
          )}
          <div className="flex items-center gap-0.5">
            <DockPositionPicker
              currentPosition={position}
              onSelect={setPosition}
              show={showDockPicker}
              onToggle={() => setShowDockPicker((v) => !v)}
              dockPosition={position}
            />
            <button
              onClick={toggleExpanded}
              className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/8 transition-colors text-zinc-500"
              title={isExpanded ? "Collapse" : "Expand"}
            >
              <CollapseIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ── Separator ── */}
        <div className="h-px mx-2.5 my-1 bg-black/5 dark:bg-white/5" />

        {/* ── User avatar ── */}
        {currentUser && (
          <div className="px-1.5 shrink-0">
            <Link
              href={profileHref}
              className={`flex items-center gap-2 rounded-xl px-2 py-1.5 transition-colors ${
                profileActive
                  ? "bg-white/60 dark:bg-white/10 text-sky-600 dark:text-sky-400"
                  : "hover:bg-black/5 dark:hover:bg-white/8"
              } ${!isExpanded ? "justify-center" : ""}`}
              title={!isExpanded ? currentUser.name || "Profile" : undefined}
            >
              <Avatar className="h-6 w-6 shrink-0">
                <AvatarImage
                  src={currentUser.image || undefined}
                  className="object-cover"
                />
                <AvatarFallback className="text-[10px] font-semibold bg-sky-500 text-white">
                  {currentUser.name?.[0]?.toUpperCase() ||
                    currentUser.email?.[0]?.toUpperCase() ||
                    "?"}
                </AvatarFallback>
              </Avatar>
              {isExpanded && (
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-foreground truncate leading-tight">
                    {currentUser.name || "User"}
                  </div>
                  <div className="text-[10px] text-zinc-500 truncate leading-tight">
                    View profile
                  </div>
                </div>
              )}
            </Link>
          </div>
        )}

        {/* ── Navigation (only this section scrolls) ── */}
        <nav className="flex-1 overflow-y-auto px-1.5 py-1 min-h-0 space-y-1 scrollbar-thin">
          {navGroups.map((group) => (
            <div key={group.label}>
              {isExpanded && (
                <div className="px-2 pb-0.5 pt-1.5 text-[9px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 select-none">
                  {group.label}
                </div>
              )}
              {!isExpanded && (
                <div className="h-px mx-2 my-1 bg-black/5 dark:bg-white/5" />
              )}
              <ul className="space-y-px">
                {group.items.map((item) => {
                  const active = isActive(item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`group relative flex items-center gap-2 rounded-xl px-2.5 py-1.75 text-[13px] transition-colors ${
                          active
                            ? "bg-white/60 dark:bg-white/10 font-medium text-sky-600 dark:text-sky-400"
                            : "hover:bg-black/5 dark:hover:bg-white/8 text-zinc-600 dark:text-zinc-400"
                        } ${!isExpanded ? "justify-center" : ""}`}
                        title={!isExpanded ? item.label : undefined}
                      >
                        {active && isExpanded && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-3.5 w-0.5 rounded-r-full bg-sky-500" />
                        )}
                        <Icon className="w-4 h-4 shrink-0" />
                        {isExpanded && <span>{item.label}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* ── Footer ── */}
        <div className="px-1.5 pb-1.5 shrink-0 space-y-px">
          <div className="h-px mx-2 mb-1 bg-black/5 dark:bg-white/5" />
          {!isExpanded ? (
            <div className="flex justify-center py-0.5">
              <MyThemeBtn />
            </div>
          ) : (
            <div className="flex items-center gap-2 px-2.5 py-1.5 text-sm text-zinc-500">
              <MyThemeBtn />
              <span className="text-xs">Theme</span>
            </div>
          )}
          <button
            type="button"
            onClick={handleLogout}
            disabled={isPending}
            className={`w-full flex items-center gap-2 rounded-xl px-2.5 py-1.75 text-[13px] transition-colors hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-500 text-zinc-500 disabled:opacity-50 ${
              !isExpanded ? "justify-center" : ""
            }`}
            title={!isExpanded ? "Sign out" : undefined}
          >
            <FiLogOut className="w-4 h-4 shrink-0" />
            {isExpanded && (
              <span>{isPending ? "Signing out…" : "Sign out"}</span>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
};

/* ═══════════════════════════════════════════════════════════
 *  Dock Position Picker — dropdown rendered via React Portal
 *  so backdrop-filter on the dock never clips it.
 * ═══════════════════════════════════════════════════════════ */

function DockPositionPicker({
  currentPosition,
  onSelect,
  show,
  onToggle,
  dockPosition,
}: {
  currentPosition: DockPosition;
  onSelect: (pos: DockPosition) => void;
  show: boolean;
  onToggle: () => void;
  dockPosition: DockPosition;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState<React.CSSProperties>({});

  /* ── Compute dropdown position from button bounding rect ── */
  useLayoutEffect(() => {
    if (!show || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const style: React.CSSProperties = {
      position: "fixed",
      zIndex: 9999,
    };

    switch (dockPosition) {
      case "bottom":
        style.bottom = window.innerHeight - rect.top + 6;
        style.left = rect.left;
        break;
      case "top":
        style.top = rect.bottom + 6;
        style.left = rect.left;
        break;
      case "left":
        style.top = rect.top;
        style.left = rect.right + 6;
        break;
      case "right":
        style.top = rect.top;
        style.right = window.innerWidth - rect.left + 6;
        break;
    }

    setDropdownPos(style);
  }, [show, dockPosition]);

  /* ── Close on click outside ── */
  useEffect(() => {
    if (!show) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      )
        return;
      onToggle();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [show, onToggle]);

  /* ── Dropdown rendered via portal into document.body ── */
  const dropdown =
    show && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={dropdownRef}
            style={dropdownPos}
            className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl border border-white/20 dark:border-white/10 rounded-xl shadow-2xl p-1 min-w-36 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Dock position
            </div>
            {POSITION_OPTIONS.map(({ pos, icon: Icon, label }) => (
              <button
                key={pos}
                onClick={() => {
                  onSelect(pos);
                  onToggle();
                }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                  pos === currentPosition
                    ? "bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 font-medium"
                    : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
                {pos === currentPosition && (
                  <span className="ml-auto text-[9px] bg-sky-500/15 text-sky-500 px-1.5 py-0.5 rounded font-medium">
                    Active
                  </span>
                )}
              </button>
            ))}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={buttonRef}
        onClick={onToggle}
        className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/8 transition-colors text-zinc-500"
        title="Move dock"
      >
        <FiMove className="w-3.5 h-3.5" />
      </button>
      {dropdown}
    </>
  );
}
