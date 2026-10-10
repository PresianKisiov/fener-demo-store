import { expect, test } from "@playwright/test";
import { addToCart, fillContact, loginAsAdmin } from "./helpers";

test("cash on delivery: order, admin processes it, customer tracks it and withdraws", async ({ page }) => {
  // Customer buys two clip lamps.
  await addToCart(page, "Лампа с щипка „Страница“", 2);
  await expect(page.getByTestId("cart-count")).toHaveText("2");

  await page.goto("/kolichka");
  await page.getByRole("link", { name: "Към поръчката" }).click();

  // Checkout without filling anything shows errors, not a crash.
  await page.getByRole("button", { name: "Поръчка със задължение за плащане" }).click();
  await expect(page.getByText("Поправи отбелязаните полета")).toBeVisible();

  await fillContact(page, "ivan@example.com");
  await page.getByRole("radio", { name: /Еконт/ }).check();
  await page.getByRole("radio", { name: /До офис/ }).check();
  await page.getByLabel("Град", { exact: true }).selectOption("Габрово");
  // The offices of the city come from /api/offices after the city is chosen.
  await page.getByLabel("Офис", { exact: true }).selectOption({ index: 1 });
  await page.getByRole("radio", { name: /Наложен платеж/ }).check();
  // 2 x 24,90 = 49,80 + 3,90 office + 1,00 COD fee = 54,70
  await expect(page.getByTestId("checkout-total")).toContainText("54,70");
  await page.getByLabel(/Приемам/).check();
  await page.getByRole("button", { name: "Поръчка със задължение за плащане" }).click();

  await expect(page.getByTestId("thank-you-heading")).toHaveText("Поръчката е приета");
  const numberText = await page.getByText(/^Поръчка \d{4}-\d{6}$/).textContent();
  const orderNumber = numberText!.replace("Поръчка ", "");
  await expect(page.getByTestId("cart-count")).toHaveText("0");

  // Admin moves it through the statuses.
  await loginAsAdmin(page);
  await page.goto("/admin/poruchki");
  await page.getByRole("link", { name: orderNumber }).click();
  await page.getByRole("button", { name: "Потвърди поръчката" }).click();
  await expect(page.getByTestId("order-status")).toHaveText("Потвърдена");

  // "Предадена на куриера" is refused while there is no waybill.
  await page.getByRole("button", { name: "Маркирай като опакована" }).click();
  await expect(page.getByTestId("order-status")).toHaveText("Опакована");
  await page.getByRole("button", { name: "Предадена на куриера" }).click();
  await expect(page.getByText("Първо създай товарителница")).toBeVisible();

  // Waybill with the suggested weight (2 x 250 g).
  await expect(page.getByLabel("Тегло, кг")).toHaveValue("0,50");
  await page.getByRole("button", { name: "Създай товарителница в Еконт" }).click();
  await expect(page.getByTestId("tracking-number")).toHaveText(/^EC\d{10}$/);
  const trackingNumber = await page.getByTestId("tracking-number").textContent();

  // The label opens (the mock courier makes a simple HTML label).
  const labelHref = await page.getByRole("link", { name: "Етикет за печат" }).getAttribute("href");
  const label = await page.request.get(labelHref!);
  expect(label.status()).toBe(200);
  expect(await label.text()).toContain(trackingNumber!);

  // Each status check moves the mock parcel one step: picked up, then delivered.
  await page.getByRole("button", { name: "Провери статуса" }).click();
  await expect(page.getByTestId("order-status")).toHaveText("Изпратена");
  await page.getByRole("button", { name: "Провери статуса" }).click();
  await expect(page.getByTestId("order-status")).toHaveText("Доставена");
  await expect(page.getByTestId("courier-status")).toContainText("Доставена");

  // Customer checks the status.
  await page.goto("/prosledyavane");
  await page.getByLabel("Номер на поръчката").fill(orderNumber);
  await page.getByLabel("Имейл", { exact: true }).fill("IVAN@example.com");
  await page.getByRole("button", { name: "Покажи" }).click();
  await expect(page.getByTestId("tracking-status")).toHaveText("Доставена");
  await expect(page.getByText(`Товарителница: ${trackingNumber}`)).toBeVisible();

  // Wrong email reveals nothing.
  await page.getByLabel("Имейл", { exact: true }).fill("someone@example.com");
  await page.getByRole("button", { name: "Покажи" }).click();
  await expect(page.getByText("Не намерихме поръчка")).toBeVisible();

  // Customer withdraws in two steps.
  await page.goto("/otkaz");
  await page.getByLabel("Име и фамилия").fill("Иван Петров");
  await page.getByLabel("Номер на поръчката").fill(orderNumber);
  await page.getByLabel("Имейл от поръчката").fill("ivan@example.com");
  await page.getByRole("button", { name: "Продължи" }).click();
  await page.getByRole("button", { name: "Потвърждавам отказа" }).click();
  await expect(page.getByTestId("withdrawal-done")).toBeVisible();

  // The acknowledgment email exists, with date and time.
  await page.goto("/admin/imeyli");
  await expect(page.getByText(`Потвърждение за отказ от договор, поръчка ${orderNumber}`)).toBeVisible();
  await page.goto("/admin/otkazi");
  await expect(page.getByTestId(`withdrawal-${orderNumber}`)).toContainText(/1[34] дни остават/);

  // The admin finds the order with the search box in the top bar.
  await page.getByRole("searchbox", { name: "Търси поръчки" }).fill("ivan@example.com");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("link", { name: orderNumber })).toBeVisible();
});
