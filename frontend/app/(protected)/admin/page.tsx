'use client'

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Image from 'next/image';
import { motion } from "framer-motion";
import { 
  FiUsers, FiBriefcase, FiActivity, FiSettings, FiShield,
  FiMessageSquare, FiAlertTriangle, FiArrowRight, FiCpu,
  FiBarChart2, FiPackage, FiZap, FiClock, FiCheckCircle
} from "react-icons/fi";
import { cn } from "@/lib/utils";

interface PlatformStats {
  platform: { totalUsers: number; totalCompanies: number; totalProducts: number; totalPolls: number };
  ai: {
    todayGenerations: number;
    todayActiveUsers: number;
    pendingReviewCount: number;
    scheduledPollsActive: number;
    topUsersToday: { userId: string; name: string | null; email: string | null; image: string | null; count: number }[];
  };
}

const adminSections = [
  {
    title: "User Management",
    description: "View, edit, and manage all platform users",
    icon: FiUsers,
    href: "/admin/users",
    color: "emerald",
    allowedRoles: ["OWNER", "ADMIN"],
  },
  {
    title: "Company Management",
    description: "Manage companies, employees, and business settings",
    icon: FiBriefcase,
    href: "/admin/companies",
    color: "blue",
    allowedRoles: ["OWNER", "ADMIN"],
  },
  {
    title: "System Updates",
    description: "Post platform updates and changelogs",
    icon: FiMessageSquare,
    href: "/admin/system-updates",
    color: "purple",
    allowedRoles: ["OWNER", "ADMIN"],
  },
  {
    title: "Setup Wizard",
    description: "Initialize system account and first-time setup",
    icon: FiSettings,
    href: "/admin/setup",
    color: "amber",
    allowedRoles: ["OWNER", "ADMIN"],
  },
  {
    title: "Audit Log",
    description: "Track all admin actions for accountability",
    icon: FiActivity,
    href: "/admin/audit-log",
    color: "rose",
    allowedRoles: ["OWNER"],
  },
  {
    title: "AI & Polls",
    description: "Review AI-generated polls, manage scheduled templates",
    icon: FiCpu,
    href: "/admin/polls",
    color: "teal",
    allowedRoles: ["OWNER", "ADMIN"],
  },
  {
    title: "Moderation",
    description: "Review content reports and take moderation actions (DSA)",
    icon: FiAlertTriangle,
    href: "/admin/moderation",
    color: "orange",
    allowedRoles: ["OWNER", "ADMIN"],
  },
];

