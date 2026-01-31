'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { IoMoonOutline } from 'react-icons/io5';
import { FiSun } from 'react-icons/fi';
import { FiMonitor } from 'react-icons/fi';

type ThemeValue = 'light' | 'dark' | 'system';

export default function ThemeToggleMenu() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const effective = (resolvedTheme ?? theme) as ThemeValue | undefined;

  const Icon = !mounted
    ? FiMonitor
    : effective === 'dark'
      ? IoMoonOutline
      : effective === 'light'
        ? FiSun
        : FiMonitor;

  const label = !mounted ? 'Theme' : theme === 'system' ? `System (${effective ?? '…'})` : theme;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="h-10 gap-2 rounded-xl border border-border bg-white/60 text-foreground hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200 dark:hover:bg-white/[0.10]"
        >
          <Icon className="h-4 w-4" />
          <span className="text-sm">{label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={() => setTheme('dark')}>
          <IoMoonOutline className="mr-2 h-4 w-4" />
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('light')}>
          <FiSun className="mr-2 h-4 w-4" />
          Light
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setTheme('system')}>
          <FiMonitor className="mr-2 h-4 w-4" />
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
