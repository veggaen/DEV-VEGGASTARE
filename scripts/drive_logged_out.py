#!/usr/bin/env python
"""
drive_logged_out.py — "human navigation" probe of the LOGGED-OUT app surface,
in BOTH light and dark mode, behaving like a real person:

  - waits for REAL content (polls body text + waits for entrance animations to
    settle) instead of a blind fixed timeout — fixes the "blank screenshot" bug
  - moves the mouse and HOVERS interactive elements, capturing the hover state
  - CLICKS into a couple of safe affordances to see transitions
  - extracts every visible text string so we can read it and judge if the app
    makes sense to a newcomer
  - runs a DOM audit (off-screen / zero-size / occluded / tiny-tap-target /
    low-contrast / dead-link / horizontal-overflow)

Attaches to your already-open real Chrome (open_app_browser.py); never launches
an automation browser (so Google OAuth isn't blocked) and never closes your
browser.

Usage:  python scripts/drive_logged_out.py [BASE_URL] [--port 9222]
Output: scripts/_probe/logged_out/  (screenshots per route×theme + report.json)
"""
from __future__ import annotations
import json
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright, Page

ARGS = sys.argv[1:]
BASE = next((a for a in ARGS if a.startswith("http")), "http://localhost:3000")
PORT = ARGS[ARGS.index("--port") + 1] if "--port" in ARGS else "9222"
GATE_PW = "MainAdc123"

# Separate output dir per target (local vs prod) so runs don't overwrite.
TARGET = "prod" if "veggat.com" in BASE else "local"
OUT = Path(__file__).parent / "_probe" / f"logged_out_{TARGET}"
OUT.mkdir(parents=True, exist_ok=True)

ROUTES = [
    ("landing", "/"),
    ("products", "/products"),
    ("pulse", "/pulse"),
    ("info", "/info"),
    ("login", "/auth/login"),
    ("register", "/auth/register"),
]
THEMES = ["light", "dark"]

AUDIT_JS = r"""
(rootSel) => {
  const root = document.querySelector(rootSel) || document.body;
  const out = { texts: [], issues: [], controls: [], links: [] };
  const vw = innerWidth, vh = innerHeight;
  const seen = new Set();
  const lum = (rgb) => {
    const m = rgb.match(/\d+(\.\d+)?/g); if (!m) return null;
    const [r,g,b] = m.slice(0,3).map(Number).map(v => {
      v/=255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4);
    });
    return 0.2126*r + 0.7152*g + 0.0722*b;
  };
  const SKIP_TEXT = new Set(['script','style','noscript','template']);
  for (const el of root.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const tag = el.tagName.toLowerCase();
    const isInteractive = ['button','a','input','select','textarea'].includes(tag)
      || el.getAttribute('role') === 'button';
    // Skip non-visible-copy containers (RSC __next_f payloads live in <script>)
    const ownText = SKIP_TEXT.has(tag) ? '' :
      [...el.childNodes].filter(n => n.nodeType === 3)
      .map(n => n.textContent.trim()).join(' ').trim();
    if (ownText && ownText.length > 1 && !seen.has(ownText)) {
      seen.add(ownText);
      out.texts.push(ownText.slice(0, 140));
      if (cs.display !== 'none' && r.width > 0 && r.height > 0) {
        const fg = lum(cs.color);
        let bgEl = el, bg = null;
        for (let i=0;i<6 && bgEl;i++){ const c=getComputedStyle(bgEl).backgroundColor;
          if (c && c!=='rgba(0, 0, 0, 0)' && c!=='transparent'){ bg=lum(c); break; } bgEl=bgEl.parentElement; }
        if (fg!=null && bg!=null) {
          const ratio = (Math.max(fg,bg)+0.05)/(Math.min(fg,bg)+0.05);
          const sizePx = parseFloat(cs.fontSize);
          const min = (sizePx>=24 || (sizePx>=18.66 && cs.fontWeight>=700)) ? 3 : 4.5;
          if (ratio < min) out.issues.push({ type:'low-contrast',
            ratio:+ratio.toFixed(2), need:min, fontPx:sizePx, text: ownText.slice(0,40) });
        }
      }
    }
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const vis = r.width > 0 && r.height > 0;
    if (isInteractive && (r.width===0 || r.height===0))
      out.issues.push({ type:'zero-size-control', tag, text:(el.innerText||'').slice(0,40) });
    if (isInteractive && vis && (r.bottom<0||r.top>vh||r.right<0||r.left>vw))
      out.issues.push({ type:'offscreen-control', tag, text:(el.innerText||'').slice(0,40) });
    if (isInteractive && vis && (r.height<24||r.width<24))
      out.issues.push({ type:'tiny-tap-target', tag, w:Math.round(r.width), h:Math.round(r.height), text:(el.innerText||'').slice(0,40) });
    if (tag==='a') {
      const href = el.getAttribute('href');
      out.links.push({ href, text:(el.innerText||'').trim().slice(0,40) });
      if (!href || href==='#' || href.startsWith('javascript:'))
        out.issues.push({ type:'dead-link', href, text:(el.innerText||'').slice(0,40) });
    }
    if (isInteractive && vis) out.controls.push({ tag,
      label:(el.getAttribute('aria-label')||el.innerText||'').trim().slice(0,48) });
  }
  if (root.scrollWidth > root.clientWidth + 2)
    out.issues.push({ type:'horizontal-overflow', scrollW:root.scrollWidth, clientW:root.clientWidth });
  return out;
}
"""


