#!/usr/bin/env node
/**
 * Shang Hai menu importer.
 *
 * Turns a Just Eat menu capture into the shared catalog used by the three demos and by
 * the order Worker (src/data/shang-hai/menu.json), and regenerates the data audit
 * (SHANG_HAI_MENU_AUDIT.md).
 *
 * Capture (manual, normal browser session, no scraping infrastructure):
 *   1. Open https://www.just-eat.es/restaurants-restaurante-asiatico-shang-hai-orihuela/menu
 *   2. In DevTools > Console run:
 *        copy(document.getElementById("__NEXT_DATA__").textContent)
 *   3. Paste into a file, e.g. ~/shang-hai-next-data.json
 *
 * Usage:
 *   node scripts/import-shang-hai-menu.mjs --next-data ~/shang-hai-next-data.json
 *       Trims the capture into src/data/shang-hai/source/just-eat-<date>.json, then imports it.
 *   node scripts/import-shang-hai-menu.mjs
 *       Re-imports from the most recent snapshot in src/data/shang-hai/source/.
 *   Add --check to fail (exit 1) when menu.json is not up to date with the snapshot.
 *
 * Stable ids: an item keeps the id it had in the previous menu.json when its Just Eat
 * item id (sourceId) matches, so re-importing never renames existing products. New items
 * get a slug of their display name (with -2, -3... on collisions).
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = join(ROOT, "src/data/shang-hai");
const SOURCE_DIR = join(DATA_DIR, "source");
const MENU_PATH = join(DATA_DIR, "menu.json");
const AUDIT_PATH = join(ROOT, "SHANG_HAI_MENU_AUDIT.md");
const SOURCE_URL =
  "https://www.just-eat.es/restaurants-restaurante-asiatico-shang-hai-orihuela/menu";

// ---------------------------------------------------------------------------
// Curated corrections. Every change to source text is listed here so it can be
// reviewed with the owner. Only evident formatting/typing errors are corrected;
// commercial names are otherwise kept verbatim (the original is kept as sourceName).
// ---------------------------------------------------------------------------

/** Evident formatting errors in published product names (source name -> display name). */
const NAME_FIXES = {
  "Menús para 2 Personas A": "Menú para 2 Personas A",
  "Menú Para 5 Personas A": "Menú para 5 Personas A",
  "Menú Para 5 Personas B": "Menú para 5 Personas B",
  "Menú Para 6 Personas A": "Menú para 6 Personas A",
  "Menú Para 6 Personas B": "Menú para 6 Personas B",
  "Pollo con Salsa de Judías Neg": "Pollo con Salsa de Judías Negras",
  "la Familia Feliz": "La Familia Feliz",
  "Cangrejo con Puero y Jengibres": "Cangrejo con Puerro y Jengibre",
  "Sau Maide 4 Estaciones, 4 Piezas": "Sau Mai de 4 Estaciones, 4 Piezas",
  "Freixenet.Cava Brut": "Freixenet Cava Brut",
  "VinosRosado Lambrusco": "Vino Rosado Lambrusco",
  "Sashimi atún, 6 piezas": "Sashimi Atún, 6 Piezas",
  "Sashimi salmón, 6 Piezas": "Sashimi Salmón, 6 Piezas",
};

