# Copilot Custom Instructions — Veggat

> These instructions are automatically loaded by GitHub Copilot Chat when working in this workspace.
> They define voice commands, workflows, and conventions the owner (v3gga) uses.

---

## Terminal Rules (ALWAYS follow these)

1. **Never use background/hidden terminals.** The user must always see terminal output in VS Code's terminal panel.
2. **"start my project" always uses the VS Code `dev` build task** (`run_task` with id `shell: dev`). This opens `dev:frontend` and `dev:backend` as visible terminal tabs.
3. **Any git or npm commands** should run in a visible (non-background) terminal so the user can see what's happening.
4. **Build checks (lint, type-check, build):** Open a third visible terminal for the check. When it finishes successfully, tell the user it passed — they can close it to get back to their 2-terminal dev view. If it fails, keep it open so they can see the errors.
5. **The user's steady-state is 2 visible terminals** (frontend + backend). Only add temporary terminals for one-off commands, and note when they can be closed.

---

## Owner Workflow Commands

When the user says one of these phrases, follow the corresponding workflow exactly.

### "start my project"

Run both dev servers so the user can start coding immediately.

1. Run the VS Code build task using `run_task` with id `shell: dev` — this launches frontend + backend in **visible** split terminal tabs.
   - Frontend: `cd frontend && npm run dev` → http://localhost:3000
   - Backend: `cd backend && npm run dev` → http://localhost:3001 (API) + :3002 (WS)
2. Confirm both are running. If one fails, show the error and offer to fix it.
3. Say: **"Frontend on :3000, backend on :3001/:3002 — ready to go."**

### "build to main" / "lets build to main" / "ship it"

This is a guarded deployment flow. Do NOT push straight to main. Follow every step:

1. **Ensure working tree is clean.** Run `git status`. If there are uncommitted changes, ask the user for a commit message, then commit.
2. **Ensure we're on `dev` or a feature branch.** If on `main`, stop and say: *"You're on main. Switch to dev first — we never push directly to main."*
3. **Push to `dev`.** Run `VEGGAT_OWNER=1 git push origin dev` (or the current feature branch). Wait for CI.
4. **Tell the user to verify.** Say exactly:
   > **Pushed to dev. CI is running.**
   > Check the Vercel preview deployment and confirm everything looks good.
   > When you're satisfied, say **"verified"** or **"looks good"** and I'll merge to main.
5. **Wait for the user to confirm.** Do nothing until they say "verified", "looks good", "ship it", "go ahead", or similar.
6. **After verification — merge to main:**
   ```
   git checkout main
   git pull origin main
   git merge dev
   VEGGAT_OWNER=1 git push origin main
   git checkout dev
   ```
7. **If Prisma schema changed — push to production DB.** Check if `prisma/schema.prisma` was modified in this deploy:
   ```
   cd frontend
   $env:NODE_ENV="production"; npx prisma db push
   $env:NODE_ENV="development"
   ```
   Vercel does NOT run migrations — skipping this causes 500 errors ("column does not exist").
8. Confirm: **"Merged to main and pushed. Vercel will deploy to veggat.com and Railway will deploy the backend. Back on dev branch."**

### "verified" / "looks good" / "go ahead" (after "build to main")

Continue with step 6 of the "build to main" flow above.

### "status" / "what's running"

Check and report:
- Git branch + clean/dirty status
- Whether dev servers are running
- Last CI status if known

### "stop" / "stop servers"

Kill the running dev server terminals.

---

## Git Rules

- **Never push directly to `main`.** Always go `feature-branch → dev → main` or `dev → main`.
- **`dev` is the staging branch.** Push here for Vercel preview deployments and CI validation.
- **`main` is production.** Pushing here triggers Vercel production deploy (veggat.com) and Railway backend deploy.
- Feature branches: `feat/short-name`, `fix/short-name`, `chore/short-name`.
- Always pull before merge to avoid conflicts.

---

## CI/CD Context

- **CI runs on push to `main` and `dev`**, and on PRs targeting those branches.
- CI does: path filtering (only runs checks for changed service), frontend build + type-check + lint + Prisma validation + migration drift check, backend type-check.
- **Vercel** auto-deploys: `main` → production (veggat.com), `dev` + PRs → preview URLs.
- **Railway** auto-deploys the backend from `main`.
- **Dependabot** opens weekly PRs for npm + GitHub Actions updates.
- **Stale bot** closes abandoned issues/PRs (30d issues, 14d PRs).

---

## Environment Routing

| Branch / Env | Vercel Env | Database | Pusher Prefix |
|-------------|-----------|----------|---------------|
| `main` (production) | production | `DATABASE_URL_MAINLIVE` | *(none)* |
| `dev` / PRs (preview) | preview | `DATABASE_URL_MAINPREVIEW` | `preview__` |
| Local dev | development | `DATABASE_URL` (.env.local) | `dev__` |

---

## Code Conventions

- Read `MasterContext.md` for global invariants before making changes.
- Read `agent.md` for full project context and architecture.
- Server Components by default. `"use client"` only when needed.
- All mutations via server actions with Zod validation.
- Prisma schema is in `frontend/prisma/schema.prisma` (canonical). Run `npx prisma generate` after changes.
- Use Webpack mode: `next dev --webpack`, `next build --webpack`.
- Add `@fileOverview` and `@stability` tags to new files.

---

## Documentation Maintenance (always-on)

After completing any non-trivial change, **check and update** the project docs if the change affects them. This is not optional — it keeps the project self-documenting.

### Files to check

| File | Update when… |
|------|-------------|
| `MasterContext.md` | New modules, changed invariants, new env vars, architecture shifts, security fixes |
| `agent.md` | Feature status changes, new tech, roadmap updates, new conventions |
| `architecture.md` | Service boundaries change, new data flows, deployment changes |
| `prd.md` | Features ship (move from ⏳ to ✅), new features planned |
| `README.md` | Setup steps change, new tooling, quick-link additions |
| `ONBOARDING.md` | Anything that affects the employee workflow or setup |

### How to do it

1. At the **end of a work session** (especially before a commit), scan the list above.
2. If any doc is stale, update the relevant section in place — don't create new files.
3. Keep updates minimal: change the specific line/section, don't rewrite whole docs.
4. Update the `Last Updated` date at the top of any file you touch.

---

## Employee vs Owner

The owner (v3gga) uses this Copilot chat workflow — voice commands like "start my project" and "build to main".

Employees/contributors should follow `ONBOARDING.md` instead. They:
- Work on feature branches only (never touch `dev` or `main` directly)
- Open PRs to `dev` for review
- Do NOT have deploy access — only the owner merges to `main`
