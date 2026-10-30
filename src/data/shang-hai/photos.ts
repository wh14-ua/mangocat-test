/**
 * Provisional, ILLUSTRATIVE photography for the three Shang Hai demos.
 *
 * None of these images show Shang Hai's own dishes: they are freely licensed stock/
 * community photos used as art-direction placeholders until the restaurant provides its
 * own shoot. Never caption them as a specific menu item ("nuestro pato", etc.); the alt
 * text describes only what is visible. Each design has its own set; nothing is shared.
 *
 * `src` / `srcSmall` are public paths WITHOUT the deployment basePath; callers prefix it.
 * `width` / `height` are the dimensions of the `src` file (long side 1600 px, or smaller
 * when the source crop was smaller; nothing is upscaled).
 *
 * Attribution (required for the CC BY / CC BY-SA files) is listed in CREDITS.md under
 * "Shang Hai demos (provisional, illustrative photography)".
 */

export type PhotoCredit = { author: string; sourceUrl: string; license: string; licenseUrl: string };

export type Photo = {
  id: string;
  src: string;
  srcSmall: string;
  srcLarge?: string;
  width: number;
  height: number;
  alt: string;
  tone: "light" | "dark";
  focalPoint: string;
  credit: PhotoCredit;
  illustrative: true;
};