/** Evident typos inside Spanish descriptions. */
const ES_TEXT_FIXES = [
  [/\(\s+/g, "("],
  [/\buromaki\b/gi, "uramaki"],
  [/\baguate\b/gi, "aguacate"],
  [/\(26 piezas$/, "(26 piezas)"],
];

/** Evident typos in the English text published by the restaurant. */
const EN_TEXT_FIXES = [
  [/​/g, ""],
  [/\bSea\s*food\b/gi, "Seafood"],
  [/\bsuace\b/gi, "sauce"],
  [/\bframn\b/gi, "prawns"],
  [/\bPlan rice\b/g, "Plain rice"],
  [/\bbamb[uú](?!\p{L})/giu, "bamboo"],
  [/\bchill sauce\b/gi, "chilli sauce"],
  [/\bSauted\b/g, "Sautéed"],
  [/\bVietnamita roll, 2 unit\b/g, "Vietnamese rolls"],
  [/\bthree delici(?:ous|ons)\b/gi, "three delights"],
  [/\bSpecial salada\b/g, "Special salad"],
  [/\bchinese rollo\b/gi, "chinese roll"],
  [/\bspringroll\b/gi, "spring roll"],
  [/\bpekin duck\b/gi, "peking duck"],
  [/\bCofee\b/g, "Coffee"],
  [/\s+thai$/i, ""], // "Beef with thai red curry sauce thai"
];

/**
 * Categories whose published "description" is only the English name of each dish
 * (e.g. "Pollo con Almendras" -> "Chicken with almonds"). For these we store it as
 * nameEn instead of presenting it as a description.
 */
const ENGLISH_NAME_CATEGORIES = new Set([
  "entrantes",
  "sopas",
  "pato",
  "pollo",
  "ternera",
  "carne",
  "marisco-y-gambas",
  "pescados-y-mariscos",
  "acompanamientos",
  "platos-combinados",
]);

/** Category English names published by the restaurant (only clean translations kept). */
const CATEGORY_EN = {
  entrantes: "Starters",
  sopas: "Soups",
  pato: "Duck",
  ternera: "Beef",
  carne: "Meat",
  "marisco-y-gambas": "Seafood",
  "pescados-y-mariscos": "Fish & seafood",
  acompanamientos: "Sides",
};

/**
 * Data-quality findings that need the owner's confirmation, keyed by source item id.
 * - dropEnglish: the published English text does not describe the dish.
 * - dropDescription: the published Spanish description contradicts the product name.
 * - conflictGroup: entries that look like the same product published with different prices;
 *   they stay visible but cannot be ordered until the owner confirms the price.
 * - duplicateOfSource: an exact duplicate entry; hidden from the menu, kept for traceability.
 */
const FINDINGS = {
  // "Pollo con Piña Natural" is described as "Chicken with almonds".
  "pollo-con-pina-natural": {
    dropEnglish: true,
    issue: "La descripción publicada («Chicken with almonds») corresponde a otro plato.",
  },
  "pato-estilo-cantones": {
    dropEnglish: true,
    issue: "Texto en inglés publicado incompleto («Cantonese style ok»).",
  },
  "kubak-de-marisco": {
    dropEnglish: true,
    issue: "Texto en inglés publicado no corresponde («Cuba seafood»).",
  },
  "gambas-con-salsa-agridulce": {
    dropEnglish: true,
    issue: "Texto en inglés publicado incompleto («Sweet sour sauce»).",
  },
  "ternera-con-cebolla": {
    issue: "Publicado dentro de la categoría Pollo; confirmar categoría.",
  },
  "sushi-variado": {
    dropDescription: true,
    issue:
      "La descripción publicada (6 piezas sashimi salmón + 6 piezas sashimi atún) no coincide con «Sushi Variado, 14 Piezas»; es la misma que la del Sashimi Variado.",
  },
  "cerveza-china": {
    conflictGroup: "cerveza-china",
    issue: "Hay dos «Cerveza China» publicadas con precios distintos (3,00 € y 2,25 €).",
  },
  "cerveza-china-2": {
    conflictGroup: "cerveza-china",
    issue: "Hay dos «Cerveza China» publicadas con precios distintos (3,00 € y 2,25 €).",
  },
  "sashimi-de-atun": {
    conflictGroup: "sashimi-atun",
    issue:
      "Sashimi de atún (6 piezas) aparece en Uramakis a 10,45 € y en Sushi a 12,45 €.",
  },
  "sashimi-atun": {
    conflictGroup: "sashimi-atun",
    issue:
      "Sashimi de atún (6 piezas) aparece en Uramakis a 10,45 € y en Sushi a 12,45 €.",
  },
  "sashimi-de-salmon": {
    issue:
      "Sashimi de salmón (6 piezas) aparece en Uramakis y en Sushi, ambos a 10,45 €; posible duplicado.",
  },
  "sashimi-salmon": {
    issue:
      "Sashimi de salmón (6 piezas) aparece en Uramakis y en Sushi, ambos a 10,45 €; posible duplicado.",
  },
  "frito-gambas-con-atun-2": {
    duplicateOf: "frito-gambas-con-atun",
    issue:
      "Entrada duplicada de «Frito Gambas con Atún, 8 Piezas» (mismo precio; una de las dos descripciones tenía una errata). Oculta en la carta.",
  },
};

/** Just Eat item labels -> catalog semantics. */
const LABELS = { hot: "spicy", alcohol: "alcohol" };

// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const argValue = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const CHECK = args.includes("--check");

function slugify(text) {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, " y ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cleanSpaces(text) {
  return text.replace(/[​ ]/g, " ").replace(/\s+/g, " ").trim();
}

function applyFixes(text, fixes) {
  const fixed = fixes.reduce((acc, [re, to]) => acc.replace(re, to), text);
  // Case-insensitive fixes must not lowercase the first letter of a sentence.
  return /^\p{Lu}/u.test(text) ? fixed.charAt(0).toUpperCase() + fixed.slice(1) : fixed;
}

function toCents(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  const cents = Math.round(value * 100);
  // Guard against anything that is not a plain 2-decimal amount.
  if (Math.abs(cents / 100 - value) > 1e-9) return null;
  return cents;
}

/** "Maki Salmón, 8 Piezas" -> { name: "Maki Salmón", pieces: { count: 8, unit: "piezas" } } */
function splitPieces(name) {
  const m = name.match(/^(.*?),\s*(\d+)\s*(piezas?|unidades?)\s*$/i);
  if (!m) return { name, pieces: undefined };
  const unit = m[3].toLowerCase().startsWith("pieza") ? "piezas" : "unidades";
  return { name: m[1].trim(), pieces: { count: Number(m[2]), unit } };
}

function piecesFromDescription(description) {
  const m = description?.match(/(?:\(|en total\s+)(\d+)\s*piezas\)?/i);
  return m ? { count: Number(m[1]), unit: "piezas" } : undefined;
}

// ---------------------------------------------------------------------------
// 1. Load (and optionally create) the snapshot
// ---------------------------------------------------------------------------

function trimNextData(nextData, capturedAt) {
  const cdn = nextData?.props?.appProps?.preloadedState?.menu?.restaurant?.cdn;
  if (!cdn?.restaurant?.menus || !cdn.items) {
    throw new Error(
      "The file does not look like a Just Eat menu __NEXT_DATA__ capture (props.appProps.preloadedState.menu.restaurant.cdn missing).",
    );
  }
  const info = cdn.restaurant.restaurantInfo;
  return {
    capturedAt,
    url: SOURCE_URL,
    method:
      "Normal page load in a desktop browser; data read from the page's own embedded __NEXT_DATA__ JSON.",
    platformRestaurantId: String(cdn.restaurant.restaurantId),
    menuVersion: cdn.restaurant.menuVersion,
    restaurantInfo: {
      name: info.name,
      seoName: info.seoName,
      location: info.location,
      allergenPhoneNumber: info.allergenPhoneNumber,
      cuisineTypes: (info.cuisineTypes ?? []).map((c) => c.name),
      openingTimes: info.restaurantOpeningTimes,
    },
    menus: cdn.restaurant.menus.map((m) => ({
      menuGroupId: m.menuGroupId,
      serviceTypes: m.serviceTypes,
      categories: m.categories.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        itemIds: c.itemIds,
      })),
    })),
    items: Object.fromEntries(
      Object.values(cdn.items).map((item) => [
        item.id,
        {
          id: item.id,
          name: item.name,
          description: item.description,
          labels: item.labels ?? [],
          hasPlatformImage: Array.isArray(item.imageSources) && item.imageSources.length > 0,
          variations: item.variations.map((v) => ({
            id: v.id,
            name: v.name,
            type: v.type,
            basePrice: v.basePrice,
            dealOnly: v.dealOnly,
            menuGroupIds: v.menuGroupIds,
            modifierGroupsIds: v.modifierGroupsIds ?? [],
          })),
        },
      ]),
    ),
    modifierGroups: cdn.modifierGroups ?? [],
    modifierSets: cdn.modifierSets ?? [],
  };
}

