import { describe, expect, it } from "vitest";
import { auditLabel } from "../../src/lib/audit-labels";

describe("auditLabel", () => {
  it("shows waybill entries in Bulgarian", () => {
    expect(auditLabel("waybill EC6403853424 (econt, mock)")).toBe("Товарителница EC6403853424 (Еконт, симулация)");
    expect(auditLabel("waybill 1052001234 (speedy, live)")).toBe("Товарителница 1052001234 (Спиди, реален акаунт)");
    expect(auditLabel("waybill EC6403853424 cancelled")).toBe("Анулирана товарителница EC6403853424");
  });

  it("shows the Meta result and wrong payment amounts", () => {
    expect(auditLabel("meta purchase: ok (events_received 1)")).toBe("Покупката е отчетена към Meta");
    expect(auditLabel("meta purchase: error 400")).toBe("Meta не прие покупката: error 400");
    expect(auditLabel("amount_mismatch: expected 3080, got 100")).toBe("Плащане с грешна сума (очаквани 3080 цента, получени 100)");
  });

  it("leaves unknown codes as they are", () => {
    expect(auditLabel("something new")).toBe("something new");
  });
});
