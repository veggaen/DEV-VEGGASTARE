#!/usr/bin/env python
"""
driver.py — the agent-facing harness for driving the Veggat web app.

Attaches over CDP to the debug Chrome launched by scripts/open_app_browser.py
(NEVER launches its own browser — that profile is already logged in and primed),
clears the access gate automatically, navigates to a route, optionally runs a
small action, and writes a screenshot. This is how a future agent (or human)
"clicks the button" in this app from a headless/CI-less shell.

WHY THIS EXISTS over chromium-cli: chromium-cli is not installed here, and the
project already drives Chrome via Playwright-over-CDP against a persistent,
logged-in debug profile (so Google OAuth + the access gate are already handled).
This script generalizes the existing scripts/shot_*.py one-offs.

PREREQUISITES (run once per machine session):
  1. Dev server:    cd frontend && npm run dev        (serves http://localhost:3000)
  2. Debug Chrome:  python scripts/open_app_browser.py (opens Chrome w/ CDP :9222)
     Leave that Chrome window OPEN. Log in once if not already.

USAGE:
  python .claude/skills/run-veggat/driver.py --route /ai
  python .claude/skills/run-veggat/driver.py --route /pulse --name pulse
  python .claude/skills/run-veggat/driver.py --route /ai --click "text=New chat" --name newchat

Screenshots land in scripts/_probe/run-veggat/<name>.png and the script prints
the resolved URL/title/theme so you can confirm you reached the real page (not
the gate, not an error).
"""
from __future__ import annotations
import argparse
import os
import sys
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

# IMPORTANT: 127.0.0.1, NOT localhost. On Windows "localhost" resolves to IPv6
# ::1 first and Chrome's CDP listens on IPv4 only → connect_over_cdp refuses.
CDP = "http://127.0.0.1:9222"
BASE = "http://localhost:3000"
REPO = Path(__file__).resolve().parents[3]  # .claude/skills/run-veggat/ -> repo root
OUT = REPO / "scripts" / "_probe" / "run-veggat"

ap = argparse.ArgumentParser()
ap.add_argument("--route", default="/ai", help="app route to open, e.g. /ai, /pulse")
ap.add_argument("--name", default=None, help="screenshot basename (defaults to route)")
ap.add_argument("--click", default=None, help="optional Playwright selector to click after load")
ap.add_argument("--base", default=BASE)
ap.add_argument("--cdp", default=CDP)
args = ap.parse_args()

sys.stdout.reconfigure(encoding="utf-8")
OUT.mkdir(parents=True, exist_ok=True)


def normalize_route(route: str) -> str:
    """Repair routes mangled by Git Bash/MSYS path conversion on Windows.

    `--route /ai` under Git Bash arrives as 'C:/Program Files/Git/ai' because
    MSYS rewrites the leading slash. Recover the real route from the tail.
    """
    r = route.replace("\\", "/")
    if ":" in r or r.startswith("C:/") or "/Git/" in r:
        r = "/" + r.rsplit("/", 1)[-1]
    if not r.startswith("/"):
        r = "/" + r
    return r


args.route = normalize_route(args.route)
name = args.name or args.route.strip("/").replace("/", "_") or "home"


def cdp_alive(url: str) -> bool:
    try:
        with urllib.request.urlopen(f"{url}/json/version", timeout=3) as r:
            return r.status == 200
    except Exception:
        return False


def read_gate_password() -> str:
    """GATE_PASSWORD from frontend/.env (the access gate blocks every route)."""
    env = REPO / "frontend" / ".env"
    if not env.exists():
        return ""
    for line in env.read_text(encoding="utf-8", errors="ignore").splitlines():
        if line.startswith("GATE_PASSWORD="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    return ""


if not cdp_alive(args.cdp):
    print(
        "ERROR: no debug Chrome on " + args.cdp + "\n"
        "  Launch it first:  python scripts/open_app_browser.py\n"
        "  (and make sure the dev server is up:  cd frontend && npm run dev)"
    )
    raise SystemExit(2)

with sync_playwright() as p:
    browser = p.chromium.connect_over_cdp(args.cdp)
    ctx = browser.contexts[0] if browser.contexts else browser.new_context()
    page = ctx.new_page()
    try:
        page.goto(f"{args.base}{args.route}", wait_until="networkidle", timeout=30000)
        page.wait_for_timeout(800)

        # Access gate: the whole site is behind a password until a cookie is set.
        if "/gate" in page.url:
            pw = read_gate_password()
            if not pw:
                print("hit /gate but GATE_PASSWORD is not in frontend/.env — cannot proceed")
                raise SystemExit(3)
            print("clearing access gate…")
            page.fill('input[type="password"]', pw)
            page.click('button:has-text("Enter Site")')
            page.wait_for_timeout(2500)
            page.goto(f"{args.base}{args.route}", wait_until="networkidle", timeout=30000)
            page.wait_for_timeout(1200)

        if args.click:
            try:
                page.click(args.click, timeout=5000)
                page.wait_for_load_state("networkidle", timeout=20000)
                page.wait_for_timeout(1200)
            except Exception as e:
                print(f"(click '{args.click}' failed: {e})")

        info = page.evaluate(
            "() => ({ url: location.pathname, title: document.title,"
            " theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light' })"
        )
        shot = OUT / f"{name}.png"
        page.screenshot(path=str(shot))
        print("OK:", info)
        print("SHOT:", shot, "bytes=", shot.stat().st_size)
        if "/gate" in info["url"]:
            print("WARNING: still on /gate — screenshot is the gate, not the page.")
    finally:
        page.close()
