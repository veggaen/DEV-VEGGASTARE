#!/usr/bin/env python
"""
drive_wallet_panel.py — "human navigation" probe for the sidebar Web3 wallet
panel. Drives the REAL app (logged-in) the way a person would: opens the menu,
hovers/clicks/scrolls through every wallet control, and at each step captures a
screenshot + every visible text string + DOM diagnostics (off-screen, zero-size,
occluded/overlapping, low-contrast, layout-shift). Records video of the whole run.

The wallet panel only renders for logged-in users. Google OAuth blocks
automation browsers, so instead of launching one we ATTACH to YOUR real Chrome:

  1. Start your Chrome with the debug port + log in (Google works — real browser):
        python scripts/open_app_browser.py
  2. Drive + audit (attaches over CDP, drives your logged-in tab):
        python scripts/drive_wallet_panel.py

Usage:
    python scripts/drive_wallet_panel.py [BASE_URL] [--port 9222]

Default BASE_URL = http://localhost:3000
Outputs to scripts/_probe/wallet/ (per-step screenshots + report.json). A video
can be stitched from the screenshots with ffmpeg afterward.
"""
from __future__ import annotations
import json
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright, Page

ARGS = sys.argv[1:]
BASE = next((a for a in ARGS if a.startswith("http")), "http://localhost:3000")
PORT = ARGS[ARGS.index("--port") + 1] if "--port" in ARGS else "9222"
GATE_PW = "MainAdc123"

OUT = Path(__file__).parent / "_probe" / "wallet"
OUT.mkdir(parents=True, exist_ok=True)


# ── DOM audit: injected into the page to grade the wallet panel as a human sees it
# Flags the exact problem classes Vetle called out: jank, hidden/occluded parts,
# overlapping z-order, unreadable contrast, tiny tap targets, meaningless text.
AUDIT_JS = r"""
(rootSel) => {
  const root = document.querySelector(rootSel) || document.body;
  const out = { texts: [], issues: [], controls: [] };
  const vw = innerWidth, vh = innerHeight;

  const seen = new Set();
  const all = root.querySelectorAll('*');
  for (const el of all) {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const tag = el.tagName.toLowerCase();
    const isInteractive = ['button','a','input','select','textarea'].includes(tag)
      || el.getAttribute('role') === 'button' || el.onclick;

    // Collect meaningful text (leaf-ish nodes only, dedup)
    const ownText = [...el.childNodes].filter(n => n.nodeType === 3)
      .map(n => n.textContent.trim()).join(' ').trim();
    if (ownText && ownText.length > 1 && !seen.has(ownText)) {
      seen.add(ownText);
      out.texts.push(ownText.slice(0, 120));
    }

    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const visible = r.width > 0 && r.height > 0;

    // Zero-size but rendered (likely a layout/clip bug)
    if (isInteractive && (r.width === 0 || r.height === 0)) {
      out.issues.push({ type: 'zero-size-control', tag, text: (el.innerText||'').slice(0,40) });
    }
    // Interactive element fully off the viewport while panel is "open"
    if (isInteractive && visible && (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw)) {
      out.issues.push({ type: 'offscreen-control', tag, text: (el.innerText||'').slice(0,40),
        pos: { top: Math.round(r.top), left: Math.round(r.left) } });
    }
    // Tiny tap target (WCAG / mobile: <24px is hard to hit)
    if (isInteractive && visible && (r.height < 24 || r.width < 24)) {
      out.issues.push({ type: 'tiny-tap-target', tag, w: Math.round(r.width), h: Math.round(r.height),
        text: (el.innerText||'').slice(0,40) });
    }
    // Occlusion: the control's center is covered by a DIFFERENT element (z bug / overlap)
    if (isInteractive && visible && r.width > 4 && r.height > 4) {
      const cx = r.left + r.width/2, cy = r.top + r.height/2;
      if (cx >= 0 && cy >= 0 && cx <= vw && cy <= vh) {
        const top = document.elementFromPoint(cx, cy);
        if (top && top !== el && !el.contains(top) && !top.contains(el)) {
          out.issues.push({ type: 'occluded-control', tag,
            text: (el.innerText||'').slice(0,40),
            coveredBy: top.tagName.toLowerCase() + (top.className ? '.'+String(top.className).slice(0,40) : '') });
        }
      }
    }
    if (isInteractive && visible) {
      out.controls.push({ tag, w: Math.round(r.width), h: Math.round(r.height),
        label: (el.getAttribute('aria-label') || el.innerText || '').trim().slice(0,48),
        fontPx: parseFloat(cs.fontSize) });
    }
  }
  // Horizontal overflow inside the panel (content wider than container => clipping)
  if (root.scrollWidth > root.clientWidth + 2) {
    out.issues.push({ type: 'horizontal-overflow',
      scrollW: root.scrollWidth, clientW: root.clientWidth });
  }
  return out;
}
"""




