# Component Composition & UI Guidelines

This guide details component composition practices, design system hierarchy, layout rhythm, and component modification rules in the **GDG Jakarta Organizer Dashboard**.

---

## 1. Protected Component Directories

> [!CAUTION]
> **Strict Protected Directories Rule**:
> - **DO NOT modify files inside `src/components/ui/`**.
> - **DO NOT modify files inside `src/components/calendar/`**.
> 
> These directories contain vendor and baseline shadcn/ui components (`radix-nova` style). Keep them intact as upstream primitives. Apply customization, styling classes, or wrapping logic in consumer components where they are used.

If a new shadcn component is required:
```bash
npx skills add shadcn/ui # if skill not installed
npx shadcn@latest add <component-name>
```

---

## 2. Component Hierarchy

Structure components into 3 clear tiers:

```
┌────────────────────────────────────────────────────────┐
│                   Domain Screen Widgets                │
│  src/app/(main)/dashboard/<screen>/_components/        │
│  Tied to specific feature data models & actions        │
│  (e.g., EventCard, CheckInModal, AttendeeSearchRow)    │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                    Shared App Components               │
│  src/components/                                       │
│  Feature-agnostic or cross-cutting application widgets │
│  (e.g., GdgLogo, EventRegistrationModal, SimpleIcon)   │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                  shadcn UI Primitives                  │
│  src/components/ui/                                    │
│  Atomic, headless Radix UI wrappers                    │
│  (e.g., Button, Card, Dialog, Input, Table, Badge)     │
└────────────────────────────────────────────────────────┘
```

---

## 3. Layout Spacing & Rhythm

### 3.1 Prefer Flex / Grid Gap over Redundant Margins
Always use layout gaps (`gap-2`, `gap-4`, `gap-6`) rather than manually sprinkling arbitrary margins on individual child elements:

```tsx
// ✅ RECOMMENDED: Using flex gap for consistent rhythm
<div className="flex flex-col gap-6">
  <div className="flex items-center justify-between gap-4">
    <h1 className="text-2xl font-bold tracking-tight">Active Events</h1>
    <Button size="sm">Create Event</Button>
  </div>
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {events.map((event) => (
      <EventCard key={event.id} event={event} />
    ))}
  </div>
</div>

// ❌ PROHIBITED: Hardcoded ad-hoc margins on every child
<div>
  <h1 className="mb-4 text-2xl">Active Events</h1>
  <Button className="mb-4">Create Event</Button>
  <div className="mt-8">...</div>
</div>
```

### 3.2 Responsive Grid Patterns
Dashboard cards and data grids should collapse cleanly on mobile viewports:
- Mobile (< 768px): 1 column (`grid-cols-1`).
- Tablet (768px - 1024px): 2 columns (`md:grid-cols-2`).
- Desktop (> 1024px): 3 or 4 columns (`lg:grid-cols-3 xl:grid-cols-4`).

---

## 4. Accessibility & Interaction States

1. **Visible Focus**:
   - Ensure all interactive elements retain standard Radix focus outlines (`focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none`).
2. **Keyboard Support**:
   - Modal dialogs, dropdowns, and sheet drawers must support keyboard dismissal (`Escape`) and tab trapping.
3. **Semantic HTML**:
   - Use `<nav>`, `<aside>`, `<main>`, `<header>`, `<footer>`, `<section>`, and `<article>` tags appropriately.
4. **State Coverage**:
   - Always supply appropriate **Loading Skeletons** (`Skeleton`), **Empty States** (`Empty`), **Error Alerts** (`Alert`, `AlertDescription`), and **Disabled States**.
