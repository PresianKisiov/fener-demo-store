import { ORDER_STATUS, type OrderStatus } from "@/lib/order-status";

// Text colors are darkened versions of the template's pill colors so they pass 4.5:1 contrast.
const TONES = {
  done: "bg-[#ccf0eb] text-[#006b5b]",
  work: "bg-[#e0d4fc] text-[#5a20e0]",
  transit: "bg-[#f5d9ff] text-[#7f17b0]",
  wait: "bg-[#ffeddd] text-[#a15300]",
  bad: "bg-[#fcd7d4] text-[#b42318]",
  off: "bg-[#eceef2] text-[#5e6470]",
} as const;

const TONE_OF: Record<OrderStatus, keyof typeof TONES> = {
  pending_payment: "wait",
  pending_confirmation: "wait",
  payment_failed: "bad",
  confirmed: "work",
  packed: "work",
  shipped: "transit",
  delivered: "done",
  refused: "bad",
  returned: "off",
  cancelled: "bad",
  withdrawal_requested: "wait",
  withdrawal_received: "wait",
  refunded: "off",
};

/** Order status in words, with a color to help scanning (never color alone). */
export function StatusPill({ status }: { status: string }) {
  const s = status as OrderStatus;
  return (
    <span className={`inline-block whitespace-nowrap rounded-md px-3 py-1 text-xs font-bold ${TONES[TONE_OF[s] ?? "off"]}`}>
      {ORDER_STATUS[s] ?? status}
    </span>
  );
}
