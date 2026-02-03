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
import { FiSun, FiMonitor, FiCheck } from 'react-icons/fi';

type ThemeValue = 'light' | 'dark' | 'system';

interface ThemeToggleMenuProps {
  /** Show label next to icon (default: true) */
  showLabel?: boolean;
  /** Compact mode - just icon button (default: false) */
  compact?: boolean;
}

export default function ThemeToggleMenu({ showLabel = true, compact = false }: ThemeToggleMenuProps) {
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

  const label = !mounted 
    ? 'Theme' 
    : theme === 'system' 
      ? `System` 
      : theme === 'dark' 
        ? 'Dark' 
        : 'Light';

  // Quick toggle function for compact mode
  const quickToggle = () => {
    if (effective === 'dark') {
      setTheme('light');
    } else {
      setTheme('dark');
    }
  };

  // Compact mode - just a toggle button
  if (compact) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={quickToggle}
        className="h-9 w-9 p-0 rounded-xl text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        aria-label={`Switch to ${effective === 'dark' ? 'light' : 'dark'} mode`}
      >
        <Icon className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="h-9 gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
        >
          <Icon className="h-4 w-4" />
          {showLabel && <span className="text-sm">{label}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="w-40 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
      >
        <DropdownMenuItem 
          onClick={() => setTheme('light')}
          className="flex items-center justify-between cursor-pointer"
        >
          <div className="flex items-center">
            <FiSun className="mr-2 h-4 w-4" />
            Light
          </div>
          {theme === 'light' && <FiCheck className="h-4 w-4 text-emerald-500" />}
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => setTheme('dark')}
          className="flex items-center justify-between cursor-pointer"
        >
          <div className="flex items-center">
            <IoMoonOutline className="mr-2 h-4 w-4" />
            Dark
          </div>
          {theme === 'dark' && <FiCheck className="h-4 w-4 text-emerald-500" />}
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-zinc-200 dark:bg-zinc-800" />
        <DropdownMenuItem 
          onClick={() => setTheme('system')}
          className="flex items-center justify-between cursor-pointer"
        >
          <div className="flex items-center">
            <FiMonitor className="mr-2 h-4 w-4" />
            System
          </div>
          {theme === 'system' && <FiCheck className="h-4 w-4 text-emerald-500" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
