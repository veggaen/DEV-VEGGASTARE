'use client'
// make me server later..
import Link from "next/link";
import { MyThemeBtn } from "./themebtn";
import { useMemo, useState, useTransition } from "react";
import { MySidebarToggleBtn } from "./sidebartogglebtn";
import { LogoutMyAction } from "@/actions/logout";
import { usePathname } from "next/navigation";
import { FiGrid, FiMessageSquare, FiPackage, FiSettings, FiShoppingCart, FiLogOut, FiRss } from "react-icons/fi";

const LOG_PREFIX = '[[USE CLIENT] sidemenumainauth.tsx.tsx]'
export const MyMenuSide = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isPending, startTransition] = useTransition();

  const pathname = usePathname();

  const navItems = useMemo(
    () => [
      { href: "/dashboard", label: "Dashboard", icon: FiGrid },
      { href: "/products", label: "Products", icon: FiPackage },
      { href: "/pulse", label: "Pulse", icon: FiRss },
      { href: "/conversations", label: "Conversations", icon: FiMessageSquare },
      { href: "/cart", label: "Cart", icon: FiShoppingCart },
      { href: "/nexus", label: "Settings", icon: FiSettings },
    ],
    []
  );

  const toggleSidebar = () => setIsSidebarCollapsed((v) => !v);

  const onClick = () => {
    console.log(`${LOG_PREFIX} LOGOUT Client => LogoutMyAction()`)
    startTransition(() => {
      LogoutMyAction()
    })
  }

  return (
    <aside
      className={`MyMenuSideMainRoot h-[calc(100dvh-var(--app-header))] border-r border-black/10 dark:border-white/10 bg-white/50 dark:bg-black/20 text-slate-900 dark:text-slate-100 backdrop-blur-xl ${
        isSidebarCollapsed ? "w-[64px]" : "w-[280px]"
      } transition-[width] duration-200 ease-out overflow-hidden`}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-3 border-b border-black/5 dark:border-white/10">
        <div className={`flex items-center gap-2 ${isSidebarCollapsed ? "justify-center w-full" : ""}`}>
          <span className={`font-semibold text-sm tracking-tight ${isSidebarCollapsed ? "hidden" : ""}`}>
            Workspace
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!isSidebarCollapsed && <MyThemeBtn />}
          <MySidebarToggleBtn
            onClick={toggleSidebar}
            aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="rounded-full hover:bg-black/5 dark:hover:bg-white/10"
          />
        </div>
      </div>

      <div className="flex h-full flex-col justify-between">
        <nav className="p-2">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 ${
                      active
                        ? "bg-white/70 dark:bg-white/10 font-medium ring-1 ring-black/10 dark:ring-white/10 shadow-sm"
                        : "hover:bg-black/5 dark:hover:bg-white/5"
                    }`}
                    title={isSidebarCollapsed ? item.label : undefined}
                  >
                    <Icon
                      className={
                        `h-4 w-4 shrink-0 transition-transform duration-200 ` +
                        (active
                          ? "text-sky-600 dark:text-sky-400"
                          : "text-slate-600 dark:text-slate-300") +
                        (item.href === "/pulse" ? " group-hover:-rotate-6 group-hover:scale-110" : "")
                      }
                    />
                    <span className={`${isSidebarCollapsed ? "hidden" : ""}`}>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-2 border-t border-black/5 dark:border-white/10">
          <button
            type="button"
            onClick={onClick}
            disabled={isPending}
            className={`w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50`}
            title={isSidebarCollapsed ? "Logout" : undefined}
          >
            <FiLogOut className="h-4 w-4 text-slate-600 dark:text-slate-300" />
            <span className={`${isSidebarCollapsed ? "hidden" : ""}`}>{isPending ? "Signing out..." : "Logout"}</span>
          </button>
        </div>
      </div>
    </aside>
  );
};