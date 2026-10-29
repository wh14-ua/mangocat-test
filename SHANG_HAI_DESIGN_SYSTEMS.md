# Shang Hai — three design systems

Three proposals for the same restaurant, built on the same catalog and order engine but
with independent visual systems: separate components, typography, palettes, navigation,
menu layouts, carts, motion and photography. Nothing visual is shared except the slim
MangoCat presentation bar above each proposal and the neutral demo payment simulator
(which stands in for Stripe's hosted page).

Code: `src/components/shang-hai/{ink-house,wok-after-dark,bento-club}/` and
`src/app/showcase/shang-hai/{…}/`. Shared logic: `src/lib/commerce`, `src/hooks/shang-hai`.

## At a glance

| Axis | 01 INK HOUSE | 02 WOK AFTER DARK | 03 BENTO CLUB |
|---|---|---|---|
| Personality | Editorial, serene, premium | Urban, nocturnal, electric | Joyful, modular, conversion-first |
| Metaphor | A finely printed book signed with a seal | A late-night poster and the kitchen ticket rail | A bento tray and takeaway packaging |
| Palette | Paper `#F1EDE3`, ink `#171A17`, lacquer `#A7342F`, stone `#A9A69D` | Petrol `#101E24`, electric orange `#FF6B35`, warm white `#F6F3EA`, metal `#607079` | Cream `#FFF8EA`, butter `#F7DC72`, tomato `#E84E36`, lime `#BCD967`, soft black `#22221F` |
| Type | Gloock (display serif) + Albert Sans | Big Shoulders (giant condensed) + Archivo (variable width) | Dela Gothic One (chunky display) + Rethink Sans (compact UI) |
| Hero | Asymmetric, lots of negative space, staggered SHANG / HAI, the 上海 seal | Full-viewport poster: letters filled with wok fire, orange marquee | A tray of colour compartments that lead straight to ordering |
| Navigation | Quiet top bar + full-screen "Índice" | Left section rail + sticky category ticker | Bottom tab bar (mobile) + search-first top bar (desktop) |
| Menu | Book with a sticky numbered index and fine rows | Section posters + ticket cards in a grid | Sticker chips + compact two-column tiles |
| Product unit | A row: name, piece count, price aligned right, seal "+" | A ticket: uppercase name, huge orange price, square "+" | A compartment: name, sticker, price, round quick-add |
| Cart | Paper "comanda" drawer from the right | High-contrast thermal "ticket", always visible | Bottom sheet on mobile, persistent sidebar on desktop |
| Motion | One orchestrated reveal, the seal stamp, slow drawer | Marquee, poster scale-ins, sparks, odometer counter | Springs, bounces, badge pops, compartments popping in |
| Photography | Calm, light, negative space, top-down / 45° | Dark, high contrast, tight crops, heat | Bright, top-down, food clearly identifiable |
| Density | Lowest: reading pace | Medium: rhythm and impact | Highest: speed and choice |

## 01 — INK HOUSE

**Concept.** The carta as a finely printed book: rice-paper ivory, ink black and one
lacquer-red seal that signs things. Sophistication without caricature: the only Chinese
characters are 上海, the restaurant's own name, used once as a seal (outlines from Noto Serif
CJK SC, OFL). No dragons, lanterns or decorative characters.

**Typography.** Gloock, a high-contrast display serif with an inked, sharp finish, for the
brand, chapter titles and large numerals; Albert Sans for dishes, prices (tabular figures)
and interface. Perfect-fourth scale, generous leading, short measures.

**Colour.** Paper and ink do all the work; lacquer red is reserved for the seal, key actions
and the cart count. Stone is decoration only; secondary text uses a darker stone that meets
4.5:1 on paper.

**Composition.** Asymmetric 12-column layouts with wide margins; the menu is a book with a
numbered index (the categories really are an ordered list) and chapters of fine rows.
Illustrative photos appear as captioned plates between chapters.

**Motion.** Contained: a single orchestrated reveal of the hero (clip-path wipe, ink-mask
photo, seal last), the seal "stamping" when something is added or an order is paid, and a
slow paper drawer. Nothing animates on its own after load.

**Why it sells.** It turns a neighbourhood Chinese restaurant into a brand with presence:
ideal if the owner wants to raise perceived value, attract dine-in customers and look
nothing like a delivery-app listing.

## 02 — WOK AFTER DARK

**Concept.** A late-night poster for the wok: heat, speed and the city after dark. The
interface borrows the kitchen's order tickets on the pass rail.

**Typography.** Big Shoulders at display optical size, uppercase and gigantic, against
Archivo used at condensed widths for labels and tickets. The scale contrast (letters
measured in viewport widths next to compact labels) is the identity; it survives without
photos.

**Colour.** Deep petrol surfaces with one electric orange for actions, prices and active
states (text on orange is petrol); warm white text; metal for rules; a single heat yellow
for spicy tags and sparks.

**Composition.** Full-bleed poster hero with the wok flame clipped inside the letters, a
moving marquee, section posters that open each part of the menu, and ticket cards with
perforated edges in a dense grid.

**Motion.** Expressive but fast and GPU-only: marquee, poster scale-ins, spark bursts and a
button morph on add, an odometer cart counter, a sliding ticker underline and a scroll
progress bar. Everything collapses under reduced motion.

**Why it sells.** Built for impulse and for evenings: it speaks to a younger, urban,
takeaway audience and makes ordering feel immediate.

## 03 — BENTO CLUB

**Concept.** A bento box turned into an interface: compartments, takeaway packaging,
labels, stickers and tape. Playful, but grown-up and precise.

**Typography.** Dela Gothic One, chunky and packaging-like, for the brand, section labels
and featured prices; Rethink Sans, compact and highly legible, for commerce UI.

**Colour.** Cream background with butter, tomato and lime compartments; soft black for text
and dark modules. Tomato is used for large shapes and buttons; small red text uses a
darker tomato for contrast.

**Composition.** A CSS-grid tray of compartments with tray-wall gutters and container
radii; sticker chips colour-coded by section; compact two-column product tiles on mobile.

**Motion.** Quick and tactile: springs, press feedback, tile bounce and "+1" chips on add,
badge pops, sheets that spring open, compartments that pop in once on first load.

**Why it sells.** The most direct path from "hungry" to "ordered" on a phone: prominent
search, one-tap add, a cart that is always one thumb away. The best fit if the priority is
moving orders from the delivery app to the restaurant's own channel.

## Shared rules (all three)

- Spanish copy, "tú", plain verbs. No invented history, chefs, awards, reviews, ratings,
  preparation times or savings. Pending facts are labelled "por confirmar".
- Real catalog only; non-orderable prices show "Precio pendiente de confirmar".
- Photos are provisional and illustrative, captioned as such, credited on
  `/showcase/shang-hai/creditos/`.
- Accessibility: semantic landmarks, one `h1`, labelled controls, visible focus, modal
  dialogs with focus trap and Escape, `aria-live` cart announcements, 44 px targets,
  `prefers-reduced-motion` honoured, ≥ 4.5:1 text contrast.
- Performance: static export, self-hosted fonts via `next/font`, pre-sized WebP with
  `srcset`, lazy images below the fold, CSS-only effects on the 208 menu items.
