import { expect, test } from "@playwright/test";
import { ADMIN, loginAsAdmin } from "./helpers";

test("admin pages need a login with the right email and password", async ({ page }) => {
  await page.goto("/admin/poruchki");
  await expect(page).toHaveURL(/\/admin\/vhod$/);
  await page.getByLabel("Имейл").fill(ADMIN.email);
  await page.getByLabel("Парола").fill("wrong-password");
  await page.getByRole("button", { name: "Влез" }).click();
  await expect(page.getByText("Грешен имейл или парола.")).toBeVisible();
  await page.getByLabel("Имейл").fill("nobody@fener.test");
  await page.getByLabel("Парола").fill(ADMIN.password);
  await page.getByRole("button", { name: "Влез" }).click();
  await expect(page.getByText("Грешен имейл или парола.")).toBeVisible();
  // The demo password hint is not shown when real credentials are configured.
  await expect(page.getByText("demo1234")).toHaveCount(0);
});

test("the dashboard shows numbers and an interactive sales chart", async ({ page }) => {
  await loginAsAdmin(page);
  for (const label of ["Поръчки днес", "Оборот за 7 дни", "Средна поръчка", "Чакат потвърждение"]) {
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  }
  const chart = page.getByRole("img", { name: /Продажби по дни/ });
  await expect(chart).toBeVisible();
  const box = (await chart.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await expect(page.getByText(/поръчк[аи]$/).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Последни поръчки" })).toBeVisible();
});

test("admin creates a hidden product and changes stock", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/admin/produkti");
  await page.getByText("Добави продукт").click();
  await page.getByLabel("Име", { exact: true }).fill("Лампа за пиано „Клавиш“");
  await page.getByLabel("Категория").fill("Настолни");
  await page.getByLabel("Цена, €").fill("39,90");
  await page.getByRole("button", { name: "Създай" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Лампа за пиано „Клавиш“" })).toBeVisible();
  // Hidden from the shop until it is completed.
  const response = await page.request.get("/produkt/lampa-za-piano-klavish");
  expect(response.status()).toBe(404);

  await page.goto("/admin/nalichnosti");
  const stock = page.getByLabel("Наличност на Лампа за пиано „Клавиш“");
  await stock.fill("12");
  await stock.locator("xpath=..").getByRole("button", { name: "Запази" }).click();
  await expect(page.getByLabel("Наличност на Лампа за пиано „Клавиш“")).toHaveValue("12");
  await page.reload();
  await expect(page.getByLabel("Наличност на Лампа за пиано „Клавиш“")).toHaveValue("12");
});

test("a product without safety data cannot be published", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/admin/produkti");
  await page.locator("article", { hasText: "Подова лампа „Кула“" }).getByRole("link", { name: "Редактирай" }).click();
  await page.getByLabel("Публикуван в магазина").check();
  await page.getByRole("button", { name: "Запази промените" }).click();
  await expect(page.getByText(/Не може да се публикува без данни за безопасност/)).toBeVisible();
});

test("a reduction must be below the lowest price of the last 30 days", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/admin/produkti");
  await page.locator("article", { hasText: "Нощна лампа „Фитил“" }).getByRole("link", { name: "Редактирай" }).click();

  // 31,00 is higher than the current 29,90: refused.
  await page.getByLabel("Цена с ДДС, €").fill("31,00");
  await page.getByLabel(/Обяви като намаление/).check();
  await page.getByRole("button", { name: "Запази промените" }).click();
  await expect(page.getByText(/Това не е намаление по закона/)).toBeVisible();
  // What was typed is still there after the error.
  await expect(page.getByLabel("Цена с ДДС, €")).toHaveValue("31,00");
  await expect(page.getByLabel(/Обяви като намаление/)).toBeChecked();

  // 24,90 is a real reduction: (29,90 - 24,90) / 29,90 = 16,7% -> shown as -16%.
  await page.getByLabel("Цена с ДДС, €").fill("24,90");
  await page.getByRole("button", { name: "Запази промените" }).click();
  await expect(page.getByText("Записано.")).toBeVisible();

  await page.goto("/produkt/noshtna-lampa-fitil");
  await expect(page.getByText("-16%")).toBeVisible();
  await expect(page.getByText(/Най-ниска цена през последните 30 дни/)).toContainText("29,90");
});

test("admin refreshes a courier office list", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/admin/kurieri");
  await expect(page.getByTestId("offices-speedy")).toHaveText("4");
  await page.getByRole("button", { name: "Обнови офисите от Спиди" }).click();
  await expect(page.getByText("Спиди: записани 6 офиса и автомата.")).toBeVisible();
});
