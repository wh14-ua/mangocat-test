import type { MenuConfig } from "./types";

/**
 * The menu. Prices are in major currency units (euros) and are formatted with
 * Intl at render time (see src/lib/format.ts). Dietary codes map to the legend.
 */
export const menu: MenuConfig = {
  intro:
    "The carte changes with the market. What follows is this week's writing; by next week a course or two will have moved on with the season.",

  legend: [
    { code: "v", label: "Vegetarian" },
    { code: "vg", label: "Vegan" },
    { code: "gf", label: "Gluten free" },
    { code: "df", label: "Dairy free" },
    { code: "n", label: "Contains nuts" },
    { code: "sf", label: "Contains shellfish" },
  ],

  tasting: {
    name: "The Tasting Menu",
    description:
      "Seven courses drawn from the morning market and the week's best arrivals, written the same day they are served. Offered to the whole table.",
    price: 185,
    courses: 7,
    pairingName: "Wine Pairing",
    pairingPrice: 95,
    highlights: [
      "Oyster, cucumber and elderflower",
      "Turbot roasted on the bone",
      "Dry-aged duck with quince",
      "Dark chocolate, olive oil, sea salt",
    ],
  },

  categories: [
    {
      id: "to-begin",
      name: "To Begin",
      description: "Small, sharp openings to wake the palate.",
      items: [
        {
          name: "Oyster, cucumber, elderflower",
          description: "Gillardeau oyster, a cold cucumber broth and the first elderflower of the season.",
          price: 24,
          tags: ["gf", "df", "sf"],
        },
        {
          name: "Hand-dived scallop, brown butter, hazelnut",
          description: "Barely warmed scallop, nut-brown butter and toasted hazelnut.",
          price: 32,
          tags: ["gf", "sf", "n"],
        },
        {
          name: "Steak tartare, oyster cream, nasturtium",
          description: "Hand-cut aged beef, a cream of smoked oyster and peppery nasturtium.",
          price: 28,
          tags: ["gf", "sf"],
        },
        {
          name: "Smoked eel, apple, horseradish",
          description: "River eel smoked over beech, sharp apple and grated horseradish.",
          price: 26,
          tags: ["gf", "df"],
        },
      ],
    },
    {
      id: "from-the-garden",
      name: "From the Garden",
      description: "Vegetables given the main role, grown within an hour of the pass.",
      items: [
        {
          name: "Heritage beetroot, aged goat curd, walnut",
          description: "Beetroot baked in clay, a curd of aged goat's cheese and candied walnut.",
          price: 24,
          tags: ["v", "gf", "n"],
        },
        {
          name: "Charred leek, almond, black truffle",
          description: "Leeks burnt over embers, almond cream and a shaving of winter truffle.",
          price: 29,
          tags: ["v", "gf", "n"],
        },
        {
          name: "Celeriac baked in salt, pear, hazelnut",
          description: "A whole celeriac baked in a salt crust, poached pear and brown hazelnut.",
          price: 27,
          tags: ["v", "gf", "n"],
        },
        {
          name: "Wild mushroom, chestnut, aged Comté",
          description: "Mushrooms from the Monts du Lyonnais, chestnut and a 24-month Comté.",
          price: 28,
          tags: ["v", "gf", "n"],
        },
      ],
    },
    {
      id: "from-the-sea",
      name: "From the Sea",
      description: "Line-caught and day-boat, carried up from the Atlantic coast.",
      items: [
        {
          name: "Line-caught turbot, mussel, sea herbs",
          description: "Turbot roasted on the bone, a liquor of mussels and herbs from the shore.",
          price: 46,
          tags: ["gf", "df", "sf"],
        },
        {
          name: "Cured trout, fennel, buttermilk",
          description: "Trout cured in beetroot, raw fennel and a cold buttermilk.",
          price: 34,
          tags: ["gf"],
        },
        {
          name: "Brittany lobster, fermented carrot, verjus",
          description: "Half a native lobster, carrot fermented for a month and the sharpness of verjus.",
          price: 58,
          tags: ["gf", "df", "sf"],
        },
        {
          name: "Monkfish, white bean, bouillabaisse",
          description: "Monkfish braised on the bone with white beans and a saffron bouillabaisse.",
          price: 44,
          tags: ["gf", "sf"],
        },
      ],
    },
    {
      id: "from-the-land",
      name: "From the Land",
      description: "Meat and game from farms we have bought from for years.",
      items: [
        {
          name: "Dry-aged duck, quince, fermented plum",
          description: "Challans duck aged three weeks, roasted quince and last autumn's plums.",
          price: 48,
          tags: ["gf", "df"],
        },
        {
          name: "Lamb, fermented garlic, wild thyme",
          description: "Shoulder and loin of milk-fed lamb, black garlic and thyme from the hills.",
          price: 46,
          tags: ["gf", "df"],
        },
        {
          name: "Aged beef, bone marrow, watercress",
          description: "A cut of grass-fed beef aged forty days, roast marrow and watercress.",
          price: 52,
          tags: ["gf"],
        },
        {
          name: "Pigeon, beetroot, elderberry",
          description: "Pigeon roasted pink, beetroot cooked in its own juice and elderberry.",
          price: 49,
          tags: ["gf", "df"],
        },
      ],
    },
    {
      id: "to-finish",
      name: "To Finish",
      description: "Desserts and a trolley of French cheeses.",
      items: [
        {
          name: "Dark chocolate, olive oil, sea salt",
          description: "A warm 70% ganache, green olive oil and crushed sea salt.",
          price: 18,
          tags: ["v", "gf"],
        },
        {
          name: "Tart of late apples, brown sugar, crème fraîche",
          description: "A thin tart of the last orchard apples, caramel and thick crème fraîche.",
          price: 17,
          tags: ["v"],
        },
        {
          name: "Honey and saffron parfait, walnut",
          description: "Frozen parfait of our rooftop honey, saffron and candied walnut.",
          price: 18,
          tags: ["v", "gf", "n"],
        },
        {
          name: "A selection of French cheeses",
          description: "Five cheeses from an affineur in the Croix-Rousse, quince and walnut bread.",
          price: 22,
          tags: ["v", "n"],
        },
      ],
    },
  ],
};
