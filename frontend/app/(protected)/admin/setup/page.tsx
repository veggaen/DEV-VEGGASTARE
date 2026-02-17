"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { FiZap, FiShield, FiCheck, FiAlertCircle, FiLoader, FiDatabase } from "react-icons/fi";
import { cn } from "@/lib/utils";

export default function AdminSetupPage() {
  const { data: session } = useSession();
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    conversationId?: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const isOwner = session?.user?.role === "OWNER";
  const isAdmin = session?.user?.role === "ADMIN" || isOwner;

  const initializeSystem = async () => {
    setIsLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/system/initialize", { method: "POST" });
      const data = await res.json();
      setResult({
        success: res.ok,
        message: data.message || data.error,
        conversationId: data.conversationId,
      });
    } catch {
      setResult({ success: false, message: "Network error" });
    }
    setIsLoading(false);
  };

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <FiAlertCircle className="w-16 h-16 text-amber-500 mb-4" />
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
          Login Required
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400">
          Please login to access admin setup.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
          <FiShield className="text-emerald-500" />
          Admin Setup
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-2">
          One-time setup for the VeggaSystem account and notifications.
        </p>
      </div>

      {/* Current Status */}
      <div className="mb-8 p-4 rounded-lg bg-zinc-100 dark:bg-zinc-800/50">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          <strong>Logged in as:</strong> {session.user?.name || session.user?.email}
        </p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          <strong>Current role:</strong>{" "}
          <span className={cn(
            "font-medium",
            isOwner ? "text-emerald-600 dark:text-emerald-400" : 
            isAdmin ? "text-blue-600 dark:text-blue-400" : 
            "text-zinc-500"
          )}>
            {session.user?.role || "USER"}
          </span>
        </p>
      </div>

      {/* Step 1: Manual Database Setup */}
      {!isAdmin && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 rounded-xl border-2 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/20 mb-6"
        >
          <div className="flex items-start gap-4">
            <FiDatabase className="w-8 h-8 text-amber-500 mt-1" />
            <div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Step 1: Set Your Role in Database
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">
                Go to your <strong>Neon Console</strong> and run this SQL:
              </p>
              <pre className="mt-3 p-3 rounded-lg bg-zinc-900 text-emerald-400 text-sm overflow-x-auto">
{`UPDATE "User" 
SET role = 'OWNER' 
WHERE email = '${session.user?.email || "your@email.com"}';`}
              </pre>
              <p className="text-xs text-zinc-500 mt-2">
                Then refresh this page to continue.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Step 2: Initialize System */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className={cn(
          "p-6 rounded-xl border-2 transition-colors",
          result?.success
            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20"
            : isAdmin
            ? "border-zinc-200 dark:border-zinc-700"
            : "border-zinc-200 dark:border-zinc-800 opacity-50"
        )}
      >
        <div className="flex items-start gap-4">
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold",
            result?.success
              ? "bg-emerald-500 text-white"
              : isAdmin
              ? "bg-emerald-500 text-white"
              : "bg-zinc-200 dark:bg-zinc-700 text-zinc-500"
          )}>
            {result?.success ? <FiCheck /> : isAdmin ? "✓" : "2"}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {isAdmin ? "Initialize VeggaSystem" : "Step 2: Initialize VeggaSystem"}
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Creates the system account and posts the inaugural update.
              All users will be notified!
            </p>
            
            {result && (
              <div className={cn(
                "mt-3 p-3 rounded-lg text-sm",
                result.success
                  ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                  : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
              )}>
                {result.message}
                {result.conversationId && (
                  <a
                    href={`/feed/${result.conversationId}`}
                    className="block mt-2 underline hover:no-underline"
                  >
                    View the inaugural pulse →
                  </a>
                )}
              </div>
            )}
            
            {isAdmin && !result?.success && (
              <button
                onClick={initializeSystem}
                disabled={isLoading}
                className={cn(
                  "mt-4 px-4 py-2 rounded-lg",
                  "bg-emerald-500 hover:bg-emerald-600 text-white",
                  "flex items-center gap-2",
                  "disabled:opacity-50"
                )}
              >
                {isLoading ? <FiLoader className="animate-spin" /> : <FiZap />}
                Initialize VeggaSystem
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Success */}
      {result?.success && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-6 p-6 rounded-xl bg-linear-to-r from-emerald-500 to-teal-500 text-white text-center"
        >
          <h3 className="text-xl font-bold mb-2">🎉 Setup Complete!</h3>
          <p className="opacity-90">
            VeggaSystem is live. Post updates at{" "}
            <a href="/admin/system-updates" className="underline hover:no-underline">
              /admin/system-updates
            </a>
          </p>
        </motion.div>
      )}
    </div>
  );
}
