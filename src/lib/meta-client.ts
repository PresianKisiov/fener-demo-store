/**
 * Meta Pixel in the browser. The Pixel script is loaded only after consent
 * (components/MetaPixel.tsx). Before that, trackMeta() does nothing.
 *
 * eventId: the same id is sent by the server (Conversions API) for the same purchase.
 * Meta sees two reports with one id and counts the purchase once.
 */
type Fbq = ((...args: unknown[]) => void) & { callMethod?: unknown; queue?: unknown[]; loaded?: boolean; version?: string; push?: unknown };

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

export function loadPixel(pixelId: string) {
  if (window.fbq) return;
  // Meta's official loader, rewritten as plain code: queue calls until the script arrives.
  const fbq: Fbq = function (...args: unknown[]) {
    if (fbq.callMethod) (fbq.callMethod as (...a: unknown[]) => void)(...args);
    else fbq.queue!.push(args);
  } as Fbq;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.queue = [];
  window.fbq = fbq;
  window._fbq = fbq;
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);
  fbq("init", pixelId);
}

export function trackMeta(event: string, params?: Record<string, unknown>, eventId?: string) {
  if (!window.fbq) return;
  if (eventId) window.fbq("track", event, params ?? {}, { eventID: eventId });
  else window.fbq("track", event, params ?? {});
}
