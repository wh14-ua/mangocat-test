# ATELIER

A flagship, production-quality website for a contemporary gastronomic restaurant.
Dark, cinematic, editorial. Built as a reusable template: the business data is fully
separated from the presentation, so the same application can be re-skinned for another
restaurant by editing configuration and swapping photography, with no component changes.

Live design system and rationale: see [`DESIGN.md`](./DESIGN.md).

## Stack

- **Next.js 16** (App Router, React Server Components) + **React 19**
- **TypeScript**
- **Tailwind CSS v4** (CSS-first tokens, via Turbopack)
- **Motion** (`motion/react`) for interaction and scroll reveals
- **Phosphor Icons** (`@phosphor-icons/react`)
- Self-hosted, licensed photography under `public/images` (see [`CREDITS.md`](./CREDITS.md))

No other runtime dependencies.

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
```

Other scripts:

```bash
npm run build    # production build (static export of all routes)
npm run start    # serve the production build
npm run lint
```

Requirements: Node 18.18+ (developed on Node 22).

## Pages

| Route           | What it is |
|-----------------|-----------|
| `/`             | Home: cinematic hero, editorial statement, featured experiences, chef, this week's dishes, reservation band |
| `/story`        | Our Story: philosophy, chef, values, provenance |
| `/menu`         | Interactive menu: tasting menu, scroll-spy categories, dietary filter (URL-synced), price ledger |
| `/reservations` | A clearly-labelled **simulated** booking flow with full validation |
| `/gallery`      | Editorial masonry with an accessible lightbox (keyboard + focus trap) |
| `/contact`      | Hours, address, contact actions and a map |

Plus `not-found`, an error boundary, a loading state, `robots.txt`, `sitemap.xml`, and
Restaurant structured data (schema.org JSON-LD).

## Architecture

```
src/
  app/                    # routes, layout, metadata, robots, sitemap, icon
  components/
    layout/               # Nav, MobileMenu, Footer, SkipLink, StructuredData, SocialLinks
    motion/               # Reveal, TextReveal, RevealImage, ParallaxImage (client leaves)
    sections/             # page section components, grouped by page
    ui/                   # Button, Container, Field, SectionHeading, Eyebrow, DietaryTags
  config/                 # ALL business data (see below)
  lib/                    # cn(), Intl formatting helpers
```

**Business data is isolated in `src/config/`** and typed in `src/config/types.ts`:

- `site.ts` - name, tagline, contact, address, hours, reservations, social, SEO
- `theme.ts` - brand colours and fonts (mirrors the CSS tokens)
- `menu.ts` - categories, dishes, prices, dietary legend, tasting menu
- `story.ts` - philosophy, chef persona, values, provenance
- `experiences.ts` - featured experiences and featured dishes
- `gallery.ts` - gallery images, filters and alt text
- `images.ts` - central map of image paths

Presentation components import from `@/config` and never hard-code business data.

## Accessibility and performance

- Semantic HTML, skip link, one `<h1>` per page, hierarchical headings, visible
  `:focus-visible` rings, `aria-label`s on icon buttons, labelled form controls, focus
  management in the menu and lightbox, `aria-live` on the booking confirmation.
- `prefers-reduced-motion` is honoured everywhere (reveals, parallax, route transition and
  loops collapse to static).
- All routes prerender as static HTML. `next/image` serves AVIF/WebP with explicit
  dimensions (no layout shift); above-the-fold images use `priority`.
- No horizontal overflow at 1440 / 768 / 390 / 375; console is clean.

The brand is intentionally **single-theme (dark)** by art direction (a candlelit room),
implemented with CSS variables so it stays themeable.

## Customising for another restaurant

See [`CUSTOMIZE.md`](./CUSTOMIZE.md) for a step-by-step guide. In short: edit `src/config/*`,
replace the files in `public/images`, and (optionally) change the colour tokens in
`src/app/globals.css` and the two fonts in `src/app/layout.tsx`.

## Deployment

The app is a standard Next.js project and deploys to any Next-compatible host.

- **Vercel**: push to a Git repo and import it, or run `npx vercel`. Zero configuration.
- **Node host**: `npm run build` then `npm run start` (serves on `PORT`, default 3000).
- Set the production URL in `src/config/site.ts` (`seo.url`) so canonical links, OpenGraph
  images, `robots.txt` and `sitemap.xml` resolve to the right domain.

## Notes and limitations

- The reservation flow is a front-end simulation for demonstration. It performs no network
  request and stores nothing; it clearly tells the visitor to call or email to book. Wiring
  it to a real booking provider is a backend task.
- Photography is curated from Unsplash (Unsplash License, free for commercial use). For a
  real client, replace it with the restaurant's own licensed shoot (see `CREDITS.md`).
- The map uses an OpenStreetMap embed (no API key). Swap `address.mapEmbedSrc` in
  `site.ts` for a different provider if preferred.
