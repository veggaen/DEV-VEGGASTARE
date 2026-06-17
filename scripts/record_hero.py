#!/usr/bin/env python
"""Record the hero animation frame-by-frame + log the live rendered headline /
description text at each step, so we can SEE how the reveal transitions (and tell
'mid-animation' apart from a real clip). Attaches to the open debug Chrome."""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8")
OUT = Path(__file__).parent / "_probe" / "hero_frames"
OUT.mkdir(parents=True, exist_ok=True)

READ_TEXT = """
() => {
  const all = [...document.querySelectorAll('span, p, h1, h2')];
  // headline = the eyebrow with the WHERE/EVERY words
  const head = all.map(e => (e.innerText || '').trim())
    .find(t => /WHERE|EVERY|CHOICE|YOURS/i.test(t) && t.length < 40) || '';
  const title = all.map(e => (e.innerText || '').trim())
    .find(t => /Freedom Store/i.test(t) && t.length < 25) || '';
  const desc = [...document.querySelectorAll('p')].map(p => (p.innerText||'').trim())
    .find(t => /marketplace/i.test(t)) || '';
  return { head: head.replace(/\\s+/g,' '), title, desc: desc.slice(0,75) };
}
"""

with sync_playwright() as p:
    b = p.chromium.connect_over_cdp("http://localhost:9222", timeout=10000)
    ctx = b.contexts[0]
    pg = ctx.pages[0]
    pg.goto("http://localhost:3000/", wait_until="domcontentloaded", timeout=60000)
    rows = []
    for i in range(28):  # 28 frames x 250ms = 7s
        pg.screenshot(path=str(OUT / f"f{i:02d}.png"))
        try:
            t = pg.evaluate(READ_TEXT)
        except Exception as e:
            t = {"head": f"<err {e}>", "title": "", "desc": ""}
        rows.append((i * 250, t))
        pg.wait_for_timeout(250)

    print("ms     | HEADLINE                          | TITLE          | DESC tail")
    print("-" * 100)
    for ms, t in rows:
        print(f"{ms:5d}  | {t['head'][:33]:33s} | {t['title'][:14]:14s} | ...{t['desc'][-40:]}")
    print(f"\nFrames saved to {OUT}")
