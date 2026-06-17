#!/usr/bin/env python
"""
drive_ai_modal_bug.py — reproduce & diagnose the "/ai page renders as a modal" bug.

Key insight: the bug is about HARD navigation (typing the URL / refresh) wrongly
showing the intercepting-route modal. So we do a real goto() (hard nav), then
inspect the DOM for a stuck modal overlay (role=dialog / aria-modal / the
backdrop) that should ONLY appear on soft (in-app) navigation.

Launches its own Chromium (no auth needed — bug repros logged-out on the
anonymous hero). Screenshots both themes.

Usage:  python scripts/drive_ai_modal_bug.py [BASE_URL]
Output: scripts/_probe/ai_modal/<target>_<theme>.png  + report.json
"""
from __future__ import annotations
import json, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ARGS = sys.argv[1:]
BASE = next((a for a in ARGS if a.startswith("http")), "http://localhost:3000")
TARGET = "prod" if "veggat.com" in BASE else "local"
OUT = Path(__file__).parent / "_probe" / "ai_modal"
OUT.mkdir(parents=True, exist_ok=True)
GATE_PW = "MainAdc123"

INSPECT_JS = r"""
() => {
  const dialog = document.querySelector('[role="dialog"],[aria-modal="true"]');
  const main = document.querySelector('main');
  // backdrop = a fixed full-screen dark layer
  const fixedDark = [...document.querySelectorAll('div')].find(d => {
    const s = getComputedStyle(d);
    return s.position === 'fixed' && (d.className||'').includes('inset-0')
      && (s.backgroundColor.includes('rgba(0, 0, 0') || (d.className||'').includes('bg-black'));
  });
  return {
    bodyOverflow: getComputedStyle(document.body).overflow,
    hasDialog: !!dialog,
    dialogLabel: dialog?.getAttribute('aria-label') || null,
    hasMain: !!main,
    mainClasses: main?.className || null,
    hasFixedBackdrop: !!fixedDark,
    backdropClasses: fixedDark?.className || null,
    title: document.title,
  };
}
"""

def run():
    report = {"base": BASE, "target": TARGET, "results": {}}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        for theme in ("dark", "light"):
            ctx = browser.new_context(
                viewport={"width": 1280, "height": 900},
                color_scheme=theme,
            )
            page = ctx.new_page()
            # access gate cookie so prod doesn't bounce us to /gate
            ctx.add_cookies([{
                "name": "veggastare_access",
                "value": "granted_TWFpbkFkYzEyMw==",
                "domain": ".veggat.com" if TARGET == "prod" else "localhost",
                "path": "/",
            }])
            try:
                # HARD navigation — this is the repro path
                page.goto(f"{BASE}/ai", wait_until="networkidle", timeout=30000)
            except Exception as e:
                report["results"][theme] = {"error": str(e)}
                continue
            page.wait_for_timeout(1200)  # let entrance anims settle
            info = page.evaluate(INSPECT_JS)
            shot = OUT / f"{TARGET}_{theme}.png"
            page.screenshot(path=str(shot), full_page=False)
            info["screenshot"] = str(shot)
            # The smoking gun: a dialog/backdrop present after a HARD nav = bug.
            info["BUG_modal_on_hard_nav"] = info["hasDialog"] or info["hasFixedBackdrop"]
            report["results"][theme] = info
            ctx.close()
        browser.close()
    (OUT / f"report_{TARGET}.json").write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))

if __name__ == "__main__":
    run()
