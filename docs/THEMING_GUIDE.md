# Veggat Theming Guide

> How to customize accent colors and brand styling across the app

## Quick Start: Changing Accent Colors

All accent colors are defined in **one place**: `frontend/app/globals.css`

### Current Configuration
- **Light mode**: Sky blue (`sky-500` = `#0ea5e9`)
- **Dark mode**: Emerald green (`emerald-500` = `#10b981`)

### How to Change Colors

#### 1. Find the Brand Accent Section

Open `frontend/app/globals.css` and search for `BRAND ACCENT COLORS`.

You'll find two sections:
1. **Light mode** (inside `:root { ... }`)
2. **Dark mode** (inside `.dark { ... }`)

#### 2. Update the HSL Values

Each color needs 5 values updated:

```css
/* Example: Changing light mode from sky to violet */
:root {
  --brand-accent: 262 83% 58%;           /* violet-500: #8b5cf6 */
  --brand-accent-hover: 263 70% 50%;     /* violet-600: #7c3aed */
  --brand-accent-light: 261 83% 66%;     /* violet-400: #a78bfa */
  --brand-accent-muted: 262 83% 58%;     /* same as base, used with opacity */
  --brand-accent-foreground: 0 0% 100%;  /* white text on accent */
}
```

### Popular Color Presets

#### Sky Blue (Current Light Mode)
```css
--brand-accent: 199 89% 48%;           /* #0ea5e9 */
--brand-accent-hover: 200 98% 39%;     /* #0284c7 */
--brand-accent-light: 198 93% 60%;     /* #38bdf8 */
```

#### Emerald Green (Current Dark Mode)
```css
--brand-accent: 160 84% 39%;           /* #10b981 */
--brand-accent-hover: 161 94% 30%;     /* #059669 */
--brand-accent-light: 160 84% 46%;     /* #34d399 */
```

#### Violet/Purple
```css
--brand-accent: 262 83% 58%;           /* #8b5cf6 */
--brand-accent-hover: 263 70% 50%;     /* #7c3aed */
--brand-accent-light: 261 83% 66%;     /* #a78bfa */
```

#### Rose/Pink
```css
--brand-accent: 350 89% 60%;           /* #f43f5e */
--brand-accent-hover: 350 89% 52%;     /* #e11d48 */
--brand-accent-light: 352 83% 71%;     /* #fb7185 */
```

#### Amber/Orange
```css
--brand-accent: 38 92% 50%;            /* #f59e0b */
--brand-accent-hover: 32 95% 44%;      /* #d97706 */
--brand-accent-light: 43 96% 56%;      /* #fbbf24 */
```

#### Cyan/Teal
```css
--brand-accent: 187 85% 43%;           /* #06b6d4 */
--brand-accent-hover: 192 91% 36%;     /* #0891b2 */
--brand-accent-light: 183 79% 54%;     /* #22d3ee */
```

---

## Using Brand Accent in Components

### Tailwind Classes

Use these utility classes in your TSX components:

```tsx
// Backgrounds
className="bg-brand-accent"        // Solid accent background
className="bg-brand-accent/10"     // 10% opacity (subtle bg)
className="bg-brand-accent/20"     // 20% opacity

// Text
className="text-brand-accent"      // Accent text color
className="text-brand-accent-light" // Lighter shade

// Borders
className="border-brand-accent"    // Accent border
className="border-brand-accent/30" // 30% opacity border

// Focus rings
className="ring-brand-accent"      // Focus ring

// Hover states
className="hover:bg-brand-accent-hover" // Darker on hover
```

### CSS Custom Properties

For inline styles or custom CSS:

```css
.my-element {
  background: hsl(var(--brand-accent));
  color: hsl(var(--brand-accent-foreground));
}

/* With opacity */
.my-subtle-bg {
  background: hsl(var(--brand-accent) / 0.1);
}
```

### Gradients

```tsx
className="bg-gradient-to-r from-brand-accent to-brand-accent-light"
```

---

## Component Reference

### Elements Using Brand Accent

These components/features use the brand accent color:

| Element | File | Description |
|---------|------|-------------|
| Focus rings | `globals.css` | Input focus states |
| Floating spheres | `fancy-background.tsx` | Animated orbs (use `color="brand"`) |
| Navigation highlight | Various | Active tab indicators |
| Pulse icon | `/pulse` page | Pulsing notification dot |
| Ask AI button | `LandingChatWidget.tsx` | CTA button styling |
| Moving borders | Various | Hover glow effects |

### Legacy Components

Some older components still use hardcoded `emerald-*` classes. These should be migrated to `brand-accent-*` over time.

To find them: `grep -r "emerald-500\|emerald-400\|emerald-600" frontend/`

---

## HSL Color Reference

HSL format: `hue saturation% lightness%`

| Color | Hue | Example HSL |
|-------|-----|-------------|
| Red | 0 | `0 84% 60%` |
| Orange | 25 | `25 95% 53%` |
| Amber | 38 | `38 92% 50%` |
| Yellow | 48 | `48 96% 53%` |
| Lime | 84 | `84 81% 44%` |
| Green | 142 | `142 71% 45%` |
| Emerald | 160 | `160 84% 39%` |
| Teal | 172 | `172 66% 50%` |
| Cyan | 187 | `187 85% 43%` |
| Sky | 199 | `199 89% 48%` |
| Blue | 217 | `217 91% 60%` |
| Indigo | 235 | `235 74% 67%` |
| Violet | 262 | `262 83% 58%` |
| Purple | 280 | `280 87% 54%` |
| Fuchsia | 300 | `300 90% 67%` |
| Pink | 330 | `330 81% 60%` |
| Rose | 350 | `350 89% 60%` |

---

## Testing Your Changes

1. Change the CSS variables in `globals.css`
2. Run `npm run dev` in the frontend folder
3. Toggle between light/dark mode to see both variants
4. Check these pages:
   - `/` (home page - Ask AI widget)
   - `/pulse` (pulsing icon)
   - `/products` (filter sidebar, product cards)
   - `/polls/create` (poll builder)

---

## Troubleshooting

**Q: My color isn't showing?**

Make sure you're using the correct format:
- HSL values WITHOUT `hsl()` wrapper: `199 89% 48%` ✅
- NOT: `hsl(199, 89%, 48%)` ❌

**Q: Old emerald colors are still showing?**

Some components use hardcoded Tailwind classes like `text-emerald-500`. These need manual migration to `text-brand-accent`.

**Q: Focus rings aren't updating?**

The `--ring` variable references `--brand-accent`. Make sure the browser has reloaded with hard refresh (Ctrl+Shift+R).
