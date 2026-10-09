import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";
import { addToCart, fillContact } from "./helpers";

async function checkoutWithCard(page: import("@playwright/test").Page, email: string) {
  await addToCart(page, "Лампа с щипка „Страница“", 1);
  await page.goto("/poruchka");
  await fillContact(page, email);
  await page.getByRole("radio", { name: /Спиди/ }).check();
  await page.getByRole("radio", { name: /До адрес/ }).check();
  await page.getByLabel("Населено място").fill("Габрово");
  await page.getByLabel("Улица, номер, вход, етаж").fill("ул. Радецки 10, ет. 2");
  await page.getByRole("radio", { name: /С карта/ }).check();
  // 24,90 + 5,90 address delivery, no COD fee = 30,80
  await expect(page.getByTestId("checkout-total")).toContainText("30,80");
  await page.getByLabel(/Приемам/).check();
  await page.getByRole("button", { name: "Поръчка със задължение за плащане" }).click();
  await expect(page).toHaveURL(/\/test-plashtane\/[0-9a-f-]{36}$/);
  return page.url().split("/").pop()!;
}

test("card payment is confirmed by the signed webhook", async ({ page }) => {
  await checkoutWithCard(page, "maria@example.com");
  await page.getByRole("button", { name: /Плати/ }).click();
  await expect(page.getByTestId("thank-you-heading")).toHaveText("Поръчката е приета");
});

test("a declined card leaves the order unpaid", async ({ page }) => {
  await checkoutWithCard(page, "georgi@example.com");
  await page.getByRole("button", { name: "Симулирай отказана карта" }).click();
  await expect(page.getByTestId("thank-you-heading")).toHaveText("Плащането не мина");
});

test("the webhook rejects forged messages and ignores repeats", async ({ page, request }) => {
  const paymentId = await checkoutWithCard(page, "elena@example.com");
  const send = (event: object, secret = "e2e-webhook-secret") => {
    const body = JSON.stringify(event);
    const t = Math.floor(Date.now() / 1000);
    const v1 = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
    return request.post("/api/payments/mock-webhook", {
      data: body,
      headers: { "content-type": "application/json", "x-mock-signature": `t=${t},v1=${v1}` },
    });
  };

  // Signed with the wrong secret: rejected.
  const forged = await send({ id: "evt_forged", type: "payment.succeeded", data: { paymentId, amountCents: 3080 } }, "guess");
  expect(forged.status()).toBe(400);

  // Correct signature but a different amount: not accepted as payment.
  const cheap = await send({ id: "evt_cheap", type: "payment.succeeded", data: { paymentId, amountCents: 100 } });
  expect(await cheap.json()).toEqual({ result: "amount_mismatch" });

  // The real event, then the same event again.
  const event = { id: "evt_real", type: "payment.succeeded", data: { paymentId, amountCents: 3080 } };
  expect(await (await send(event)).json()).toEqual({ result: "processed" });
  expect(await (await send(event)).json()).toEqual({ result: "duplicate" });

  // A late "failed" event cannot undo a successful payment.
  const late = await send({ id: "evt_late", type: "payment.failed", data: { paymentId, amountCents: 3080 } });
  expect(await late.json()).toEqual({ result: "already_final" });
});
