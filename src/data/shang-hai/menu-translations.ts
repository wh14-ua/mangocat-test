/**
 * English menu text curated by MangoCat (2026-11-05), layered over the catalog.
 *
 * menu.json keeps exactly what the restaurant published (including the English names it
 * published on Just Eat, as `nameEn`). This overlay completes what is missing and corrects
 * published English that is wrong or misleading. Rules followed:
 * - translate the Spanish name and description faithfully; never add ingredients,
 *   quantities, cooking methods or claims that the Spanish text does not state;
 * - brand and proper names stay as published (wines, Freixenet, Coca-Cola, dim sum
 *   transliterations such as "Shien Ló Pao");
 * - British English (prawns, starters, chips), the usual English of the coast's visitors;
 * - the restaurant's own English wording is kept whenever it is correct.
 *
 * Status: pending review by the owner. Every override of published English is listed in
 * `overrides` with the reason, and SHANG_HAI_MENU_AUDIT.md summarises them.
 */

export type MenuTranslation = { name?: string; description?: string };

export type MenuTranslations = {
  version: string;
  status: "pending-owner-review" | "reviewed";
  categories: Record<string, string>;
  /** Display names of the editorial sections used for navigation. */
  sections: Record<string, string>;
  items: Record<string, MenuTranslation>;
  options: Record<string, string>;
  choices: Record<string, string>;
  /** Published English that this overlay replaces, and why. */
  overrides: Record<string, string>;
  /** Proper names deliberately identical in both languages. */
  untranslatedNames: string[];
};

const BAMBOO = "the published “bamboo mushrooms” reads as one ingredient; the Spanish is bamboo shoots and mushrooms";

