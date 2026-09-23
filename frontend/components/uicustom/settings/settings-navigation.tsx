"use client";

/** @fileOverview One settings navigation model, with a phone drawer and desktop rail. @stability stable */
import { useEffect, useRef, useState } from "react";
import type { IconType } from "react-icons";
import { FiChevronRight, FiMenu } from "react-icons/fi";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

type Section<T extends string> = { id: T; label: string; description: string; icon: IconType };

export function SettingsNavigation<T extends string>({ sections, active, onSelect }: {
  sections: readonly Section<T>[];
  active: T;
  onSelect: (section: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const selected = sections.find(section => section.id === active) ?? sections[0];
  useEffect(() => {
    const desktop = matchMedia('(min-width: 1024px)');
    const closeOnDesktop = () => { if (desktop.matches) setOpen(false); };
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, []);

  const items = sections.map(section => (
    <button key={section.id} type="button" aria-current={active === section.id ? 'page' : undefined}
      onClick={() => { onSelect(section.id); setOpen(false); }}
      className={`flex min-h-14 w-full items-center gap-3 rounded-xl border px-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active === section.id
        ? 'border-emerald-500/50 bg-emerald-500/10 text-foreground'
        : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
      <section.icon aria-hidden="true" className={`size-5 shrink-0 ${active === section.id ? 'text-emerald-500' : ''}`} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{section.label}</span>
        <span className="block text-xs text-muted-foreground">{section.description}</span>
      </span>
      <FiChevronRight aria-hidden="true" className="size-4 shrink-0" />
    </button>
  ));

  return <>
    <aside className="sticky top-4 hidden min-w-0 self-start lg:block">
      <nav aria-label="Settings sections" data-settings-navigation-scroll
        className="max-h-[calc(100dvh-var(--app-header-offset,72px)-var(--demo-notice-height,0px)-2rem)] space-y-1 overflow-y-auto overscroll-contain p-1">
        {items}
      </nav>
    </aside>
    <div className="min-w-0 lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button ref={trigger} type="button" aria-label={`Settings sections: ${selected.label}`}
            className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <selected.icon aria-hidden="true" className="size-5 shrink-0 text-emerald-500" />
            <span className="min-w-0 flex-1 text-sm font-medium">{selected.label}</span>
            <span className="text-xs text-muted-foreground">Change</span>
            <FiMenu aria-hidden="true" className="size-5 shrink-0" />
          </button>
        </SheetTrigger>
        <SheetContent side="left" accessibleTitle="Settings sections"
          accessibleDescription="Choose a settings section. Escape closes this menu."
          onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus({ preventScroll: true }); }}
          className="flex h-dvh w-[min(24rem,100%)] flex-col gap-0 bg-background pt-[env(safe-area-inset-top)]">
          <p aria-hidden="true" className="shrink-0 border-b px-5 py-5 pr-14 font-semibold">Settings</p>
          <nav aria-label="Settings sections" data-settings-navigation-scroll
            className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {items}
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  </>;
}
