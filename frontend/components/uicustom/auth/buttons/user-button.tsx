"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { FaCartFlatbed } from "react-icons/fa6";
import { FaUser } from "react-icons/fa";
import Link from "next/link";
import { ExitIcon } from "@radix-ui/react-icons";
import { TiMessages } from "react-icons/ti";
import { AiOutlineSetting } from "react-icons/ai";
import { FiUser, FiBox, FiSun, FiMoon, FiShoppingBag } from "react-icons/fi";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useTheme } from "next-themes";
import { useCleanLogout } from "@/hooks/use-clean-logout";

const itemClass =
  "cursor-pointer rounded-xl px-2.5 py-2 focus:bg-black/5 dark:focus:bg-white/10";

export const MyUserButton = () => {
  const user = useCurrentUser();
  const { resolvedTheme, setTheme } = useTheme();
  const cleanLogout = useCleanLogout();

  const toggleTheme = () => {
    const next = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(next);
  };

  if (!user) {
    return (
      <div className="hidden md:flex items-center text-sm text-muted-foreground">Guest</div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="group h-[52px] w-[52px] rounded-full bg-transparent p-0 text-zinc-700 hover:bg-transparent hover:text-zinc-950 dark:text-zinc-200 dark:hover:bg-transparent dark:hover:text-zinc-50 focus-visible:ring-2 focus-visible:ring-ring transform-none hover:scale-100 active:scale-100"
          aria-label="Open user menu"
          title={user.name ?? "User menu"}
        >
          <Avatar className="h-[52px] w-[52px] shrink-0 border-0 bg-transparent transition-shadow duration-200 group-hover:shadow-[0_0_0_2px_hsl(var(--brand-accent)/0.5)] rounded-full">
            <AvatarImage src={user.image || "/users/avatar.webp"} alt="User" />
            <AvatarFallback className="bg-brand-accent text-brand-accent-foreground">
              <FaUser />
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={10}
        className="w-72 rounded-2xl border border-black/10 bg-white/85 p-2 shadow-e3 backdrop-blur-xl dark:border-white/10 dark:bg-zinc-950/75"
      >
        <DropdownMenuLabel className="px-2 py-2">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{user.name}</span>
            {user.email ? (
              <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{user.email}</span>
            ) : null}
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild className={itemClass}>
          <Link href="/profile" className="flex w-full items-center gap-2">
            <FiUser className="h-5 w-5" />
            My profile
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild className={itemClass}>
          <Link href="/conversations" className="flex w-full items-center gap-2">
            <TiMessages className="h-5 w-5" />
            Conversations
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild className={itemClass}>
          <Link href="/cart" className="flex w-full items-center gap-2">
            <FaCartFlatbed className="h-5 w-5" />
            Cart
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild className={itemClass}>
          <Link href="/my-orders" className="flex w-full items-center gap-2">
            <FiShoppingBag className="h-5 w-5" />
            My orders
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* "Settings" used to link to /nexus (Business Hub) — mislabeled.
            Both destinations now exist under their real names. */}
        <DropdownMenuItem asChild className={itemClass}>
          <Link href="/settings" className="flex w-full items-center gap-2">
            <AiOutlineSetting className="h-5 w-5" />
            Settings
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild className={itemClass}>
          <Link href="/nexus" className="flex w-full items-center gap-2">
            <FiBox className="h-5 w-5" />
            Business hub
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem
          className={itemClass}
          onSelect={(e) => {
            e.preventDefault();
            toggleTheme();
          }}
        >
          {resolvedTheme === "dark" ? (
            <><FiSun className="h-5 w-5" /> Switch to light</>
          ) : (
            <><FiMoon className="h-5 w-5" /> Switch to dark</>
          )}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="cursor-pointer rounded-xl px-2.5 py-2 text-red-600 focus:bg-red-500/10 focus:text-red-700 dark:focus:bg-red-500/15 dark:focus:text-red-400"
          onSelect={(e) => {
            e.preventDefault();
            cleanLogout();
          }}
        >
          <ExitIcon className="h-5 w-5" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