function loadSnapshot() {
  const nextDataPath = argValue("--next-data");
  if (nextDataPath) {
    const capturedAt = argValue("--captured-at") ?? new Date().toISOString();
    const snapshot = trimNextData(JSON.parse(readFileSync(nextDataPath, "utf8")), capturedAt);
    const out = join(SOURCE_DIR, `just-eat-${capturedAt.slice(0, 10)}.json`);
    writeFileSync(out, JSON.stringify(snapshot, null, 2) + "\n");
    console.log(`Snapshot written: ${out.replace(ROOT + "/", "")}`);
    return snapshot;
  }
  const explicit = argValue("--snapshot");
  const file =
    explicit ??
    join(
      SOURCE_DIR,
      readdirSync(SOURCE_DIR)
        .filter((f) => /^just-eat-\d{4}-\d{2}-\d{2}\.json$/.test(f))
        .sort()
        .at(-1) ?? "",
    );
  if (!existsSync(file)) throw new Error(`No snapshot found (looked for ${file}).`);
  return JSON.parse(readFileSync(file, "utf8"));
}

// ---------------------------------------------------------------------------
// 2. Normalize
// ---------------------------------------------------------------------------

function buildCatalog(snapshot, previous) {
  const retrievedAt = snapshot.capturedAt;
  const verifiedAt = retrievedAt.slice(0, 10);
  // Delivery and collection menus are identical on Just Eat; use the collection menu.
  const menu =
    snapshot.menus.find((m) => m.serviceTypes.includes("collection")) ?? snapshot.menus[0];
  const otherMenus = snapshot.menus.filter((m) => m !== menu);
  const sameAcrossMenus = otherMenus.every(
    (m) =>
      JSON.stringify(m.categories.map((c) => [c.id, c.itemIds])) ===
      JSON.stringify(menu.categories.map((c) => [c.id, c.itemIds])),
  );

  const previousBySource = new Map((previous?.items ?? []).map((i) => [i.sourceId, i.id]));
  const previousCatBySource = new Map(
    (previous?.categories ?? []).map((c) => [c.sourceId, c.id]),
  );
  const usedIds = new Set();
  const usedCatIds = new Set();

  const groups = new Map(
    snapshot.modifierGroups.map((g) => [g.id, g]),
  );
  const sets = new Map(snapshot.modifierSets.map((s) => [s.id, s.modifier]));

  const categories = [];
  const items = [];

  for (const cat of menu.categories) {
    let catId = previousCatBySource.get(cat.id) ?? slugify(cat.name);
    for (let n = 2; usedCatIds.has(catId); n++) catId = `${slugify(cat.name)}-${n}`;
    usedCatIds.add(catId);
    const category = {
      id: catId,
      name: cleanSpaces(cat.name),
      ...(CATEGORY_EN[catId] ? { nameEn: CATEGORY_EN[catId] } : {}),
      sourceId: cat.id,
      itemIds: [],
    };
    categories.push(category);

    for (const sourceItemId of cat.itemIds) {
      const raw = snapshot.items[sourceItemId];
      if (!raw) continue;
      const sourceName = cleanSpaces(raw.name);
      const fixedName = NAME_FIXES[sourceName] ?? sourceName;
      const { name, pieces: namePieces } = splitPieces(fixedName);

      let id = previousBySource.get(raw.id);
      if (!id || usedIds.has(id)) {
        const base = slugify(name);
        id = base;
        for (let n = 2; usedIds.has(id); n++) id = `${base}-${n}`;
      }
      usedIds.add(id);

      const finding = FINDINGS[id] ?? {};
      const issues = finding.issue ? [finding.issue] : [];

      const rawDescription = raw.description ? raw.description.replace(/​/g, "").trim() : "";
      let description;
      let descriptionEn;
      let nameEn;
      if (rawDescription.includes("\n\n")) {
        const [es, ...en] = rawDescription.split(/\n\s*\n/);
        description = applyFixes(cleanSpaces(es), ES_TEXT_FIXES);
        descriptionEn = applyFixes(cleanSpaces(en.join(" ")), EN_TEXT_FIXES);
      } else if (ENGLISH_NAME_CATEGORIES.has(catId)) {
        if (rawDescription && !finding.dropEnglish) {
          nameEn = applyFixes(cleanSpaces(rawDescription), EN_TEXT_FIXES);
        }
      } else if (rawDescription && !finding.dropDescription) {
        description = applyFixes(cleanSpaces(rawDescription), ES_TEXT_FIXES);
      }

      const variation = raw.variations[0];
      if (raw.variations.length !== 1) {
        issues.push(
          `El producto tiene ${raw.variations.length} variantes publicadas; revisar el modelo de variantes.`,
        );
      }
      const priceCents = toCents(variation?.basePrice);
      if (priceCents === null) issues.push("Precio no publicado o con formato no válido.");

      const options = (variation?.modifierGroupsIds ?? [])
        .map((gid) => groups.get(gid))
        .filter(Boolean)
        .map((g) => ({
          id: slugify(g.name) || "opcion",
          name: g.name,
          minChoices: g.minChoices,
          maxChoices: g.maxChoices,
          choices: g.modifiers
            .map((mid) => sets.get(mid))
            .filter(Boolean)
            .map((m) => {
              const [es, en] = m.name.split("/").map((s) => cleanSpaces(s));
              const nameEs = es.charAt(0) + es.slice(1).toLowerCase();
              return {
                id: slugify(es),
                name: nameEs,
                ...(en ? { nameEn: applyFixes(en, EN_TEXT_FIXES) } : {}),
                priceDeltaCents: toCents(m.additionPrice) ?? 0,
              };
            }),
        }));

      const tags = raw.labels.map((l) => LABELS[l]).filter(Boolean);
      const dietaryTags = tags.filter((t) => t === "spicy");

      let verificationStatus = priceCents === null ? "pending" : "verified";
      if (finding.conflictGroup) verificationStatus = "conflicting";

      const item = {
        id,
        name,
        ...(nameEn ? { nameEn } : {}),
        ...(description ? { description } : {}),
        ...(descriptionEn ? { descriptionEn } : {}),
        categoryId: catId,
        priceCents,
        ...((namePieces ?? piecesFromDescription(description))
          ? { pieces: namePieces ?? piecesFromDescription(description) }
          : {}),
        ...(dietaryTags.length ? { dietaryTags } : {}),
        ...(tags.includes("alcohol") ? { ageRestricted: true } : {}),
        ...(options.length ? { options } : {}),
        available: true,
        source: "just-eat",
        sourceId: raw.id,
        ...(sourceName !== name ? { sourceName } : {}),
        verifiedAt,
        verificationStatus,
        ...(finding.duplicateOf ? { duplicateOf: finding.duplicateOf } : {}),
        ...(issues.length ? { issues } : {}),
        // Kept for the audit only; never rendered (platform images are not licensed to us).
        ...(raw.hasPlatformImage ? { platformImageOnSource: true } : {}),
      };
      items.push(item);
      category.itemIds.push(id);
    }
  }

  const info = snapshot.restaurantInfo;
  return {
    catalog: {
      schemaVersion: 1,
      catalogId: "shang-hai-orihuela",
      currency: "EUR",
      version: `${verifiedAt}.${snapshot.menuVersion?.slice(0, 8) ?? "manual"}`,
      generatedAt: verifiedAt,
      sources: [
        {
          id: "just-eat",
          name: "Carta pública de Just Eat",
          url: snapshot.url,
          retrievedAt,
          platformRestaurantId: snapshot.platformRestaurantId,
          platformMenuVersion: snapshot.menuVersion,
        },
      ],
      categories,
      items,
    },
    meta: { sameAcrossMenus, info, menusCount: snapshot.menus.length },
  };
}

