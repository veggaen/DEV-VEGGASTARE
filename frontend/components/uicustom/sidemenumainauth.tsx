'use client'
import Link from "next/link";
import { MyThemeBtn } from "./themebtn";
import { useMemo, useState, useTransition } from "react";
import { MySidebarToggleBtn } from "./sidebartogglebtn";
import { LogoutMyAction } from "@/actions/logout";
import { usePathname } from "next/navigation";
import {
  FiGrid, FiMessageSquare, FiPackage, FiSettings, FiShoppingCart,
  FiCreditCard, FiLogOut, FiZap, FiHome, FiDownload, FiTruck,
  FiShield, FiUsers, FiBox, FiClipboard, FiDollarSign,
} from "react-icons/fi";
import { PulseHeart } from "@/components/uicustom/icons/PulseIcons";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface NavGroup {
  label: string;
  items: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[];
}

export const MyMenuSide = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isPending, startTransition] = useTransition();

  const pathname = usePathname();
  const currentUser = useCurrentUser();
  const isAdmin = currentUser?.role === 'OWNER' || currentUser?.role === 'ADMIN';

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
          { href: "/conversations", label: "Messages", icon: FiMessageSquare },
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
        ],
      });
    }

    return groups;
  }, [isAdmin]);

  const toggleSidebar = () => setIsSidebarCollapsed((v) => !v);

  const handleLogout = () => {
    startTransition(() => {
      LogoutMyAction();
    });
  };

  const profileHref = currentUser?.id ? `/profile/${currentUser.id}` : '/profile';
  const profileActive = pathname.startsWith('/profile');

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <aside
      className={`MyMenuSideMainRoot flex flex-col h-[calc(100dvh-var(--app-header))] border-r border-black/10 dark:border-white/10 bg-white/50 dark:bg-black/20 text-zinc-900 dark:text-zinc-100 backdrop-blur-xl ${
        isSidebarCollapsed ? "w-[60px]" : "w-[256px]"
      } transition-[width] duration-200 ease-out overflow-hidden shrink-0`}
    >
      {/* Header */}
      <div className={`flex items-center border-b border-black/5 dark:border-white/10 px-3 py-2.5 shrink-0 ${isSidebarCollapsed ? "justify-center" : "justify-between"}`}>
        {!isSidebarCollapsed && (
          <span className="text-xs font-semibold tracking-widest uppercase text-muted-foreground select-none pl-1">
            Veggat
          </span>
        )}
        <MySidebarToggleBtn
          onClick={toggleSidebar}
          isCollapsed={isSidebarCollapsed}
          aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        />
      </div>

      {/* User profile section */}
      {currentUser && (
        <div className="px-2 pt-2 shrink-0">
          <Link
            href={profileHref}
            className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 ${
              profileActive
                ? "bg-white/70 dark:bg-white/10 ring-1 ring-black/10 dark:ring-white/10 shadow-sm"
                : "hover:bg-black/5 dark:hover:bg-white/5"
            } ${isSidebarCollapsed ? "justify-center" : ""}`}
            title={isSidebarCollapsed ? (currentUser.name || "Profile") : undefined}
          >
            <Avatar className="h-7 w-7 shrink-0 ring-2 ring-background shadow-sm">
              <AvatarImage src={currentUser.image || undefined} className="object-cover" />
              <AvatarFallback className="text-[11px] font-semibold bg-sky-500 text-white">
                {currentUser.name?.[0]?.toUpperCase() || currentUser.email?.[0]?.toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
            {!isSidebarCollapsed && (
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium text-foreground truncate leading-tight">
                  {currentUser.name || "User"}
                </div>
                <div className="text-[11px] text-muted-foreground truncate leading-tight">
                  View profile
                </div>
              </div>
            )}
          </Link>
          <div className="mt-2 border-t border-black/5 dark:border-white/10" />
        </div>
      )}

      {/* Navigation — grouped */}
      <nav className="flex-1 overflow-y-auto p-2 min-h-0 space-y-3">
        {navGroups.map((group) => (
          <div key={group.label}>
            {!isSidebarCollapsed && (
              <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 select-none">
                {group.label}
              </div>
            )}
            {isSidebarCollapsed && <div className="border-t border-black/5 dark:border-white/10 mx-2 mb-1" />}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 ${
                        active
                          ? "bg-white/70 dark:bg-white/10 font-medium ring-1 ring-black/10 dark:ring-white/10 shadow-sm"
                          : "hover:bg-black/5 dark:hover:bg-white/5"
                      } ${isSidebarCollapsed ? "justify-center" : ""}`}
                      title={isSidebarCollapsed ? item.label : undefined}
                    >
                      {active && !isSidebarCollapsed && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[3px] rounded-r-full bg-sky-500" />
                      )}
                      <Icon
                        className={`h-4 w-4 shrink-0 transition-transform duration-150 ${
                          active
                            ? "text-sky-600 dark:text-sky-400"
                            : "text-zinc-500 dark:text-zinc-400"
                        }`}
                      />
                      {!isSidebarCollapsed && (
                        <span className={active ? "text-foreground" : "text-zinc-700 dark:text-zinc-300"}>
                          {item.label}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer: theme + logout */}
      <div className="border-t border-black/5 dark:border-white/10 p-2 shrink-0 space-y-0.5">
        {isSidebarCollapsed ? (
          <div className="flex justify-center py-1">
            <MyThemeBtn />
          </div>
        ) : (
          <div className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-zinc-600 dark:text-zinc-400`}>
            <MyThemeBtn />
            <span className="text-sm">Theme</span>
          </div>
        )}
        <button
          type="button"
          onClick={handleLogout}
          disabled={isPending}
          className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400 text-zinc-600 dark:text-zinc-400 disabled:opacity-50 ${isSidebarCollapsed ? "justify-center" : ""}`}
          title={isSidebarCollapsed ? "Sign out" : undefined}
        >
          <FiLogOut className="h-4 w-4 shrink-0" />
          {!isSidebarCollapsed && (
            <span>{isPending ? "Signing out…" : "Sign out"}</span>
          )}
        </button>
      </div>
    </aside>
  );
};
