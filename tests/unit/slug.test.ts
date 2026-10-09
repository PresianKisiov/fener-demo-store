import { describe, expect, it } from "vitest";
import { slugify } from "@/lib/slug";

describe("slugify", () => {
  it("transliterates Bulgarian the official way", () => {
    expect(slugify("Детски играчки")).toBe("detski-igrachki");
    expect(slugify("Нощна лампа „Фитил“")).toBe("noshtna-lampa-fitil");
    expect(slugify("Щипка за юрган")).toBe("shtipka-za-yurgan");
    expect(slugify("Цветна история")).toBe("tsvetna-istoria");
  });
  it("keeps Latin letters and numbers and cleans the rest", () => {
    expect(slugify("LED лента 2 м!")).toBe("led-lenta-2-m");
    expect(slugify("  --Лампа--  ")).toBe("lampa");
  });
});