const CC0 = { license: "CC0 1.0", licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/" } as const;
const CC_BY_4 = { license: "CC BY 4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0/" } as const;
const CC_BY_SA_4 = { license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/" } as const;
const CC_BY_SA_2 = { license: "CC BY-SA 2.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0/" } as const;

const COMMONS = "https://commons.wikimedia.org/wiki/File:";

export const shangHaiPhotos = {
  inkHouse: {
    hero: {
      id: "ink-house/hero",
      src: "/images/shang-hai/ink-house/hero-1600.webp",
      srcSmall: "/images/shang-hai/ink-house/hero-800.webp",
      width: 1600,
      height: 1067,
      alt: "Cuenco blanco de fideos en caldo de curry con tofu frito, brotes de soja y judías verdes, junto a una cuchara de porcelana, unos palillos y un platito de salsa de chile, sobre un mantel de lino claro.",
      tone: "light",
      focalPoint: "55% 58%",
      credit: { author: "Noahs Knight", sourceUrl: `${COMMONS}Lan_Jie_Famous_Curry_Noodles_(Unsplash).jpg`, ...CC0 },
      illustrative: true,
    },
    tea: {
      id: "ink-house/tea",
      src: "/images/shang-hai/ink-house/tea-1600.webp",
      srcSmall: "/images/shang-hai/ink-house/tea-800.webp",
      width: 1600,
      height: 1200,
      alt: "Hojas de té seco, largas y finas, sobre una cuchara de porcelana blanca para té, aislada sobre fondo blanco.",
      tone: "light",
      focalPoint: "60% 55%",
      credit: { author: "KirillK", sourceUrl: `${COMMONS}Gaiwan-yellow-tea-huang-ya.jpg`, ...CC0 },
      illustrative: true,
    },
    dimsum: {
      id: "ink-house/dimsum",
      src: "/images/shang-hai/ink-house/dimsum-1600.webp",
      srcSmall: "/images/shang-hai/ink-house/dimsum-800.webp",
      width: 1600,
      height: 1412,
      alt: "Un xiaolongbao plisado sobre papel perforado, dentro de una vaporera de bambú.",
      tone: "light",
      focalPoint: "35% 38%",
      credit: { author: "FASTILY", sourceUrl: `${COMMONS}Xiaolongbao_2_2017-10-27.jpg`, ...CC_BY_SA_4 },
      illustrative: true,
    },
    sushi: {
      id: "ink-house/sushi",
      src: "/images/shang-hai/ink-house/sushi-1600.webp",
      srcSmall: "/images/shang-hai/ink-house/sushi-800.webp",
      width: 1600,
      height: 972,
      alt: "Dos piezas de nigiri de pescado con cebollino y jengibre rallado sobre un plato de cerámica verde pálido, en una mesa de madera blanqueada.",
      tone: "light",
      focalPoint: "47% 45%",
      credit: { author: "Douglas Perkins", sourceUrl: `${COMMONS}Nigiri.jpg`, ...CC_BY_4 },
      illustrative: true,
    },
  },
  wokAfterDark: {
    fire: {
      id: "wok-after-dark/fire",
      src: "/images/shang-hai/wok-after-dark/fire-1600.webp",
      srcSmall: "/images/shang-hai/wok-after-dark/fire-800.webp",
      width: 1156,
      height: 1600,
      alt: "Una gran llamarada sale de un wok en una cocina profesional en penumbra, con una olla de acero al fondo.",
      tone: "dark",
      focalPoint: "45% 40%",
      credit: { author: "Ricardo Liberato", sourceUrl: `${COMMONS}Wok_of_Dong.jpg`, ...CC_BY_SA_2 },
      illustrative: true,
    },
    noodles: {
      id: "wok-after-dark/noodles",
      src: "/images/shang-hai/wok-after-dark/noodles-1600.webp",
      srcSmall: "/images/shang-hai/wok-after-dark/noodles-800.webp",
      width: 1060,
      height: 1600,
      alt: "Unos palillos levantan fideos gruesos de un cuenco oscuro con gambas, guindilla y hierbas, sobre fondo negro.",
      tone: "dark",
      focalPoint: "50% 35%",
      credit: { author: "Artur Rutkowski", sourceUrl: `${COMMONS}Eating_Asian_Noodles_(Unsplash).jpg`, ...CC0 },
      illustrative: true,
    },
    dumplings: {
      id: "wok-after-dark/dumplings",
      src: "/images/shang-hai/wok-after-dark/dumplings-1600.webp",
      srcSmall: "/images/shang-hai/wok-after-dark/dumplings-800.webp",
      width: 1600,
      height: 1455,
      alt: "Una veintena de bollitos blancos plisados dorándose en una sartén negra con aceite, vistos desde arriba.",
      tone: "dark",
      focalPoint: "55% 50%",
      credit: {
        author: "Valenzuela400",
        sourceUrl: `${COMMONS}Xiaolongbao_%E5%B0%8F%E7%B1%A0%E5%8C%85_in_pot_Chinese_Lunar_New_Year_%E8%BE%B2%E6%9B%86%E6%96%B0%E5%B9%B4_2_February_2025_Manila_PhilippinesC.jpg`,
        ...CC_BY_SA_4,
      },
      illustrative: true,
    },
    sushi: {
      id: "wok-after-dark/sushi",
      src: "/images/shang-hai/wok-after-dark/sushi-1600.webp",
      srcSmall: "/images/shang-hai/wok-after-dark/sushi-800.webp",
      width: 1600,
      height: 732,
      alt: "Nigiri de langostino sobre una barra lacada en negro que refleja la pieza.",
      tone: "dark",
      focalPoint: "55% 50%",
      credit: { author: "Zheng Zhou", sourceUrl: `${COMMONS}Kurumaebi_(Japanese_tiger_prawn)_Nigiri.jpg`, ...CC_BY_SA_4 },
      illustrative: true,
    },
    street: {
      id: "wok-after-dark/street",
      src: "/images/shang-hai/wok-after-dark/street-1600.webp",
      srcSmall: "/images/shang-hai/wok-after-dark/street-800.webp",
      width: 1600,
      height: 1068,
      alt: "Vista aérea nocturna de una ciudad: avenidas iluminadas que se cruzan entre bloques de edificios.",
      tone: "dark",
      focalPoint: "50% 50%",
      credit: { author: "JINDONG H", sourceUrl: `${COMMONS}Neon_streets_(Unsplash).jpg`, ...CC0 },
      illustrative: true,
    },
  },
  bentoClub: {
    sushi: {
      id: "bento-club/sushi",
      src: "/images/shang-hai/bento-club/sushi-1600.webp",
      srcSmall: "/images/shang-hai/bento-club/sushi-800.webp",
      width: 1600,
      height: 933,
      alt: "Bandeja de uramakis vista desde arriba, en filas: rollos de salmón, de aguacate y de atún.",
      tone: "light",
      focalPoint: "50% 50%",
      credit: {
        author: "Benoît Prieur",
        sourceUrl: `${COMMONS}Cuisine_japonaise_%C3%A0_Saint-Maurice-de-Beynost_(restaurant_%C3%A0_emporter_La_Perle_Sushi)_-_3.jpg`,
        ...CC0,
      },
      illustrative: true,
    },
    dumplings: {
      id: "bento-club/dumplings",
      src: "/images/shang-hai/bento-club/dumplings-1600.webp",
      srcSmall: "/images/shang-hai/bento-club/dumplings-800.webp",
      width: 1600,
      height: 1067,
      alt: "Tres empanadillas con sésamo negro sobre un plato de madera con palillos, vistas desde arriba sobre fondo blanco.",
      tone: "light",
      focalPoint: "48% 50%",
      credit: { author: "Charles Deluvio", sourceUrl: `${COMMONS}Dumplings_(Unsplash).jpg`, ...CC0 },
      illustrative: true,
    },
    poke: {
      id: "bento-club/poke",
      src: "/images/shang-hai/bento-club/poke-1600.webp",
      srcSmall: "/images/shang-hai/bento-club/poke-800.webp",
      width: 1600,
      height: 1334,
      alt: "Poke de salmón en un cuenco de cartón, visto desde arriba: edamame, algas, aguacate, pepino, dados de encurtido amarillo y tiras de alga nori, junto a un vasito de salsa.",
      tone: "light",
      focalPoint: "42% 55%",
      credit: { author: "Andy Li", sourceUrl: `${COMMONS}Salmon_Poke_Bowl_(S)_with_Spicy_mayo_sauce_-_Kitokito.jpg`, ...CC0 },
      illustrative: true,
    },
    rice: {
      id: "bento-club/rice",
      src: "/images/shang-hai/bento-club/rice-1600.webp",
      srcSmall: "/images/shang-hai/bento-club/rice-800.webp",
      width: 1600,
      height: 1350,
      alt: "Plato blanco de fideos salteados con brotes de soja y cebolleta, visto desde arriba sobre una mesa de madera clara.",
      tone: "light",
      focalPoint: "50% 50%",
      credit: { author: "Andy Li", sourceUrl: `${COMMONS}King_prawns_chow_mein_with_spicy_sauce_-_Stir_Fry_by_CK_2025-08-26.jpg`, ...CC0 },
      illustrative: true,
    },
    springrolls: {
      id: "bento-club/springrolls",
      src: "/images/shang-hai/bento-club/springrolls-1600.webp",
      srcSmall: "/images/shang-hai/bento-club/springrolls-800.webp",
      width: 1200,
      height: 1600,
      alt: "Dos rollitos de primavera en una fuente blanca alargada con dos salsas para mojar, vistos desde arriba sobre una mesa de color teja.",
      tone: "light",
      focalPoint: "50% 50%",
      credit: { author: "Srujanabotcha", sourceUrl: `${COMMONS}Golden_Vegetable_Spring_Rolls_Served_with_Dipping_Sauce.jpg`, ...CC_BY_SA_4 },
      illustrative: true,
    },
  },
} as const satisfies Record<string, Record<string, Photo>>;
