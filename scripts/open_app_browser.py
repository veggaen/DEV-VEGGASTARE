#!/usr/bin/env python
"""
open_app_browser.py — "Open in browser" helper.

Launches YOUR real Chrome (not an automation browser) with a remote-debugging
port, using a dedicated persistent profile, and navigates to the app. Because
this is a genuine Chrome with no automation flags during login, Google OAuth
works normally (the "this browser may not be secure" block does NOT trigger).

You log in once here; the profile persists, so future runs are already signed in.
The open Chrome exposes CDP on the debug port, which drive_wallet_panel.py
attaches to (it does NOT launch its own browser).

Usage:
    python scripts/open_app_browser.py [BASE_URL] [--port 9222]

Leave this window open while driving. Close it when done.
"""
from __future__ import annotations
import subprocess
import sys
from pathlib import Path

ARGS = sys.argv[1:]
BASE = next((a for a in ARGS if a.startswith("http")), "http://localhost:3000")
PORT = "9222"
if "--port" in ARGS:
    PORT = ARGS[ARGS.index("--port") + 1]

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
# Dedicated debug profile so the port always works and your MAIN profile/browsing
# is untouched. Lives under the repo's _probe dir (gitignored).
DEBUG_PROFILE = str(Path(__file__).parent / "_probe" / "chrome-debug-profile")


def main() -> int:
    Path(DEBUG_PROFILE).mkdir(parents=True, exist_ok=True)
    args = [
        CHROME,
        f"--remote-debugging-port={PORT}",
        f"--user-data-dir={DEBUG_PROFILE}",
        "--no-first-run",
        "--no-default-browser-check",
        BASE,
    ]
    print(f"Launching your Chrome -> {BASE}")
    print(f"  debug port : {PORT}")
    print(f"  profile    : {DEBUG_PROFILE}")
    print("\n>>> Log in normally (Google etc.) in the window that opens.")
    print(">>> Leave it OPEN, then run:  python scripts/drive_wallet_panel.py")
    # Detach so this returns immediately; Chrome keeps running with the debug port.
    subprocess.Popen(args, close_fds=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
