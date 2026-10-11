---
name: ATELIER - Nocturne design system
description: >
  The visual system for ATELIER, a contemporary gastronomic restaurant. A dark,
  cinematic, editorial language. The page is a quiet dining room at night: a cool
  near-black canvas, high-contrast serif display type set against a calm grotesque,
  generous negative space, fine hairline rules, and ONE warm accent, the colour of
  candlelight, used sparingly. Photography is the decoration; type and void do the
  rest. Adapted from the principles of DESIGN.reference.md (token discipline, a single
  decisive decorative system, type as the primary voice, restrained stacked elevation,
  surface-rhythm between bands) but a completely different identity.

# ─────────────────────────────────────────────────────────────────────────────
# DESIGN READ  (per design-taste-frontend §0)
# Reading this as: a flagship multi-page site for a luxury gastronomic restaurant,
# for design-conscious diners AND the agency's prospective clients, with a cinematic
# editorial-luxury language, leaning toward Next.js + Tailwind v4 + Motion + a
# justified high-contrast serif on a dark canvas with a single candlelight accent.
#
# DIALS:  DESIGN_VARIANCE: 8   MOTION_INTENSITY: 6   VISUAL_DENSITY: 3
#   variance 8  -> asymmetric editorial compositions, offset columns, varied aspect
#                  ratios, large voids; collapse to strict single column < 768px.
#   motion 6    -> fluid scroll reveals, slow ken-burns on hero, hover physics on
#                  images and links, one route transition; all reduced-motion safe.
#   density 3   -> art-gallery spacing, large section gaps, no card clutter.
# ─────────────────────────────────────────────────────────────────────────────

colors:
  # Canvas ladder - a cool near-black dining room. Never pure #000, never warm espresso.
  noir: "#0C0C0D"          # page base (deepest)
  coal: "#141416"          # alternate band / raised section
  slate: "#1B1C1F"         # cards, inputs, menu surfaces
  graphite: "#272829"      # hover surface / pressed

  # Text on dark
  porcelain: "#F3F2EE"     # primary text + headlines (near-white, barely warm)
  mist: "#A7A8A3"          # secondary text, lead paragraphs, nav rest-state
  ash: "#80817C"           # tertiary / captions (large or non-essential only)

  # The one accent - candlelight. Locked across every page. No second accent.
  ember: "#E4A54C"         # accent: links-on-hover, active state, key numerals, primary CTA fill
  ember-deep: "#C98A39"    # pressed / deep accent
  ember-soft: "rgba(228,165,76,0.10)"  # faint accent wash behind active elements

  # Hairlines (the brand's chief divider device)
  line: "rgba(243,242,238,0.12)"
  line-strong: "rgba(243,242,238,0.24)"

  # Semantic (tuned for the dark canvas)
  positive: "#86BE8E"      # form success
  critical: "#E3756A"      # form error
  on-ember: "#0C0C0D"      # text on an ember fill (dark, passes AA ~9:1)
  selection-bg: "#E4A54C"
  selection-fg: "#0C0C0D"

