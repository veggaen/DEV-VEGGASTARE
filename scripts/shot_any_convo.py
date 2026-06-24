#!/usr/bin/env python
"""
shot_any_convo.py — attach to the user's logged-in Chrome, open the LOCAL
/conversations list, click into the first real conversation, and screenshot the
composer dock in the current theme. Falls back gracefully if no conversation
exists. Closes its own tab.
"""
from __future__ import annotations
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path(__file__).parent / "_probe" / "composer"
OUT.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.connect_over_cdp("http://localhost:9222")
    ctx = browser.contexts[0]
    page = ctx.new_page()
    try:
        page.goto("http://localhost:3000/conversations", wait_until="networkidle", timeout=30000)
        page.wait_for_timeout(1500)
        # Click the first conversation link (href starts with /conversations/<id>)
        link = page.locator('a[href^="/conversations/"]').first
        opened = False
        if link.count() > 0:
            try:
                link.click(timeout=5000)
                page.wait_for_load_state("networkidle", timeout=20000)
                page.wait_for_timeout(1800)
                opened = True
            except Exception as e:
                print("click failed:", e)
        theme = page.evaluate("() => document.documentElement.classList.contains('dark') ? 'dark' : 'light'")
        info = page.evaluate(r"""
        () => {
          const form = document.querySelector('form');
          if (!form) return {hasForm:false, url:location.pathname};
          const rounded = [...form.querySelectorAll('*')].filter(el => {
            const r = getComputedStyle(el).borderRadius; return r && parseFloat(r) >= 12;
          });
          return {hasForm:true, url:location.pathname, roundedCount:rounded.length,
            sample: rounded.slice(0,6).map(el => (el.tagName+': '+el.className).slice(0,90))};
        }""")
        vp = page.viewport_size or {"width":1280,"height":900}
        full = OUT / f"convo_{theme}_full.png"
        page.screenshot(path=str(full))
        dock = OUT / f"convo_{theme}_dock.png"
        page.screenshot(path=str(dock), clip={"x":0,"y":max(0,vp["height"]-340),"width":vp["width"],"height":340})
        print({"opened":opened, "theme":theme, "info":info, "full":str(full), "dock":str(dock)})
    finally:
        page.close()
