import type { Experience, FeaturedDish } from "./types";
import { images } from "./images";

/**
 * Featured experiences (home) and featured dishes (home offset-index).
 */
export const experiences: Experience[] = [
  {
    title: "The Tasting Menu",
    description:
      "Seven courses written the day they are served, drawn from the morning market. The full room eats the same menu, together.",
    image: images.dish03,
    meta: "Nightly, by reservation",
  },
  {
    title: "The Chef's Counter",
    description:
      "Six seats at the pass, close enough to talk to the kitchen between courses. The best seat in a small room.",
    image: images.counter,
    meta: "Six seats, Friday and Saturday",
  },
  {
    title: "The Cellar",
    description:
      "A decade of Rhône and Burgundy, with growers we return to each vintage. Taken as a pairing or chosen by the glass.",
    image: images.wine,
    meta: "Pairing or by the glass",
  },
];

export const featuredDishes: FeaturedDish[] = [
  {
    name: "Oyster, cucumber, elderflower",
    note: "The opening course, always served cold.",
    image: images.dish01,
  },
  {
    name: "Line-caught turbot, mussel, sea herbs",
    note: "Roasted on the bone, finished with a mussel liquor.",
    image: images.dish04,
  },
  {
    name: "Heritage beetroot, aged goat curd",
    note: "Baked in clay until it gives up its sweetness.",
    image: images.dish02,
  },
  {
    name: "Dry-aged duck, quince, plum",
    note: "Three weeks in the ageing room before the fire.",
    image: images.dish05,
  },
  {
    name: "Dark chocolate, olive oil, sea salt",
    note: "A warm ganache, green oil and crushed salt.",
    image: images.dessert,
  },
];
