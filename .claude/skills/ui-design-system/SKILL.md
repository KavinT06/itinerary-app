---
name: ui-design-system
description: Visual design rules for this app - the design tokens, typography, layout, component and motion rules in docs/design/DESIGN_SYSTEM.md, the traces of the "AI template" look to avoid, and the screenshot-based review checklist. Use when designing or restyling any screen, choosing colours, fonts, spacing or icons, adding a component under app/components, or reviewing a UI change.
---

# UI design system

Source of truth: `docs/design/DESIGN_SYSTEM.md` (tokens, type scale, components) and
`docs/design/UX_RESEARCH.md` (why). Tokens live in the `@theme` block of `app/globals.css`.
If a rule here and the document disagree, the document wins; fix this file.

## Direction

A calm, confident product in the style of modern SaaS landing pages: a dark brand hero with one vivid
accent, a geometric sans in semibold with tight tracking, a warm off-white content area, thin borders
instead of heavy shadows, generous whitespace, a ~1200 px container, large rounded blocks.

## The AI-template look: never ship these

- Emoji as icons or decoration
- Rainbow or multi-stop gradients (purple-pink-blue), gradient text, gradient cards
- Every block on a white card with `shadow-2xl`; cards inside cards
- `hover:scale` on cards and buttons; spinners and bounce everywhere
- Centred everything; three equal feature cards with an icon in a coloured circle and no point of view
- Hype copy: "Let AI craft your perfect journey", "Dream", "Adventure", "Magic", exclamation marks
- Random Tailwind palette colours (`text-purple-700`, `bg-amber-50`) instead of tokens

## Rules

- **Colour:** brand (dark), accent (one, used sparingly: primary button fill, hero key words, timeline
  dots, the budget marker), neutrals (warm), and semantic warning/danger. The accent is never text, a
  border or an icon on light backgrounds; key numbers stay ink. Every pair used for text meets WCAG AA;
  the ratios are in the design system document.
- **Focus:** one ring colour (the focus token, used for nothing else), 2 px solid with a 2 px offset; never
  inset on the primary button.
- **Type:** one family via `next/font`. Headings weight 600, tracking about -0.02em; body 16 px / 1.5.
  Numbers in tables and times use `tabular-nums`.
- **Spacing:** the 4 px scale; section padding is generous on desktop and tighter but not cramped at 375 px.
- **Shape:** inputs and buttons ~8 px radius; panels ~16 px; pills fully rounded. Borders are 1 px.
- **Elevation:** at most a soft, low-opacity shadow for floating elements. No `shadow-2xl`.
- **Icons:** inline SVG, `aria-hidden`, one stroke width, sized to the text they sit beside.
- **Motion:** 150-250 ms ease-out for state changes; nothing loops except the loading indicator; all
  animation under `motion-safe:`.
- **Copy:** plain, specific, sentence case. Say what the product does and what the user should do next.
- **Truth:** only claims the product backs (up to 14 days, five timed stops a day, an estimated budget,
  no account). Keep the "AI-generated, check before you travel" notice prominent.

## Review checklist (run on screenshots at 1440 px and 375 px)

1. Would a designer mistake this for a template? List any item from the AI-template list above.
2. One focal point per view; hierarchy readable when squinting.
3. Spacing and radii on the scale; edges align to a grid.
4. Accent used only where it means something.
5. Contrast measured, not guessed; focus ring visible on every control.
6. 375 px: no horizontal scroll, 44 px targets, long text wraps, nothing clipped.
7. Loading, error, empty and 404 states are designed, not defaults.
8. `prefers-reduced-motion` disables decorative motion.