typography:
  # Two faces only. Serif is the voice; grotesque is the quiet connective tissue.
  display:
    fontFamily: '"Cormorant Garamond", Georgia, "Times New Roman", serif'
    note: >
      High-contrast Garaldic serif. Carries every headline and editorial statement.
      Weights 300/400/500. Justified for this brief (genuinely editorial/gastronomic);
      deliberately NOT Fraunces or Instrument Serif (the two banned LLM-default serifs).
      Why this serif: its engraved, culinary elegance reads like a classic tasting-menu
      card, while the modern digital cut keeps it contemporary rather than stuffy.
  sans:
    fontFamily: '"Hanken Grotesk", ui-sans-serif, system-ui, -apple-system, sans-serif'
    note: >
      Warm, highly legible grotesque. Carries body, nav, labels, buttons, captions,
      prices, form fields. Numbers use tabular-nums in menu/price/comparison contexts.

  scale:
    # Fluid sizes via clamp(); serif unless noted (sans).
    hero:        { face: display, size: "clamp(3.25rem, 8.5vw, 7.5rem)", weight: 400, leading: "0.95", tracking: "-0.01em" }
    display-xl:  { face: display, size: "clamp(2.75rem, 6vw, 5rem)",     weight: 400, leading: "1.0",  tracking: "-0.01em" }
    display-lg:  { face: display, size: "clamp(2.1rem, 4vw, 3.25rem)",   weight: 400, leading: "1.05", tracking: "-0.005em" }
    display-md:  { face: display, size: "clamp(1.6rem, 2.6vw, 2.25rem)", weight: 500, leading: "1.1",  tracking: "0" }
    title:       { face: display, size: "1.5rem",   weight: 500, leading: "1.2" }
    lead:        { face: sans,    size: "clamp(1.05rem, 1.4vw, 1.25rem)", weight: 400, leading: "1.7", color: mist }
    body:        { face: sans,    size: "1rem",      weight: 400, leading: "1.75" }
    body-sm:     { face: sans,    size: "0.875rem",  weight: 400, leading: "1.6" }
    caption:     { face: sans,    size: "0.8125rem", weight: 400, leading: "1.5", color: mist }
    eyebrow:     { face: sans,    size: "0.75rem",   weight: 500, leading: "1", transform: "uppercase", tracking: "0.24em", color: ember }
    nav:         { face: sans,    size: "0.8125rem", weight: 500, tracking: "0.02em" }
    button:      { face: sans,    size: "0.8125rem", weight: 600, transform: "uppercase", tracking: "0.16em" }

spacing:               # 4px base unit, matched to an airy density
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
  3xl: 64px
  4xl: 96px
  5xl: 128px
  6xl: 160px
  section: 192px       # desktop band top/bottom at full air

radius:                # SHAPE LOCK: everything is sharp. The brief bans "excessive rounded cards".
  none: 0              # cards, images, sections, buttons, inputs, menus - ALL use 0
  # No soft or pill radii exist in this system. Icon-affordances are square too.
  # This is the single documented radius rule; it is followed everywhere.

grid:
  max-content: "1280px"   # inner content column
  max-wide: "1440px"      # wide bands (hero, galleries) may reach this
  gutter-desktop: "40px"
  gutter-mobile: "20px"
  columns: 12             # mental grid for asymmetric placement

breakpoints:            # standard Tailwind scale
  sm: 640
  md: 768
  lg: 1024
  xl: 1280
  2xl: 1536
  # Audited at 1440 (desktop), 768 (tablet), 390 & 375 (mobile).

---

## 1. The idea

ATELIER is a workshop of taste. The site should feel like being seated at night in a
small, serious dining room: the lights are low, a single candle is warm on the table,
and everything else recedes so the food and the words can be heard. We build that feeling
with four moves, and nothing else:

1. **A dark, cool canvas.** A near-black ladder (`noir -> coal -> slate -> graphite`) gives
   depth through four steps of lightness, never through colour. This is the deliberate
   opposite of the beige-and-brass "luxury" default; the room is cool, the accent is warm.
2. **Type as the voice.** A high-contrast serif (Cormorant Garamond) says everything that
   matters; a calm grotesque (Hanken Grotesk) handles the quiet work. No third face.
3. **Photography as the only decoration.** Full-bleed, duotone-graded, cinematic imagery.
   There are no illustrations, no gradient blobs, no glass panels, no decorative lines
   drawn "to look designed". Where there is no photograph, there is void.
4. **One warm accent, rationed.** Candlelight amber (`ember`) appears only where it earns
   attention: a link lighting up, the active menu category, a key price, the primary CTA.
   It is the glow of the room, not the wallpaper.

This mirrors the *principles* of the reference (a single decisive decorative system; type
as primary voice; four-step surface ladder; restraint over ornament) while being an
entirely different brand from a developer platform.

## 2. Colour

**Canvas ladder (dark-locked).** The page is `noir`. Alternate bands lift to `coal`;
surfaces that must read as objects (menu panels, form fields, the reservation summary)
sit on `slate`; hover/pressed lifts to `graphite`. Depth is a lightness step plus a
hairline, never a heavy shadow. The site is intentionally **single-theme (dark)** by art
direction, the way a candlelit room is: this is a legitimate "the brand insists on one
mode" decision, implemented with CSS variables so it stays fully themeable (see §11).

