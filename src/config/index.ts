/**
 * Single import surface for the configuration layer.
 *   import { site, menu, story, gallery, experiences, images } from "@/config";
 */
export * from "./types";
export { site, reserveCta } from "./site";
export { theme } from "./theme";
export { menu } from "./menu";
export { story } from "./story";
export { experiences, featuredDishes } from "./experiences";
export { gallery } from "./gallery";
export { images } from "./images";
export {
  meridia,
  showcaseDesigns,
  showcaseImages,
  playfulHandcraftImages,
  getShowcaseDesign,
} from "./showcase";
export type { ShowcaseDesign, ShowcaseDish, ShowcaseContent } from "./showcase";