// ---------------------------------------------------------------------------
// 3. Audit report
// ---------------------------------------------------------------------------

const euro = (c) =>
  c === null ? "sin precio" : `${(c / 100).toFixed(2).replace(".", ",")} €`;

function buildAudit({ catalog, meta }, previous) {
  const items = catalog.items;
  const visible = items.filter((i) => !i.duplicateOf);
  const priced = items.filter((i) => i.priceCents !== null);
  const missingPrice = items.filter((i) => i.priceCents === null);
  const conflicting = items.filter((i) => i.verificationStatus === "conflicting");
  const duplicates = items.filter((i) => i.duplicateOf);
  const withDescription = items.filter((i) => i.description);
  const withEnglish = items.filter((i) => i.nameEn || i.descriptionEn);
  const withPieces = items.filter((i) => i.pieces);
  const withOptions = items.filter((i) => i.options?.length);
  const platformImages = items.filter((i) => i.platformImageOnSource);
  const renamed = items.filter((i) => i.sourceName && NAME_FIXES[i.sourceName]);
  const piecesMoved = items.filter((i) => i.sourceName && !NAME_FIXES[i.sourceName]);
  const withIssues = items.filter((i) => i.issues?.length);
  const source = catalog.sources[0];

  const expectedCategories = [
    "Combos", "Menús", "Entrantes", "Sopas", "Pato", "Pollo", "Ternera", "Carne",
    "Marisco y Gambas", "Pescados y Mariscos", "Acompañamientos", "Platos Combinados",
    "Dím Sum", "Nigiris", "Bowls", "Makis", "Uramakis", "Sushi", "Temakis", "Gunkan Maki",
    "Otros", "Vino Tinto", "Vino Blanco", "Vino Rosado",
  ];
  const found = catalog.categories.map((c) => c.name);
  const missingCats = expectedCategories.filter((c) => !found.includes(c));
  const extraCats = found.filter((c) => !expectedCategories.includes(c));

  const reference = [
    ["Combo A", 1945], ["Combo B", 3345], ["Combo C", 4645], ["Combo D", 6345],
    ["Menú para 2 Personas A", 2745], ["Menú para 2 Personas B", 3445],
  ].map(([name, cents]) => {
    const item = items.find((i) => i.name === name);
    return { name, expected: cents, found: item?.priceCents ?? null };
  });

  let diff = "";
  if (previous) {
    const prevById = new Map(previous.items.map((i) => [i.id, i]));
    const added = items.filter((i) => !prevById.has(i.id));
    const removed = previous.items.filter((i) => !items.some((n) => n.id === i.id));
    const changed = items.filter(
      (i) => prevById.has(i.id) && prevById.get(i.id).priceCents !== i.priceCents,
    );
    diff = `\n## Changes since the previous import\n\n- Added: ${added.length}${added.length ? ` (${added.map((i) => i.name).join(", ")})` : ""}\n- Removed: ${removed.length}${removed.length ? ` (${removed.map((i) => i.name).join(", ")})` : ""}\n- Price changes: ${changed.length}${changed.length ? ` (${changed.map((i) => `${i.name}: ${euro(prevById.get(i.id).priceCents)} → ${euro(i.priceCents)}`).join("; ")})` : ""}\n`;
  }

  const row = (cells) => `| ${cells.join(" | ")} |`;
  return `# Shang Hai — menu data audit

> Generated by \`node scripts/import-shang-hai-menu.mjs\` from the snapshot captured on
> **${source.retrievedAt}**. Do not edit by hand; re-run the importer.

## Source

| | |
|---|---|
| Source | ${source.name}: <${source.url}> |
| Retrieved | ${source.retrievedAt} (normal page load in a desktop browser; the page's embedded \`__NEXT_DATA__\` JSON was read) |
| Platform restaurant id | ${source.platformRestaurantId} |
| Platform menu version | \`${source.platformMenuVersion}\` |
| Name on the platform | ${meta.info.name} |
| Address on the platform | ${meta.info.location.address}, ${meta.info.location.postCode} ${meta.info.location.city} |
| Menus on the platform | ${meta.menusCount} (delivery and collection) — ${meta.sameAcrossMenus ? "identical categories and items" : "**they differ; review**"} |

Automated HTTP requests to Just Eat receive a Cloudflare block (HTTP 403). It was not
circumvented; the capture comes from an ordinary browser session.

## Totals

| Metric | Count |
|---|---|
| Categories | ${catalog.categories.length} |
| Products (entries published) | ${items.length} |
| Products shown in the demos (duplicates hidden) | ${visible.length} |
| With a published price | ${priced.length} |
| Without a price (\`priceCents: null\`) | ${missingPrice.length} |
| Price conflicts (shown, not orderable until confirmed) | ${conflicting.length} |
| Exact duplicates (hidden) | ${duplicates.length} |
| With a Spanish description | ${withDescription.length} |
| With English text published by the restaurant | ${withEnglish.length} |
| With a piece count | ${withPieces.length} |
| With real options | ${withOptions.length} (${withOptions.map((i) => i.name).join(", ")}) |
| With allergen information | 0 (not published on the platform) |
| With an authorised photo | 0 |
| With a platform photo on Just Eat (not used: generic/AI-watermarked platform imagery, not licensed to us) | ${platformImages.length} |
| Names with an evident formatting fix (original kept as \`sourceName\`) | ${renamed.length} |
| Names whose piece count moved to the \`pieces\` field (text otherwise unchanged) | ${piecesMoved.length} |
| Products with notes for the owner | ${withIssues.length} |

### Category check (against the 24 categories listed in the brief)

- Found: ${catalog.categories.length}. Missing: ${missingCats.length ? missingCats.join(", ") : "none"}. Extra: ${extraCats.length ? extraCats.join(", ") : "none"}.
- "Destacados" on the platform is an automatic highlights strip, not a category; it is not imported.

${row(["#", "Category", "Products"])}
${row(["---", "---", "---"])}
${catalog.categories.map((c, i) => row([String(i + 1), c.name, String(c.itemIds.length)])).join("\n")}

### Reference prices from the brief

${row(["Product", "Brief", "Platform", "Result"])}
${row(["---", "---", "---", "---"])}
${reference.map((r) => row([r.name, euro(r.expected), euro(r.found), r.expected === r.found ? "match" : "**differs**"])).join("\n")}
${diff}
## Formatting fixes applied to names

${row(["Published", "Shown"])}
${row(["---", "---"])}
${renamed.map((i) => row([i.sourceName, i.name + (i.pieces ? ` (${i.pieces.count} ${i.pieces.unit})` : "")])).join("\n")}

Piece counts written as part of the name (", 8 Piezas") are moved to the \`pieces\` field and
shown next to the name; this is a display change, not a rename.

## Needs the owner's confirmation

${withIssues.map((i) => `- **${i.name}** (${euro(i.priceCents)}): ${i.issues.join(" ")}`).join("\n")}

Restaurant-level data (see \`src/data/shang-hai/restaurant.ts\`):

- Phone: the platform publishes ${meta.info.allergenPhoneNumber} as the allergen-enquiries number; confirm whether it also takes orders.
- Opening hours: the platform lists Wednesday–Monday 12:00–16:00 and 19:30–23:30, Tuesday closed. Confirm the hours for the restaurant's own channel.
- Pickup preparation time: not confirmed (the platform's estimates are not reused).
- Own delivery: not confirmed; disabled. Just Eat's minimum order and fees are not reused.
- Allergens: no allergen information is published per dish. EU Regulation 1169/2011 requires it to be available before purchase for distance selling; the demos tell customers to ask the restaurant.
- Wine and beer: selling alcohol requires age confirmation; the checkout asks for it and the restaurant should check ID at pickup. Confirm the owner wants to sell alcohol online.
- Photography: none authorised yet. The demos use clearly provisional, licensed illustrative images.
- English names: shown as published (with evident typos fixed); confirm they are wanted.

Completeness: the catalog contains every entry present in the platform's menu data at
the time of capture (${items.length} entries in ${catalog.categories.length} categories, the same
set in the delivery and collection menus). This proves completeness against Just Eat only;
the restaurant may sell products that are not listed there.
`;
}