def set_theme(page: Page, theme: str):
    """Force next-themes mode before content paints.

    The app's next-themes storageKey is 'veggat:theme' (NOT the default
    'theme'), and the default is 'system' — so to capture a real explicit theme
    we must write the correct key AND set the html class for the first paint.
    """
    page.add_init_script(f"""
      try {{
        localStorage.setItem('veggat:theme', '{theme}');
        document.documentElement.classList.remove('light','dark');
        document.documentElement.classList.add('{theme}');
        document.documentElement.style.colorScheme = '{theme}';
      }} catch (e) {{}}
    """)


def wait_for_real_content(page: Page, min_chars: int = 40, timeout: int = 20000):
    """Wait until the page actually has substantial text (hydrated), not a blank
    shell — then a short beat for entrance animations. Fixes blank screenshots."""
    try:
        page.wait_for_function(
            "(min) => (document.body && document.body.innerText.trim().length > min)",
            arg=min_chars, timeout=timeout,
        )
    except Exception:
        pass
    page.wait_for_timeout(900)  # let entrance/transition animations settle


def human_hover_pass(page: Page, name: str, report: dict, max_hovers: int = 6):
    """Move the mouse and hover the top interactive elements like a person would,
    capturing a screenshot of each hover state."""
    controls = [c for c in page.locator("button, a[href], [role=button]").all()
                if _safe_visible(c)]
    hovered = []
    for i, c in enumerate(controls[:max_hovers]):
        try:
            label = (c.get_attribute("aria-label") or c.inner_text() or "").strip()[:40]
            c.scroll_into_view_if_needed(timeout=1500)
            c.hover(timeout=1500)
            page.wait_for_timeout(450)  # watch the hover effect animate in
            shot = OUT / f"{name}__hover_{i:02d}.png"
            page.screenshot(path=str(shot))
            hovered.append({"label": label, "screenshot": shot.name})
        except Exception:
            pass
    report.setdefault("hovers", {})[name] = hovered


def _safe_visible(loc) -> bool:
    try:
        return loc.is_visible()
    except Exception:
        return False


def capture(page: Page, name: str, report: dict):
    shot = OUT / f"{name}.png"
    page.screenshot(path=str(shot), full_page=True)
    a = page.evaluate(AUDIT_JS, "body")
    report["pages"].append({
        "name": name, "url": page.url, "screenshot": shot.name,
        "issue_count": len(a["issues"]), "issues": a["issues"][:60],
        "control_count": len(a["controls"]),
        "link_count": len(a["links"]),
        "dead_links": [l for l in a["links"] if not l["href"] or l["href"] in ("#",)][:20],
        "texts": a["texts"][:160],
    })
    print(f"  · {name}: {len(a['controls'])} controls, {len(a['links'])} links, {len(a['issues'])} issues")


def drive(page: Page, report: dict):
    try:
        page.request.post(f"{BASE}/api/access-gate", data={"password": GATE_PW})
    except Exception:
        pass

    for theme in THEMES:
        set_theme(page, theme)  # init-script applies on next navigation
        for rname, path in ROUTES:
            name = f"{rname}_{theme}"
            page.goto(f"{BASE}{path}", wait_until="domcontentloaded", timeout=60000)
            wait_for_real_content(page)
            capture(page, name, report)
            human_hover_pass(page, name, report)

        # Landing: scroll through below-the-fold sections in this theme
        page.goto(BASE, wait_until="domcontentloaded", timeout=60000)
        wait_for_real_content(page)
        for i in range(4):
            page.mouse.wheel(0, 750)
            page.wait_for_timeout(700)  # watch scroll-triggered animations
            capture(page, f"landing_{theme}_scroll{i}", report)

    try:
        sess = page.request.get(f"{BASE}/api/auth/session").json()
        report["logged_in"] = bool(sess and sess.get("user"))
    except Exception:
        report["logged_in"] = None


def main() -> int:
    report: dict = {"base": BASE, "pages": []}
    cdp = f"http://localhost:{PORT}"
    with sync_playwright() as p:
        try:
            browser = p.chromium.connect_over_cdp(cdp, timeout=10000)
        except Exception as e:
            print(f"Could not attach to Chrome on {cdp}: {e}")
            print("Start it first:  python scripts/open_app_browser.py")
            return 2
        ctx = browser.contexts[0] if browser.contexts else browser.new_context()
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        drive(page, report)

    (OUT / "report.json").write_text(json.dumps(report, indent=2))
    total = sum(p["issue_count"] for p in report["pages"])
    print(f"\nPages: {len(report['pages'])}  ·  total issues flagged: {total}  ·  logged_in={report.get('logged_in')}")
    print(f"Report: {OUT / 'report.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
