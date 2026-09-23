'use client';
/** @fileOverview Persistent, independently scrollable desktop navigation; the existing drawer serves smaller screens. @stability stable */
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from '@/components/ui/navigation-link';
import { getNavigationGroups, isActiveNavigationPath } from './site-navigation';

export default function DesktopNavigation() {
  const pathname = usePathname();
  const { data: session } = useSession();
  if (pathname.startsWith('/auth/') || pathname === '/gate') return null;
  const groups = getNavigationGroups(session?.user);
  return <aside data-desktop-navigation className="hidden w-20 shrink-0 border-r border-border bg-background lg:flex lg:min-h-0 lg:flex-col">
    <nav aria-label="Primary navigation" data-desktop-navigation-scroll className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-2 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      {groups.map(group => <div key={group.label} role="group" aria-label={group.label} className="space-y-1">
        {group.items.map(({ href, label, icon: Icon }) => {
          const active = isActiveNavigationPath(pathname, href);
          return <Link key={href} href={href} aria-current={active ? 'page' : undefined}
            title={label === 'Pulse' || label === 'Trading' ? `${label} — experimental` : label}
            className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-[10px] font-medium leading-tight transition-colors duration-200 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? 'bg-brand-accent/10 text-foreground ring-1 ring-inset ring-brand-accent/30' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
            <Icon aria-hidden="true" className={`size-5 shrink-0 ${active ? 'text-brand-accent' : ''}`} />
            <span>{label}</span>
          </Link>;
        })}
      </div>)}
    </nav>
  </aside>;
}
