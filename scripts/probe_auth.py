#!/usr/bin/env python
"""
probe_auth.py — reusable headless browser probe for the live VeggaStare auth
surfaces. Captures screenshots, console errors, network failures, and the
rendered button/control inventory so we can VERIFY (not assume) that the auth
UI renders and behaves.

Usage:
    .venv/Scripts/python scripts/probe_auth.py [BASE_URL]

Default BASE_URL = https://www.veggat.com
Outputs to scripts/_probe/ (screenshots + report.json).
"""
from __future__ import annotations
import json
import sys
import os
import time
import urllib.request
import urllib.error
from pathlib import Path
from playwright.sync_api import sync_playwright, ConsoleMessage

BASE = sys.argv[1] if len(sys.argv) > 1 else "https://www.veggat.com"
OUT = Path(__file__).parent / "_probe"
OUT.mkdir(exist_ok=True)

# Hard wall-clock budget for the whole run. The probe's job is to VERIFY quickly,
# not to babysit a wedged dev server — if we blow this budget we bail with a
# partial report rather than hang the calling session (which is what timed out
# the last two sessions). Override with PROBE_BUDGET_S.
BUDGET_S = float(os.environ.get("PROBE_BUDGET_S", "90"))
_START = time.monotonic()


def budget_left() -> float:
    return BUDGET_S - (time.monotonic() - _START)

# Surfaces worth probing. `gate_token` lets us pass the access gate if the
# environment exposes one via query param (filled in by the caller/env).
GATE = os.environ.get("VEGGAT_GATE_TOKEN", "")
SUFFIX = f"?gate={GATE}" if GATE else ""
ROUTES = [
    ("gate", "/"),
    ("login", "/auth/login"),
    ("register", "/auth/register"),
]


def warm(url: str, attempts: int = 4) -> int | None:
    """Pre-compile an on-demand dev route so the real probe never trips over a
    cold-compile 500. Turbopack/Next dev compile routes on first request and
    return a transient 500 until ready — that race is what made earlier probes
    falsely report /auth/register and / as broken.

    This is a *cheap HTTP* check (no browser, no networkidle), so a warm route
    confirms readiness in one fast request instead of the old 6× full page-load
    loop that took 45s+ per route and timed out the calling session. We only
    retry while the server is actually cold (>=500). Returns the final status.
    """
    last = None
    for i in range(attempts):
        if budget_left() <= 5:
            return last
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "probe-warm"})
            with urllib.request.urlopen(req, timeout=20) as resp:
                last = resp.status
        except urllib.error.HTTPError as e:
            last = e.code
        except Exception:
            last = None
        if last is not None and last < 500:
            return last  # warm — done in one request when already compiled
        time.sleep(1.0)  # cold: let the dev compiler finish, then retry
    return last


def probe(page, name: str, path: str) -> dict:
    console_errors: list[str] = []
    page_errors: list[str] = []
    failed_requests: list[str] = []

    page.on("console", lambda m: console_errors.append(f"{m.type}: {m.text}")
            if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: page_errors.append(str(e)))

    def on_requestfailed(r):
        failure = (r.failure or "")
        # net::ERR_ABORTED is teardown/cancellation noise, never a broken asset:
        # Playwright cancels in-flight requests when we leave/close the page
        # (Turbopack chunks, third-party SDK init like edgestore, and the HEAD
        # the browser sees from our own warm() check all land here). Counting
        # these as failures is what made a working 200 app look 500'd.
        if "ERR_ABORTED" not in failure:
            failed_requests.append(f"{r.method} {r.url} :: {failure}")

    page.on("requestfailed", on_requestfailed)

    url = f"{BASE}{path}{SUFFIX}"
    result: dict = {"name": name, "url": url}
    try:
        # Warm the route first (cheap HTTP) so a cold dev compile can't
        # masquerade as a 500 in the real browser pass below.
        result["http_status"] = warm(url)
        page.goto(url, wait_until="domcontentloaded", timeout=45000)
        # Cap the networkidle wait by what's left of the global budget so one
        # chatty route (WC/AppKit keep sockets open) can't eat the whole run.
        idle_ms = max(2000, min(15000, int(budget_left() * 1000) - 5000))
        try:
            page.wait_for_load_state("networkidle", timeout=idle_ms)
        except Exception:
            result["networkidle"] = "timeout (ok, captured anyway)"
        result["title"] = page.title()
        result["final_url"] = page.url

        # Inventory interactive controls — the thing we keep claiming "works".
        buttons = page.locator("button, [role=button], a[href]").all()
        labels = []
        for b in buttons[:60]:
            try:
                t = (b.inner_text() or "").strip().replace("\n", " ")
                if t:
                    labels.append(t[:50])
            except Exception:
                pass
        result["control_count"] = len(buttons)
        result["controls_sample"] = labels[:40]

        # Auth-specific signal: do the OAuth / wallet buttons exist?
        for key, sel in {
            "google": "text=/google/i",
            "github": "text=/github/i",
            "discord": "text=/discord/i",
            "wallet": "text=/wallet|connect/i",
            "email": "input[type=email]",
            "password": "input[type=password]",
        }.items():
            try:
                result[f"has_{key}"] = page.locator(sel).count() > 0
            except Exception:
                result[f"has_{key}"] = False

        shot = OUT / f"{name}.png"
        page.screenshot(path=str(shot), full_page=True)
        result["screenshot"] = str(shot)
    except Exception as e:
        result["error"] = str(e)

    result["console_errors"] = console_errors[:25]
    result["page_errors"] = page_errors[:25]
    result["failed_requests"] = failed_requests[:25]
    return result


def main() -> int:
    report = {"base": BASE, "routes": [], "skipped": []}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 1280, "height": 900})
        for name, path in ROUTES:
            if budget_left() <= 10:
                report["skipped"].append(name)
                continue
            page = ctx.new_page()
            report["routes"].append(probe(page, name, path))
            page.close()
        # Mobile portrait pass on login (a11y / portrait-vs-landscape bar).
        if budget_left() > 10:
            page = ctx.new_page()
            page.set_viewport_size({"width": 390, "height": 844})
            r = probe(page, "login_mobile", "/auth/login")
            report["routes"].append(r)
            page.close()
        else:
            report["skipped"].append("login_mobile")
        browser.close()

    (OUT / "report.json").write_text(json.dumps(report, indent=2))
    # Compact stdout summary.
    for r in report["routes"]:
        errs = len(r.get("console_errors", [])) + len(r.get("page_errors", []))
        print(f"[{r['name']}] {r.get('final_url', r['url'])}  "
              f"status={r.get('http_status','?')}  "
              f"controls={r.get('control_count','?')}  "
              f"google={r.get('has_google')} github={r.get('has_github')} "
              f"discord={r.get('has_discord')} wallet={r.get('has_wallet')}  "
              f"errs={errs}")
        if r.get("error"):
            print(f"    ERROR: {r['error']}")
    if report["skipped"]:
        print(f"[skipped (budget): {', '.join(report['skipped'])}]")
    print(f"\nFull report: {OUT / 'report.json'}  "
          f"(elapsed {time.monotonic() - _START:.1f}s / budget {BUDGET_S:.0f}s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
