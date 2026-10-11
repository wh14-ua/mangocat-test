import type { StoryConfig } from "./types";
import { images } from "./images";

/**
 * Editorial content for the Our Story page and the chef sections elsewhere.
 */
export const story: StoryConfig = {
  eyebrow: "Our Story",
  heading: "A workshop for the season",
  lead:
    "ATELIER began in a narrow room on the Quai Saint-Antoine with eight tables and a single idea: cook what the morning market gives, and little else.",

  opening: {
    image: images.storyHero,
    caption: "The dining room at ATELIER, set for the evening's first service.",
  },

  philosophy: {
    heading: "Cooking is a daily study",
    body: [
      "The menu is written each morning, after the market and before service. What arrives decides what is cooked. A course that was perfect on Tuesday may be gone by Friday, and that is the point.",
      "We keep the room small so the kitchen can stay close to every plate. Twenty-four seats, one seating a night, and a pass you can see from most of the tables.",
      "The result is not a fixed signature but a way of working: attention paid to one ingredient at a time, and a plate that tastes of a place and a week.",
    ],
    image: images.kitchen,
  },

  chef: {
    name: "Camille Devereux",
    role: "Chef & Founder",
    portrait: images.chefPortrait,
    bio: [
      "Camille Devereux opened ATELIER in 2014, after ten years cooking in Lyon, in Paris and on the Basque coast. The idea for the room was simple and stubborn: a kitchen that answered to the season rather than to a signature.",
      "The training shows in the restraint. Classical technique sits underneath every plate, but the writing on top changes with the week. Devereux still works the pass for every service and still walks the market most mornings.",
    ],
    quote:
      "A plate should taste of a place and a week, and of almost nothing else.",
  },

  values: [
    {
      title: "The Season Decides",
      body: "The carte is written the morning it is cooked. We follow the market, not the other way around.",
    },
    {
      title: "One Room, One Menu",
      body: "Twenty-four seats, a single seating, and a tasting menu served to the whole table at once.",
    },
    {
      title: "Grown Close",
      body: "Most of what reaches the pass is grown or raised within an hour of Lyon, by people we have bought from for years.",
    },
    {
      title: "Nothing Wasted",
      body: "A whole animal, a whole vegetable. Trimmings become stock, ferments and the next day's first course.",
    },
  ],

  provenance: {
    heading: "Where it comes from",
    body: "We buy from a short list of growers, fishers and an affineur in the Croix-Rousse. The list is on the wall by the door, and it changes about as often as the menu does.",
    images: [images.produce, images.counter, images.chefHands],
  },

  pullQuote: {
    text: "We are not trying to be remembered for one dish. We are trying to cook this week properly.",
    attribution: "Camille Devereux, Chef & Founder",
  },
};
