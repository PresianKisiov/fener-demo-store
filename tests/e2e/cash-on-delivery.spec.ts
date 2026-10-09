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
  for (const [button, status] of [
    ["Потвърди поръчката", "Потвърдена"],
    ["Маркирай като опакована", "Опакована"],
    ["Създай товарителница и изпрати", "Изпратена"],
    ["Маркирай като доставена", "Доставена"],
  ]) {
    await page.getByRole("button", { name: button }).click();
    await expect(page.getByTestId("order-status")).toHaveText(status);
  }
  await expect(page.getByText(/Товарителница: EC\d{10}/)).toBeVisible();

  // Customer checks the status.
  await page.goto("/prosledyavane");
  await page.getByLabel("Номер на поръчката").fill(orderNumber);
  await page.getByLabel("Имейл", { exact: true }).fill("IVAN@example.com");
  await page.getByRole("button", { name: "Покажи" }).click();
  await expect(page.getByTestId("tracking-status")).toHaveText("Доставена");

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
