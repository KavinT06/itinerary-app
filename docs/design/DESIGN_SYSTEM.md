# Design system: Dusk Horizon

Status: **proposed**. The owner approves the palette and the font at the design checkpoint, before any
component is built. Until then the values below are the working set.

This document is the source of truth for tokens, type, layout, components and motion. The reasons behind it
are in [`UX_RESEARCH.md`](UX_RESEARCH.md); where the two disagree on a value, this document wins. The tested
strings and structural rules that a redesign must keep are listed in UX_RESEARCH sections 6.1 and 8; they are
not repeated here.

Tokens live in the `@theme` block of `app/globals.css` (section 9). Components use token utilities only
(`bg-night`, `text-muted`, `rounded-panel`); a hex value or a Tailwind palette class in a component is a bug.

---

## 1. Palette decision

Three directions were proposed and scored by an independent judge (fit for travel, distinctiveness from
greatify.ai, accessibility headroom, font, accent discipline, how buildable the hero is).

| Direction | Brand (dark) | Accent | Neutral (page) | Font proposed | Score |
|---|---|---|---|---|---|
| **Dusk Horizon** | night `#0D1530` | saffron `#F6B84B` | paper `#F6F2EA` | Plus Jakarta Sans | **8** |
| Deep Ocean | ocean `#0B2530` | coral `#FF8A5C` | sand `#F6F1E7` | Manrope | 7 |
| Evergreen Explorer | pine `#10251C` | apricot `#F4A863` | linen `#F5EFE4` | Figtree | 6 |

**Winner: Dusk Horizon.** Why:

- **It cannot be mistaken for greatify.** Night (hue 226) is 43 degrees from greatify's teal `#00373A`
  (hue 183); saffron (hue 38) is far from its green `#00DC46` (139) and its secondary orange `#FF8A3B` (24).
  Deep Ocean's coral shares greatify's orange R and G channels, and Evergreen's pine sits between greatify's
  green and teal.
- **The widest contrast margins.** Saffron on night is 10.18:1 and the button label 10.18:1, so the accent
  works as hero text and as a button fill without a second "accent-ink" shade.
- **One accent shade.** The budget figure stays ink, with saffron as a small marker, so nobody can reach for
  the accent as text on a light background.
- **The concept fits the task.** The last light on the horizon over a printed travel document: the itinerary
  is ink on paper, and time, place and order carry the page.

