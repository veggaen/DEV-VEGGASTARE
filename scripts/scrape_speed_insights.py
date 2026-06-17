#!/usr/bin/env python
"""
scrape_speed_insights.py — pull Speed Insights field data the only way that
works: drive the Vercel DASHBOARD in your already-logged-in real Chrome and
(a) capture the dashboard's own internal vitals fetches, (b) read the rendered
P75 metric tiles from the DOM.

Vercel does NOT expose Speed Insights via public API (token returns 404 on every
endpoint), but the dashboard UI fetches it with your session — so the attached
browser CAN see it. Attaches over CDP; never launches/closes your browser.

Usage: python scripts/scrape_speed_insights.py [--port 9222]
Output: scripts/_probe/speed_insights.json  + screenshot
"""
from __future__ import annotations
import json
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

PORT = sys.argv[sys.argv.index("--port") + 1] if "--port" in sys.argv else "9222"
URL = "https://vercel.com/v3ggas-projects/dev-veggastare/speed-insights"
OUT = Path(__file__).parent / "_probe"
OUT.mkdir(parents=True, exist_ok=True)


def main() -> int:
    captured: list[dict] = []
    with sync_playwright() as p:
        try:
            browser = p.chromium.connect_over_cdp(f"http://localhost:{PORT}", timeout=10000)
        except Exception as e:
            print(f"Could not attach to Chrome on :{PORT}: {e}")
            return 2
        ctx = browser.contexts[0] if browser.contexts else browser.new_context()
        page = ctx.new_page()

        # Capture any response that looks like a vitals/insights data fetch.
        def on_response(resp):
            u = resp.url
            if any(k in u for k in ("vitals", "speed-insights", "insights", "web-analytics", "observability")):
                try:
                    if "application/json" in (resp.headers.get("content-type") or ""):
                        captured.append({"url": u, "status": resp.status, "json": resp.json()})
                except Exception:
                    captured.append({"url": u, "status": resp.status, "json": None})

        page.on("response", on_response)

        print(f"Navigating to {URL}")
        page.goto(URL, wait_until="domcontentloaded", timeout=60000)
        # Give the dashboard time to fire its data fetches + render tiles
        for _ in range(12):
            page.wait_for_timeout(1500)
            if captured:
                break

        # If we landed on a login wall, say so plainly.
        if "login" in page.url or "/sso" in page.url:
            print("!! Not logged into Vercel in this browser — open the dashboard "
                  "and log in, then re-run.")
        page.screenshot(path=str(OUT / "speed_insights.png"), full_page=True)

        # Scrape visible metric text as a fallback (P75 tiles: LCP/CLS/INP/FCP/TTFB/FID)
        metrics = page.evaluate(r"""() => {
          const out = {};
          const wanted = ['LCP','CLS','INP','FCP','TTFB','FID','Real Experience Score','RES'];
          // grab text nodes near metric labels
          const txt = document.body.innerText.split('\n').map(s=>s.trim()).filter(Boolean);
          for (let i=0;i<txt.length;i++){
            for (const w of wanted){
              if (txt[i] === w || txt[i].startsWith(w+' ')) {
                out[w] = (txt[i+1]||'') + ' | ' + (txt[i+2]||'');
              }
            }
          }
          return out;
        }""")

        result = {"url": page.url, "captured_fetches": captured, "dom_metrics": metrics}
        (OUT / "speed_insights.json").write_text(json.dumps(result, indent=2))
        print(f"Captured {len(captured)} data fetch(es). DOM metrics: {list(metrics.keys())}")
        print(f"Saved: {OUT / 'speed_insights.json'}  +  speed_insights.png")
        page.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
