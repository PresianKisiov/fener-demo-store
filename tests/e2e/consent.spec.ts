import { expect, test } from "@playwright/test";

// An empty browser: no consent cookie yet.
test.use({ storageState: { cookies: [], origins: [] } });

test("Meta Pixel loads only after the visitor accepts cookies", async ({ page }) => {
  const pixelRequests: string[] = [];
  // No real call to Meta from the tests: answer with an empty script and count the requests.
  await page.route("https://connect.facebook.net/**", (route) => {
    pixelRequests.push(route.request().url());
    return route.fulfill({ status: 200, contentType: "application/javascript", body: "" });
  });

  await page.goto("/");
  const banner = page.getByRole("dialog", { name: "Бисквитки" });
  await expect(banner).toBeVisible();
  expect(pixelRequests).toHaveLength(0);

  // "Only necessary": banner closes, Pixel stays off, also after a reload.
  await banner.getByRole("button", { name: "Само нужните" }).click();
  await expect(banner).toBeHidden();
  await page.reload();
  await expect(page.getByRole("dialog", { name: "Бисквитки" })).toBeHidden();
  expect(pixelRequests).toHaveLength(0);

  // The footer link brings the choice back; accepting loads the Pixel.
  await page.getByRole("button", { name: "Настройки на бисквитките" }).click();
  await page.getByRole("dialog", { name: "Бисквитки" }).getByRole("button", { name: "Приемам всички" }).click();
  await expect.poll(() => pixelRequests.length).toBeGreaterThan(0);
});