export const MENU_EN: MenuTranslations = {
  version: "2026-11-05",
  status: "pending-owner-review",

  categories: {
    combos: "Combos",
    menus: "Set menus",
    entrantes: "Starters",
    sopas: "Soups",
    pato: "Duck",
    pollo: "Chicken",
    ternera: "Beef",
    carne: "Meat",
    "marisco-y-gambas": "Seafood & prawns",
    "pescados-y-mariscos": "Fish & seafood",
    acompanamientos: "Sides",
    "platos-combinados": "Combination plates",
    "dim-sum": "Dim sum",
    nigiris: "Nigiri",
    bowls: "Bowls",
    makis: "Maki",
    uramakis: "Uramaki",
    sushi: "Sushi",
    temakis: "Temaki",
    "gunkan-maki": "Gunkan maki",
    otros: "Beers, soft drinks & more",
    "vino-tinto": "Red wine",
    "vino-blanco": "White wine",
    "vino-rosado": "Rosé wine",
  },

  sections: {
    "para-compartir": "Set menus & combos",
    "cocina-china": "Chinese cuisine",
    sushi: "Sushi",
    bebidas: "Drinks",
    otros: "Other",
  },

  items: {
    // Combos (descriptions only: names are identical)
    "combo-a": {
      description: "4 nigiri, 4 chicken maki, 4 vegetable maki and 2 wakame gunkan maki (14 pieces)",
    },
    "combo-b": {
      description:
        "6 mixed nigiri + wakame salad, 4 chicken maki, 4 vegetable maki, 4 salmon uramaki, 4 California and 4 gunkan maki (26 pieces)",
    },
    "combo-c": {
      description:
        "Wakame salad, griddled chicken gyozas, 8 mixed nigiri, 4 chicken maki, 4 vegetable maki, 4 salmon uramaki, 4 California, 4 gunkan maki (2 tuna and 2 salmon), 28 pieces in total",
    },
    "combo-d": {
      description:
        "Wakame salad, griddled chicken gyozas, 4 Vietnamese rolls, 1 Peking duck, 8 mixed nigiri, 4 chicken maki, 4 vegetable maki, 4 salmon uramaki, 4 California, 4 gunkan maki (2 tuna and 2 salmon), 33 pieces in total",
    },

    // Set menus
    "menu-para-2-personas-a": {
      name: "Set menu for 2 · A",
      description:
        "Chinese salad, spring roll, fried rice with three delights, sweet and sour pork, beef with bamboo shoots, mushrooms, drink and desserts",
    },
    "menu-para-2-personas-b": {
      name: "Set menu for 2 · B",
      description:
        "Special salad, Chinese roll, special fried rice, Peking duck, sizzling prawns with garlic, drink and dessert",
    },
    "menu-para-3-personas-a": {
      name: "Set menu for 3 · A",
      description:
        "Chinese salad, spring roll, fried rice with three delights, sweet and sour pork, beef with bamboo shoots and mushrooms, chicken with almonds, drink and desserts",
    },
    "menu-para-3-personas-b": {
      name: "Set menu for 3 · B",
      description:
        "Special salad, Chinese roll, special fried rice, Peking duck, chicken with bamboo shoots and mushrooms, sizzling prawns with garlic, drink and dessert",
    },
    "menu-para-4-personas-a": {
      name: "Set menu for 4 · A",
      description:
        "Chinese salad, spring rolls (4), fried rice with three delights, fried noodles with three delights, chicken with almonds, beef with bamboo shoots and mushrooms, sweet and sour pork, prawns in curry sauce, drink and dessert",
    },
    "menu-para-4-personas-b": {
      name: "Set menu for 4 · B",
      description:
        "Special salad, Chinese rolls (8), curry triangle, Peking duck, ribs in BBQ sauce, chicken with bamboo shoots and mushrooms, sizzling prawns with garlic, special fried rice, fried noodles with three delights, drink and desserts",
    },
    "menu-para-5-personas-a": {
      name: "Set menu for 5 · A",
      description:
        "Chinese salad, spring rolls (5), fried rice with three delights, fried noodles with three delights, chicken with almonds, beef with bamboo shoots and mushrooms, sweet and sour pork, prawns in oyster sauce, fried king prawns, drink and dessert",
    },
    "menu-para-5-personas-b": {
      name: "Set menu for 5 · B",
      description:
        "Special salad, Chinese rolls (10), Peking duck, ribs in BBQ sauce, chicken with bamboo shoots and mushrooms, sizzling prawns with garlic, fried king prawns, special fried rice, fried noodles with three delights, drink and dessert",
    },
    "menu-para-6-personas-a": {
      name: "Set menu for 6 · A",
      description:
        "Chinese salad (3), spring rolls (6), fried rice with three delights (3), chicken with almonds, beef with bamboo shoots and mushrooms, roast pork, fried king prawns, sweet and sour pork, prawns in oyster sauce, drink and dessert or coffee",
    },
    "menu-para-6-personas-b": {
      name: "Set menu for 6 · B",
      description:
        "Special salad (2), Chinese rolls (12), special fried rice (3), Peking duck, roast spare ribs, beef in gon bao sauce, chicken with bamboo shoots and Chinese mushrooms, fried king prawns, sizzling prawns with leek and ginger, drink and dessert or coffee",
    },

    // Starters
    "cocktail-de-gambas": { name: "Prawn cocktail" },
    "langostinos-fritos-thai": { name: "Thai fried king prawns" },
    "wan-tun-frito": { name: "Fried wontons" },
    "algas-fritas": { name: "Fried seaweed" },
    "pinchos-chinos": { name: "Chicken satay skewers" },
    "pincho-de-cerdo-mongolia": { name: "Mongolian pork skewer" },
    "triangulo-de-curry-thai": { name: "Thai curry triangle" },
    "verduras-en-tempura": { name: "Vegetable tempura" },
    "gambas-en-tempura": { name: "Prawn tempura" },

    // Soups
    "sopa-de-wantu": { name: "Wonton soup" },

    // Duck
    "pato-estilo-cantones": { name: "Cantonese-style duck" },
    "pato-estilo-thai": { name: "Thai-style duck" },
    "pato-con-bambu-y-setas-a-la-plancha": { name: "Sizzling duck with bamboo shoots and mushrooms" },

    // Chicken
    "pollo-con-salsa-agridulce": { name: "Sweet and sour chicken balls" },
    "pollo-con-pina-natural": { name: "Chicken with fresh pineapple" },
    "pollo-con-bambu-y-setas": { name: "Chicken with bamboo shoots and mushrooms" },
    "pollo-estilo-hong-kong": { name: "Hong Kong-style chicken" },
    "pollo-con-champinones": { name: "Chicken with mushrooms" },

    // Beef
    "tiras-de-buey-crujiente-con-salsa-de-piel-de-naranja": { name: "Crispy beef strips with orange peel sauce" },
    "ternera-con-bambu-y-setas": { name: "Beef with bamboo shoots and mushrooms" },
    "ternera-con-judias-negras": { name: "Beef with black bean sauce" },

    // Meat
    "cerdo-con-salsa-agridulce": { name: "Sweet and sour pork" },
    "costillas-con-salsa-agridulce": { name: "Sweet and sour spare ribs" },

    // Seafood
    "gambas-bambu-y-setas": { name: "Prawns with bamboo shoots and mushrooms" },
    "gambas-con-salsa-agridulce": { name: "Sweet and sour prawns" },
    "sepia-con-salsa-gon-bao": { name: "Cuttlefish with gon bao sauce" },
    "sepia-con-bambu-y-setas": { name: "Cuttlefish with bamboo shoots and mushrooms" },
    "kubak-de-marisco": { name: "Seafood ku bak (crispy rice)" },

    // Sides
    "ku-bak-con-tres-delicias": { name: "Ku bak (crispy rice) with three delights" },
    "udon-tallarines-con-marisco": { name: "Seafood udon noodles" },
    "tallarines-estilo-chino": { name: "Chinese-style noodles" },
    "tallarines-fritos-con-tres-delicias": { name: "Fried noodles with three delights" },
    "fideos-de-arroz-singapur-al-curry": { name: "Singapore-style curry rice noodles" },
    "pan-de-gambas": { name: "Prawn crackers" },
    "patatas-fritas": { name: "Chips" },

    // Combination plates
    "pechuga-de-pollo-con-patatas": { name: "Chicken breast with chips" },

    // Dim sum
    "ensalada-de-algas-wakame": { name: "Wakame seaweed salad" },
    "shien-lo-pao": { name: "Shien Ló Pao" },
    "shia-chiao": { name: "Shia Chiao" },
    "sau-mai": { name: "Sau Mai" },
    kuotie: { name: "Kuotie" },
    "siau-long-pao": { name: "Siau Long Pao" },
    "sau-mai-de-4-estaciones": { name: "Four seasons sau mai" },
    "gyozas-de-pollo-a-la-plancha": { name: "Griddled chicken gyozas" },
    "empanadillas-vegetables-shuijing": { name: "Shuijing vegetable dumplings" },
    "albondigas-de-sepia-y-gambas": { name: "Cuttlefish and prawn balls" },
    samosa: { name: "Samosas" },
    "saumai-de-marisco": { name: "Seafood sau mai" },
    "combinado-1": { name: "Dim sum selection 1", description: "Sau mai" },
    "combinado-2": { name: "Dim sum selection 2", description: "Steamed" },
    "combinado-3": { name: "Dim sum selection 3", description: "Fried" },

    // Nigiri
    "nigiri-gamba": { name: "Prawn nigiri" },
    "nigiri-anguila": { name: "Eel nigiri" },
    "nigiri-aguacate": { name: "Avocado nigiri" },
    "nigiri-surimi": { name: "Surimi nigiri" },
    "nigiri-mixto": { name: "Mixed nigiri", description: "2 tuna, 2 salmon, 2 prawn and 2 eel" },
    zamburina: { name: "Zamburiña (queen scallop)", description: "Scallop" },
    "flambeado-salmon": { name: "Flame-seared salmon" },
    "flambeado-atun": { name: "Flame-seared tuna" },
    "nigiri-flambeado-ternera": { name: "Flame-seared beef nigiri" },
    pulpo: { name: "Octopus" },
    atun: { name: "Tuna" },
    lubina: { name: "Sea bass" },

    // Bowls
    "poke-bowl-de-salmon": { name: "Salmon poke bowl" },
    "poke-bowl-de-atun": { name: "Tuna poke bowl" },
    "poke-bowl-de-pollo": { name: "Chicken poke bowl" },

    // Maki
    "maki-salmon": { name: "Salmon maki" },
    "maki-atun": { name: "Tuna maki" },
    "maki-pollo-crujiente": { name: "Crispy chicken maki" },
    "maki-vegetal": { name: "Vegetable maki" },
    "maki-pepino": { name: "Cucumber maki" },
    "maki-aguacate": { name: "Avocado maki" },
    "maki-california": { name: "California maki" },
    "maki-surimi": { name: "Surimi maki" },
    "maki-gambas": { name: "Prawn maki" },
    "maki-dragon": { name: "Dragon maki" },
    "maki-rollo-variado": { name: "Assorted maki rolls", description: "Tuna, salmon and vegetable" },
    "salmon-con-aguacate-y-mango": { name: "Salmon with avocado and mango" },
    "hoso-maki-frito": { name: "Fried hosomaki", description: "Strawberries with cheese" },

    // Uramaki
    "uramaki-salmon": { name: "Salmon uramaki" },
    "uramaki-atun": { name: "Tuna uramaki" },
    "uramaki-anguila": { name: "Eel uramaki" },
    "uramaki-rainbow-roll": { name: "Rainbow roll uramaki" },
    "mango-con-salmon": { name: "Mango with salmon" },
    "picante-atun": { name: "Spicy tuna", description: "Avocado, tuna and chilli" },
    "frito-salmon": { name: "Fried salmon roll", description: "Salmon, avocado with cheese" },
    "frito-gambas-con-atun": { name: "Fried prawn and tuna roll", description: "Prawns with avocado" },
    "frito-gambas-con-atun-2": { name: "Fried prawn and tuna roll", description: "Prawns with avocado" },
    "sashimi-de-atun": { name: "Tuna sashimi" },
    "sashimi-de-salmon": { name: "Salmon sashimi" },
    "arroz-negro-de-gambas-con-fresa": { name: "Black rice with prawns and strawberry" },
    "arroz-negro-de-almendras-con-salmon-y-aguacate": { name: "Black rice with almonds, salmon and avocado" },
    "pollo-crujiente-rollo": { name: "Crispy chicken roll", description: "Chicken with cucumber" },
    "arroz-negro-de-salmon-con-katafi": { name: "Black rice with salmon and kataifi" },
    "hoso-putu-maki": { name: "Hoso Putu Maki", description: "Avocado, salmon with surimi and cheese" },

    // Sushi
    "sashimi-salmon": { name: "Salmon sashimi" },
    "sashimi-atun": { name: "Tuna sashimi" },
    futomaki: { name: "Futomaki", description: "Tuna, salmon and vegetables" },
    "sushi-variado": { name: "Assorted sushi" },
    "sashimi-variado": {
      name: "Assorted sashimi",
      description: "6 pieces of salmon sashimi, 6 pieces of tuna sashimi",
    },
    "sushi-y-sashimi-variado": { name: "Assorted sushi and sashimi" },
    "sushi-tempura": { name: "Tempura sushi" },
    "sushi-tempura-con-queso": { name: "Tempura sushi with cheese" },

    // Temaki
    "temaki-salmon": { name: "Salmon temaki" },
    "temaki-atun": { name: "Tuna temaki" },
    "temaki-gamba": { name: "Prawn temaki" },

    // Gunkan maki
    "gunkan-maki-wakame": { name: "Wakame gunkan maki" },
    "gunkan-maki-salmon": { name: "Salmon gunkan maki" },
    "gunkan-maki-atun": { name: "Tuna gunkan maki" },
    "arroz-negro-con-queso-con-mango": { name: "Black rice with cheese and mango" },

    // Drinks
    "cerveza-china": { name: "Chinese beer" },
    "cerveza-china-2": { name: "Chinese beer" },
    refrescos: {
      name: "Soft drinks",
      description: "Coca-Cola, Zero, Fanta orange, Fanta lemon, Seven Up, Aquarius orange or Nestea",
    },
    "agua-mineral-pequena": { name: "Mineral water, small" },
    "freixenet-cava-brut": { name: "Freixenet Cava Brut" },
    zumos: { name: "Juices", description: "Orange, pineapple or peach" },
    "agua-con-gas": { name: "Sparkling water" },
    "agua-mineral-grande": { name: "Mineral water, large" },

    // Wines (brand names unchanged)
    "vino-tinto-marques-de-caceres": { name: "Marques de Cáceres red wine" },
    "vino-tinto-marques-de-riscal": { name: "Marques de Riscal red wine" },
    "vino-tinto-campo-viejo": { name: "Campo Viejo red wine" },
    "vino-tinto-faustino-v": { name: "Faustino V red wine" },
    "vino-tinto-sangre-de-toro": { name: "Sangre de Toro red wine" },
    "vino-tinto-coto": { name: "Coto red wine" },
    "vino-tinto-faustino-vii": { name: "Faustino VII red wine" },
    "vino-tinto-de-la-casa": { name: "House red wine" },
    "vino-blanco-coto": { name: "Coto white wine" },
    "vino-blanco-vinasol": { name: "Viñasol white wine" },
    "vino-blanco-marina-alta": { name: "Marina Alta white wine" },
    "vino-blanco-diamante": { name: "Diamante white wine" },
    "vino-blanco-emparrado": { name: "Emparrado white wine" },
    "vino-blanco-barbadillo": { name: "Barbadillo white wine" },
    "vino-blanco-de-la-casa": { name: "House white wine" },
    "vino-rosado-mateus": { name: "Mateus rosé wine" },
    "vino-rosado-marques-de-caceres": { name: "Marques de Cáceres rosé wine" },
    "vino-rosado-penascal": { name: "Peñascal rosé wine" },
    "vino-rosado-lambrusco": { name: "Lambrusco rosé wine" },
    "vino-rosado-de-la-casa": { name: "House rosé wine" },
  },

  options: { elige: "Choose" },
  choices: { "con-postre": "With dessert", "con-cafe": "With coffee" },

  overrides: {
    "menu-para-2-personas-a": BAMBOO,
    "menu-para-3-personas-a": BAMBOO,
    "menu-para-3-personas-b": BAMBOO,
    "menu-para-4-personas-a": BAMBOO,
    "menu-para-4-personas-b": BAMBOO,
    "menu-para-5-personas-a":
      "published English omits the fried noodles and says curry sauce where the Spanish says oyster sauce",
    "menu-para-5-personas-b": BAMBOO,
    "menu-para-6-personas-a": "wording aligned with the other set menus (bamboo shoots)",
    "menu-para-6-personas-b": "wording aligned with the other set menus (bamboo shoots)",
    "cocktail-de-gambas": "“Shrimps cocktail” → British “Prawn cocktail”",
    "langostinos-fritos-thai": "published “Fried prawns” dropped “Thai” and that they are king prawns",
    "wan-tun-frito": "“Fried wan tun” → usual English “Fried wontons”",
    "algas-fritas": "grammar (“seaweeds”)",
    "pinchos-chinos": "spelling (“saté”) and the skewer format of the Spanish name",
    "triangulo-de-curry-thai": "published “Curry triangle” dropped “Thai”",
    "verduras-en-tempura": "idiomatic English",
    "gambas-en-tempura": "idiomatic English",
    "sopa-de-wantu": "“Wantu soup” → usual English “Wonton soup”",
    "pato-estilo-thai": "hyphenation",
    "pato-con-bambu-y-setas-a-la-plancha": BAMBOO,
    "pollo-con-salsa-agridulce": "grammar (“Sweet sour”); the restaurant's “chicken balls” is kept",
    "pollo-con-bambu-y-setas": BAMBOO,
    "pollo-estilo-hong-kong": "capitalisation",
    "pollo-con-champinones": "“Chicken mushrooms” missed “with”",
    "tiras-de-buey-crujiente-con-salsa-de-piel-de-naranja": "word order and “strips” from the Spanish name",
    "ternera-con-bambu-y-setas": BAMBOO,
    "ternera-con-judias-negras": "grammar (“black beans sauce”)",
    "cerdo-con-salsa-agridulce": "grammar (“Sweet sour”)",
    "costillas-con-salsa-agridulce": "grammar (“Sweet sour”)",
    "gambas-bambu-y-setas": BAMBOO,
    "sepia-con-salsa-gon-bao":
      "Spanish “sepia” is cuttlefish; the published English says squid — confirm with the owner",
    "sepia-con-bambu-y-setas":
      "Spanish “sepia” is cuttlefish; the published English says squid — confirm with the owner",
    "ku-bak-con-tres-delicias": "“three delights” as in the rest of the menu",
    "udon-tallarines-con-marisco": "capitalisation",
    "tallarines-estilo-chino": "“style” from the Spanish name",
    "tallarines-fritos-con-tres-delicias": "published English dropped “fried”",
    "fideos-de-arroz-singapur-al-curry":
      "Spanish name says curry rice noodles; published English says “with prawns” instead — confirm with the owner",
    "pan-de-gambas": "plural (“crackers”)",
    "patatas-fritas": "“Fried chips” → British “Chips”",
    "pechuga-de-pollo-con-patatas": "“breast” from the Spanish name",
  },

  untranslatedNames: [
    "combo-a",
    "combo-b",
    "combo-c",
    "combo-d",
    "shien-lo-pao",
    "shia-chiao",
    "sau-mai",
    "kuotie",
    "siau-long-pao",
    "futomaki",
    "hoso-putu-maki",
    "freixenet-cava-brut",
  ],
};
