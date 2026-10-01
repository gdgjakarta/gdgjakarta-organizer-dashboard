# Design Tokens & Theming System

This guide documents the design token architecture, theme presets, styling conventions, and brand identity implemented in the **GDG Jakarta Organizer Dashboard**.

---

## 1. Design System Architecture

The dashboard is built on **Tailwind CSS v4** combined with **shadcn/ui** (`radix-nova` style) using CSS variables for semantic theme tokens.

### Theme Layers:
```
┌──────────────────────────────────────────────────────────┐
│                   Theme Presets (.css)                   │
│   src/styles/presets/ (tangerine, brutalist, soft-pop)   │
└────────────────────────────┬─────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────┐
│                 Semantic CSS Variables                   │
│   --background, --foreground, --card, --primary, ...    │
└────────────────────────────┬─────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────┐
│                 Tailwind Semantic Tokens                 │
│   bg-background, text-foreground, border-border, ...     │
└──────────────────────────────────────────────────────────┘
```

---

## 2. Semantic Theme Tokens

Always use semantic theme tokens instead of hardcoded colors or raw utility shades. This ensures screens work seamlessly across **Light Mode**, **Dark Mode**, and all **Theme Presets**.

| Semantic Class | Target Use Case | Example |
|---|---|---|
| `bg-background` / `text-foreground` | Main page canvas and primary readable body text | `<div className="min-h-screen bg-background text-foreground">` |
| `bg-card` / `text-card-foreground` | Content cards, widgets, panel containers | `<Card className="bg-card text-card-foreground">` |
| `border-border` | Default border strokes on cards, dividers, inputs | `<div className="border border-border">` |
| `bg-primary` / `text-primary-foreground` | Primary action buttons, active indicator pills | `<Button className="bg-primary text-primary-foreground">` |
| `bg-secondary` / `text-secondary-foreground` | Secondary buttons, subtle badges, filter chips | `<Badge className="bg-secondary text-secondary-foreground">` |
| `bg-muted` / `text-muted-foreground` | Inactive tabs, disabled states, helper subtext | `<p className="text-sm text-muted-foreground">` |
| `bg-accent` / `text-accent-foreground` | Hover states, selected table rows, list highlights | `<tr className="hover:bg-accent/50">` |
| `bg-destructive` / `text-destructive-foreground` | Delete actions, error banners, check-in warnings | `<Button variant="destructive">` |
| `ring-ring` | Keyboard focus rings and outline accents | `<input className="focus-visible:ring-2 focus-visible:ring-ring">` |

---

## 3. Strict Token Enforcement Rules

> [!CAUTION]
> **No Arbitrary Color Literals Rule**:
> 1. **DO NOT use arbitrary hex, rgb, or oklch values** (e.g. `bg-[#4285F4]`, `text-[#1e1e1e]`).
> 2. Always reach for semantic CSS tokens first (`bg-primary`, `bg-muted`, `border-border`).
> 3. If a specific brand or status accent is required that is not provided by the current theme preset, use standard named Tailwind colors (e.g. `text-blue-600`, `bg-emerald-500/10`, `text-amber-500`).

---

## 4. Google Developer Groups (GDG) Brand Palette

When styling GDG-specific highlights, badges, icons, or status pills, map them to standard Tailwind color tokens that align with the official GDG brand guidelines:

- **Google Blue**: `bg-blue-600`, `text-blue-600`, `border-blue-500`
- **Google Red**: `bg-red-600`, `text-red-600`, `border-red-500`
- **Google Yellow**: `bg-amber-500` / `yellow-500`, `text-amber-600`, `border-amber-400`
- **Google Green**: `bg-emerald-600` / `green-600`, `text-emerald-600`, `border-emerald-500`

---

## 5. Theme Presets (`src/styles/presets/`)

The application supports real-time switching between curated visual presets:

1. **Tangerine (`tangerine.css`)**:
   - Modern, energetic palette with warm orange accents, rounded borders, and crisp card elevation.
2. **Brutalist (`brutalist.css`)**:
   - High-contrast typography, sharp borders (`border-2 border-black dark:border-white`), and bold drop shadows (`shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`).
3. **Soft Pop (`soft-pop.css`)**:
   - Playful, rounded aesthetic with pastel undertones, subtle gradients, and pill-shaped elements.

Presets are generated via `npm run generate:presets` and applied at runtime via data attributes (`data-theme="tangerine"`) on the `<html>` or `<body>` element.
