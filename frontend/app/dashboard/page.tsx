/**
 * @fileOverview  Dashboard overview page — clean flat UI with at-a-glance
 *                stats and quick navigation. No heavy bordered boxes.
 * @stability     stable
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "@/components/ui/navigation-link";
import { dbPrisma } from "@/lib/db";
import {
  FiPackage,
  FiShoppingBag,
  FiMessageSquare,
  FiDollarSign,
  FiTrendingUp,
  FiShield,
  FiHexagon,
  FiArrowRight,
  FiStar,
  FiClock,
  FiZap,
  FiRepeat,
  FiLayers,
  FiBox,
} from "react-icons/fi";

/* ── Quick-link cards ────────────────────────────────────── */
const QUICK_LINKS = [
  {
    href: "/dashboard/trading",
    label: "Trading · experimental",
    description: "P2P, DEX swap, paper trading & crypto inventory",
    icon: FiHexagon,
    accent: "sky",
  },
  {
    href: "/products",
    label: "Products",
    description: "Browse the marketplace — buy, sell, or list new items",
    icon: FiPackage,
    accent: "emerald",
  },
  {
    href: "/my-orders",
    label: "My Orders",
    description: "Track purchases, downloads, and delivery status",
    icon: FiShoppingBag,
    accent: "violet",
  },
  {
    href: "/my-sales",
    label: "My Sales",
    description: "Revenue, payouts, and sales analytics",
    icon: FiDollarSign,
    accent: "amber",
  },
  {
    href: "/nexus",
    label: "Business Hub",
    description: "Company management, employees, and warehouses",
    icon: FiBox,
    accent: "blue",
  },
  {
    href: "/conversations",
    label: "Messages",
    description: "Conversations with sellers, buyers, and support",
    icon: FiMessageSquare,
    accent: "pink",
  },
  {
    href: "/ai",
    label: "AI Chat",
    description: "Use your credit balance or bring your own API key",
    icon: FiZap,
    accent: "rose",
  },
  {
    href: "/settings",
    label: "Settings",
    description: "Profile, security, privacy & connected accounts",
    icon: FiShield,
    accent: "zinc",
  },
] as const;

/* ── Accent color utilities (minimal — no heavy rings/borders) ─── */
const accentText: Record<string, string> = {
  sky: "text-sky-500",
  emerald: "text-emerald-500",
  violet: "text-violet-500",
  amber: "text-amber-500",
  blue: "text-blue-500",
  pink: "text-pink-500",
  rose: "text-rose-500",
  zinc: "text-zinc-400",
};

const accentBg: Record<string, string> = {
  sky: "bg-sky-500/8",
  emerald: "bg-emerald-500/8",
  violet: "bg-violet-500/8",
  amber: "bg-amber-500/8",
  blue: "bg-blue-500/8",
  pink: "bg-pink-500/8",
  rose: "bg-rose-500/8",
  zinc: "bg-zinc-500/8",
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");
  const user = session.user;
  const firstName = user.name?.split(" ")[0] ?? "there";

  // ── Fetch real stats ─────────────────────────────────────
  const [productCount, orderCount, dbUser] = await Promise.all([
    dbPrisma.product.count({ where: { userId: user.id! } }).catch(() => 0),
    dbPrisma.order.count({ where: { userId: user.id! } }).catch(() => 0),
    dbPrisma.user
      .findUnique({
        where: { id: user.id! },
        select: { createdAt: true },
      })
      .catch(() => null),
  ]);

  const memberSince = dbUser?.createdAt
    ? dbUser.createdAt.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      })
    : "—";

  return (
    <div className="w-full min-w-0 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* ── Welcome ──────────────────────────────────────── */}
      <section className="mb-12">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
          Welcome back, {firstName}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Here&apos;s an overview of your account and quick links to everything
          you need.
        </p>
      </section>

      {/* ── Stat Highlights — flat, no bordered boxes ───── */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8 mb-14">
        <StatCard
          icon={FiPackage}
          label="Products Listed"
          value={productCount.toString()}
          accent="emerald"
        />
        <StatCard
          icon={FiShoppingBag}
          label="My Orders"
          value={orderCount.toString()}
          accent="sky"
        />
        <StatCard
          icon={FiRepeat}
          label="DEX · experimental"
          value="—"
          accent="violet"
        />
        <StatCard
          icon={FiClock}
          label="Member Since"
          value={memberSince}
          accent="amber"
        />
      </section>

      {/* ── Quick Links — clean open cards ─────────────── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-5">
          Quick Access
        </h2>
        <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_LINKS.map((link) => {
            const txt = accentText[link.accent] ?? "text-zinc-400";
            const bg = accentBg[link.accent] ?? "bg-zinc-500/8";
            return (
              <Link
                key={link.href}
                href={link.href}
                className="group flex min-w-0 items-start gap-3.5 px-4 py-3.5 rounded-lg transition-colors duration-200 motion-reduce:transition-none hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div
                  className={`shrink-0 flex items-center justify-center w-9 h-9 rounded-lg ${bg}`}
                >
                  <link.icon className={`h-4.5 w-4.5 ${txt}`} />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {link.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    {link.description}
                  </p>
                </div>
                <FiArrowRight aria-hidden="true" className="shrink-0 h-3.5 w-3.5 text-muted-foreground mt-1" />
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/* ── Stat Card — flat, borderless ──────────────────────── */
function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent: string;
}) {
  const txt = accentText[accent] ?? "text-zinc-400";
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Icon className={`h-3.5 w-3.5 ${txt}`} />
        <span className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
          {label}
        </span>
      </div>
      <span className={`text-2xl font-bold ${txt} tabular-nums`}>
        {value}
      </span>
    </div>
  );
}
