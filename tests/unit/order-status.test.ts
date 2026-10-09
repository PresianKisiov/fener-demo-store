import { describe, expect, it } from "vitest";
import { adminTransitions, canTransition } from "@/lib/order-status";

describe("order state machine", () => {
  it("allows the normal cash on delivery path", () => {
    expect(canTransition("pending_confirmation", "confirmed")).toBe(true);
    expect(canTransition("confirmed", "packed")).toBe(true);
    expect(canTransition("packed", "shipped")).toBe(true);
    expect(canTransition("shipped", "delivered")).toBe(true);
  });

  it("blocks impossible jumps", () => {
    expect(canTransition("cancelled", "shipped")).toBe(false);
    expect(canTransition("pending_payment", "shipped")).toBe(false);
    expect(canTransition("delivered", "cancelled")).toBe(false);
  });

  it("does not let an admin mark a card order as paid by hand", () => {
    expect(adminTransitions("pending_payment")).toEqual(["cancelled"]);
  });
});
