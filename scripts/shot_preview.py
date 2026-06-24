#!/usr/bin/env python
"""Screenshot /dev/chat-preview in both themes (own headless browser, no auth)."""
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path(__file__).parent / "_probe" / "composer"
OUT.mkdir(parents=True, exist_ok=True)
URL = "http://localhost:3000/dev/chat-preview"

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    for theme in ("dark", "light"):
        ctx = b.new_context(viewport={"width": 1280, "height": 900}, color_scheme=theme)
        ctx.add_cookies([{
            "name": "veggastare_access",
            "value": "granted_TWFpbkFkYzEyMw==",
            "domain": "localhost", "path": "/",
        }])
        pg = ctx.new_page()
        # force the app's theme class (it reads localStorage / class on <html>)
        pg.add_init_script(f"""
          try {{ localStorage.setItem('theme', '{theme}'); }} catch(e) {{}}
        """)
        pg.goto(URL, wait_until="networkidle", timeout=30000)
        pg.evaluate(f"""() => {{
          const h = document.documentElement;
          h.classList.remove('dark','light');
          h.classList.add('{theme}');
        }}""")
        pg.wait_for_timeout(1500)
        full = OUT / f"preview_{theme}.png"
        pg.screenshot(path=str(full))
        vp = pg.viewport_size
        dock = OUT / f"preview_{theme}_dock.png"
        pg.screenshot(path=str(dock), clip={"x":0,"y":max(0,vp["height"]-300),"width":vp["width"],"height":300})
        print(theme, "->", full)
        ctx.close()
    b.close()
