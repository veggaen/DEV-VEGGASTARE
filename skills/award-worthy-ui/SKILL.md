---
name: award-worthy-ui
description: How to style pages in this repo (VeggaStare) and how to build award-worthy UI in general — design tokens, theming rules, motion, hover/press states, elevation, commerce UX patterns. Use whenever creating or restyling any page, component, or interaction in the frontend.
---

# Award-Worthy UI — VeggaStare styling system & general techniques

Two parts: (1) the rules of THIS codebase, (2) the general craft techniques that make UI feel award-worthy anywhere. Read part 1 before touching any frontend file.

## Part 1 — How THIS app is styled

### Architecture

- Next.js App Router, Tailwind v4 (`@theme inline` in `frontend/app/globals.css`), shadcn-style kit in `frontend/components/ui/`, custom components in `frontend/components/uicustom/`.
- Theme = `next-themes` toggling `.dark` on `<html>`. **Theme state lives ONLY on `<html>`.** Never mirror it onto `<body>` or into React state — dual-tracking caused the historic "light gradients on dark background" bug.
- Fonts: Poppins for auth headings; system stack elsewhere.

### The token system (globals.css) — the single source of truth

Semantic tokens, all HSL triplets consumed as `hsl(var(--token))`:

| Token | Meaning |
|---|---|
| `background` / `foreground` | page base / ink |
| `surface-1/2/3` | elevation by lightness (surface-1 = raised card) |
| `card`, `popover`, `input`, `border` | component surfaces |
| `muted`, `muted-foreground` | quiet surfaces / secondary text |
| `brand-accent`, `-hover`, `-light`, `-foreground` | THE accent. Sky-500 in light, emerald-500 in dark — automatically |
| `destructive` | errors/danger |
| `--elevation-1/2/3` → `shadow-e1/e2/e3` | theme-aware shadow scale |
| `--ease-out-quart`, `--ease-spring` | motion easings |

**Golden rules:**

1. **Never hardcode `zinc-*`, `gray-*`, `white`, `black` for surfaces/text/borders.** Use tokens. Every light-mode bug in this app's history came from dark-authored hardcoded utilities later patched with `!important` compat layers (see the poll-builder and product-detail scopes in globals.css — those are quarantined legacy, never extend them, delete them when their pages are rewritten).
2. **Accent = `brand-accent` tokens, never raw `emerald-*`/`sky-*`** — raw colors break the theme-adaptive accent (light=sky, dark=emerald). Exception: semantic status colors (success emerald, warning amber, error red) — but ALWAYS as a light/dark pair: `text-emerald-600 dark:text-emerald-400`, `text-amber-700 dark:text-amber-200`.
3. **Small accent text needs the darker step for contrast:** `text-brand-accent-hover dark:text-brand-accent-light` (sky-500 on white is only ~2.8:1).
4. If a class has no `dark:` pair and isn't a token, it's a bug waiting for the other theme.

### Component kit conventions (`components/ui/`)

- `Button` — variants include legacy `vega*` names, now token-based. Semantics: `vegaBuyBtn` = loudest CTA (money actions), `vegaAddBasketBtn` = accent outline (secondary commerce), `vegaAddWishlistBtn` = quietest, `vegaEmeraldBtn` = general primary CTA, `vegaNormalBtn(-Red)` = neutral secondary (destructive-leaning). Size `touch` (48px) for primary mobile CTAs. Base includes `motion-safe:active:scale-[0.97]` press feedback — don't duplicate it.
- `Input`/`Textarea`/`SelectTrigger` — `bg-input border-border/70`, brand-accent focus ring via `focus-visible:border-brand-accent/60 focus-visible:shadow-[0_0_0_3px_hsl(var(--brand-accent)/0.14)]`, `aria-invalid` → destructive styling. Set `aria-invalid` on failed validation; the styling is automatic.
- `Card` — token border, emits `data-card` (light-mode elevation rules in globals.css hook onto it).
- `Dialog` — frosted scrim (`bg-black/60 backdrop-blur-sm`), `bg-popover shadow-e3 rounded-xl`.
- Form feedback: `MyFormError` / `MyFormSuccess` (uicustom/forms) — animated, `role=alert/status`.
- Auth pages: wrap in `CardWrapper` (uicustom/auth) — full-height stage, brand glow backdrop, frosted card, entrance animation. `headerLabel` renders as the page title.

### Reusable CSS hooks (globals.css)

`.auth-card-enter` (calm slide-up entrance) · `.message-bubble-enter` (fast pop-in) · `.scroll-reveal`+`.revealed` (IntersectionObserver reveals) · `.glass-panel` (theme-aware glassmorphism) · `.hero-spotlight` (cursor spotlight) · `.kinetic-char` (per-character title intro) · `.noise-overlay` (masks gradient banding) · `.no-scrollbar`, `.overscroll-contain-y`, `.fade-mask-*`.

Theme toggle cross-fade: `themebtn.tsx` adds `.theme-transitioning` to `<html>` for ~520ms; only then do colors transition (320ms). Don't add global `transition: all` anywhere — it smears hover states and fights this system.

