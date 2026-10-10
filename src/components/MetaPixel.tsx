"use client";
/**
 * Loads Meta Pixel after the visitor accepts cookies, and reports a PageView on every
 * page change. Without META_PIXEL_ID (no pixelId prop) it does nothing at all.
 */
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CONSENT_EVENT, readConsent } from "@/lib/consent";
import { loadPixel, trackMeta } from "@/lib/meta-client";

export function MetaPixel({ pixelId }: { pixelId: string | null }) {
  const pathname = usePathname();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    setAllowed(readConsent() === "all");
    const onChange = (event: Event) => {
      const consent = (event as CustomEvent).detail;
      setAllowed(consent === "all");
      // Meta's script cannot be unloaded from a page; after a "no" the next page load is clean.
      if (consent !== "all" && window.fbq) location.reload();
    };
    window.addEventListener(CONSENT_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_EVENT, onChange);
  }, []);

  useEffect(() => {
    if (!pixelId || !allowed) return;
    loadPixel(pixelId);
    trackMeta("PageView");
  }, [pixelId, allowed, pathname]);

  return null;
}

/** Reports one event when the page opens: ViewContent, InitiateCheckout, Purchase. */
export function MetaEvent({ name, params, eventId }: { name: string; params?: Record<string, unknown>; eventId?: string }) {
  const [sent, setSent] = useState(false);
  useEffect(() => {
    if (sent) return;
    const send = () => {
      if (!window.fbq) return false;
      trackMeta(name, params, eventId);
      setSent(true);
      return true;
    };
    if (send()) return;
    // The Pixel may load a moment later (just after consent): try again for a few seconds.
    const timer = setInterval(() => send() && clearInterval(timer), 500);
    const stop = setTimeout(() => clearInterval(timer), 8000);
    return () => {
      clearInterval(timer);
      clearTimeout(stop);
    };
  }, [name, params, eventId, sent]);
  return null;
}

/** Thank-you page: the purchase goes to Meta from the browser and from the server, with one event id. */
export function MetaPurchase({ token, eventId, params }: { token: string; eventId: string; params: Record<string, unknown> }) {
  useEffect(() => {
    fetch("/api/meta/purchase", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) }).catch(() => {});
  }, [token]);
  return <MetaEvent name="Purchase" params={params} eventId={eventId} />;
}