**Text.** `porcelain` for headlines and primary copy; `mist` for secondary copy and lead
paragraphs; `ash` only for large or non-essential captions (it does not meet AA for small
body text, so body never uses it).

**The accent is locked.** `ember` is the only accent on the entire site (Color Consistency
Lock). It is never joined by a blue status chip or a green badge; semantic `positive` /
`critical` exist solely for form validation and are muted to live inside the dark room.
Text on an `ember` fill is always `on-ember` (near-black), which clears WCAG AA (~9:1).

**Contrast budget (audited).** porcelain/noir ~18:1 · mist/noir ~7:1 (AA body) ·
ember/noir ~9:1 · on-ember/ember ~9:1. `ash` is reserved for >=18px or decorative use.

## 3. Typography

Two faces, loaded with `next/font` (self-hosted, `display: swap`, preconnect handled by
Next): **Cormorant Garamond** (display) and **Hanken Grotesk** (sans).

- **Headlines** are Cormorant, weight 300-500, sentence case, with light negative tracking
  at large sizes. Serifs do not want the aggressive `-2.4px` tracking a geometric sans
  wants, so display tracking stays between `-0.01em` and `0`.
- **Emphasis inside a headline** uses *italic of the same serif*, never a second family
  injected mid-headline (that mixed-family move is the amateur tell). Any italic word with
  a descender (`y g j p q`) gets `leading-[1.1]` plus bottom padding so it never clips.
- **Body** is Hanken Grotesk at generous line-height (1.7-1.75) for comfortable reading of
  menu descriptions and the story. Max measure ~65ch.
- **Eyebrows** (small uppercase tracked labels) are rationed hard: at most one per three
  sections, in `ember` or `mist`. Most sections lead with the headline alone.
- **Numerals** use `font-variant-numeric: tabular-nums` wherever they align or compare
  (menu prices, the price column, reservation summary).
- Typographic correctness: real ellipsis `…`, curly quotes `“ ”`, non-breaking spaces in
  units and the wordmark. **Zero em-dashes (`—`) or en-dash separators anywhere** - a hard
  ban from the design skill; hyphens and restructured sentences only.

## 4. Layout & grid

- Inner content caps at **1280px**; wide bands (hero, gallery, full-bleed imagery) reach
  **1440px** or go edge-to-edge. Desktop gutter 40px, mobile 20px (plus safe-area insets).
- **Asymmetry is the default** (variance 8): offset columns (`2fr 1fr`, `7/12 + 4/12`),
  a headline pushed to the left third with the image bleeding off the right edge, captions
  hung in the margin. Centre-aligned layout is used only for the two moments where the
  message *is* the composition (the hero headline, one full-bleed statement band).
- Every multi-column layout declares its `<768px` collapse explicitly to a single column.
- CSS Grid for all multi-column structure (never flexbox percentage math). `min-h-[100dvh]`
  for full-height sections (never `h-screen`). `overflow-x` is clipped at the page shell so
  no composition can introduce a horizontal scrollbar.

**Section-layout variety (anti-repetition).** A page uses at least four different layout
families and repeats none. The zigzag image+text split appears at most twice in a row
before a different family breaks the rhythm. Families in the kit:
`cinematic-hero` · `editorial-statement` · `asymmetric-split` · `offset-index`
(dishes as a hung list with hover imagery) · `full-bleed-quote` · `portrait-feature`
(chef) · `reservation-band` · `menu-ledger` · `editorial-gallery` · `contact-split`.

## 5. Shape & elevation

- **Radius is 0 everywhere.** Cards, images, inputs, buttons, menus, even icon-affordances
  are square. This is the one documented shape rule and it holds on every component; it
  directly answers the brief's "avoid excessive rounded cards".
- **Elevation is mostly flat.** Objects separate from the canvas with a one-step lightness
  lift plus a `line` hairline. Only true overlays (mobile menu, gallery lightbox, sticky
  nav once scrolled) take a soft shadow: `0 24px 60px -24px rgba(0,0,0,0.7)` plus a top
  inset highlight `inset 0 1px 0 rgba(255,255,255,0.04)`. No pure-black Material drops.

