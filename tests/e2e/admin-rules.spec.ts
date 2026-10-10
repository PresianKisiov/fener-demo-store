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

// A 1x1 PNG. The browser turns it into WebP before upload, like a phone photo.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

test("admin uploads a product photo and the shop shows it", async ({ page }) => {
  await loginAsAdmin(page);
  // Product 2 is "Отметка" in the demo data.
  await page.goto("/admin/produkti/2");
  await expect(page.getByRole("heading", { level: 1, name: "Лампа за книга „Отметка“" })).toBeVisible();
  await page.getByLabel("Добави снимки").setInputFiles({ name: "lampa.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByText("Качени снимки: 1.")).toBeVisible();
  const src = await page.getByRole("img", { name: /Лампа за книга „Отметка“, снимка 1/ }).getAttribute("src");
  const image = await page.request.get(src!);
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toMatch(/image\/(webp|jpeg)/);

  await page.goto("/produkt/lampa-za-kniga-otmetka");
  await expect(page.locator(`img[src="${src}"]`)).toBeVisible();
});

test("search engines are kept away from the demo, the sitemap lists products", async ({ request }) => {
  expect(await (await request.get("/robots.txt")).text()).toContain("Disallow: /");
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/produkt/lampa-za-kniga-otmetka");
});

test("photos of a hidden product are visible only to the admin", async ({ page, request }) => {
  await loginAsAdmin(page);
  // Product 8, "Кула", is the unpublished draft in the demo data.
  await page.goto("/admin/produkti/8");
  await page.getByLabel("Добави снимки").setInputFiles({ name: "kula.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByText("Качени снимки: 1.")).toBeVisible();
  const src = await page.getByRole("img", { name: /снимка 1/ }).getAttribute("src");
  expect((await page.request.get(src!)).status()).toBe(200); // admin session
  expect((await request.get(src!)).status()).toBe(404); // a visitor
});

test("the hourly job cannot be started from outside", async ({ request }) => {
  expect((await request.post("/api/cron")).status()).toBe(401);
  expect((await request.post("/api/cron", { headers: { authorization: "Bearer guess" } })).status()).toBe(401);
});
