import type { GalleryConfig } from "./types";
import { images } from "./images";

/**
 * Editorial gallery. `aspect` drives the grid rhythm; `category` matches a
 * filter id. Alt text is written for screen readers (no decorative captions).
 */
export const gallery: GalleryConfig = {
  filters: [
    { id: "all", label: "Everything" },
    { id: "dishes", label: "Dishes" },
    { id: "room", label: "The Room" },
    { id: "kitchen", label: "The Kitchen" },
    { id: "details", label: "Details" },
  ],
  items: [
    { src: images.dish01, alt: "A cold opening course of oyster with cucumber and elderflower", aspect: "portrait", category: "dishes" },
    { src: images.interior02, alt: "The ATELIER dining room in low evening light", aspect: "landscape", category: "room" },
    { src: images.chefHands, alt: "A cook finishing a plate at the pass", aspect: "portrait", category: "kitchen" },
    { src: images.dish02, alt: "Heritage beetroot with aged goat curd and walnut", aspect: "square", category: "dishes" },
    { src: images.tableDetail, alt: "A table laid with glassware and linen before service", aspect: "square", category: "details" },
    { src: images.kitchen, alt: "The open kitchen during service", aspect: "landscape", category: "kitchen" },
    { src: images.dish03, alt: "Turbot roasted on the bone with sea herbs", aspect: "portrait", category: "dishes" },
    { src: images.wine, alt: "A glass of red wine poured in the dining room", aspect: "portrait", category: "details" },
    { src: images.counter, alt: "The chef's counter looking into the kitchen", aspect: "landscape", category: "room" },
    { src: images.dessert, alt: "A warm dark chocolate dessert with olive oil and salt", aspect: "portrait", category: "dishes" },
    { src: images.detail01, alt: "A sauce finished to order at the pass", aspect: "square", category: "details" },
    { src: images.produce, alt: "Seasonal produce carried in from the morning market", aspect: "landscape", category: "kitchen" },
    { src: images.dish06, alt: "An early course plated for the whole table", aspect: "square", category: "dishes" },
    { src: images.chefPortrait, alt: "Chef Camille Devereux in the kitchen", aspect: "portrait", category: "kitchen" },
  ],
};