Taken from the other directions (the judge's grafts):

1. **Font: Manrope** (from Deep Ocean) instead of Plus Jakarta Sans, which is the font AI-built landing pages
   use most. Fallback order if Manrope does not hold up on Windows: Figtree, then Plus Jakarta Sans.
2. **Isometric card stack** in the hero (from Deep Ocean), `rotate(-30deg) skewX(30deg) scaleY(.866)`, instead
   of the weaker `rotate(-8deg) skewY(4deg)` tilt.
3. **The planner panel overlaps the hero** by 64 px at desktop (from Deep Ocean), which joins the two and keeps
   form controls out of the glow band.
4. **A tinted accent fill with ink text for the countdown button** (from Deep Ocean) instead of a greyed-out
   button with low-contrast text.
5. **The warm glow stays a small share of the hero** (from Evergreen), so it reads as one brand gradient.

Adjustments made after measurement: the horizon glow drops from 22% to 15% saffron (at 22% the focus ring
fell to 2.67:1); three derived tokens were added (`saffron-hover`, `saffron-disabled`, `budget-chip`); the
timeline dots get a 1 px night ring; one neutral (`sunken`) was added for the AI notice and read-only fields.

---

## 2. Colour tokens

### 2.1 Tokens

| Token | Hex | Role |
|---|---|---|
| `--color-night` | `#0D1530` | Brand dark: hero, 404 band, label colour on the saffron button, timeline-dot ring, active mobile day chip |
| `--color-night-2` | `#1A2550` | Upper stop of the hero gradient; base of the hero glass cards |
| `--color-saffron` | `#F6B84B` | **The one accent.** Hero key words, badge text on the hero, primary button fill, timeline dots, budget marker, active-day dot on dark. Never text, and never the only boundary, on paper or surface |
| `--color-saffron-hover` | `#F7C366` | Primary button hover (15% white over saffron) |
| `--color-saffron-disabled` | `#FCE6C0` | Primary button while disabled ("Please wait Ns", "Generating Itinerary…"), always with ink text (saffron 35% over white) |
| `--color-budget-chip` | `#FDF2DF` | Fill of the estimated-budget chip (saffron 18% over white). The figure on it is ink |
| `--color-paper` | `#F6F2EA` | Page background below the hero; footer |
| `--color-surface` | `#FFFFFF` | Planner panel, status panel, inputs, summary chips |
| `--color-sunken` | `#EFEAE0` | AI notice strip, read-only inputs while submitting, secondary-button hover |
| `--color-ink` | `#131A2C` | Text on paper, surface and every tinted fill; itinerary times |
| `--color-muted` | `#575E70` | Secondary text on light: hints, placeholders, descriptions, labels of chips, footer |
| `--color-hairline` | `#E3DCCF` | Decorative 1 px rules: panel outlines, dividers, timeline rail, skeleton bars. Never the only boundary of a control |
| `--color-control` | `#8A8476` | Input and joined-date-range borders, secondary-button border, tip rule (3:1 against surface and paper) |
| `--color-on-night` | `#F6F2EA` | Primary text on the hero (same value as paper) |
| `--color-on-night-muted` | `#A9B2CB` | Hero subtext, facts row, glass-card labels |
| `--color-warning-bg` | `#FCEFD2` | Retryable-error banner fill (RATE_LIMITED, AI_BUSY, AI_TIMEOUT, network) |
| `--color-warning-ink` | `#7A4A00` | Warning icon; banner border at 25% |
| `--color-danger-bg` | `#FCE9E6` | Validation and non-retryable banner fill |
| `--color-danger-ink` | `#A21F1A` | Danger icon and rule, invalid-field border, inline field-error text |
| `--color-focus` | `#3D74F0` | Focus ring only: 2 px solid, 2 px offset, the same on the hero and on light. Never decoration |

Derived blends (not tokens; written as `color-mix()` or alpha utilities, listed so they can be re-measured):

| Blend | Result | Where |
|---|---|---|
| saffron 15% over night | `#302D34` | Peak of the horizon glow |
| saffron 20% over night | `#3C3635` | Pill badge fill on the hero (`bg-saffron/20`) |
| night-2 70% over night | `#162046` | Hero glass cards (`bg-night-2/70`) |
| paper 85% over night | `#D3D1CE` | Condensed nav, worst case if it ever sits over the hero |
| paper 85% over surface | `#F7F4ED` | Condensed nav over content |

### 2.2 Contrast

Computed with a WCAG 2.x relative-luminance script and sRGB alpha blends:
`node scripts/contrast.mjs` prints this table. Change a token there and here together, and re-run it. Text needs
4.5:1; large text and UI boundaries (control borders, focus ring, timeline-dot shape) need 3:1. "n/a" rows
are reference values that justify a rule.

| Pair | Foreground | Background | Ratio | Needs | Result |
|---|---|---|---|---|---|
| on-night on night (hero text) | `#F6F2EA` | `#0D1530` | 16.12:1 | 4.5:1 | pass |
| on-night on night-2 | `#F6F2EA` | `#1A2550` | 13.20:1 | 4.5:1 | pass |
| on-night on glow peak | `#F6F2EA` | `#302D34` | 12.13:1 | 4.5:1 | pass |
| on-night-muted on night (hero subtext, facts) | `#A9B2CB` | `#0D1530` | 8.50:1 | 4.5:1 | pass |
| on-night-muted on night-2 | `#A9B2CB` | `#1A2550` | 6.96:1 | 4.5:1 | pass |
| on-night-muted on glow peak | `#A9B2CB` | `#302D34` | 6.40:1 | 4.5:1 | pass |
| saffron on night (h1 key words) | `#F6B84B` | `#0D1530` | 10.18:1 | 4.5:1 | pass |
| saffron on night-2 | `#F6B84B` | `#1A2550` | 8.34:1 | 4.5:1 | pass |
| saffron on glow peak | `#F6B84B` | `#302D34` | 7.66:1 | 4.5:1 | pass |
| saffron on badge fill | `#F6B84B` | `#3C3635` | 6.71:1 | 4.5:1 | pass |
| on-night on glass card | `#F6F2EA` | `#162046` | 14.15:1 | 4.5:1 | pass |
| on-night-muted on glass card | `#A9B2CB` | `#162046` | 7.46:1 | 4.5:1 | pass |
| ink on paper | `#131A2C` | `#F6F2EA` | 15.52:1 | 4.5:1 | pass |
| ink on surface | `#131A2C` | `#FFFFFF` | 17.33:1 | 4.5:1 | pass |
| ink on sunken (AI notice, read-only input) | `#131A2C` | `#EFEAE0` | 14.45:1 | 4.5:1 | pass |
| muted on paper | `#575E70` | `#F6F2EA` | 5.80:1 | 4.5:1 | pass |
| muted on surface (hints, placeholder) | `#575E70` | `#FFFFFF` | 6.48:1 | 4.5:1 | pass |
| muted on sunken | `#575E70` | `#EFEAE0` | 5.41:1 | 4.5:1 | pass |
| night on saffron (primary button) | `#0D1530` | `#F6B84B` | 10.18:1 | 4.5:1 | pass |
| ink on saffron | `#131A2C` | `#F6B84B` | 9.80:1 | 4.5:1 | pass |
| night on saffron-hover | `#0D1530` | `#F7C366` | 11.10:1 | 4.5:1 | pass |
| ink on saffron-disabled (Please wait Ns) | `#131A2C` | `#FCE6C0` | 14.21:1 | 4.5:1 | pass |
| muted on saffron-disabled (not used) | `#575E70` | `#FCE6C0` | 5.31:1 | - | n/a |
| ink on budget-chip (figure) | `#131A2C` | `#FDF2DF` | 15.63:1 | 4.5:1 | pass |
| muted on budget-chip (label) | `#575E70` | `#FDF2DF` | 5.85:1 | 4.5:1 | pass |
| ink on warning-bg (banner heading, message) | `#131A2C` | `#FCEFD2` | 15.20:1 | 4.5:1 | pass |
| warning-ink on warning-bg (icon, rule) | `#7A4A00` | `#FCEFD2` | 6.56:1 | 4.5:1 | pass |
| muted on warning-bg (retry hint) | `#575E70` | `#FCEFD2` | 5.68:1 | 4.5:1 | pass |
| ink on danger-bg | `#131A2C` | `#FCE9E6` | 14.80:1 | 4.5:1 | pass |
| danger-ink on danger-bg | `#A21F1A` | `#FCE9E6` | 6.53:1 | 4.5:1 | pass |
| muted on danger-bg | `#575E70` | `#FCE9E6` | 5.54:1 | 4.5:1 | pass |
| danger-ink on surface (field error, invalid border) | `#A21F1A` | `#FFFFFF` | 7.64:1 | 4.5:1 | pass |
| danger-ink on paper | `#A21F1A` | `#F6F2EA` | 6.85:1 | 4.5:1 | pass |
| warning-ink on surface | `#7A4A00` | `#FFFFFF` | 7.48:1 | 4.5:1 | pass |
| ink on condensed nav over night (worst case) | `#131A2C` | `#D3D1CE` | 11.37:1 | 4.5:1 | pass |
| ink on condensed nav over surface | `#131A2C` | `#F7F4ED` | 15.78:1 | 4.5:1 | pass |
| control vs surface (input border) | `#8A8476` | `#FFFFFF` | 3.72:1 | 3:1 | pass |
| control vs paper | `#8A8476` | `#F6F2EA` | 3.33:1 | 3:1 | pass |
| control vs sunken (read-only input) | `#8A8476` | `#EFEAE0` | 3.10:1 | 3:1 | pass |
| focus vs night | `#3D74F0` | `#0D1530` | 4.25:1 | 3:1 | pass |
| focus vs night-2 | `#3D74F0` | `#1A2550` | 3.48:1 | 3:1 | pass |
| focus vs glow peak | `#3D74F0` | `#302D34` | 3.20:1 | 3:1 | pass |
| focus vs paper | `#3D74F0` | `#F6F2EA` | 3.80:1 | 3:1 | pass |
| focus vs surface | `#3D74F0` | `#FFFFFF` | 4.24:1 | 3:1 | pass |
| focus vs sunken | `#3D74F0` | `#EFEAE0` | 3.54:1 | 3:1 | pass |
| focus vs warning-bg | `#3D74F0` | `#FCEFD2` | 3.72:1 | 3:1 | pass |
| focus vs danger-bg | `#3D74F0` | `#FCE9E6` | 3.62:1 | 3:1 | pass |
| focus vs budget-chip | `#3D74F0` | `#FDF2DF` | 3.82:1 | 3:1 | pass |
| focus vs condensed nav over surface | `#3D74F0` | `#F7F4ED` | 3.86:1 | 3:1 | pass |
| focus vs saffron (why the offset is required) | `#3D74F0` | `#F6B84B` | 2.40:1 | - | n/a |
| night ring (timeline dot) vs surface | `#0D1530` | `#FFFFFF` | 17.99:1 | 3:1 | pass |
| night ring (timeline dot) vs paper | `#0D1530` | `#F6F2EA` | 16.12:1 | 3:1 | pass |
| saffron vs surface (fill only, never text) | `#F6B84B` | `#FFFFFF` | 1.77:1 | - | n/a |
| saffron vs paper (fill only, never text) | `#F6B84B` | `#F6F2EA` | 1.58:1 | - | n/a |
| hairline vs paper (decorative) | `#E3DCCF` | `#F6F2EA` | 1.22:1 | - | n/a |
| hairline vs surface (decorative) | `#E3DCCF` | `#FFFFFF` | 1.36:1 | - | n/a |

Rules that follow from the numbers:

- **Saffron is never text, a border or an icon on paper or surface** (1.58 and 1.77:1). On light it is only a
  fill with ink or night on top, or a mark with a night ring.
- **The focus ring always has its 2 px offset.** Against the saffron button it is 2.40:1; the offset puts it on
  the panel or page behind. An inset ring on the primary button is forbidden.
- **Control borders use `control`, never `hairline`.** The tightest margin is control on paper (3.33:1); a
  "softer" border fails WCAG 1.4.11. Inputs sit on surface where possible (3.72:1).
- **No hero text and no form control in the bottom 25% of the hero**, where the glow lifts the background.
- **Re-measure on the build**, with `getComputedStyle` and pixel samples, wherever translucent layers stack
  (glass over glow, badge, condensed nav, `backdrop-filter`), at 1440 and 375.

---

## 3. Typography

**Family: Manrope**, one variable file (wght 200-800), latin subset, self-hosted by `next/font/google`
(export `Manrope`, confirmed in `next/dist/compiled/@next/font/dist/google/font-data.json`). It replaces
Geist and Geist Mono, which are both removed.

```js
// app/layout.js
import { Manrope } from 'next/font/google';

const manrope = Manrope({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-manrope', // mapped to --font-sans in globals.css (section 9)
});

// The class goes on <html>, not <body>: Tailwind's preflight sets font-family on html
// from --default-font-family, which must resolve there.
<html lang="en" className={manrope.variable}>
```

The variable is named `--font-manrope`, not `--font-sans`, so that `--font-sans` in `@theme` can reference it
without a self-reference or a specificity tie with `:root`. Verify on the build:
`getComputedStyle(document.body).fontFamily` starts with the Manrope family name.

**Weights used:** 500 (body, labels, chips) and 600 (headings, buttons, times, the budget figure). Nothing else:
no 400, 700 or 800 in the UI. Check body 500 at 16 px on Windows ClearType at 100% scaling; if it reads too
light or too heavy, change only the body token's weight.

**Numbers:** `tabular-nums` on every time, date, day count, countdown, elapsed-seconds counter and price.

### Type scale

A 1.2 ratio from 16 px, rounded to whole pixels. The one off-ratio step is `small` (14 px), because 13 px at
500 is too small for labels on ClearType. Letter-spacing in em. Mobile applies below `lg` (1024 px).

| Token | Use | Mobile size / line-height | Desktop size / line-height | Tracking | Weight |
|---|---|---|---|---|---|
| `display` | Hero h1 | 40 / 44 | 56 / 60 | -0.025em | 600 |
| `h1` | 404 h1, other page titles | 33 / 40 | 48 / 56 | -0.02em | 600 |
| `h2` | Trip title, "How it works", banner on its own | 28 / 34 | 33 / 40 | -0.02em | 600 |
| `h3` | Day titles, panel headings (status panel) | 19 / 26 | 23 / 30 | -0.015em | 600 |
| `title` | Stop titles (h4), banner heading, wordmark | 16 / 24 | 16 / 24 | -0.01em | 600 |
| `lead` | Hero subtext, "Good to know" | 16 / 26 | 19 / 30 | -0.01em | 500 |
| `body` | Default text, inputs, buttons | 16 / 24 | 16 / 24 | 0 | 500 (buttons 600) |
| `small` | Labels, hints, chips, facts row, footer, times | 14 / 20 | 14 / 20 | 0 | 500 (times, labels 600 where noted) |
| `caption` | Badge, "Tip" label, legends, skeleton labels in the hero | 12 / 16 | 12 / 16 | 0.01em | 600 |

Rules: sentence case everywhere except tested strings; no uppercase labels; no `font-black`, `font-bold` or
`font-extrabold`; maximum line length about 70 characters (`max-w-reading` for prose, `max-w-copy` for the
hero subtext).

---

## 4. Spacing, container and rhythm

**Scale:** Tailwind's 4 px spacing unit (`--spacing: 0.25rem`, unchanged). Allowed steps:

| Step | px | Typical use |
|---|---|---|
| 1 | 4 | Icon-to-text in chips |
| 2 | 8 | Label to input, icon to text, chip gap |
| 3 | 12 | Badge to h1, h1 to subtext, inline-error gap |
| 4 | 16 | Field to field, mobile gutter, panel padding at 375 (inner groups) |
| 5 | 20 | Status panel padding at 375 |
| 6 | 24 | Group to group in the form, stop to stop, grid gutter, panel padding at 375 |
| 8 | 32 | Panel padding desktop, desktop gutter at `lg`, footer padding |
| 10 | 40 | Hero subtext to facts row |
| 12 | 48 | Result header to first day; day to day |
| 16 | 64 | Section padding at 375; hero/panel overlap at desktop |
| 24 | 96 | Section padding desktop |
| 30 | 120 | Hero top padding desktop (below the nav) |

Arbitrary values (`p-[13px]`) are not allowed except in the hero visual's geometry.

**Container:** `max-w-content` (1200 px) centred, with gutters `px-4` (16 px) below `sm`, `px-6` (24 px) from
`sm`, `px-8` (32 px) from `lg`. Reading column for the itinerary `max-w-reading` (720 px); hero subtext
`max-w-copy` (448 px).

**Breakpoints:** Tailwind defaults. `sm` 640, `md` 768, `lg` 1024 (two-column hero, sticky day list,
desktop type sizes), `xl` 1280.

**Section rhythm:**

| Section | Mobile (375) | Desktop (1440) |
|---|---|---|
| Hero | top 96 (nav 64 + 32), bottom 64 including the 24 overlap | nav 72, then a box at least 576 tall with the copy and the visual centred in it, then the 64 overlap |
| Hero stack | badge→h1 12, h1→subtext 12, subtext→facts 32 | badge→h1 12, h1→subtext 12, subtext→facts 40 |
| Planner panel | padding 20 (groups 24 apart, fields 16 apart) | padding 32; one 3-column grid, 16 gutter, rows 24 apart |
| Result | 64 below the planner; title→notice 16, notice→chips 24, chips→day chips 32, notes→days 48, day→day 48, stop→stop 24 | 96 below the planner; chips→columns 48; navigator left, notes and days in the right column |
| Other sections | 64 top and bottom | 96 top and bottom |
| Footer | 32 | 32 |

Layouts are left-aligned. Centre nothing except the 404 on very wide screens (and even there, left-aligned
inside a narrow block is preferred).

---

## 5. Radii, borders, elevation, glass

**Radius ladder** (Tailwind's default radii are removed, so only these exist):

| Token | px | Use |
|---|---|---|
| `rounded-control` | 8 | Inputs, joined date range, buttons, badge, banner icon tile, tip block |
| `rounded-card` | 12 | Alert banner, AI notice, status panel at 375, wrapped chips, skeleton blocks |
| `rounded-panel` | 16 | Planner panel, status panel, hero glass cards |
| `rounded-block` | 20 | The hero's lower edge at desktop if it is rounded; otherwise unused |
| `rounded-full` | pill | Summary chips, day-nav chips, timeline dots, skeleton line bars |

**Borders:** always 1 px, except the invalid state (2 px, drawn as `border` plus a 1 px inset ring so the
layout does not move). Decorative lines use `hairline`; anything that
identifies a control uses `control`.

**Elevation** (Tailwind's default shadows are removed). Resting surfaces have **no shadow**; they have a
hairline.

| Token | Value | Only on |
|---|---|---|
| `shadow-float` | `0 6px 24px -8px rgb(13 21 48 / 0.12)` | Condensed nav, mobile sticky day-chip bar |
| `shadow-raised` | `0 16px 40px -20px rgb(13 21 48 / 0.30)` | The planner panel where it overlaps the hero (desktop and mobile) |
| `shadow-glass` | `0 12px 32px -12px rgb(5 8 20 / 0.55)` | Hero glass cards |

No hover shadows, no hover lift: nothing on this page is a clickable card.

**Glass and blur:**

- Allowed in two places only: the hero glass cards (`backdrop-filter: blur(10px)`, desktop `lg` and up) and
  the condensed nav (`blur(16px) saturate(1.4)` over `paper/85`).
- Always behind `@supports (backdrop-filter: blur(1px))`. The fill without blur must pass contrast on its own
  (the table in 2.2 uses the unblurred blends).
- Never behind form controls, banners, the itinerary or long text. Never on mobile hero content.

---

## 6. Motion

| What | Duration | Easing | Notes |
|---|---|---|---|
| Colour, background, border changes (hover, focus, invalid) | 150 ms | `ease-standard` | No scale, no translate |
| Banner and status panel appearing | 200 ms fade | `ease-standard` | Opacity only |
| Nav condense (height, background, border, shadow) | 250 ms | `ease-standard` | Triggered by an IntersectionObserver on `#hero-end`, a line where the planner panel starts, once it passes under the bar |
| Hero entrance (copy, then cards) | 700 ms, 80 ms stagger | `ease-out-expo` | Fade up 24 px, once, on load. Cards only at `lg` |
| Skeleton pulse | 1.6 s, infinite | `ease-standard` | Opacity 1 → 0.55 → 1. The only loop on the page |

Easing tokens: `--ease-out-expo: cubic-bezier(.16,1,.3,1)` for entrances; `--ease-standard:
cubic-bezier(.4,0,.2,1)` for state changes.

What never animates: layout size of the form, the itinerary, scale on anything, spinners (the button text
change is the loading signal), counters (the countdown and elapsed time change their text once a second,
without a transition), the glow and the grid.

**`prefers-reduced-motion: reduce`:**

- The entrance and the pulse are applied only through `motion-safe:` classes, so they do not run; elements
  render in their final state (the keyframes use `both` fill only when the class is present).
- A global guard in `globals.css` sets animation and transition durations to `0.01ms` and
  `scroll-behavior: auto` as a backstop.
- JavaScript scrolling (`scrollIntoView`, `scrollTo`) uses `behavior: 'auto'` when
  `matchMedia('(prefers-reduced-motion: reduce)').matches`; CSS classes do not cover JS.
- The nav condenses instantly.

---

## 7. Components

Every interactive element: minimum 44 px tall at 375 (40 px allowed for the desktop nav CTA), focus ring per
section 2, a visible label. Icons are `aria-hidden` and never the only carrier of meaning.

### 7.1 Navigation bar

- `position: fixed`, full width, `z-40`. Content: skip link ("Skip to planner", first focusable, visible on
  focus), product wordmark (`title` token, 600, no logo graphic; the link is 44 px tall), on desktop one text
  link "How it works", and a small button "Plan a trip" that jumps to `#planner` and focuses Area. The CTA is
  never saffron: over the hero it is a dark ghost button (1 px `on-night/30` border, `on-night` text, hover
  `on-night/10`); condensed it is the secondary button. The submit button is the page's one primary action.
- **Over the hero:** transparent, 72 px tall (64 at 375), wordmark and link in `on-night`, link hover underline.
- **Condensed** (once `#hero-end`, where the planner panel starts, passes under the bar; never over the dark band): 60 px (56 at 375), `bg-paper/85` with
  `backdrop-blur` per section 5, 1 px `hairline` bottom border, `shadow-float`, text in `ink`. Transition per
  section 6.
- `html { scroll-padding-top: 68px }` (condensed height plus 8) so anchors are not hidden.
- At 375: wordmark and the CTA only. No hamburger.

### 7.2 Badge (hero)

`inline-flex`, gap 6, padding 6 / 10, 28 px tall, `rounded-control`, no fill, 1 px border `on-night/20`, text
`caption` in `on-night`, one 14 px check icon in `on-night-muted`. Neutral, not saffron: the h1's key words are
the hero's one accent. Content is the one fact the facts row does not carry: "No account needed". Not a link.

### 7.3 Buttons

| Variant | Fill | Text | Border | Hover | Use |
|---|---|---|---|---|---|
| Primary | `saffron` | `night`, `body` 600 | none (optional 1 px inset `night/20` on light panels) | `saffron-hover` | Submit, 404 "Plan a trip". One per view |
| Secondary | `surface` | `ink`, 600 | 1 px `control` | `sunken` fill | Cancel, Plan Another Trip, Edit details, Print |
| Ghost (light) | transparent | `ink`, 600 | none | `sunken` fill | Low-emphasis actions inside panels |
| Ghost (dark) | transparent | `on-night` | 1 px `on-night/30` | `on-night/10` fill | Nav CTA over the hero |

- Sizes: submit 52 px tall, full width at 375; standard 44 px; nav CTA 40 px desktop, 44 px at 375.
  Padding 0 20, `rounded-control`, icon 20 px with 8 px gap.
- **Focus:** the global ring, 2 px `focus`, offset 2 px. Never inset on the primary button.
- **Disabled primary** (cooldown "Please wait Ns", loading "Generating Itinerary…"): fill `saffron-disabled`,
  text `ink` at full opacity (14.21:1), `cursor: not-allowed`. Keep the native `disabled` attribute as today.
  Never lower the opacity of the label; no spinner inside the button.
- **Disabled secondary:** `sunken` fill, `muted` text (5.41:1), `control` border.
- No `hover:scale`, no shadow, no gradient.

### 7.4 Inputs

- **Label** above the input: `small` 600 `ink`, 8 px gap. The ` *` stays in the label text (tested).
- **Input:** 48 px tall, `rounded-control`, `surface` fill, 1 px `control` border, padding 0 12, `body` in
  `ink`, placeholder in `muted`.
- **Hint** below: `small` 500 `muted`, linked with `aria-describedby` (date range: live "3 days · up to 14",
  "Up to 14 days" until both dates are set; it stays under a date error and explains it).
- **Focus:** border unchanged, plus the global 2 px ring with 2 px offset.
- **Invalid:** 2 px `danger-ink` border (1 px border + 1 px inset ring), `aria-invalid="true"`, and an inline
  message under it: 16 px alert-circle icon plus `small` 500 text in `danger-ink` on surface (7.64:1), linked
  with `aria-describedby`. Colour is never the only signal.
- **Read-only** (while submitting): `sunken` fill, `ink` text, `control` border, no ring change.
- **Disabled** (not used today; for completeness): `sunken` fill, `muted` text, `cursor: not-allowed`.
- **Joined date range:** two native `type="date"` inputs side by side at every width that read as one
  control: each half has its own 1 px `control` border and the right half overlaps the shared edge by 1 px
  (`-ml-px`). 48 px tall like every input. Each half's focus ring is drawn inset (`outline-offset: -3px`, on
  surface 4.24:1). Only the invalid half turns red: it is raised (`z-10`) so its 2 px danger border covers the
  shared edge, and its neighbour keeps the `control` border. The message goes under the whole control.
  At `sm`+ the left half is one form column plus the gutter (`calc(50% + 8px)`), so Return lines up with City.
- **Fieldsets:** groups "Where", "When", "Who" with an sr-only legend (the labels carry the visible
  hierarchy; a 12 px legend above 14 px labels inverted it). No section headings, no "All fields are required"
  line: the asterisks and the `required` attribute say it.
- **Grid:** one 3-column grid from `sm` (16 px gutter, 24 px between rows): Area | City | State, then the date
  range across two columns and Full Name in the third. One column at 375.

### 7.5 Cards and panels

- **Planner panel:** `surface`, `rounded-panel`, 1 px `hairline`, padding 20 (375) / 32 (desktop),
  `shadow-raised` because it overlaps the hero (24 px at 375, 64 px at desktop). The error banner and submit
  button live inside it.
- **Status panel** (loading): `surface`, `rounded-panel`, 1 px `hairline`, padding 20 / 24. `h3` "Crafting
  your itinerary…", `small` `muted` estimate, elapsed seconds in `small` 600 `tabular-nums` (`aria-hidden`, after the copy),
  time-based copy (under 15 s "This usually takes 5–30 seconds.", from 15 s "Longer trips take more time.",
  from 30 s "The service may be busy. You can keep waiting or cancel."), Cancel as a secondary button (right on desktop, full width at 375).
- **Hero glass cards:** see 7.12.
- **No nested cards.** A panel may contain rows, chips and a banner, never another bordered card with a shadow.
- **"How it works":** three two-column rows divided by 1 px `hairline` (number and title left, text right);
  no cards, no icons in coloured circles.

### 7.6 Chips

- **Summary chip:** `inline-flex`, 32 px tall, `rounded-full` (12 px if the text wraps), `surface` fill,
  1 px `hairline` border, padding 0 12, 16 px icon in `muted`, `small` 500 `ink` text, an sr-only label
  ("Destination", "Dates", "Traveller"). `min-w-0`, `overflow-wrap: anywhere` for long destinations.
- **Budget chip:** `budget-chip` fill, 1 px `hairline`, an 8 px `saffron` square marker with a 1 px `night`
  ring, label "Estimated budget" in `small` `muted` and the figure in `small` 600 `ink` `tabular-nums`; a
  second line "Excludes flights" in `caption` `muted`. The figure is never saffron.
- **Day-nav chip (mobile):** see 7.11.
- Chips are not interactive unless they are day-nav links; they have no hover state.

### 7.7 Alert banner

- One component, two variants. Fill `warning-bg` or `danger-bg`, `rounded-card`, a 1 px border in
  `warning-ink` or `danger-ink` at 25%, padding 16. No left rule: on a 12 px radius it bends into a bracket,
  the stock Tailwind alert look.
- Row: 20 px icon (alert-triangle for warning, alert-circle for danger) in the variant ink, then a column:
  heading (`title` token, `ink`, the exact tested title and nothing else), the server message (`small`,
  `ink`), and for retryable errors the retry hint (`small`, `muted`, countdown `tabular-nums` in a child with
  `aria-live="off"`).
- `role="alert"` on the banner only; `tabIndex={-1}` for focus: on an error the planner focuses the field a
  validation error names, otherwise the banner (the submit button was disabled while loading). Placed directly above the submit button.
- Warning = retryable or not the visitor's doing (RATE_LIMITED, AI_BUSY, AI_TIMEOUT, AI_INVALID_RESPONSE,
  AI_UNAVAILABLE, SERVICE_UNAVAILABLE, INTERNAL, network); danger = validation, AI_QUOTA_EXHAUSTED, AI_REFUSED.
  Never on the hero.
- No retry invited and nothing to correct (AI_QUOTA_EXHAUSTED, SERVICE_UNAVAILABLE): a third line in `small`
  `muted`, "Your details are still in the form." (true: the form keeps its values).
- The warning fill must not be mistaken for the disabled button: the banner always has the icon, heading and
  border.

### 7.8 AI notice

One strip directly under the trip title, above the summary chips and before anything the model wrote (the
lead's call at build time, so the caveat is read with the title): `sunken` fill, `rounded-card`, padding 12 / 16,
width fitted to the text up to `max-w-reading`, 16 px info icon in `muted`, the exact notice text in `small` 500
`ink` (14.45:1). Appears once; no `role="alert"`.

### 7.9 Loading skeleton

- Built only from the validated request: day labels ("Day 1 · Thu 26 Nov"), five stop rows per day, at most
  three days at full height. No place names, no destination string as text.
- Bars: `hairline` fill on `surface`, `rounded-full`, heights 12 (text) and 16 (titles); time stubs 40 px wide;
  the same grid as the timeline so nothing jumps when the result arrives.
- `aria-hidden="true"` on the whole skeleton; the status panel carries the meaning.
- Pulse per section 6, `motion-safe:` only; static under reduced motion.

### 7.10 Timeline (stops of a day)

- **Day header:** `h3` "Day 1" (exact, tested), then the long date and the day's area in `small` `muted`
  ("Thursday 26 Nov · Alfama and Baixa"), a 1 px `hairline` rule below. No coloured band, no emoji.
- **Grid per stop:** time column 64 px (52 at 375) | rail 24 px (20 at 375) | content.
- **Time:** `small` 600 `ink` `tabular-nums`, right-aligned. Missing time: "—" with sr-only "Time not set".
- **Rail and dot:** 1 px `hairline` vertical rail; dot 10 px = 8 px `saffron` fill + 1 px `night` ring
  (16.12-17.99:1), aligned to the time's first line.
- **Content:** `h4` in `title`; description in `body` `muted`; venue line in `small` `ink` with a 16 px
  map-pin icon in `muted`, `overflow-wrap: anywhere`; tip as an inset row: 2 px left rule in `control`,
  "Tip" in `caption` `muted`, text in `small` `ink`.
- 24 px between stops. No card per stop, no hover colour, no scale.

### 7.11 Day navigator

- **Desktop (`lg`+):** a sticky `<nav aria-label="Days">` list, 220 px wide, `top` = condensed nav + 24.
  Items are links (`#day-1`), one 36 px row each: "Day 1" in `small` 600 left, the short date in `small` 500
  `muted` right, so 14 days (504 px) fit under the nav on a 720 px tall window; the list also has a
  `max-height` of the viewport minus 104 px and scrolls on its own as a backstop. A 2 px `hairline` rail runs
  down the items' left edge. Active item (`aria-current="true"`, from an IntersectionObserver): `sunken` fill
  and the rail segment in `night`. (Saffron is not used here: it would be 1.58:1 on paper.)
- **Activating an item** scrolls the day into view (`smooth`, or `auto` under reduced motion) and moves focus
  to the day's `h3` (`tabIndex={-1}`, `preventScroll`), so the next Tab continues from that day.
- **Mobile:** a sticky chip row under the nav (`top` 56 px), `paper/85` with `shadow-float` once stuck,
  contained `overflow-x: auto` with `scroll-snap-type: x proximity` and `scroll-padding-inline` equal to the
  gutter (without it, snapping pulls the first chip flush to the screen edge). Solid `paper` with a `hairline`
  bottom rule, no translucency over itinerary text. Chips 44 px tall, `rounded-full`,
  `surface` with `hairline` border, "Day 1 · 26 Nov" in `small` 600. Active chip: `night` fill, `on-night`
  text and a 6 px `saffron` dot (10.18:1 on night). Hidden for one-day trips.
- Day sections get `scroll-margin-top` = bar height + 8 px. Nav items never contain a heading element.

### 7.12 Hero

- **Background:** a two-stop vertical gradient, `night-2` at the top to `night` by 60%, and under it one wide,
  flattened radial of `saffron` at 15% centred below the bottom edge (peak `#302D34`). The only gradient on
  the page.
- **Grid:** two `repeating-linear-gradient`s of 1 px `on-night` lines at 6% in 64 px cells on a plane with
  `perspective(900px) rotateX(62deg)`, faded with a radial `mask-image` so it is clear of the copy column.
- **Copy (left, `max-w-copy` for the subtext):** badge, h1 in `display` ("Plan a trip, day by day." with the
  key words in `saffron`, the rest `on-night`; no gradient text), subtext in `lead` `on-night-muted`, facts
  row in `small` `on-night-muted` with 16 px icons, about 24 px apart.
- **Visual (right, `lg`+ only, `aria-hidden`):** three glass cards, 184 px wide, in isometric projection
  (`rotate(-30deg) skewX(30deg) scaleY(.866)`), 28 px apart and each 70 px further back in the plane. The
  stack fills the right half of the hero's box, centred 12 px high, scaled to 85% below `xl`. Measured at
  1024-1920: every card ends at least 48 px above the planner panel and 24 px below the nav. Decorative
  content is never clipped. Each card: `night-2/85` fill, blur per section 5, `rounded-panel`, a 1 px top and
  left edge highlight in `on-night/20`, `shadow-glass`. Schematic content only, in `small` (12 px text does
  not survive the skew): "Day 1" / "Day 2" / "Day 3" in 600 `on-night`, a 1 px rail with five dots, generic
  times "09:00 / 11:30 / 13:00 / 15:30 / 19:00" in `on-night-muted` `tabular-nums`, skeleton bars in
  `on-night/12`, and on the front card "Estimated budget" with an `on-night/30` bar where a number would be.
  Dots are saffron on the front card (Day 1) only and `on-night-muted/60` on the others, so the h1 stays the
  hero's focal point. No places, prices or counts, no heading elements.
- **Below `lg`:** cards hidden; the glow and grid show only in the band under the facts row, which the
  planner panel overlaps.
- Build it as a static server component (see section 9.3) so it costs HTML bytes, not JavaScript.

### 7.13 Footer

On `paper`, 1 px `hairline` top border, padding 32. One row (stacked at 375): wordmark in `small` 600 `ink`,
"Day-by-day travel plans." in `small` `muted`, and optionally a source-code link. No AI caveat here: the
landing page states it once (How it works, step 03) and every result carries the notice. No
provider name, no "stack", no social icons or link columns.

### 7.14 404

Same nav (`<SiteNav solid />`: condensed from the start, links to `/#planner` and `/#how-it-works`, CTA arrow
pointing right, skip link "Skip to content") and footer, `paper` area, a left-aligned block: "404" in `small`
600 `muted`, `h1` "Page not found", one line in `lead` `muted` "This page doesn't exist.", and a primary
button-styled link "Plan a trip" to `/` (full width at 375). No illustration. Server component (`app/not-found.jsx`).

---

## 8. Iconography

- Inline SVG only, `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, **stroke-width 1.75**,
  round caps and joins, `aria-hidden="true"`, `focusable="false"`.
- Sizes: 16 px beside `small` text, 20 px in buttons and banners, 14 px in the badge. Never larger than the
  text cap height times about 1.5; no icons in coloured circles.
- Colour inherits from the text (`muted` beside secondary text, variant ink in banners).
- Paths are hand-authored or copied individually from Lucide (ISC licence: keep the licence comment in the
  icons file). No icon package.
- One file, `app/components/icons.jsx`, one small component per icon.

| Icon | Used in |
|---|---|
| map-pin | Destination chip, venue line |
| calendar | Dates chip, facts row (up to 14 days) |
| user | Traveller chip |
| wallet | Budget chip label (optional beside the marker), facts row (estimated budget) |
| clock | Facts row (about 5-30 seconds), status panel |
| list (timeline) | Facts row (5 timed stops a day) |
| check | Badge (no account needed) |
| info | AI notice |
| alert-triangle | Warning banner |
| alert-circle | Danger banner, inline field error |
| arrow-left | Plan Another Trip |
| arrow-down | Nav CTA "Plan a trip" (optional) |
| pencil | Edit details (collapsed planner) |
| printer | Print (only if print styles are approved) |

---

## 9. Tailwind 4 implementation

### 9.1 `app/globals.css`

```css
@import "tailwindcss";

@theme {
  /* Only these tokens exist: remove Tailwind's default palette, radii and shadows. */
  --color-*: initial;
  --radius-*: initial;
  --shadow-*: initial;

  /* Brand */
  --color-night: #0D1530;
  --color-night-2: #1A2550;
  --color-saffron: #F6B84B;
  --color-saffron-hover: #F7C366;
  --color-saffron-disabled: #FCE6C0;
  --color-budget-chip: #FDF2DF;

  /* Neutrals */
  --color-paper: #F6F2EA;
  --color-surface: #FFFFFF;
  --color-sunken: #EFEAE0;
  --color-ink: #131A2C;
  --color-muted: #575E70;
  --color-hairline: #E3DCCF;
  --color-control: #8A8476;
  --color-on-night: #F6F2EA;
  --color-on-night-muted: #A9B2CB;

  /* Semantic */
  --color-warning-bg: #FCEFD2;
  --color-warning-ink: #7A4A00;
  --color-danger-bg: #FCE9E6;
  --color-danger-ink: #A21F1A;
  --color-focus: #3D74F0;

  /* Radii */
  --radius-control: 0.5rem;  /* 8 */
  --radius-card: 0.75rem;    /* 12 */
  --radius-panel: 1rem;      /* 16 */
  --radius-block: 1.25rem;   /* 20 */

  /* Elevation */
  --shadow-float: 0 6px 24px -8px rgb(13 21 48 / 0.12);
  --shadow-raised: 0 16px 40px -20px rgb(13 21 48 / 0.30);
  --shadow-glass: 0 12px 32px -12px rgb(5 8 20 / 0.55);

  /* Layout */
  --container-content: 75rem;  /* 1200 */
  --container-reading: 45rem;  /* 720 */
  --container-copy: 28rem;     /* 448 */

  /* Type scale (mobile tokens end in -m; use e.g. `text-display-m lg:text-display`) */
  --text-display: 3.5rem;
  --text-display--line-height: 3.75rem;
  --text-display--letter-spacing: -0.025em;
  --text-display--font-weight: 600;
  --text-display-m: 2.5rem;
  --text-display-m--line-height: 2.75rem;
  --text-display-m--letter-spacing: -0.025em;
  --text-display-m--font-weight: 600;

  --text-h1: 3rem;
  --text-h1--line-height: 3.5rem;
  --text-h1--letter-spacing: -0.02em;
  --text-h1--font-weight: 600;
  --text-h1-m: 2.0625rem;
  --text-h1-m--line-height: 2.5rem;
  --text-h1-m--letter-spacing: -0.02em;
  --text-h1-m--font-weight: 600;

  --text-h2: 2.0625rem;
  --text-h2--line-height: 2.5rem;
  --text-h2--letter-spacing: -0.02em;
  --text-h2--font-weight: 600;
  --text-h2-m: 1.75rem;
  --text-h2-m--line-height: 2.125rem;
  --text-h2-m--letter-spacing: -0.02em;
  --text-h2-m--font-weight: 600;

  --text-h3: 1.4375rem;
  --text-h3--line-height: 1.875rem;
  --text-h3--letter-spacing: -0.015em;
  --text-h3--font-weight: 600;
  --text-h3-m: 1.1875rem;
  --text-h3-m--line-height: 1.625rem;
  --text-h3-m--letter-spacing: -0.015em;
  --text-h3-m--font-weight: 600;

  --text-title: 1rem;
  --text-title--line-height: 1.5rem;
  --text-title--letter-spacing: -0.01em;
  --text-title--font-weight: 600;

  --text-lead: 1.1875rem;
  --text-lead--line-height: 1.875rem;
  --text-lead--letter-spacing: -0.01em;
  --text-lead--font-weight: 500;
  --text-lead-m: 1rem;
  --text-lead-m--line-height: 1.625rem;
  --text-lead-m--letter-spacing: -0.01em;
  --text-lead-m--font-weight: 500;

  --text-body: 1rem;
  --text-body--line-height: 1.5rem;
  --text-body--font-weight: 500;

  --text-small: 0.875rem;
  --text-small--line-height: 1.25rem;
  --text-small--font-weight: 500;

  --text-caption: 0.75rem;
  --text-caption--line-height: 1rem;
  --text-caption--letter-spacing: 0.01em;
  --text-caption--font-weight: 600;

  /* Motion */
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-standard: cubic-bezier(0.4, 0, 0.2, 1);
  --animate-rise: rise 700ms var(--ease-out-expo) both;
  --animate-pulse-soft: pulse-soft 1.6s var(--ease-standard) infinite;

  @keyframes rise {
    from { opacity: 0; transform: translateY(24px); }
    to { opacity: 1; transform: none; }
  }
  @keyframes pulse-soft {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.55; }
  }
}

/* The font: next/font sets --font-manrope on <html>; `inline` resolves it there. */
@theme inline {
  --font-sans: var(--font-manrope), ui-sans-serif, system-ui, sans-serif;
}

@layer base {
  :root { color-scheme: light; } /* native date pickers match the light content area */
  html { scroll-padding-top: 68px; }
  body {
    background: var(--color-paper);
    color: var(--color-ink);
    font-size: var(--text-body);
    line-height: var(--text-body--line-height);
    font-weight: 500;
    -webkit-font-smoothing: antialiased;
  }
  :focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }
  @media (prefers-reduced-motion: reduce) {
    *, ::before, ::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
}
```

Notes:

- `--color-*: initial` means `bg-white`, `text-gray-500` and the like no longer generate CSS. Tailwind ignores
  unknown classes silently, so review also greps for them (9.2). `bg-transparent` and `currentColor` still
  work.
- The hero's gradient, grid and mask are written as plain CSS in a small `@layer components` block (or a CSS
  module next to the hero), using `var(--color-*)`, because they do not map to single utilities.
- Opacity modifiers on tokens (`bg-saffron/20`, `bg-paper/85`, `bg-night-2/70`) are the way to make the
  blends in section 2.1.

### 9.2 Naming conventions

- Colour tokens are role names (`night`, `paper`, `ink`, `muted`, `control`, `on-night`), not Tailwind hue
  names; semantic pairs are `*-bg` (fill) and `*-ink` (text, icon, rule on that fill).
- Mobile variants of type tokens end in `-m` and are paired with an `lg:` desktop token in the same class list.
- Radii and shadows are named by use (`control`, `card`, `panel`, `float`, `raised`, `glass`).
- No arbitrary colour values (`bg-[#...]`) and no inline `style` colours. Inline `style` is allowed only for
  animation delays and the hero geometry.
- Review grep, which must return nothing:
  `grep -rnE "\[#[0-9a-fA-F]|(gray|slate|purple|pink|indigo|amber|yellow|blue|orange|green|red)-[0-9]{2,3}|shadow-(sm|md|lg|xl|2xl)|font-(bold|black|extrabold)" app --include=*.jsx --include=*.js`
- Components are PascalCase files in `app/components/`, presentational, with class lists ordered layout →
  box → type → colour → state.

### 9.3 Structure that protects the JS budget

`app/page.jsx` is a client component today, so anything written inside it ships in first-load JS. Make it a
server component that renders a static `<Hero />` (server, `aria-hidden` visual, no hooks) and one client
island `<Planner />` that owns `useTripGeneration`, the form, the status and the result. The nav-condense
observer and the day-navigator observer are a few lines each inside small client components. Target: first-
load JS for `/` at or under about 125 kB (110 kB today).

---

## 10. Do not (the AI-template look)

- Do not use emoji anywhere: not as icons, bullets, decoration or in buttons and headings.
- Do not add gradients beyond the one hero gradient: no rainbow or multi-stop gradients, no gradient text,
  no gradient buttons or cards, no glow blobs behind content.
- Do not put every block on a white card with a heavy shadow, and do not nest cards. No `shadow-xl`,
  `shadow-2xl` or hover shadows.
- Do not use `hover:scale`, bounce, wiggle, shimmer, spinners or looping decoration. The skeleton pulse is the
  only loop.
- Do not centre everything, and do not build rows of three equal feature cards with an icon in a coloured
  circle.
- Do not write hype copy: "craft", "dream", "adventure", "magic", "perfect journey", exclamation marks,
  "Let AI…". Plain, specific, sentence case.
- Do not use Tailwind palette colours or hex values in components; only the tokens above.
- Do not use saffron as text, a border or an icon on paper or surface, and do not add a second accent colour.
  Blue is for the focus ring only.
- Do not state a fact more than once on the landing page. The facts row carries 14 days, 5 stops and
  5-30 s; the badge carries "No account needed"; "How it works" carries the one AI caveat.
- Do not add logos, "trusted by" rows, user counts, ratings, testimonials, sample itineraries, travel times or
  progress percentages. Only the true facts: up to 14 days, five timed stops a day, an estimated budget, no
  account needed, usually about 5-30 seconds.
- Do not use `font-bold`, `font-black` or uppercase tracking-wide labels; headings are 600 with negative
  tracking.
- Do not load fonts, images or scripts from outside the app (CSP `font-src 'self'`, `img-src 'self' data:`);
  no UI kits, icon packages or animation libraries.
