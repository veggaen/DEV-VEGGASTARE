#!/usr/bin/env python
"""
shot_composer.py — screenshot the DM conversation composer by attaching to the
user's already-open, logged-in Chrome (debug port 9222). Opens a NEW tab so we
don't disturb the user's current tab, navigates to the given conversation URL,
captures the bottom (composer) region in the current theme, then closes the tab.

Usage:  python scripts/shot_composer.py <FULL_URL> [out_name]
"""
from __future__ import annotations
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000/conversations"
NAME = sys.argv[2] if len(sys.argv) > 2 else "composer"
OUT = Path(__file__).parent / "_probe" / "composer"
OUT.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.connect_over_cdp("http://localhost:9222")
    ctx = browser.contexts[0]
    page = ctx.new_page()
    try:
        page.goto(URL, wait_until="networkidle", timeout=30000)
        page.wait_for_timeout(1800)  # let messages + composer settle
        # detect theme
        theme = page.evaluate("() => document.documentElement.classList.contains('dark') ? 'dark' : 'light'")
        full = OUT / f"{NAME}_{theme}_full.png"
        page.screenshot(path=str(full))
        # tight crop of the bottom 360px (the composer dock)
        vp = page.viewport_size or {"width": 1280, "height": 900}
        crop = OUT / f"{NAME}_{theme}_dock.png"
        page.screenshot(path=str(crop), clip={
            "x": 0, "y": max(0, vp["height"] - 360),
            "width": vp["width"], "height": 360,
        })
        # report whether a double-rounded structure still exists
        info = page.evaluate(r"""
        () => {
          const form = document.querySelector('form');
          if (!form) return {found:false};
          const rounded = [...form.querySelectorAll('*')].filter(el => {
            const r = getComputedStyle(el).borderRadius;
            return r && parseFloat(r) >= 12;
          });
          return {found:true, roundedCount: rounded.length,
            classes: rounded.slice(0,5).map(el => el.className.slice(0,80))};
        }
        """)
        print({"theme": theme, "full": str(full), "dock": str(crop), "rounded": info})
    finally:
        page.close()  # close our tab, leave the user's browser intact