## 6. Imagery & art direction

Photography is the whole decorative system, so it is treated with discipline:

- **Grade.** Every image sits under a graded dark scrim (a `noir`-to-transparent gradient)
  so porcelain type stays legible and the set feels like one cinematic shoot, not a stock
  grab-bag. Hero and band images lean darker; gallery images show more of their own light.
- **Geometry.** Full-bleed heroes and bands; portraits at 4:5; dishes at 3:4 or 1:1;
  gallery mixes 4:5, 1:1 and 3:2 to build an editorial rhythm. All framed sharp (radius 0).
- **Sourcing (real, licensed, self-hosted).** Images are curated from Unsplash (Unsplash
  License, free commercial use), each URL **verified** (HTTP 200, image content-type) and
  then **downloaded into `/public/images`** so the production site has zero runtime
  dependence on an external host and no possibility of a broken link. `next/image` serves
  them with explicit dimensions (no CLS), `priority` above the fold, `loading="lazy"`
  below. Credits recorded in `CREDITS.md`. No random image APIs, no hotlinked placeholders.
- **No tells on images:** no pills/tags overlaid on photos, no decorative "Plate 03 /
  House archive" photo-credit captions, no `01 / 4` counters.

## 7. Motion (MOTION_INTENSITY 6, all reduced-motion safe)

Every animation earns its place (hierarchy, storytelling, or feedback). Implemented with
**Motion** (`motion/react`); continuous scroll values use `useScroll`/`useTransform`
(never `useState` per frame, never a `scroll` event listener).

- **Line reveal.** Headlines and lead copy rise into place behind an overflow mask
  (`translateY` + opacity), lightly staggered, once on enter.
- **Image reveal.** Photographs scale from `1.06 -> 1` with a fade as they enter.
- **Hero.** A slow, subtle ken-burns scale on the background image; the headline reveals by
  line. Optional faint parallax on scroll.
- **Hover.** Images lift their scrim and scale `1.03`; text links draw an `ember` underline
  from the left; buttons shift fill and nudge their arrow.
- **Route transition.** One brief porcelain-to-transparent wipe / fade between pages
  (<450ms), via an App Router `template.tsx`.
- **Reduced motion.** Under `prefers-reduced-motion: reduce` everything collapses to its
  final state instantly - no ken-burns, no parallax, no reveal offset, no route wipe.
  Only `transform` and `opacity` are ever animated; no `transition: all`.

## 8. Components (kit)

Sharp, hairline-led, dark-native. Built once, reused via config.

- **Button** - `primary` (ember fill, on-ember label, arrow that nudges on hover),
  `secondary` (hairline outline, porcelain label, fill-wipe to porcelain/graphite on hover),
  `ghost` (text + animated underline). Labels Title Case, uppercase-styled, tracked, one
  line at desktop, always AA against their background. One label per intent sitewide
  (the single reservation CTA reads **“Reserve a Table”** in nav, hero, and footer).
- **Field** - label always above the input (never placeholder-as-label), input on `slate`
  with a `line` border that lights to `ember` on focus (`focus-visible` ring), helper text
  slot, error text below in `critical`, `autocomplete`/`name`/`inputmode` set.
- **SectionHeading** - eyebrow (optional, rationed) + serif headline + optional lead, left
  or centre per composition; `text-wrap: balance`.
- **Reveal / RevealImage** - the motion primitives above, as isolated `'use client'` leaves.
- **Nav** - fixed, single line, <=72px tall, transparent over the hero then `noir`/blur with
  a hairline once scrolled; collapses to a square hamburger opening a full-screen overlay
  menu with staggered links on mobile.
- **Footer** - editorial multi-column: wordmark + reservation CTA, hours, address/contact,
  social, legal. Hairline-separated, no version stamps, no locale/weather strip.
- **Lightbox** - full-screen gallery viewer, keyboard (arrows/Esc) + focus trap +
  `overscroll-behavior: contain`, square controls with `aria-label`s.

