/**
 * Cookie consent. In the EU, advertising cookies (Meta Pixel) may be set only after
 * the visitor agrees. "necessary" = only what the shop needs to work (cart, admin login).
 * The choice is kept for 180 days in a first-party cookie, which the server can read too.
 */
export const CONSENT_COOKIE = "fener_consent";
export const CONSENT_EVENT = "fener:consent";
export type Consent = "all" | "necessary";

export function parseConsent(value: string | undefined | null): Consent | null {
  return value === "all" || value === "necessary" ? value : null;
}

/** Browser only. */
export function readConsent(): Consent | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${CONSENT_COOKIE}=([^;]*)`));
  return parseConsent(match?.[1]);
}

/** Browser only. Tells the page (Pixel loader) about the new choice. */
export function saveConsent(consent: Consent | null) {
  const maxAge = consent ? 180 * 24 * 60 * 60 : 0;
  document.cookie = `${CONSENT_COOKIE}=${consent ?? ""}; Max-Age=${maxAge}; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  if (consent !== "all") {
    // Taking consent back also removes the advertising cookies Meta Pixel had set.
    for (const name of ["_fbp", "_fbc"]) {
      document.cookie = `${name}=; Max-Age=0; Path=/`;
      document.cookie = `${name}=; Max-Age=0; Path=/; Domain=.${location.hostname}`;
    }
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: consent }));
}
