/**
 * Catches typos in the most common email domains: "ivan@gmial.com" -> "ivan@gmail.com".
 * Runs in the browser (a hint under the field) and needs no network.
 *
 * Note: nobody can check that a mailbox really exists without sending it an email.
 * What we can check: the spelling (here) and that the domain accepts email at all
 * (src/server/email-check.ts, on the server).
 */
const COMMON = [
  "abv.bg",
  "gmail.com",
  "mail.bg",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "icloud.com",
  "dir.bg",
  "live.com",
  "yandex.ru",
  "proton.me",
  "protonmail.com",
];

/** Edit distance with swaps counted as one step (gmial -> gmail = 1). */
function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/** Returns the corrected address, or null when the domain looks fine or is not close to a common one. */
export function suggestEmail(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 1) return null;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1).trim().toLowerCase();
  if (!domain || COMMON.includes(domain)) return null;
  let best: { domain: string; d: number } | null = null;
  for (const candidate of COMMON) {
    const d = distance(domain, candidate);
    if (d <= 2 && (!best || d < best.d)) best = { domain: candidate, d };
  }
  return best ? `${local}@${best.domain}` : null;
}
