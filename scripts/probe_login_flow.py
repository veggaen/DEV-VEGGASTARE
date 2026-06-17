#!/usr/bin/env python
"""
probe_login_flow.py — drive the login page interactively against a local
gate-disabled dev server. Verifies OAuth buttons render, the "Connect with
Web3" chooser modal opens, and captures screenshots for visual review.

Usage: .venv/Scripts/python scripts/probe_login_flow.py [BASE_URL]
"""
from __future__ import annotations
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3005"
OUT = Path(__file__).parent / "_probe"
OUT.mkdir(exist_ok=True)


def main() -> int:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        page.goto(f"{BASE}/auth/login", wait_until="networkidle", timeout=60000)

        # 1. Inventory ALL buttons by accessible name (catches icon buttons too).
        print("=== buttons on /auth/login (name | visible | enabled) ===")
        for b in page.get_by_role("button").all():
            try:
                name = (b.get_attribute("aria-label") or b.inner_text() or "").strip().replace("\n", " ")
                print(f"  · {name[:48]!r}  vis={b.is_visible()} en={b.is_enabled()}")
            except Exception as e:
                print(f"  · <err {e}>")

        # 2. Look specifically for OAuth provider affordances (text OR aria/icon).
        print("\n=== OAuth provider detection ===")
        for prov in ["google", "github", "discord"]:
            cnt = page.locator(f"[aria-label*='{prov}' i], button:has-text('{prov}'), "
                               f"img[alt*='{prov}' i], svg[aria-label*='{prov}' i]").count()
            print(f"  {prov}: {cnt} match(es)")

        page.screenshot(path=str(OUT / "login_full.png"), full_page=True)

        # 3. Open the Web3 chooser modal and screenshot it.
        print("\n=== Web3 chooser modal ===")
        web3 = page.get_by_role("button", name="Connect with Web3")
        if web3.count() == 0:
            web3 = page.locator("button:has-text('Web3')")
        if web3.count() > 0:
            web3.first.click()
            page.wait_for_timeout(900)
            dialog = page.get_by_role("dialog")
            opened = dialog.count() > 0 and dialog.first.is_visible()
            print(f"  modal opened: {opened}")
            if opened:
                print("  modal text:", (dialog.first.inner_text() or "")[:200].replace("\n", " | "))
                page.screenshot(path=str(OUT / "web3_chooser.png"), full_page=True)
        else:
            print("  NO 'Connect with Web3' button found")

        browser.close()
    print(f"\nScreenshots in {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