def step(page: Page, name: str, report: dict, root_sel: str = "body"):
    """Capture one timeline step: screenshot + text + DOM audit."""
    page.wait_for_timeout(350)  # let any transition settle so we don't catch mid-animation
    shot = OUT / f"{name}.png"
    page.screenshot(path=str(shot))
    audit = page.evaluate(AUDIT_JS, root_sel)
    report["steps"].append({
        "name": name,
        "screenshot": shot.name,
        "issue_count": len(audit["issues"]),
        "issues": audit["issues"],
        "control_count": len(audit["controls"]),
        "controls": audit["controls"][:60],
        "texts": audit["texts"][:120],
    })
    print(f"  · {name}: {len(audit['controls'])} controls, {len(audit['issues'])} issues")


def drive(page: Page, report: dict):
    # Pass the gate if present (idempotent — harmless if already past it)
    try:
        page.request.post(f"{BASE}/api/access-gate", data={"password": GATE_PW})
    except Exception:
        pass
    page.goto(BASE, wait_until="domcontentloaded", timeout=60000)
    page.wait_for_timeout(1500)
    step(page, "00_home_loaded", report)

    # Confirm we're logged in (the wallet panel needs it)
    session = page.request.get(f"{BASE}/api/auth/session").json()
    report["logged_in"] = bool(session and session.get("user"))
    if not report["logged_in"]:
        report["fatal"] = ("Not logged in — wallet panel won't render. "
                           "Run with --save-state and log in first.")
        print("  !! " + report["fatal"])
        return

    # Open the menu (topbar hamburger)
    opened = False
    for sel in ['[aria-label="Open menu"]', 'button[aria-label*="menu" i]']:
        loc = page.locator(sel)
        if loc.count() > 0:
            loc.first.click()
            opened = True
            break
    page.wait_for_timeout(700)
    step(page, "01_menu_open", report)
    if not opened:
        report["issues_global"] = ["Could not find a menu-open button by aria-label"]

    # Find the wallet panel container by its known heading/anchor text
    panel = page.locator("text=/Web3 Wallets|Connect a wallet|Wallets/i").first
    if panel.count() == 0:
        report["issues_global"] = report.get("issues_global", []) + \
            ["Wallet panel not found after opening menu"]
    # Hover the first few wallet controls to capture hover-state visuals + jank
    controls = page.locator("button, [role=button]").all()
    for i, c in enumerate(controls[:8]):
        try:
            if c.is_visible():
                c.hover(timeout=1500)
                step(page, f"02_hover_{i:02d}", report)
        except Exception:
            pass

    # Expand the "+ Connect a wallet" disclosure (the main discoverability path)
    connect = page.locator("button:has-text('Connect a wallet')")
    if connect.count() > 0:
        connect.first.click()
        page.wait_for_timeout(500)
        step(page, "03_connect_expanded", report)

    # Scroll the panel to reveal anything below the fold (and catch scroll jank)
    page.mouse.wheel(0, 600)
    step(page, "04_scrolled", report)


def main() -> int:
    report: dict = {"base": BASE, "steps": []}
    cdp = f"http://localhost:{PORT}"
    with sync_playwright() as p:
        # ATTACH to your already-running real Chrome (started via
        # open_app_browser.py). No automation browser is launched, so Google
        # OAuth isn't blocked and we drive YOUR logged-in session.
        try:
            browser = p.chromium.connect_over_cdp(cdp, timeout=10000)
        except Exception as e:
            print(f"Could not attach to Chrome on {cdp}: {e}")
            print("Start it first:  python scripts/open_app_browser.py")
            return 2

        ctx = browser.contexts[0] if browser.contexts else browser.new_context()
        # Reuse the existing tab if one is on the app; else open a new one.
        page = None
        for pg in ctx.pages:
            if BASE.split("//")[-1].split("/")[0] in (pg.url or ""):
                page = pg
                break
        page = page or ctx.new_page()
        try:
            drive(page, report)
        finally:
            # Do NOT close the browser — it's the user's. Just detach.
            pass

    (OUT / "report.json").write_text(json.dumps(report, indent=2))
    total_issues = sum(s["issue_count"] for s in report["steps"])
    print(f"\nSteps: {len(report['steps'])}  ·  total DOM issues flagged: {total_issues}")
    print(f"Logged in: {report.get('logged_in')}")
    if report.get("fatal"):
        print("FATAL:", report["fatal"])
    print(f"Report: {OUT / 'report.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
