# OMS Lundi Aprem — Design System

Source of truth for every visual primitive used in the app.
**Components consume tokens. Tokens never live in components.**

```
src/styles/
├── design-tokens.css   ← palette, spacing, radii, shadows, type families
├── typography.css      ← six canonical text styles (.t-*)
└── README.md           ← you are here
```

Both stylesheets are imported once at the top of `src/index.css`,
which is the single entry point loaded from `src/main.tsx`. Tailwind
utilities are mapped to these tokens in `tailwind.config.js`.

---

## The two hard rules

### 1. Never use raw color values inline

```tsx
// ❌ Forbidden — disconnects the component from the system
<div style={{ color: "#202930", background: "#F4F4F2" }} />
<div className="text-[#4A6274] bg-[#EAEFF3]" />

// ✅ Use the canonical Tailwind classes (mapped to tokens)
<div className="text-ink-800 bg-ink-50" />
<div className="text-accent-500 bg-accent-50" />

// ✅ Or reference the token directly when Tailwind isn't ergonomic
<div style={{ boxShadow: "var(--shadow-2)" }} />
```

This applies to **every visual property**: color, background,
border-color, fill, stroke, shadow.

### 2. Never use spacing values outside the 4pt scale

The scale is `--s-1` (4px) through `--s-20` (80px) in 4px increments.
If your design needs `7px` or `13px`, the design is wrong — round
to the nearest scale step.

```tsx
// ❌ Forbidden
<div className="p-[13px] gap-[7px]" />
<div style={{ marginTop: 18 }} />

// ✅ Tailwind classes (s-* prefix avoids collision with default scale)
<div className="p-s-3 gap-s-2" />     // 12px padding, 8px gap
<div className="mt-s-5" />            // 20px margin-top

// ✅ Direct token reference
<div style={{ marginTop: "var(--s-5)" }} />
```

The `s-*` prefix matters: `p-4` is the Tailwind default (16px) and
remains available — but new code should pick a side and stick with
the canonical scale (`p-s-4`).

---

## Cheatsheet

### Color

| Role          | Token              | Tailwind class                |
| ------------- | ------------------ | ----------------------------- |
| Page bg       | `--ink-25`         | `bg-ink-25`                   |
| Paper bg      | `--ink-50`         | `bg-ink-50`                   |
| Border (rest) | `--ink-200`        | `border-ink-200`              |
| Muted text    | `--ink-400/500`    | `text-ink-400` / `text-ink-500` |
| Body text     | `--ink-700`        | `text-ink-700`                |
| Title         | `--ink-800/900`    | `text-ink-800` / `text-ink-900` |
| Primary CTA   | `--accent-500`     | `bg-accent-500 text-white`    |
| Selected card | `--accent-50`      | `bg-accent-50`                |
| Success       | `--positive-500`   | `text-positive-500`           |
| Urgent        | `--warning-500`    | `text-warning-500`            |
| Destructive   | `--danger-500`     | `text-danger-500`             |

### Spacing

`s-1`=4px · `s-2`=8 · `s-3`=12 · `s-4`=16 · `s-5`=20 · `s-6`=24 · `s-8`=32 · `s-10`=40 · `s-12`=48 · `s-16`=64 · `s-20`=80

(Every step in between exists too — `s-7`, `s-9`, `s-11`, etc.)

### Radii

| Use                         | Token       | Tailwind        |
| --------------------------- | ----------- | --------------- |
| Inputs, chips               | `--r-1` 6px | `rounded-r-1`   |
| Buttons, compact cards      | `--r-2` 8   | `rounded-r-2`   |
| Default card                | `--r-3` 10  | `rounded-r-3`   |
| Modal, large card           | `--r-4` 12  | `rounded-r-4`   |
| Feature card, hero          | `--r-5` 16  | `rounded-r-5`   |
| Pill, capsule, avatar       | `--r-pill`  | `rounded-r-pill` |

### Shadows

| Use                       | Token         | Tailwind     |
| ------------------------- | ------------- | ------------ |
| Resting card / table row  | `--shadow-1`  | `shadow-1`   |
| Hover lift                | `--shadow-2`  | `shadow-2`   |
| Modal / popover           | `--shadow-3`  | `shadow-3`   |

### Typography

Apply one of the six classes — never restyle text inline.

| Class        | Family        | Use                              |
| ------------ | ------------- | -------------------------------- |
| `.t-display` | Inter Tight   | Hero, page title (rare)          |
| `.t-h1`      | Inter Tight   | Section title                    |
| `.t-h2`      | Inter Tight   | Subsection title, modal heading  |
| `.t-body`    | Inter         | Default reading text             |
| `.t-label`   | Inter         | Small uppercase UI label         |
| `.t-num`     | JetBrains Mono | Numbers, IDs, totals (tabular)  |

---

## Adding to the system

Need a value that isn't here? Don't reach for an inline override —
extend the system:

1. Add the token to `design-tokens.css` with a usage comment.
2. Map it into `tailwind.config.js` so Tailwind utilities pick it up.
3. Update this README's cheatsheet.
4. Use it.

If a "one-off" value feels justified, it almost always means the
design system is missing a role — propose the addition in PR review.

---

## Notes & migration paths

- **Fonts are loaded via Google Fonts (`<link>` in `index.html`).**
  This is fine for development and early production. For
  privacy/performance hardening, switch to self-hosted variable
  fonts (`@font-face` + WOFF2) — variables stay the same.

- **Legacy aliases.** `design-tokens.css` re-exports the older OLDA
  names (`--brand-duck-*`, `--fg-1..4`, `--brand-paper`, etc.) as
  pointers to the canonical tokens. Existing markup keeps working.
  New code should use the canonical names.

- **`index.css` workflow tokens.** Status-badge colors
  (`--status-*`) and new-order panel chrome (`--no-brand-*`) live
  there because they're feature-scoped, not part of the global
  palette. They reference the canonical accent tokens.

- **Tailwind config is `.js`, not `.ts`.** No functional difference
  for token mapping. A future migration is its own chantier.
