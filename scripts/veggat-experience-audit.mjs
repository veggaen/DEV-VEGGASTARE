#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const withBuild = args.has("--build");
const json = args.has("--json");

const reportDir = path.join(root, "scripts", "_probe", "experience-audit");
const reportPath = path.join(reportDir, "last-report.md");

function run(label, command, commandArgs, cwd = root) {
  const started = Date.now();
  const result = spawnSync(command, commandArgs, {
    cwd,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  return {
    label,
    ok: result.status === 0,
    status: result.status,
    ms: Date.now() - started,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim(),
  };
}

function walk(dir, predicate, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      if (["node_modules", ".next", "generated", ".git"].includes(entry)) continue;
      walk(full, predicate, out);
    } else if (predicate(full)) {
      out.push(full);
    }
  }
  return out;
}

function rel(file) {
  return path.relative(root, file).replaceAll("\\", "/");
}

function scanUiSmells() {
  const files = [
    ...walk(path.join(root, "frontend", "app"), (f) => /\.(tsx|ts|css)$/.test(f)),
    ...walk(path.join(root, "frontend", "components"), (f) => /\.(tsx|ts|css)$/.test(f)),
  ];
  const findings = [];
  const counters = {
    roundedFull: 0,
    genericFailed: 0,
    negativeLayout: 0,
    todo: 0,
    hardHeroOnToolPage: 0,
  };

  for (const file of files) {
    const text = readFileSync(file, "utf8");
    const lines = text.split(/\r?\n/);
    lines.forEach((line, idx) => {
      const at = `${rel(file)}:${idx + 1}`;
      if (line.includes("rounded-full")) counters.roundedFull += 1;
      if (/Failed to (create|load|save|update)/i.test(line)) {
        counters.genericFailed += 1;
        findings.push({ severity: "watch", at, message: "Generic failure copy. Prefer actionable error text with recovery." });
      }
      if (/(marginTop:\s*['"]?-|className=.*\s-\w*t-\d|className=.*\s-\w*b-\d)/.test(line)) {
        counters.negativeLayout += 1;
        findings.push({ severity: "watch", at, message: "Negative layout offset. Confirm this is intentional and not a layout patch." });
      }
      if (/\b(TODO|FIXME|HACK)\b/.test(line)) counters.todo += 1;
      if (/products\/create|ProductCreation|MyProductCreationForm/.test(text) && /\bhero\b/i.test(line)) {
        counters.hardHeroOnToolPage += 1;
      }
    });
  }

  return { counters, findings: findings.slice(0, 40) };
}

const checks = [
  run("Prisma schema validate", "node", ["frontend/node_modules/prisma/build/index.js", "validate", "--schema", "frontend/prisma/schema.prisma"]),
  run("Frontend TypeScript", "node", ["node_modules/typescript/bin/tsc", "--noEmit", "--pretty", "false"], path.join(root, "frontend")),
];

if (withBuild) {
  checks.push(run("Frontend production build (webpack)", "node", ["node_modules/next/dist/bin/next", "build", "--webpack"], path.join(root, "frontend")));
}

const ui = scanUiSmells();

const flowChecklist = [
  {
    name: "Digital image listing",
    route: "/products/create",
    checks: [
      "Upload PNG as product image and digital file.",
      "Publish should either succeed or show exact upload/server reason.",
      "Buyer sees download in /my-downloads after paid order.",
    ],
  },
  {
    name: "Wallet setup",
    route: "/settings?section=wallet",
    checks: [
      "Direct extension path is visible separately from AppKit/Reown.",
      "Connect session does not unlink saved wallet.",
      "Verify/link and remove link are visibly different actions.",
    ],
  },
  {
    name: "Crypto payout routing",
    route: "/products/create step 4",
    checks: [
      "EVM tokens can share a verified EVM receiving wallet.",
      "SOL can use a Solana address without EVM warning noise.",
      "Checkout displays the final receiver before payment.",
    ],
  },
  {
    name: "Voice room settings",
    route: "/conversations/[id]",
    checks: [
      "Settings opens as screen modal, not trapped inside sidebar.",
      "Mic permission prompt is triggered by explicit user action.",
      "Input selector, output selector, and live mic meter all work.",
    ],
  },
];

const summary = {
  ok: checks.every((check) => check.ok),
  generatedAt: new Date().toISOString(),
  checks: checks.map(({ label, ok, status, ms }) => ({ label, ok, status, ms })),
  uiCounters: ui.counters,
  reportPath,
};

const md = [
  "# Veggat Experience Audit",
  "",
  `Generated: ${summary.generatedAt}`,
  "",
  "## Automated Checks",
  "",
  ...checks.map((check) => `- ${check.ok ? "PASS" : "FAIL"} ${check.label} (${Math.round(check.ms / 1000)}s)`),
  "",
  "## UI Smell Counters",
  "",
  ...Object.entries(ui.counters).map(([key, value]) => `- ${key}: ${value}`),
  "",
  "## Watch Findings",
  "",
  ...(ui.findings.length
    ? ui.findings.map((finding) => `- ${finding.severity.toUpperCase()} ${finding.at}: ${finding.message}`)
    : ["- None from static scan."]),
  "",
  "## Human / Playwright Flow Checklist",
  "",
  ...flowChecklist.flatMap((flow) => [
    `### ${flow.name}`,
    `Route: ${flow.route}`,
    "",
    ...flow.checks.map((check) => `- [ ] ${check}`),
    "",
  ]),
  "## Notes",
  "",
  "- Static checks are signals, not verdicts. Screenshot and interaction checks still decide UI quality.",
  "- Run with `--build` before pushing production-facing UI or payment/checkout work.",
  "",
].join("\n");

mkdirSync(reportDir, { recursive: true });
writeFileSync(reportPath, md, "utf8");

if (json) {
  console.log(JSON.stringify(summary, null, 2));
} else {
  console.log(`${summary.ok ? "PASS" : "FAIL"} Veggat experience audit`);
  for (const check of checks) {
    console.log(`${check.ok ? "  PASS" : "  FAIL"} ${check.label}`);
    if (!check.ok && check.output) console.log(check.output.slice(0, 4000));
  }
  console.log(`Report: ${reportPath}`);
}

process.exit(summary.ok ? 0 : 1);
