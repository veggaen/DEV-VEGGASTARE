"use client"

import { useEffect } from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button, ButtonProps } from "@/components/ui/button"

interface MyThemeBtnProps {
  customName?: ButtonProps['variant'];
  onClick?: () => void;
}

export function MyThemeBtn({ customName, onClick }: MyThemeBtnProps) {
  const { setTheme, theme } = useTheme()

  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-mode');
      document.body.classList.remove('dark-mode');
    } else if (theme === 'dark') {
      document.body.classList.add('dark-mode');
      document.body.classList.remove('light-mode');
    }
  }, [theme]);

  const handleClick = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
    if (onClick) {
      onClick();
    }
  };

  return (
    <Button variant={customName ? customName : 'vegaThemeBtn'} size="icon" onClick={handleClick}>
      <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}