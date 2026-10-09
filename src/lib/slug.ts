/**
 * URL slugs from Bulgarian text, using the official transliteration
 * (Закон за транслитерацията): "Нощна лампа" -> "noshtna-lampa".
 */
const MAP: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sht",
  ъ: "a", ь: "y", ю: "yu", я: "ya",
};

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .split(/\s+/)
    .map((word) => {
      // "ия" at the end of a word is written "ia" (e.g. "история" -> "istoria").
      const w = word.replace(/ия(?=[^а-я]*$)/, "\u0001");
      return [...w].map((ch) => (ch === "\u0001" ? "ia" : (MAP[ch] ?? ch))).join("");
    })
    .join("-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
