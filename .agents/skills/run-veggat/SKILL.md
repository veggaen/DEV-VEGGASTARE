---
name: run-veggat
description: Run, launch, build, and screenshot the Veggat web app (Next.js frontend). Use when asked to run the app, start the dev server, drive/screenshot a page (/ai, /pulse, /conversations), verify a UI change in the real running app, or capture before/after frames of an animation.
---

# Run Veggat

Veggat is a **Next.js (App Router) web app** in `frontend/`, served by `next dev`
on `http://localhost:3000`. It is **driven over CDP with Playwright**, not
`chromium-cli` (not installed here). The harness is
[.Codex/skills/run-veggat/driver.py](driver.py): it attaches to an
already-running, already-logged-in debug Chrome, clears the site's access gate,
opens a route, and screenshots it.

**Paths below are relative to the repo root** (`c:/Users/v3gga/Documents/DEV-VEGGASTARE`).
Run commands from there. This is a **Windows** machine; the Bash tool is Git Bash.

## Prerequisites

Python deps live in the repo's `.venv` (Playwright is already installed there).
No `apt-get` / `xvfb` — this drives real Chrome on Windows, not a headless Linux
browser. If Playwright is somehow missing: `pip install playwright`.

## Run (agent path) — the driver

Two long-running processes must be up first (start once, leave open):

```bash
# 1. Dev server (leave running in the background)
cd frontend && npm run dev
```

```bash
# 2. Debug Chrome with CDP on :9222 (persistent, logged-in profile). Detaches.
python scripts/open_app_browser.py
```

Then drive any route and screenshot it:

```bash
python .Codex/skills/run-veggat/driver.py --route /ai --name ai
python .Codex/skills/run-veggat/driver.py --route /pulse --name pulse
```

Verified output (this session):

```
OK: {'url': '/ai', 'title': 'AI Chat — Veggat', 'theme': 'light'}
SHOT: ...\scripts\_probe\run-veggat\ai.png bytes= 155302
```

Screenshots land in `scripts/_probe/run-veggat/<name>.png`. The driver prints the
resolved `url` — confirm it's your route and **not** `/gate` (it warns if so).
Click something after load with `--click` (Playwright selector):

```bash
python .Codex/skills/run-veggat/driver.py --route /ai --click "text=New chat" --name newchat
```

### Recording an animation (before/after a motion change)

For hover/transition work, use the existing recorder (attaches to the same debug
Chrome). Pass `--host 127.0.0.1` — `localhost` fails (see Gotchas):

```bash
python scripts/record_animation.py --url /ai --name aicard --frames 18 --interval 55 \
  --host 127.0.0.1 --hover ".group.relative.overflow-hidden.rounded-2xl"
```

Frames + a timeline land in `scripts/_probe/anim/<name>/`. Never judge an
animation from one frame — watch the sequence.

## Build (production)

```bash
cd frontend && npm run build
```

Verified green this session (exit 0). Typecheck: `cd frontend && npx tsc --noEmit`
(verified, exit 0). Lint: `cd frontend && npm run lint` — runs ESLint over the
whole app; it is slow (minutes) and can appear to hang, so prefer scoping it to
changed files, e.g. `cd frontend && npx eslint lib/voice/`.

## Run (human path)

`cd frontend && npm run dev`, open `http://localhost:3000` in a normal browser,
enter the access-gate password, sign in. Useful for manual clicking; the driver
above is what an agent should use because it's scriptable and already past the
gate.

## Gotchas (battle scars from this session)

- **The whole site is behind an access gate.** Every route 307-redirects to
  `/gate` ("private testing mode") until a cookie is set. The driver clears it
  automatically by reading `GATE_PASSWORD` from `frontend/.env` and submitting the
  form. A raw `page.goto("/ai")` lands on the gate, not the page.
- **CDP must be `127.0.0.1`, never `localhost`.** On Windows `localhost` resolves
  to IPv6 `::1` first; Chrome's CDP is IPv4-only → `connect_over_cdp` throws
  `ECONNREFUSED ::1:9222`. The driver hardcodes `127.0.0.1`; `record_animation.py`
  needs `--host 127.0.0.1`.
- **Git Bash mangles leading-slash args.** `--route /ai` arrives as
  `C:/Program Files/Git/ai` (MSYS path conversion) and Playwright rejects it as an
  invalid URL. The driver repairs this (`normalize_route`), so `--route /ai` works
  — but if you script Playwright inline, expect the mangling.
- **`open_app_browser.py` does NOT launch an automation browser** — it opens your
  real Chrome with a dedicated debug profile under `scripts/_probe/`. That profile
  is where you're logged in; the driver reuses it (so OAuth + session persist).
  Leave the window open while driving.
- **Anonymous vs. logged-in.** A fresh debug profile shows the anonymous `/ai`
  ("Start your first chat", 0 conversations). Log in once in the debug Chrome to
  see real data.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `ECONNREFUSED ::1:9222` / `127.0.0.1:9222` | Debug Chrome isn't running. `python scripts/open_app_browser.py`. |
| Driver prints `WARNING: still on /gate` | `GATE_PASSWORD` missing/wrong in `frontend/.env`, or the gate markup changed. |
| `Cannot navigate to invalid URL .../Git/ai` | Git Bash arg mangling — the driver handles it; for inline scripts pass the route differently or use the driver. |
| Screenshot is blank/tiny | Page errored or didn't settle; check the printed `url`/`title`, raise the `wait_for_timeout`. |
