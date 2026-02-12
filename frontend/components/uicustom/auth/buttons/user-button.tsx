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
import { signOut } from "next-auth/react";
import { ExitIcon } from "@radix-ui/react-icons";
import { TiMessages } from "react-icons/ti";
import { AiOutlineSetting } from "react-icons/ai";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useTheme } from "next-themes";
import { useCleanLogout } from "@/hooks/use-clean-logout";

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
			<div className="hidden md:flex items-center text-sm text-zinc-600 dark:text-zinc-300">Guest</div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
	          size="icon"
					className="group h-[52px] w-[52px] rounded-full bg-transparent p-0 text-zinc-700 hover:bg-transparent hover:text-zinc-950 dark:text-zinc-200 dark:hover:bg-transparent dark:hover:text-zinc-50 focus-visible:ring-2 focus-visible:ring-sky-400/70 transform-none hover:scale-100 active:scale-100"
	          aria-label="Open user menu"
	          title={user.name ?? "User menu"}
        >
					<Avatar className="h-[52px] w-[52px] shrink-0 border-0 bg-transparent">
            <AvatarImage src={user.image || "/users/avatar.webp"} alt="User" />
            <AvatarFallback className="bg-emerald-500 text-white">
              <FaUser />
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
				sideOffset={10}
				className="w-72 rounded-2xl border border-black/10 bg-white/85 p-2 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-zinc-950/75"
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

				<DropdownMenuItem asChild className="cursor-pointer rounded-xl px-2.5 py-2 focus:bg-black/5 dark:focus:bg-white/10">
          <Link href="/conversations" className="flex w-full items-center gap-2">
            <TiMessages className="h-5 w-5" />
            Conversations
          </Link>
        </DropdownMenuItem>

				<DropdownMenuItem asChild className="cursor-pointer rounded-xl px-2.5 py-2 focus:bg-black/5 dark:focus:bg-white/10">
          <Link href="/cart" className="flex w-full items-center gap-2">
            <FaCartFlatbed className="h-5 w-5" />
            Cart
          </Link>
        </DropdownMenuItem>

				<DropdownMenuItem asChild className="cursor-pointer rounded-xl px-2.5 py-2 focus:bg-black/5 dark:focus:bg-white/10">
          <Link href="/nexus" className="flex w-full items-center gap-2">
            <AiOutlineSetting className="h-5 w-5" />
            Settings
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

  			<DropdownMenuItem
  				className="cursor-pointer rounded-xl px-2.5 py-2 focus:bg-black/5 dark:focus:bg-white/10"
  				onSelect={(e) => {
  					e.preventDefault();
  					toggleTheme();
  				}}
  			>
  				{resolvedTheme === "dark" ? "Switch to light" : "Switch to dark"}
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
