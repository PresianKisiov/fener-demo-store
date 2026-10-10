"use client";
/**
 * The cookie banner. Both buttons are equally visible: EU rules do not allow making
 * "refuse" harder than "accept". Until the visitor chooses, no advertising code loads.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { CONSENT_EVENT, readConsent, saveConsent } from "@/lib/consent";

export function ConsentBanner() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // The cookie is only readable in the browser, after the page has loaded.
    setOpen(readConsent() === null);
    const reopen = (event: Event) => setOpen((event as CustomEvent).detail === null);
    window.addEventListener(CONSENT_EVENT, reopen);
    return () => window.removeEventListener(CONSENT_EVENT, reopen);
  }, []);

  if (!open) return null;
  return (
    <div role="dialog" aria-labelledby="consent-title" aria-describedby="consent-text" className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4">
      <div className="mx-auto max-w-3xl rounded-3xl border-[1.5px] border-line bg-white p-5 shadow-xl sm:flex sm:items-end sm:gap-6">
        <div className="text-sm">
          <p id="consent-title" className="font-display text-lg font-medium">Бисквитки</p>
          <p id="consent-text" className="mt-1 text-ink-soft">
            Нужните бисквитки пазят количката ти. С твое съгласие ползваме и Meta Pixel: така рекламите ни стигат до хора, които биха харесали
            лампите. <Link href="/usloviya#biskvitki" className="underline">Повече</Link>
          </p>
        </div>
        <div className="mt-4 flex shrink-0 gap-2 sm:mt-0">
          <button type="button" className="btn-secondary" onClick={() => { saveConsent("necessary"); setOpen(false); }}>
            Само нужните
          </button>
          <button type="button" className="btn-primary" onClick={() => { saveConsent("all"); setOpen(false); }}>
            Приемам всички
          </button>
        </div>
      </div>
    </div>
  );
}

/** Footer link: forget the choice and show the banner again. */
export function ConsentSettingsLink() {
  return (
    <button type="button" className="underline-offset-4 hover:underline" onClick={() => saveConsent(null)}>
      Настройки на бисквитките
    </button>
  );
}
