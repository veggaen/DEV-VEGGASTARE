'use client'

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { 
  FiUsers, FiBriefcase, FiActivity, FiSettings, FiShield,
  FiMessageSquare, FiAlertTriangle, FiArrowRight
} from "react-icons/fi";
import { cn } from "@/lib/utils";

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
};

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    if (!session || (session.user?.role !== "OWNER" && session.user?.role !== "ADMIN")) {
      router.push("/");
    }
  }, [session, status, router]);

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

        {/* Quick Stats - Placeholder */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-8 p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800"
        >
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
            Platform Overview
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Use the sections above to manage users, companies, and platform settings. 
            All administrative actions are logged in the audit trail for security and accountability.
          </p>
        </motion.div>
      </div>
    </div>
  );
}