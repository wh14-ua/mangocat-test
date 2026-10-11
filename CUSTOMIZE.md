# Customising ATELIER for another restaurant

This template separates business data from presentation. To adapt it you edit
configuration and swap images. You should not need to touch the section components.

Work through the steps below. After each change, run `npm run dev` and check the result.

---

## 1. Brand, contact, hours, SEO -> `src/config/site.ts`

One file holds the identity:

- `name`, `wordmark`, `tagline`, `shortDescription`, `legalName`, `foundedYear`, `cuisine`
- `priceRange`, `locale`, `currency` (used by `Intl` for prices and dates)
- `address` (lines, postcode, city, country, `mapEmbedSrc`, `directionsUrl`)
- `contact` (phone display + `tel:` href, email)
- `openingHours` (one row per days/service/time; use `"Closed"` to close a day)
- `reservations` (policy, lead note, max party size, services and their time slots)
- `social` (each has a label, href and an `icon` key)
- `nav` (the primary navigation links)
- `seo` (`url`, titles, description, keywords, OpenGraph image, locale)

The single reservation call-to-action label lives in `reserveCta` at the bottom of the file
and is reused everywhere, so changing it once changes it site-wide.

> Tip: keep prices as plain numbers (e.g. `185`). They are formatted with the `locale` and
> `currency` you set, so switching to `"en-US"` / `"USD"` renders `$185` automatically.

## 2. Colours and fonts

### Colours -> `src/app/globals.css`

The `@theme { ... }` block at the top is the colour config. Change the hex values and the
whole site re-skins. The token names are intentionally brand-neutral in meaning:

- `--color-noir / coal / onyx / graphite` - the dark surface ladder (deepest to lightest)
- `--color-porcelain / mist / ash` - text (primary / secondary / tertiary)
- `--color-ember` (+ `-deep`, `--color-on-ember`) - the single accent
- `--color-line / line-strong` - hairlines

Keep one accent. If you move to a light-themed brand, also update `color-scheme`, the
`body` background, and `<meta name="theme-color">` (in `src/app/layout.tsx` via
`theme.themeColor` in `src/config/theme.ts`), and re-check contrast.

Mirror any colour you need in JS in `src/config/theme.ts` (used for the theme-color meta
tag and structured data).

### Fonts -> `src/app/layout.tsx`

Two fonts are loaded with `next/font/google`: a display serif and a sans. Swap them for any
Google font by changing the two imports (keep the `variable` names `--font-cormorant` and
`--font-hanken`, or rename them in both `layout.tsx` and the `@theme inline` block in
`globals.css`).

## 3. Menu -> `src/config/menu.ts`

- `legend` - the dietary codes and their labels
- `tasting` - the featured set menu (name, description, price, courses, pairing, highlights)
- `categories` - each with an `id`, `name`, optional `description`, and `items`
- each item: `name`, `description`, `price`, and optional `tags` (dietary codes)

The filter chips on the menu page are defined in
`src/components/sections/menu/MenuBrowser.tsx` (`DIET_FILTERS`); adjust if your legend
changes.

## 4. Story, chef, values -> `src/config/story.ts`

Edit the opener, philosophy copy, chef persona (name, role, portrait, bio, quote), values
and provenance. The chef quote on the home page and the pull quote on the story page are
split into display lines inside their components (`ChefFeature.tsx`, `PullQuote.tsx`);
update those lines if you change the quote text.

## 5. Experiences and featured dishes -> `src/config/experiences.ts`

`experiences` drives the home "three ways to spend it" trio; `featuredDishes` drives the
home dish index. Each references an image from the map in step 7.

## 6. Gallery -> `src/config/gallery.ts`

Define `filters` and `items`. Each item has a `src`, descriptive `alt`, an `aspect`
(`portrait` | `square` | `landscape`, which drives the masonry rhythm) and a `category`
matching a filter id.

## 7. Photography -> `public/images` + `src/config/images.ts`

Replace the files in `public/images` with the restaurant's own licensed photography. The
simplest path is to keep the existing file names, so nothing else changes. If you rename
them, update the paths in `src/config/images.ts` (the single map that every config imports).

Guidance for a cohesive result: shoot or select images that share a grade (here: dark,
warm, low light). Landscape sources work best for full-bleed bands; portrait for the chef
and tall dishes. Record attribution in `CREDITS.md`.

Also replace the social-share image at `public/images/og-image.jpg` with a landscape image
at roughly 1200x630, and the favicon at `src/app/icon.svg`.

## 8. Final checks

- `npm run build` passes.
- Click through every page; test the mobile menu, the menu filter, the gallery lightbox and
  the reservation flow.
- Set `seo.url` to the real domain before deploying.
- Re-read all visible copy for the new brand's voice.

That is the whole adaptation surface. Everything else (layout, motion, accessibility) is
shared and reused.
