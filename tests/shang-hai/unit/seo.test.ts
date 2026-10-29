import { describe, expect, it } from "vitest";
import { shangHaiRestaurant } from "@/data/shang-hai/restaurant";
import { restaurantJsonLd } from "@/lib/shang-hai/seo";

describe("restaurant JSON-LD", () => {
  it("publishes only verified facts and never ratings", () => {
    const ld = restaurantJsonLd(shangHaiRestaurant, "https://example.es");
    expect(ld.address).toMatchObject({ streetAddress: "Avenida Doctor Gómez Pardo Ródenas, 5", postalCode: "03300" });
    // Pending facts stay out until the owner confirms them.
    expect(ld.telephone).toBeUndefined();
    expect(ld.openingHoursSpecification).toBeUndefined();
    expect(ld.geo).toBeUndefined();
    expect(JSON.stringify(ld)).not.toMatch(/aggregateRating|review/i);
  });

  it("adds hours and phone once they are verified", () => {
    const confirmed = {
      ...shangHaiRestaurant,
      phone: { ...shangHaiRestaurant.phone, status: "verified" as const },
      hours: { ...shangHaiRestaurant.hours, status: "verified" as const },
    };
    const ld = restaurantJsonLd(confirmed, "https://example.es", "https://example.es/carta");
    expect(ld.telephone).toBe("+34623300934");
    expect(ld.openingHoursSpecification).toContainEqual({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: "https://schema.org/Monday",
      opens: "12:00",
      closes: "16:00",
    });
    expect(ld.hasMenu).toBe("https://example.es/carta");
  });
});
