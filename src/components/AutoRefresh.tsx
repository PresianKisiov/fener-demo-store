"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-renders the page from the server every few seconds, e.g. while a payment is being confirmed. */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