## 9. Accessibility (Web Interface Guidelines, baked in from the start)

Semantic HTML first; `<button>` for actions, `<a>`/`<Link>` for navigation. Skip link to
`#main`. Hierarchical headings, one `<h1>` per page, `scroll-margin-top` on anchors.
Icon-only buttons carry `aria-label`; decorative icons/images are `aria-hidden` / `alt=""`.
Visible `focus-visible` rings on everything interactive (never `outline:none` without a
replacement). Forms: real `<label htmlFor>`, correct `type`/`inputmode`/`autocomplete`,
placeholders end with `…`, errors inline and focus the first invalid field, submit stays
enabled until the request starts then shows a spinner, paste never blocked. Async results
(the simulated booking confirmation) announce via `aria-live="polite"`. `color-scheme: dark`
and a matching `<meta name="theme-color">`. Dates/prices via `Intl.*`. Target ~AA for body,
AAA for hero copy; motion honours reduced-motion; zoom is never disabled.

## 10. Page blueprints

- **Home** - cinematic hero (video-less, graded still) -> editorial statement -> featured
  experiences (asymmetric, not three equal cards) -> chef portrait-feature -> featured
  dishes as an offset hung index with hover imagery -> full-bleed reservation band -> footer.
- **Our Story** - editorial opener -> philosophy (asymmetric split) -> chef feature ->
  values as a hung index -> a full-bleed quote -> provenance imagery -> CTA band.
- **Menu** - ledger layout: sticky category nav (state in the URL `?menu=`), the tasting
  menu featured, then à la carte categories as price-ledger rows with dish, description,
  dietary tags and a leader to the price; allergen legend; dietary filter.
- **Reservations** - a clearly-labelled **simulated** booking flow: date (`Intl`-formatted),
  party size, service/time, name, contact, notes; inline validation; a confirmation step
  that explicitly states no real reservation was made and gives the phone/email to book.
- **Gallery** - editorial mixed-aspect grid with filter (URL `?view=`) and an accessible
  lightbox.
- **Contact** - split: hours + address + contact actions on one side, a map on the other;
  fully responsive.

## 11. Reusability & configuration

Business data is fully separated from presentation. A new restaurant is adapted by editing
`src/config/*` and swapping `/public/images`, with **no component edits**:

- `site.ts` - name, tagline, legal name, contact (phone/email), address, hours, social,
  reservation policy, SEO/OpenGraph defaults, map embed.
- `theme.ts` - brand colours (the token hexes above) and the two font-family names; piped
  into CSS variables, so re-skinning is changing values in one file.
- `menu.ts` - categories, dishes, prices, dietary/allergen tags, the tasting menu.
- `story.ts` - philosophy copy, chef persona, values, provenance.
- `experiences.ts`, `gallery.ts`, `images.ts` - featured experiences, gallery manifest,
  image asset map.

`README.md` + `CUSTOMIZE.md` document the swap. This is why the kit is token- and
config-driven rather than hard-coded.

## 12. Do & Don't

**Do**
- Keep the room dark and cool; let photography and void carry the page.
- Spend `ember` like candlelight: a link waking up, the active category, one key price, the
  single reservation CTA. One accent, everywhere, forever.
- Lead sections with the serif headline; drop the eyebrow unless it truly orients.
- Separate with hairlines and space, not boxes and shadows.
- Set every headline with `text-wrap: balance`; align price numerals with tabular-nums.

**Don't**
- No beige/cream backgrounds, no brass/ochre/oxblood, no espresso-brown near-black. No
  second accent. No AI-purple, no neon glow, no glassmorphism, no mesh-gradient blobs.
- No rounded cards (radius is 0). No drop-shadow stacks on flat content.
- No em-dashes or en-dash separators, anywhere, ever. Real `…` and curly quotes only.
- No eyebrow on every section, no section-number labels, no decorative status dots, no
  scroll cues, no locale/time/weather strip, no version stamps, no pills on photos, no
  "Quietly trusted by", no three identical feature cards, no fake-precise invented metrics.
- No hand-rolled decorative SVG illustrations, no div-based fake screenshots, no pure-text
  "minimalism" standing in for real photography.