### Page recipes used in this app

- **Page header:** eyebrow (`text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground`) + `text-2xl sm:text-3xl font-semibold tracking-tight` title + `border-b border-border pb-5`.
- **Two-column commerce layout:** `grid lg:grid-cols-[minmax(0,1fr)_360px]`, right column `lg:sticky lg:top-6 lg:self-start` for the summary.
- **Checkout journey:** step indicator (Cart → Checkout → Confirmation), inline dismissible error banners (NEVER full-page error takeovers that destroy typed input), trust cue under pay button, pay CTA shows the exact amount ("Confirm & pay 0.0412 ETH").
- **Empty states:** icon in a soft `rounded-2xl bg-muted/60 ring-1 ring-border/60` tile + one-line title + one-line hint + a single CTA with `hover:gap-3` arrow slide.
- **Loading:** skeletons that mirror the real layout (see cart/checkout), staggered opacity per row. Never a spinner-only page.
- **Optimistic mutations:** update UI instantly, disable only the affected row (per-item pending set), roll back on failure — see cart page.

## Part 2 — General award-worthy techniques

### Hierarchy & layout

- One focal point per screen. The primary action must be visually loudest; demote everything else (quiet secondaries, ghost tertiaries).
- Type scale with contrast: big titles `tracking-tight`, tiny labels uppercase + `tracking-[0.2em]`. Numbers always `tabular-nums`.
- Space in a consistent rhythm (4/8px grid). Group with whitespace before reaching for borders; borders before boxes; boxes only for true elevation.
- Max content width + generous side padding. Sticky summary/side rails for long flows.

### Color & depth

- Semantic tokens first; theme by swapping token values, not by sprinkling `dark:` everywhere.
- Light mode: express depth with layered soft shadows (two shadows: tight+ambient) and pure-white cards on an off-white page. Dark mode: shadows barely read — express depth with SURFACE LIGHTNESS steps instead; keep shadows whisper-soft.
- Accent discipline: one accent color, used sparingly (focus rings, active states, primary CTA, tiny highlights). If everything is accented, nothing is.
- Gradients: subtle radial glows anchored to a corner/top, faded by mid-page; add a noise overlay to hide banding.

### Motion (what separates good from award-worthy)

- Durations: 150–250ms for feedback, 300–500ms for entrances. Easing: ease-out-quart for UI response; spring overshoot only for small playful elements.
- Hover = lift (`-translate-y-px` to `-translate-y-0.5` + shadow bloom). Press = scale down (~0.97). **Never shrink on hover** — shrinking reads as retreat.
- Entrances: stagger children 30–80ms apart; slide-up 8–24px + fade. Exit animations half the duration of entrances.
- Transition ONLY the properties that change (`transition-[color,box-shadow,transform]`), never `all`. Prefer compositor properties (transform/opacity/filter).
- Every animation needs a `prefers-reduced-motion: reduce` fallback (`motion-safe:` prefix or media query).
- Micro-details that get noticed: arrow slides on CTA hover (`transition-[gap] hover:gap-3`), animated success check, count-up numbers, branded text selection, cursor spotlights on heroes.

### Interaction states — every interactive element needs all six

default · hover · active/press · focus-visible (accent outline/ring — keyboard only) · disabled (`opacity-50 pointer-events-none` + `title` explaining why) · pending (spinner IN the control, label change, control stays in place).

Disabled CTAs should tell users what unlocks them ("Fill in address" instead of a dead "Pay" button).

### Forms & commerce UX

- Labels above fields, validation inline on blur, error text next to the field it concerns, `aria-invalid` + `role=alert`.
- 44–48px touch targets on mobile-primary actions (WCAG 2.2).
- Money screens: show totals breakdown live, exact charge amount on the confirm button, trust signals (lock icon + one reassurance line), irreversibility warnings for crypto, countdown timers when rates are locked, never lose typed input on error.
- Confirmation pages are a MOMENT: animated success mark, clear order id, obvious next actions (downloads / track / continue shopping).

### Accessibility as polish

Focus rings on `:focus-visible` only. Contrast: 4.5:1 body text, 3:1 large/UI. `scroll-margin-top` under sticky headers. `aria-live` for async feedback. Alt text always. Keyboard path through every flow.

### Performance as design

- Skeletons mirror real layout (no layout shift), optimistic updates, per-row pending — perceived speed IS UX.
- `next/image` with proper `sizes`; CSS keyframes over JS animation loops; `field-sizing: content` for auto-growing textareas; IntersectionObserver for scroll reveals (never scroll listeners).

### Anti-patterns (all found and removed from this codebase once — don't reintroduce)

- Hardcoded dark-only colors patched later with `!important` layers.
- `hover:scale-95` on buttons (shrink-on-hover), dead classes like `hover:text-md`.
- Hover states that jump to unrelated hues (basket button turning orange).
- Full-page error takeovers on forms.
- Icon-only buttons for major actions with no label or `aria-label`.
- Duplicate theme state (html class + body class).
- `transition: all` / permanently transitioning every element.
