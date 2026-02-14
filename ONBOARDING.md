# Onboarding — Veggat Contributor Guide

> **Everything you need to get running and start contributing.**
> This is the only doc you need to read. It links to deeper docs when relevant.

**Last Updated:** 2026-02-14

---

## 1. What Is Veggat?

Veggat is a **Web3-enabled marketplace + social platform** at [veggat.com](https://www.veggat.com).
Users buy/sell products, trade crypto P2P (OSRS-style), post to a social feed (Pulse), take advanced polls/quizzes, and build reputation via the True Reach™ scoring system.

**Two-service monorepo:**

| Service | Tech | Port | Hosted On |
|---------|------|------|-----------|
| **Frontend** | Next.js 16 + React 19 + Prisma | 3000 | Vercel |
| **Backend** | Hapi.js 21 + Socket.IO + Prisma | 3001 (API) + 3002 (WS) | Railway |

Both share a PostgreSQL database (Neon).

---

## 2. Setup

### Prerequisites

- **Node.js 20+** and **npm**
- **Git** configured with your GitHub account
- Access to the GitHub repo (ask the owner for an invite)
- A `.env.local` file for frontend and `.env` file for backend (the owner will provide these)

### Installation

```bash
# 1. Clone and enter the repo
git clone <repo-url>
cd DEV-VEGGASTARE

# 2. Install root deps (concurrently — lets you start both servers at once)
npm install

# 3. Frontend setup
cd frontend
npm install
npx prisma generate       # generates the Prisma client (required!)
npx prisma migrate dev    # applies database migrations
cd ..

# 4. Backend setup
cd backend
npm install
cd ..
```

### Starting Dev Servers

Pick whichever method you prefer:

| Method | Command | What Happens |
|--------|---------|-------------|
| **Both at once (recommended)** | `npm run dev` from repo root | Frontend + Backend, colored output |
| **VS Code task** | `Ctrl+Shift+B` | Both in split terminal panels |
| **Frontend only** | `npm run dev:fe` | localhost:3000 |
| **Backend only** | `npm run dev:be` | localhost:3001 + :3002 |

---

## 3. Project Structure (what you need to know)

```
DEV-VEGGASTARE/
├── frontend/              # Next.js app (UI + auth + DB + API routes)
│   ├── app/               # Pages & routes (App Router)
│   ├── actions/           # Server actions (all DB mutations go here)
│   ├── components/        # UI components
│   │   ├── ui/            # shadcn/ui primitives (don't modify)
│   │   └── uicustom/      # Custom components (this is where you'll work)
│   ├── prisma/            # schema.prisma — THE database schema
│   ├── lib/               # Utilities, helpers
│   ├── hooks/             # React hooks
│   └── schemas/           # Zod validation schemas
├── backend/               # Hapi.js API + WebSocket server
│   └── src/               # All backend source code
├── agent.md               # Full project context (read if you want the deep picture)
└── MasterContext.md        # Architecture invariants (read before making changes)
```

---

## 4. Rules You Must Follow

These are hard rules. Breaking them causes bugs.

| # | Rule |
|---|------|
| 1 | **Never import `auth()` in client components.** Auth is server-side only. |
| 2 | **Run `npx prisma generate` after any schema change.** The generated client is not committed. |
| 3 | **`frontend/prisma/schema.prisma` is the canonical schema.** Don't edit the backend copy. |
| 4 | **All mutations use Zod validation.** Check `schemas/` for existing schemas. |
| 5 | **Server Components by default.** Only add `"use client"` when you need interactivity. |
| 6 | **Webpack mode only.** `next dev --webpack`, `next build --webpack` (not Turbopack). |
| 7 | **Never commit `.env` files, `database-backups/`, or `generated/prisma/`.** |
| 8 | **Add `@fileOverview` and `@stability` tags** to files you create. |

---

## 5. Git Workflow

**You work on feature branches. You never push to `dev` or `main` directly.**

```
                    you work here
                         │
                         ▼
feat/my-feature ──push──▶ open PR to dev ──▶ owner reviews ──▶ owner merges
```

### Step by step:

```bash
# 1. Start from dev (always pull first)
git checkout dev
git pull origin dev

# 2. Create your feature branch
git checkout -b feat/my-feature

# 3. Code your changes...

# 4. Commit with a clear message
git add .
git commit -m "feat: add product search filter"

# 5. Push your branch
git push -u origin feat/my-feature

# 6. Open a Pull Request → dev on GitHub
#    CI will run automatically. Fix any issues it finds.
#    The owner will review and merge.
```

### Branch naming:
- `feat/short-name` — new feature
- `fix/short-name` — bug fix
- `chore/short-name` — cleanup, config, deps

### What you DON'T do:
- ❌ Push to `main` (production deploys happen here)
- ❌ Push to `dev` directly (owner merges PRs into dev)
- ❌ Merge your own PRs (wait for review)

> **Safety net:** A git hook will block you automatically if you accidentally try to push to `main` or `dev`. You'll see a clear error message telling you to push your feature branch instead.

### Opening a PR

When you open a PR on GitHub, a **PR template** is pre-filled with a checklist. Fill it out — it helps the reviewer go faster.

### Reporting bugs / requesting features

Use the **issue templates** on GitHub:
- 🐛 Bug Report — something broken
- ✨ Feature Request — new idea

---

## 6. What Happens When You Push

1. **CI runs automatically** — GitHub Actions checks your code:
   - Frontend: type-check + build + lint + Prisma validation + migration drift check
   - Backend: type-check
   - If CI fails, fix the errors before requesting review.

2. **Vercel creates a preview** — every PR gets a unique preview URL. Use it to test.

3. **Owner reviews** — they'll review your code and either approve or request changes.

4. **Owner merges to dev** — your code goes to the staging environment.

5. **Owner ships to main** — when ready, they merge dev → main (production deploy).

---

## 7. Common Tasks

### Adding a new page
Create `frontend/app/my-page/page.tsx`. It's a Server Component by default.

### Adding a server action (DB mutation)
Create or edit a file in `frontend/actions/`. Validate input with Zod. Use Prisma for queries.

### Modifying the database
1. Edit `frontend/prisma/schema.prisma`
2. Run `npx prisma migrate dev --name describe-your-change`
3. Run `npx prisma generate`
4. Commit both the schema change AND the migration file

### Adding a component
- Simple/primitive → `frontend/components/ui/` (prefer shadcn/ui)
- Feature-specific → `frontend/components/uicustom/your-feature/`

### Running lint
```bash
npm run lint              # from repo root
# or
cd frontend && npm run lint
```

---

## 8. Environment Variables

You'll receive `.env.local` (frontend) and `.env` (backend) from the owner. Key ones:

**Frontend** (`.env.local`):
- `DATABASE_URL` — PostgreSQL connection string
- `AUTH_SECRET` — NextAuth secret
- `NEXTAUTH_URL` — `http://localhost:3000`
- OAuth keys (Google, GitHub, Discord)
- `NEXT_PUBLIC_PUSHER_KEY` / `CLUSTER` — real-time events
- `NEXT_PUBLIC_BACKEND_URL` — `http://localhost:3001`
- `NEXT_PUBLIC_WS_URL` — `http://localhost:3002`

**Backend** (`.env`):
- `PORT` — 3001
- `WS_PORT` — 3002
- `DATABASE_URL` — PostgreSQL connection string
- Pusher keys

> Never commit these. They're in `.gitignore`.

---

## 9. Need More Context?

| Document | When to read it |
|----------|----------------|
| [agent.md](agent.md) | Full deep-dive into the entire project |
| [MasterContext.md](MasterContext.md) | Before changing architecture or invariants |
| [architecture.md](architecture.md) | To understand how services connect |
| [prd.md](prd.md) | To see what's shipped vs planned |
| [frontend/README.md](frontend/README.md) | Detailed frontend setup |
| [backend/README.md](backend/README.md) | Detailed backend setup |

---

## 10. Quick Reference

```bash
npm run dev          # start both servers
npm run dev:fe       # frontend only
npm run dev:be       # backend only
npm run lint         # lint frontend

cd frontend
npx prisma generate  # after schema changes
npx prisma migrate dev --name my-change  # create migration
npx prisma studio    # browse DB in browser

git checkout -b feat/my-feature   # new branch
git push -u origin feat/my-feature  # push & create PR
```

**Questions?** Ask the owner (v3gga) or check the docs above.
