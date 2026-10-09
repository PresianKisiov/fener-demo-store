import { expect, type Page } from "@playwright/test";

export async function addToCart(page: Page, productName: string, quantity = 1) {
  await page.goto("/katalog");
  await page.getByRole("link", { name: productName }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: productName })).toBeVisible();
  await page.getByLabel("Брой").selectOption(String(quantity));
  await page.getByRole("button", { name: "Добави в количката" }).click();
  await expect(page.getByText("Добавено в количката.")).toBeVisible();
}

export async function fillContact(page: Page, email: string) {
  await page.getByLabel("Име и фамилия").fill("Иван Петров");
  await page.getByLabel("Мобилен телефон").fill("0888 123 456");
  await page.getByLabel("Имейл", { exact: true }).fill(email);
}

export const ADMIN = { email: "admin@fener.test", password: "Fener-Demo-2026" };

export async function loginAsAdmin(page: Page) {
  await page.goto("/admin/vhod");
  await page.getByLabel("Имейл").fill(ADMIN.email);
  await page.getByLabel("Парола").fill(ADMIN.password);
  await page.getByRole("button", { name: "Влез" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Табло" })).toBeVisible();
}
