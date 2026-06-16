"use client";

/**
 * Register page — split-screen hero shell that mirrors /auth/login so sign-up
 * is a first-class, polished flow (it used to be a bare card).
 */
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { useTheme } from "next-themes";
import { FiSun, FiMoon, FiZap, FiUsers, FiShield, FiArrowLeft } from "react-icons/fi";
import { MyRegisterform } from "@/components/uicustom/auth/forms/register-form";

const HIGHLIGHTS = [
  { icon: FiZap, text: "Pulse out — let the world feel your beat" },
  { icon: FiUsers, text: "Build reach: every verified link lifts your tier" },
  { icon: FiShield, text: "Your rhythm. Your data. Your control." },
];

export default function RegisterPage() {
  const reduceMotion = useReducedMotion();
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <div className="min-h-[calc(100vh-80px)] flex bg-white dark:bg-black">
      {/* Theme toggle */}
      <button
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        className="fixed top-4 right-4 z-50 p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
        aria-label="Toggle theme"
      >
        {resolvedTheme === "dark" ? (
          <FiSun className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
        ) : (
          <FiMoon className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
        )}
      </button>

      {/* Left — brand / hero */}
      <motion.div
        initial={reduceMotion ? undefined : { opacity: 0, x: -20 }}
        animate={reduceMotion ? undefined : { opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-zinc-900 dark:bg-zinc-950" />
        {/* Soft brand glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -left-32 top-1/3 h-115 w-115 rounded-full blur-3xl opacity-40"
          style={{ background: "radial-gradient(closest-side, rgba(16,185,129,0.45), transparent)" }}
        />
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20">
          <motion.div
            initial={reduceMotion ? undefined : { opacity: 0, y: 20 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <h1 className="text-4xl xl:text-5xl font-bold text-white mb-6 leading-tight">
              Join the Vibe —<br />
              <span className="text-zinc-300">start your rhythm</span>
            </h1>
            <p className="text-zinc-400 text-lg mb-12 max-w-md">
              Create your account to pulse, vote, trade, and build reach in the community.
            </p>
          </motion.div>

          <motion.div
            className="space-y-4"
            initial={reduceMotion ? undefined : { opacity: 0, y: 20 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
          >
            {HIGHLIGHTS.map((f, i) => (
              <div key={i} className="flex items-center gap-3 text-white">
                <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center">
                  <f.icon className="w-5 h-5" />
                </div>
                <span className="text-sm font-medium text-zinc-300">{f.text}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </motion.div>

      {/* Right — register form */}
      <motion.div
        initial={reduceMotion ? undefined : { opacity: 0, x: 20 }}
        animate={reduceMotion ? undefined : { opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full lg:w-1/2 flex items-center justify-center px-6 sm:px-12 py-12"
      >
        <div className="w-full max-w-md">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors mb-8"
          >
            <FiArrowLeft className="w-4 h-4" /> Back home
          </Link>

          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-2">Create your account</h2>
            <p className="text-zinc-500 dark:text-zinc-400">
              Already have an account?{" "}
              <Link href="/auth/login" className="text-zinc-900 dark:text-white hover:underline font-medium transition-colors">
                Sign in
              </Link>
            </p>
          </div>

          <MyRegisterform />
        </div>
      </motion.div>
    </div>
  );
}
