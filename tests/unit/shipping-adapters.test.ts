/**
 * Courier adapters without network. The Econt samples are real answers from
 * Econt's test system (10.10.2026), shortened. The Speedy ones follow Speedy's documentation.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildEcontLabel, econtAdapter, econtErrorMessage, econtState, parseEcontOffices } from "@/server/shipping/econt";
import { workingHours } from "@/server/shipping/http";
import { buildSpeedyShipment, parseSpeedyOffices, speedyState, titleCase } from "@/server/shipping/speedy";
import { CourierError, type ShipmentRequest } from "@/server/shipping/types";

const officeRequest: ShipmentRequest = {
  orderNumber: "2026-000123",
  receiver: { name: "Иван Петров", phone: "+359888123456", email: "ivan@example.com" },
  delivery: { type: "office", officeCode: "1127" },
  weightGrams: 1200,
  description: "Лампи",
  codAmountCents: 4890,
};

const econtGabrovo = {
  id: 1087,
  code: "5306",
  isMPS: false,
  isAPS: false,
  name: "Габрово",
  address: {
    city: { postCode: "5300", name: "Габрово" },
    fullAddress: " Габрово ул. Доктор Заменхоф №3 Под Автогарата",
  },
  normalBusinessHoursFrom: 1791610200000,
  normalBusinessHoursTo: 1791646200000,
  halfDayBusinessHoursFrom: 1791612000000,
  halfDayBusinessHoursTo: 1791626400000,
};

describe("Econt", () => {
  it("turns the office list into our rows and skips mobile post stations", () => {
    const rows = parseEcontOffices({
      offices: [
        econtGabrovo,
        { ...econtGabrovo, code: "1702", isAPS: true, name: "Еконтомат Русе", address: { city: { postCode: "7000", name: "Русе" }, fullAddress: " Русе бул. Тутракан №8" } },
        { ...econtGabrovo, code: "3704@3790", isMPS: true, name: "Мобилен офис" },
      ],
    });
    expect(rows).toEqual([
      { code: "5306", kind: "office", city: "Габрово", postCode: "5300", name: "Габрово", address: "ул. Доктор Заменхоф №3 Под Автогарата", hours: "пон-пет 08:30-18:30, съб 09:00-13:00" },
      expect.objectContaining({ code: "1702", kind: "locker", city: "Русе", address: "бул. Тутракан №8" }),
    ]);
  });

  it("builds a waybill to an office with cash on delivery", () => {
    const label = buildEcontLabel(officeRequest, { name: "Фенер", phone: "+359888000000" }, { senderOfficeCode: "5306", paymentMethod: "cash" });
    expect(label).toMatchObject({
      senderOfficeCode: "5306",
      receiverOfficeCode: "1127",
      receiverClient: { name: "Иван Петров", phones: ["+359888123456"] },
      weight: 1.2,
      shipmentType: "PACK",
      services: { cdAmount: 48.9, cdType: "get", cdCurrency: "EUR" },
      paymentSenderMethod: "cash",
    });
    expect(label).not.toHaveProperty("receiverAddress");
  });

  it("builds a waybill to an address with post code and no cash on delivery", () => {
    const label = buildEcontLabel({
      ...officeRequest,
      delivery: { type: "address", city: "Габрово", postCode: "5300", addressLine: "ул. Брянска 15, вх. А" },
      codAmountCents: null,
    });
    expect(label).toHaveProperty("receiverAddress", { city: { country: { code3: "BGR" }, name: "Габрово", postCode: "5300" }, other: "ул. Брянска 15, вх. А" });
    expect(label).not.toHaveProperty("services");
    expect(label).not.toHaveProperty("receiverOfficeCode");
  });

  it("reads Econt's nested error answer", () => {
    const answer = {
      type: "ExInvalidParam",
      message: " ",
      innerErrors: [{ type: "ExInvalidParam", message: "получател: ", innerErrors: [{ message: " ", innerErrors: [{ type: "ExInvalidCity", message: "Несъответствие между населено място и пощенски код." }] }] }],
    };
    expect(econtErrorMessage(answer)).toBe("получател: Несъответствие между населено място и пощенски код.");
  });

  it("maps Econt statuses to ours", () => {
    expect(econtState({ shortDeliveryStatusEn: "Awaiting delivery to Econt", trackingEvents: [{ destinationType: "prepared" }] })).toBe("created");
    expect(econtState({ shortDeliveryStatusEn: "In route", trackingEvents: [{ destinationType: "prepared" }, { destinationType: "office" }] })).toBe("in_transit");
    expect(econtState({ shortDeliveryStatusEn: "Delivered", trackingEvents: [{ destinationType: "client" }] })).toBe("delivered");
    expect(econtState({ shortDeliveryStatusEn: "Is returning to sender", trackingEvents: [{ destinationType: "return" }] })).toBe("returned");
    expect(econtState({ shortDeliveryStatusEn: "Cancelled before sending", trackingEvents: [] })).toBe("cancelled");
  });

  describe("adapter over HTTP", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("creates a label with Basic login and returns number, https PDF link and cost", async () => {
      const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
        Response.json({
          label: {
            shipmentNumber: "1051604334939",
            pdfURL: "http://demo.econt.com/ee/api_export.php?exportMethod=printLoading&loading_num=1051604334939&_key=abc",
            totalPrice: 4.63,
            currency: "EUR",
          },
        }),
      );
      vi.stubGlobal("fetch", fetchMock);
      const created = await econtAdapter("demo").createShipment(officeRequest);
      expect(created).toEqual({
        trackingNumber: "1051604334939",
        labelUrl: "https://demo.econt.com/ee/api_export.php?exportMethod=printLoading&loading_num=1051604334939&_key=abc",
        costCents: 463,
        costCurrency: "EUR",
      });
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("https://demo.econt.com/ee/services/Shipments/LabelService.createLabel.json");
      expect((init.headers as Record<string, string>).Authorization).toBe("Basic " + Buffer.from("iasp-dev:1Asp-dev").toString("base64"));
      expect(JSON.parse(init.body as string).mode).toBe("create");
    });

    it("turns HTTP 517 into a readable CourierError", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => Response.json({ type: "ExInvalidParam", message: "Невалидно потребителско име и/или парола." }, { status: 517 })));
      const error = await econtAdapter("demo").createShipment(officeRequest).catch((e) => e);
      expect(error).toBeInstanceOf(CourierError);
      expect(error.message).toBe("Еконт: Невалидно потребителско име и/или парола.");
    });

    it("skips numbers Econt does not know when tracking", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          Response.json({
            shipmentStatuses: [
              { status: { shipmentNumber: "1051604334939", shortDeliveryStatus: "Очаква предаване към Еконт", shortDeliveryStatusEn: "Awaiting delivery to Econt", trackingEvents: [{ destinationType: "prepared", destinationDetails: "Очаква предаване към Еконт", time: 1791648858000 }] } },
              { status: null, error: { message: "Не е намерена пратка с номер 123." } },
            ],
          }),
        ),
      );
      const results = await econtAdapter("demo").track([
        { trackingNumber: "1051604334939", current: "created", createdAt: new Date() },
        { trackingNumber: "123", current: "created", createdAt: new Date() },
      ]);
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({ state: "created", statusText: "Очаква предаване към Еконт" });
      expect(results[0].events[0].text).toBe("Очаква предаване към Еконт");
    });
  });
});

describe("Speedy", () => {
  it("writes place names normally", () => {
    expect(titleCase("ВЕЛИКО ТЪРНОВО")).toBe("Велико Търново");
    expect(titleCase("БАНСКО-РАЗЛОГ")).toBe("Банско-Разлог");
    expect(titleCase("Габрово")).toBe("Габрово");
  });

  it("turns the office list into our rows", () => {
    const rows = parseSpeedyOffices({
      offices: [
        { id: 77, name: "ГАБРОВО - ЦЕНТЪР", type: "OFFICE", address: { siteName: "ГАБРОВО", postCode: "5300", localAddressString: "ул. Райчо Каролев 4" }, workingTimeFrom: "09:00", workingTimeTo: "18:30", workingTimeHalfFrom: "09:00", workingTimeHalfTo: "13:00" },
        { id: 78, name: "АВТОМАТ", type: "APT", address: { siteName: "ГАБРОВО", postCode: "5300", localAddressString: "Мол" }, workingTimeFrom: "00:00", workingTimeTo: "23:59" },
      ],
    });
    expect(rows[0]).toEqual({ code: "77", kind: "office", city: "Габрово", postCode: "5300", name: "ГАБРОВО - ЦЕНТЪР", address: "ул. Райчо Каролев 4", hours: "пон-пет 09:00-18:30, съб 09:00-13:00" });
    expect(rows[1]).toMatchObject({ kind: "locker", hours: "24/7" });
  });

  it("builds a shipment to an office with cash on delivery", () => {
    const body = buildSpeedyShipment({ ...officeRequest, delivery: { type: "locker", officeCode: "78" } });
    expect(body.recipient).toMatchObject({ pickupOfficeId: 78, privatePerson: true, phone1: { number: "+359888123456" } });
    expect(body.service).toMatchObject({ serviceId: 505, additionalServices: { cod: { amount: 48.9, processingType: "CASH" } } });
    expect(body.content).toMatchObject({ parcelsCount: 1, totalWeight: 1.2 });
    expect(body.payment).toEqual({ courierServicePayer: "SENDER" });
  });

  it("maps operation codes to our statuses", () => {
    expect(speedyState([{ operationCode: 148 }])).toBe("created");
    expect(speedyState([{ operationCode: 148 }, { operationCode: 1 }])).toBe("in_transit");
    expect(speedyState([{ operationCode: 148 }, { operationCode: 12 }, { operationCode: -14 }])).toBe("delivered");
    expect(speedyState([{ operationCode: 44 }, { operationCode: 111 }])).toBe("returned");
  });
});

describe("working hours", () => {
  it("shows round-the-clock lockers as 24/7", () => {
    expect(workingHours("00:01", "23:59", null, null)).toBe("24/7");
    expect(workingHours("09:00", "18:00", null, null)).toBe("пон-пет 09:00-18:00");
    expect(workingHours(null, null, null, null)).toBe("");
  });
});
