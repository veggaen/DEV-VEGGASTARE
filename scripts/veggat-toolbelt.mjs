#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const args = process.argv.slice(2);
const json = args.includes("--json");
const problemArg = args.find((arg) => arg.startsWith("--problem="));
const problem = (problemArg?.slice("--problem=".length) ?? args.filter((arg) => !arg.startsWith("--")).join(" ")).trim();

const reportDir = path.join(root, "scripts", "_probe", "toolbelt");
const reportPath = path.join(reportDir, "last-report.md");

function run(command, commandArgs, cwd = root) {
  const result = spawnSync(command, commandArgs, {
    cwd,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  return {
    ok: result.status === 0,
    status: result.status,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim(),
  };
}

function readJson(file) {
  if (!existsSync(file)) return {};
  return JSON.parse(readFileSync(file, "utf8"));
}

function hasPackage(pkg, name) {
  return Boolean(pkg.dependencies?.[name] || pkg.devDependencies?.[name] || pkg.overrides?.[name]);
}

function hasCommand(command, commandArgs = ["--version"]) {
  const result = run(command, commandArgs);
  return result.ok;
}

const rootPkg = readJson(path.join(root, "package.json"));
const frontendPkg = readJson(path.join(root, "frontend", "package.json"));

const capabilities = [
  {
    domain: "Visual UX",
    tool: "Playwright",
    installed: hasPackage(frontendPkg, "@playwright/test") && existsSync(path.join(root, "frontend", "playwright.config.ts")),
    run: "cd frontend; npm run test:e2e",
    bestFor: "screenshots, route flows, hover/click bugs, cart/checkout journeys, browser console errors",
    nextUpgrade: "Add route-specific visual snapshots for /products, /products/create, /settings, checkout, and voice settings.",
  },
  {
    domain: "Accessibility",
    tool: "@axe-core/playwright",
    installed: hasPackage(frontendPkg, "@axe-core/playwright"),
    run: "cd frontend; npx playwright test e2e/accessibility.spec.ts",
    bestFor: "labels, contrast, duplicate IDs, ARIA regressions, keyboard-trap checks",
    nextUpgrade: "Install @axe-core/playwright and add WCAG A/AA scans to the Playwright UX project.",
  },
  {
    domain: "Performance",
    tool: "Lighthouse CI",
    installed: hasPackage(rootPkg, "@lhci/cli") || hasPackage(frontendPkg, "@lhci/cli") || existsSync(path.join(root, ".lighthouserc.cjs")),
    run: "npx lhci autorun",
    bestFor: "performance budgets, accessibility score, SEO, best-practice drift",
    nextUpgrade: "Add .lighthouserc.cjs with budgets for marketplace, product creation, checkout, and settings.",
  },
  {
    domain: "Static Security",
    tool: "CodeQL",
    installed: existsSync(path.join(root, ".github", "workflows", "codeql.yml")),
    run: "GitHub Actions: .github/workflows/codeql.yml",
    bestFor: "repository-level JavaScript/TypeScript data-flow vulnerability scanning",
    nextUpgrade: "Treat high-risk upload, checkout, wallet, auth, and webhook changes as CodeQL review triggers.",
  },
  {
    domain: "Static Security",
    tool: "Semgrep",
    installed: hasCommand("semgrep"),
    run: "semgrep scan --config auto",
    bestFor: "fast local SAST, custom project rules, dangerous patterns before CI",
    nextUpgrade: "Add a small ruleset for unsafe downloads, untrusted redirects, auth bypasses, and payment webhook mistakes.",
  },
  {
    domain: "Dependency Risk",
    tool: "npm audit",
    installed: existsSync(path.join(root, "package-lock.json")),
    run: "npm audit --workspaces --omit=dev",
    bestFor: "known dependency vulnerabilities and vulnerable transitive packages",
    nextUpgrade: "Pair with Dependabot triage and only auto-fix after tests/build pass.",
  },
  {
    domain: "Database Contract",
    tool: "Prisma",
    installed: hasPackage(frontendPkg, "prisma") && existsSync(path.join(root, "frontend", "prisma", "schema.prisma")),
    run: "node frontend/node_modules/prisma/build/index.js validate --schema frontend/prisma/schema.prisma",
    bestFor: "schema drift, migrations, payout/delivery/order data ownership",
    nextUpgrade: "Add product delivery and wallet-routing invariants as database-level constraints where possible.",
  },
  {
    domain: "Unit/Logic",
    tool: "Vitest",
    installed: hasPackage(frontendPkg, "vitest"),
    run: "cd frontend; node ../node_modules/vitest/vitest.mjs run",
    bestFor: "currency conversion, wallet routing, order state machines, delivery-token logic",
    nextUpgrade: "Add focused tests for currency display, crypto receiver selection, and EdgeStore upload type mapping.",
  },
  {
    domain: "Observability",
    tool: "Vercel Analytics and Speed Insights",
    installed: hasPackage(frontendPkg, "@vercel/analytics") && hasPackage(frontendPkg, "@vercel/speed-insights"),
    run: "Production dashboard",
    bestFor: "real user performance signals and production traffic behavior",
    nextUpgrade: "Add structured event names for create listing, checkout, wallet link, mic permission, and digital download.",
  },
  {
    domain: "Observability",
    tool: "Sentry",
    installed: hasPackage(frontendPkg, "@sentry/nextjs"),
    run: "npx @sentry/wizard@latest -i nextjs",
    bestFor: "runtime errors, session replay, traces, release health, agent debugging evidence",
    nextUpgrade: "Install when DSN/project exists; scrub wallet/email/payment PII before enabling replay.",
  },
  {
    domain: "Voice",
    tool: "LiveKit",
    installed: hasPackage(frontendPkg, "livekit-client") && hasPackage(frontendPkg, "livekit-server-sdk"),
    run: "Route-level browser permission test with fake media devices",
    bestFor: "spaces/lobbies, participant tracks, mic device switching, tokenized room auth",
    nextUpgrade: "Add a Playwright voice harness using fake media streams and explicit permission prompts.",
  },
  {
    domain: "File Safety",
    tool: "Upload allowlist and future malware scanner",
    installed: existsSync(path.join(root, "frontend", "app", "api", "edgestore", "[...edgestore]", "route.ts")),
    run: "npm run audit:experience",
    bestFor: "digital file allowlists, exact upload errors, safer download delivery",
    nextUpgrade: "Add quarantine + checksum + signed download URL checks; integrate ClamAV/VirusTotal only at the server edge.",
  },
  {
    domain: "Agent Memory",
    tool: "Veggat Experience Audit",
    installed: existsSync(path.join(root, "scripts", "veggat-experience-audit.mjs")),
    run: "npm run audit:experience:build",
    bestFor: "repeatable agent handoff, UI smell counts, build-backed confidence before main",
    nextUpgrade: "Feed Playwright screenshots and console logs into the report.",
  },
];

const problemRules = [
  { match: /paypal|checkout|payment|order|buy/i, tools: ["Playwright", "Vitest", "CodeQL", "Sentry"], reason: "Payments need browser proof, state-machine tests, security review, and runtime evidence." },
  { match: /wallet|metamask|solana|evm|crypto|receiver|address/i, tools: ["Vitest", "Playwright", "CodeQL"], reason: "Wallet bugs need deterministic receiver logic plus real browser session checks." },
  { match: /voice|mic|microphone|speaker|livekit|lobby|spaces/i, tools: ["LiveKit", "Playwright", "Sentry"], reason: "Voice failures depend on browser permissions, media devices, and track/runtime errors." },
  { match: /upload|digital|download|file|image|edgestore/i, tools: ["Upload allowlist and future malware scanner", "Vitest", "CodeQL"], reason: "Digital delivery is a trust boundary: type validation, signed delivery, and abuse safety matter." },
  { match: /ui|ux|animation|card|layout|hover|responsive|modal/i, tools: ["Playwright", "@axe-core/playwright", "Lighthouse CI"], reason: "UX quality needs screenshots, interaction traces, accessibility, and performance budgets." },
  { match: /slow|performance|lcp|cls|bundle/i, tools: ["Lighthouse CI", "Vercel Analytics and Speed Insights", "Playwright"], reason: "Performance needs lab budgets plus real-user telemetry." },
  { match: /security|auth|secret|vulnerability|xss|csrf/i, tools: ["CodeQL", "Semgrep", "npm audit"], reason: "Security needs data-flow scanning, custom local rules, and dependency risk checks." },
];

function predict(problemText) {
  if (!problemText) {
    return {
      label: "General Veggat upgrade",
      reason: "Run the core loop first, then pick a domain-specific tool when a failure appears.",
      tools: ["Veggat Experience Audit", "Playwright", "Prisma", "Vitest"],
    };
  }
  const hit = problemRules.find((rule) => rule.match.test(problemText));
  return hit
    ? { label: problemText, reason: hit.reason, tools: hit.tools }
    : {
        label: problemText,
        reason: "No exact rule matched. Start with audit + search + type/build checks, then promote a new rule after the first repeated failure.",
        tools: ["Veggat Experience Audit", "Playwright", "Vitest"],
      };
}

const recommendation = predict(problem);
const byName = new Map(capabilities.map((capability) => [capability.tool, capability]));
const missing = capabilities.filter((capability) => !capability.installed);
const installed = capabilities.filter((capability) => capability.installed);

const md = [
  "# Veggat Toolbelt Report",
  "",
  `Generated: ${new Date().toISOString()}`,
  "",
  "## Predicted Next Tools",
  "",
  `Problem: ${recommendation.label}`,
  `Reason: ${recommendation.reason}`,
  "",
  ...recommendation.tools.map((tool) => {
    const capability = byName.get(tool);
    if (!capability) return `- ${tool}: not registered yet. Add it if this problem repeats.`;
    return `- ${capability.installed ? "READY" : "MISSING"} ${tool}: ${capability.bestFor}. Command: \`${capability.run}\``;
  }),
  "",
  "## Installed Capabilities",
  "",
  ...installed.map((capability) => `- ${capability.domain}: ${capability.tool} - ${capability.bestFor}.`),
  "",
  "## Missing / Optional Upgrades",
  "",
  ...missing.map((capability) => `- ${capability.domain}: ${capability.tool} - ${capability.nextUpgrade}`),
  "",
  "## Tool Creation Rule",
  "",
  "When a tool run fails or gives weak evidence, do not just retry. Add one of:",
  "- a smaller reproducer",
  "- a better parser for the failure output",
  "- a screenshot or trace capture",
  "- a fixture or fake provider",
  "- a domain-specific invariant test",
  "- a report section agents can read next time",
  "",
].join("\n");

mkdirSync(reportDir, { recursive: true });
writeFileSync(reportPath, md, "utf8");

const summary = {
  problem: recommendation.label,
  reportPath,
  predictedTools: recommendation.tools,
  installed: installed.map((capability) => capability.tool),
  missing: missing.map((capability) => capability.tool),
};

if (json) {
  console.log(JSON.stringify(summary, null, 2));
} else {
  console.log("Veggat toolbelt");
  console.log(`Problem: ${summary.problem}`);
  console.log(`Predicted: ${summary.predictedTools.join(", ")}`);
  console.log(`Ready: ${summary.installed.length}/${capabilities.length}`);
  console.log(`Report: ${reportPath}`);
}
