"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";
import { Button, ButtonProps } from "@/components/ui/button";
import { IoMoonOutline } from "react-icons/io5";
import { FiSun } from "react-icons/fi";
import { useUiPreferences } from "@/components/providers/ui-preferences";

interface MyThemeBtnProps {
  customName?: ButtonProps["variant"];
  onClick?: () => void;
}

export function MyThemeBtn({ customName, onClick }: MyThemeBtnProps) {
  const { setTheme, theme, resolvedTheme } = useTheme();
  const { prefs } = useUiPreferences();
  const showFancyHover = prefs.hoverEffects === "colorful";

  useEffect(() => {
    const effective = (resolvedTheme ?? theme) as string | undefined;

    if (effective === "light") {
      document.body.classList.add("light-mode");
      document.body.classList.remove("dark-mode");
    } else if (effective === "dark") {
      document.body.classList.add("dark-mode");
      document.body.classList.remove("light-mode");
    }
  }, [theme, resolvedTheme]);

  const handleClick = () => {
    const effective = (resolvedTheme ?? theme) as string | undefined;
    setTheme(effective === "dark" ? "light" : "dark");
    if (onClick) onClick();
  };

  return (
			<Button
				variant={customName ? customName : "vegaThemeBtn"}
				size="icon"
				onClick={handleClick}
				className="group relative h-10 w-10 overflow-hidden rounded-xl border border-black/10 bg-white/40 text-zinc-700 hover:bg-transparent focus-visible:ring-2 focus-visible:ring-sky-400/70 dark:border-white/10 dark:bg-white/[0.06] dark:text-zinc-200 transition-colors transform-none hover:scale-100 active:scale-100"
			>
				{/* Hover fill: expand from center → then gradient settles in */}
				<span aria-hidden className="pointer-events-none absolute inset-0">
					<span className="absolute inset-0 origin-center scale-x-0 bg-black/5 transition-transform duration-200 ease-out group-hover:scale-x-100 dark:bg-white/[0.10]" />
					{showFancyHover && (
						<span className="absolute inset-0 origin-center scale-x-0 opacity-0 bg-linear-to-r from-sky-400/55 via-emerald-400/45 to-fuchsia-400/55 transition-[transform,opacity] duration-300 ease-out delay-150 group-hover:scale-x-100 group-hover:opacity-100" />
					)}
				</span>

				<FiSun className="relative z-10 h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
				<IoMoonOutline className="absolute z-10 h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
				<span className="sr-only">Toggle theme</span>
			</Button>
  );
}