// ---------------------------------------------------------------------------

const snapshot = loadSnapshot();
const previous = existsSync(MENU_PATH) ? JSON.parse(readFileSync(MENU_PATH, "utf8")) : null;
const result = buildCatalog(snapshot, previous);
const nextMenu = JSON.stringify(result.catalog, null, 2) + "\n";
const audit = buildAudit(result, previous && previous.version !== result.catalog.version ? previous : null);

if (CHECK) {
  const current = existsSync(MENU_PATH) ? readFileSync(MENU_PATH, "utf8") : "";
  if (current !== nextMenu) {
    console.error("menu.json is out of date. Run: node scripts/import-shang-hai-menu.mjs");
    process.exit(1);
  }
  console.log("menu.json is up to date.");
} else {
  writeFileSync(MENU_PATH, nextMenu);
  writeFileSync(AUDIT_PATH, audit);
  const c = result.catalog;
  console.log(
    `menu.json: ${c.categories.length} categories, ${c.items.length} items (${c.items.filter((i) => i.priceCents !== null).length} priced, ${c.items.filter((i) => i.verificationStatus === "conflicting").length} conflicting, ${c.items.filter((i) => i.duplicateOf).length} duplicates). Audit: SHANG_HAI_MENU_AUDIT.md`,
  );
}