const colorClasses = {
  emerald: {
    bg: "bg-emerald-500/10 dark:bg-emerald-500/20",
    icon: "text-emerald-600 dark:text-emerald-400",
    border: "hover:border-emerald-500/30",
  },
  blue: {
    bg: "bg-blue-500/10 dark:bg-blue-500/20",
    icon: "text-blue-600 dark:text-blue-400",
    border: "hover:border-blue-500/30",
  },
  purple: {
    bg: "bg-purple-500/10 dark:bg-purple-500/20",
    icon: "text-purple-600 dark:text-purple-400",
    border: "hover:border-purple-500/30",
  },
  amber: {
    bg: "bg-amber-500/10 dark:bg-amber-500/20",
    icon: "text-amber-600 dark:text-amber-400",
    border: "hover:border-amber-500/30",
  },
  rose: {
    bg: "bg-rose-500/10 dark:bg-rose-500/20",
    icon: "text-rose-600 dark:text-rose-400",
    border: "hover:border-rose-500/30",
  },
  teal: {
    bg: "bg-teal-500/10 dark:bg-teal-500/20",
    icon: "text-teal-600 dark:text-teal-400",
    border: "hover:border-teal-500/30",
  },
  orange: {
    bg: "bg-orange-500/10 dark:bg-orange-500/20",
    icon: "text-orange-600 dark:text-orange-400",
    border: "hover:border-orange-500/30",
  },
};

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (status === "loading") return;
    if (!session || (session.user?.role !== "OWNER" && session.user?.role !== "ADMIN")) {
      router.push("/");
    }
  }, [session, status, router]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/stats");
      if (res.ok) {
        setStats(await res.json());
      }
    } catch {
      // silent — dashboard still usable
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session?.user?.role === "OWNER" || session?.user?.role === "ADMIN") {
      fetchStats();
    }
  }, [session, fetchStats]);

  if (status === "loading" || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500" />
      </div>
    );
  }

  const userRole = session.user?.role;
  const filteredSections = adminSections.filter(
    section => section.allowedRoles.includes(userRole || "")
  );

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-12 w-12 rounded-xl bg-linear-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <FiShield className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                Admin Dashboard
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Platform management • Role: {userRole}
              </p>
            </div>
          </div>
          
          {userRole === "OWNER" && (
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm text-amber-600 dark:text-amber-400">
              <FiAlertTriangle className="h-4 w-4" />
              <span>You have full platform access. All actions are logged.</span>
            </div>
          )}
        </div>

        {/* Admin Sections Grid */}
        <div className="grid gap-4 md:grid-cols-2">
          {filteredSections.map((section, index) => {
            const colors = colorClasses[section.color as keyof typeof colorClasses];
            return (
              <motion.div
                key={section.href}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <button
                  onClick={() => router.push(section.href)}
                  className={cn(
                    "w-full text-left p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800",
                    "bg-white dark:bg-zinc-900 transition-all duration-200",
                    "hover:shadow-lg hover:scale-[1.02]",
                    colors.border
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center", colors.bg)}>
                      <section.icon className={cn("h-6 w-6", colors.icon)} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
                        {section.title}
                      </h3>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        {section.description}
                      </p>
                    </div>
                    <FiArrowRight className="h-5 w-5 text-zinc-400 dark:text-zinc-600" />
                  </div>
                </button>
              </motion.div>
            );
          })}
        </div>

        {/* Platform Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-8 p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800"
        >
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
            <FiBarChart2 className="h-5 w-5 text-zinc-400" />
            Platform Overview
          </h2>

          {statsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-20 rounded-xl bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
              ))}
            </div>
          ) : stats ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={FiUsers} label="Users" value={stats.platform.totalUsers} color="emerald" />
              <StatCard icon={FiBriefcase} label="Companies" value={stats.platform.totalCompanies} color="blue" />
              <StatCard icon={FiPackage} label="Products" value={stats.platform.totalProducts} color="purple" />
              <StatCard icon={FiBarChart2} label="Polls" value={stats.platform.totalPolls} color="amber" />
            </div>
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Could not load stats.</p>
          )}
        </motion.div>

        {/* AI & Polls Overview */}
        {stats && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65 }}
            className="mt-4 p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800"
          >
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
              <FiCpu className="h-5 w-5 text-teal-500" />
              AI Generation — Today
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <StatCard icon={FiZap} label="Generations" value={stats.ai.todayGenerations} color="teal" />
              <StatCard icon={FiUsers} label="Active Users" value={stats.ai.todayActiveUsers} color="emerald" />
              <StatCard icon={FiClock} label="Pending Review" value={stats.ai.pendingReviewCount} color="amber" />
              <StatCard icon={FiCheckCircle} label="Sched. Active" value={stats.ai.scheduledPollsActive} color="purple" />
            </div>

            {stats.ai.topUsersToday.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">Top Users Today</h3>
                <div className="space-y-2">
                  {stats.ai.topUsersToday.map((u) => (
                    <div key={u.userId} className="flex items-center gap-3 px-3 py-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg text-sm">
                      {u.image ? (
                        <Image src={u.image} alt="" width={28} height={28} unoptimized className="h-7 w-7 rounded-full object-cover" />
                      ) : (
                        <div className="h-7 w-7 rounded-full bg-zinc-200 dark:bg-zinc-700" />
                      )}
                      <span className="flex-1 text-zinc-700 dark:text-zinc-300 truncate">
                        {u.name ?? u.email ?? u.userId}
                      </span>
                      <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                        {u.count} gen{u.count !== 1 ? "s" : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {stats.ai.pendingReviewCount > 0 && (
              <button
                onClick={() => router.push("/admin/polls")}
                className="mt-4 w-full text-sm font-medium text-center py-2.5 rounded-lg bg-amber-500/10 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 hover:bg-amber-500/20 transition-colors"
              >
                {stats.ai.pendingReviewCount} poll{stats.ai.pendingReviewCount !== 1 ? "s" : ""} awaiting review →
              </button>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}

/* ─── Stat Card ───────────────────────────────────────────────────────────── */

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    emerald: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/20",
    blue: "text-blue-600 dark:text-blue-400 bg-blue-500/10 dark:bg-blue-500/20",
    purple: "text-purple-600 dark:text-purple-400 bg-purple-500/10 dark:bg-purple-500/20",
    amber: "text-amber-600 dark:text-amber-400 bg-amber-500/10 dark:bg-amber-500/20",
    teal: "text-teal-600 dark:text-teal-400 bg-teal-500/10 dark:bg-teal-500/20",
    rose: "text-rose-600 dark:text-rose-400 bg-rose-500/10 dark:bg-rose-500/20",
  };
  const classes = colorMap[color] ?? colorMap.emerald;

  return (
    <div className="flex items-center gap-3 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
      <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", classes)}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{value.toLocaleString()}</p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
      </div>
    </div>
  );
}