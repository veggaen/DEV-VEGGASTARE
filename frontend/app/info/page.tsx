"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";

const AVATAR_URL = "https://avatars.githubusercontent.com/veggaen";

export default function InfoPage() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="relative min-h-[calc(100vh-var(--app-header-offset,0px))] overflow-x-hidden">
      {/* background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-background/25 via-background/10 to-background/0 dark:from-black/25 dark:via-black/10 dark:to-black/0" />
        <motion.div
          className="absolute -right-12 top-20 h-[560px] w-[560px] rounded-full blur-3xl"
          animate={reduceMotion ? undefined : { x: [0, -14, 0], y: [0, 10, 0], opacity: [0.14, 0.24, 0.14], scale: [1, 1.06, 1] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          style={{
            background:
              "radial-gradient(closest-side, rgba(34,197,94,0.20), rgba(56,189,248,0.10), rgba(34,197,94,0) 72%)",
            mixBlendMode: "screen",
          }}
        />
        <motion.div
          className="absolute -left-16 bottom-10 h-[620px] w-[620px] rounded-full blur-3xl"
          animate={reduceMotion ? undefined : { x: [0, 18, 0], y: [0, -12, 0], opacity: [0.10, 0.20, 0.10], scale: [1, 1.04, 1] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          style={{
            background:
              "radial-gradient(closest-side, rgba(167,139,250,0.12), rgba(236,72,153,0.10), rgba(56,189,248,0) 74%)",
            mixBlendMode: "screen",
          }}
        />
      </div>

      <div className="relative mx-auto w-full max-w-7xl px-6 py-10 lg:py-12">
        <motion.div
          initial={reduceMotion ? undefined : { opacity: 0, y: 14 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          <div className="grid grid-cols-1 gap-10 2xl:grid-cols-[320px_minmax(0,1fr)_260px]">
            <header className="space-y-3 2xl:col-start-2 2xl:col-span-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-semibold text-muted-foreground">
                <motion.span
                  className="h-2 w-2 rounded-full bg-emerald-400"
                  aria-hidden
                  animate={reduceMotion ? undefined : { opacity: [0.55, 1, 0.55] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                />
                <span>Info / Contact</span>
              </div>
              <h1 className="text-balance text-4xl font-semibold text-foreground sm:text-5xl">
                Building a marketplace that feels alive.
              </h1>
              <p className="max-w-3xl text-pretty text-sm text-muted-foreground sm:text-base">
                VeggaStare is my playground for fast UI motion, realtime signals, and practical marketplace workflows. I’m
                iterating in public: shipping small, learning quickly, and steadily turning the rough edges into a system that
                feels effortless.
              </p>
            </header>

            <motion.aside
              initial={reduceMotion ? undefined : { opacity: 0, y: 10 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: "easeOut", delay: 0.05 }}
              className="2xl:row-start-1 2xl:row-span-2 2xl:col-start-1"
            >
              <div className="flex items-center gap-5 sm:gap-6 2xl:flex-col 2xl:items-start">
                <motion.div
                  className="relative shrink-0"
                  initial={"rest"}
                  animate={"rest"}
                  whileHover={reduceMotion ? undefined : "hover"}
                  variants={
                    reduceMotion
                      ? undefined
                      : {
                          rest: { scale: 1, rotate: 0 },
                          hover: { scale: 1.06, rotate: -1.5 },
                        }
                  }
                  transition={{ type: "spring", stiffness: 420, damping: 22 }}
                >
                  {/* Soft aura glow */}
                  <motion.div
                    aria-hidden
                    className="absolute -inset-3 rounded-full blur-xl"
                    style={{
                      background:
                        "conic-gradient(from 180deg, rgba(34,197,94,0.22), rgba(56,189,248,0.18), rgba(236,72,153,0.14), rgba(34,197,94,0.22))",
                    }}
                    animate={
                      reduceMotion
                        ? undefined
                        : {
                            rotate: 360,
                            opacity: [0.55, 0.85, 0.55],
                            filter: [
                              "blur(18px) saturate(1.05)",
                              "blur(24px) saturate(1.25)",
                              "blur(18px) saturate(1.05)",
                            ],
                          }
                    }
                    transition={{ duration: 16, repeat: Infinity, ease: "linear" }}
                    variants={
                      reduceMotion
                        ? undefined
                        : {
                            rest: { scale: 1, opacity: 0.55 },
                            hover: { scale: 1.18, opacity: 1 },
                          }
                    }
                  />

                  {/* Dense edge ring glow (masked so it hugs the border) */}
                  <motion.div
                    aria-hidden
                    className="absolute -inset-2 rounded-full pointer-events-none"
                    style={{
                      background:
                        "conic-gradient(from 90deg, rgba(34,197,94,0.65), rgba(56,189,248,0.65), rgba(236,72,153,0.48), rgba(34,197,94,0.65))",
                      WebkitMaskImage:
                        "radial-gradient(farthest-side, transparent calc(100% - 10px), #000 calc(100% - 8px), #000 100%)",
                      maskImage:
                        "radial-gradient(farthest-side, transparent calc(100% - 10px), #000 calc(100% - 8px), #000 100%)",
                    }}
                    variants={
                      reduceMotion
                        ? undefined
                        : {
                            rest: { opacity: 0, filter: "blur(0px) saturate(1)" },
                            hover: { opacity: 1, filter: "blur(0.7px) saturate(1.5)" },
                          }
                    }
                    transition={{ duration: 0.22, ease: "easeOut" }}
                  />

                  {/* Tight border glow */}
                  <motion.div
                    aria-hidden
                    className="absolute -inset-1 rounded-full"
                    variants={
                      reduceMotion
                        ? undefined
                        : {
                            rest: { opacity: 0, boxShadow: "0 0 0 rgba(0,0,0,0)" },
                            hover: {
                              opacity: 1,
                              boxShadow:
                                "inset 0 0 0 1.5px rgba(255,255,255,0.14), 0 0 0 1px rgba(56,189,248,0.26), 0 0 28px rgba(56,189,248,0.55), 0 0 48px rgba(34,197,94,0.38), 0 0 36px rgba(236,72,153,0.26)",
                            },
                          }
                    }
                    transition={{ duration: 0.25, ease: "easeOut" }}
                  />
                  <Image
                    src={AVATAR_URL}
                    alt="Veggaen profile image"
                    width={180}
                    height={180}
                    className="relative h-[96px] w-[96px] rounded-full border border-border object-cover sm:h-[120px] sm:w-[120px] 2xl:h-[160px] 2xl:w-[160px]"
                    priority
                  />
                </motion.div>

                <div className="min-w-0">
                  <div className="text-lg font-semibold text-foreground">Veggaen</div>
                  <div className="mt-0.5 text-sm text-muted-foreground">
                    Builder · motion-first UI · backend systems · crypto tooling
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                    <Link
                      href="https://github.com/veggaen"
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-medium text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground hover:decoration-foreground/40"
                    >
                      GitHub
                    </Link>
                    <span className="text-sm text-muted-foreground/60">Email (add later)</span>
                  </div>
                </div>
              </div>

              <div className="mt-7 hidden 2xl:block border-t border-border pt-5">
                <div className="text-xs font-semibold tracking-wide text-muted-foreground">Now</div>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <li className="flex gap-2">
                    <span aria-hidden className="mt-[0.55rem] h-1.5 w-1.5 rounded-full bg-foreground/25" />
                    <span>Polishing marketplace UX, search, and filtering.</span>
                  </li>
                  <li className="flex gap-2">
                    <span aria-hidden className="mt-[0.55rem] h-1.5 w-1.5 rounded-full bg-foreground/25" />
                    <span>Realtime “Pulse” as signal, not noise.</span>
                  </li>
                  <li className="flex gap-2">
                    <span aria-hidden className="mt-[0.55rem] h-1.5 w-1.5 rounded-full bg-foreground/25" />
                    <span>Wallet UX + network-aware pricing.</span>
                  </li>
                </ul>
              </div>
            </motion.aside>

            <div className="space-y-8 2xl:col-start-2">
              <motion.section
                initial={reduceMotion ? undefined : { opacity: 0, y: 10 }}
                animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: "easeOut", delay: 0.08 }}
                className="border-t border-border pt-5"
              >
                <h2 className="text-sm font-semibold tracking-wide text-foreground/90">What this is</h2>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  A modern marketplace where the boring parts are solid (search, inventory, checkout), and the interface feels
                  responsive, expressive, and calm — even when the data is moving.
                </p>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                  I’m building it with a systems mindset: permissions and roles that make sense, realtime updates that scale,
                  and UI motion that helps you understand state instead of distracting you.
                </p>
              </motion.section>

              <motion.section
                initial={reduceMotion ? undefined : { opacity: 0, y: 10 }}
                animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: "easeOut", delay: 0.12 }}
                className="border-t border-white/10 pt-5"
              >
                <h2 className="text-sm font-semibold tracking-wide text-white/90">What’s next</h2>
                <ul className="mt-3 grid grid-cols-1 gap-x-10 gap-y-2 text-sm text-white/70 sm:grid-cols-2">
                  {[
                    "Production hardening: stability, performance, and fewer sharp edges.",
                    "Pulse: a high-signal realtime stream with good filtering.",
                    "Cleaner onboarding and role/permission flows for teams.",
                    "Warehouse tooling: inventory ops, config, and an admin experience that stays fast.",
                    "Design system polish: spacing, motion, and touch-friendly patterns.",
                    "More user control: what gets emphasized, what stays quiet.",
                  ].map((item) => (
                    <li key={item} className="flex gap-2">
                      <span aria-hidden className="mt-[0.55rem] h-1.5 w-1.5 flex-none rounded-full bg-white/25" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </motion.section>

              <motion.section
                initial={reduceMotion ? undefined : { opacity: 0, y: 10 }}
                animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: "easeOut", delay: 0.16 }}
                className="border-t border-border pt-5"
              >
                <h2 className="text-sm font-semibold tracking-wide text-foreground/90">How I build</h2>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Ship small changes, validate with real usage, then refine. I care about performance, accessibility, and
                  consistent interaction patterns so the product stays coherent as it grows.
                </p>
              </motion.section>

              <motion.section
                initial={reduceMotion ? undefined : { opacity: 0, y: 10 }}
                animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: "easeOut", delay: 0.2 }}
                className="border-t border-border pt-5"
              >
                <h2 className="text-sm font-semibold tracking-wide text-foreground/90">Contact</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Want to collaborate, report a bug, or suggest a feature? The fastest path right now is GitHub.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href="/products"
                    className="rounded-xl bg-muted/50 dark:bg-white/5 px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted dark:hover:bg-white/10 hover:text-foreground"
                  >
                    Explore marketplace
                  </Link>
                  <Link
                    href="/"
                    className="rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground/60 transition-colors hover:bg-muted/50 dark:hover:bg-white/5 hover:text-foreground"
                  >
                    Back home
                  </Link>
                </div>
              </motion.section>
            </div>

            <motion.aside
              initial={reduceMotion ? undefined : { opacity: 0, y: 10 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: "easeOut", delay: 0.1 }}
              className="hidden space-y-8 2xl:block 2xl:col-start-3"
            >
              <div className="border-t border-border pt-5">
                <div className="text-xs font-semibold tracking-wide text-muted-foreground">Focus</div>
                <div className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Motion as feedback, not decoration. Realtime where it matters. Clear roles and data that stays correct.
                </div>
              </div>
              <div className="border-t border-border pt-5">
                <div className="text-xs font-semibold tracking-wide text-muted-foreground">Stack</div>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <li className="flex gap-2">
                    <span aria-hidden className="mt-[0.55rem] h-1.5 w-1.5 rounded-full bg-foreground/25" />
                    <span>Next.js App Router + Tailwind</span>
                  </li>
                  <li className="flex gap-2">
                    <span aria-hidden className="mt-[0.55rem] h-1.5 w-1.5 rounded-full bg-foreground/25" />
                    <span>Prisma + realtime primitives</span>
                  </li>
                  <li className="flex gap-2">
                    <span aria-hidden className="mt-[0.55rem] h-1.5 w-1.5 rounded-full bg-foreground/25" />
                    <span>wagmi + wallet UX polish</span>
                  </li>
                </ul>
              </div>
            </motion.aside>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
