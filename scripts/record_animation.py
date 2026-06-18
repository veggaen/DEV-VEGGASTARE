#!/usr/bin/env python
"""
record_animation.py — general-purpose ANIMATION recorder for the app.

WHY THIS EXISTS: single screenshots cannot tell "mid-animation" apart from
"broken/clipped". Judging an entrance/hover/transition from one frame produced a
false "hero text is clipped" finding that frame-by-frame recording disproved.
So: never judge an animation from a still — record it and watch the arc.

Captures N frames at a fixed interval over a route (entrance animations), and
optionally hovers/clicks a selector first (hover/press transitions). For each
frame it saves a screenshot AND logs the live rendered text of given selectors,
so you can see what the DOM actually shows over time (not just pixels).

Attaches to the already-open debug Chrome over CDP (open_app_browser.py); never
launches/closes your browser.

Usage:
  python scripts/record_animation.py --url / --name hero --frames 28 --interval 250
  python scripts/record_animation.py --url /auth/login --hover "button:has(svg)" --name oauth_hover
  python scripts/record_animation.py --url / --click "[aria-label='Open menu']" --name menu_open

Output: scripts/_probe/anim/<name>/  (f00.png … + timeline.txt)
"""
from __future__ import annotations
import argparse
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8")

ap = argparse.ArgumentParser()
ap.add_argument("--url", default="/")
ap.add_argument("--name", default="anim")
ap.add_argument("--frames", type=int, default=24)
ap.add_argument("--interval", type=int, default=250, help="ms between frames")
ap.add_argument("--port", default="9222")
ap.add_argument("--host", default="127.0.0.1",
                help="CDP host (use 127.0.0.1 not localhost to avoid IPv6 ::1 refusal)")
ap.add_argument("--base", default="http://localhost:3000")
ap.add_argument("--hover", default=None, help="CSS selector to hover before recording")
ap.add_argument("--click", default=None, help="CSS selector to click before recording")
ap.add_argument("--watch", default=None,
                help="comma-separated regexes; logs the first matching text element each frame")
args = ap.parse_args()

# Git Bash/MSYS on Windows rewrites a leading-slash arg ("/ai") into a Windows
# path ("C:/Program Files/Git/ai"), which Playwright rejects. Recover the route.
_u = args.url.replace("\\", "/")
if ":" in _u or "/Git/" in _u:
    _u = "/" + _u.rsplit("/", 1)[-1]
if not _u.startswith(("/", "http")):
    _u = "/" + _u
args.url = _u

OUT = Path(__file__).parent / "_probe" / "anim" / args.name
OUT.mkdir(parents=True, exist_ok=True)

watch = [w.strip() for w in (args.watch or "").split(",") if w.strip()]
# JS reads, per frame, the text of the first element matching each watch regex.
READ = """
(patterns) => {
  const all = [...document.querySelectorAll('span,p,h1,h2,button,a,div')];
  const out = {};
  for (const pat of patterns) {
    let re; try { re = new RegExp(pat, 'i'); } catch { re = null; }
    const hit = re ? all.map(e => (e.innerText || '').trim())
      .find(t => t && t.length < 80 && re.test(t)) : '';
    out[pat] = (hit || '').replace(/\\s+/g, ' ').slice(0, 60);
  }
  return out;
}
"""

with sync_playwright() as p:
    b = p.chromium.connect_over_cdp(f"http://{args.host}:{args.port}", timeout=10000)
    ctx = b.contexts[0] if b.contexts else b.new_context()
    pg = ctx.pages[0] if ctx.pages else ctx.new_page()
    pg.goto(f"{args.base}{args.url}", wait_until="domcontentloaded", timeout=60000)

    if args.click:
        try:
            pg.locator(args.click).first.click(timeout=4000)
        except Exception as e:
            print(f"(click '{args.click}' failed: {e})")
    if args.hover:
        try:
            pg.locator(args.hover).first.hover(timeout=4000)
        except Exception as e:
            print(f"(hover '{args.hover}' failed: {e})")

    rows = []
    for i in range(args.frames):
        pg.screenshot(path=str(OUT / f"f{i:02d}.png"))
        snap = {}
        if watch:
            try:
                snap = pg.evaluate(READ, watch)
            except Exception:
                snap = {}
        rows.append((i * args.interval, snap))
        pg.wait_for_timeout(args.interval)

    lines = []
    for ms, snap in rows:
        cells = "  ".join(f"[{k[:10]}={v[:30]}]" for k, v in snap.items()) if snap else ""
        lines.append(f"{ms:5d}ms  {cells}")
    (OUT / "timeline.txt").write_text("\n".join(lines), encoding="utf-8")
    print("\n".join(lines))
    print(f"\n{args.frames} frames + timeline saved to {OUT}")
    print("Review: open the frames in sequence to watch the animation arc.")
