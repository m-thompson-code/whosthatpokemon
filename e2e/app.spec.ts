import { expect, test, type Page } from "@playwright/test";

const identityKey = "whosthatpokemon.identity.v1";

const seedMockIdentity = async (page: Page, username: string | null) => {
  await page.addInitScript(
    ({ key, value }) => window.localStorage.setItem(key, value),
    {
      key: identityKey,
      value: JSON.stringify({
        version: 1,
        mode: "mock",
        username,
        mockId: "moo-playwright",
        firebaseUid: null,
      }),
    },
  );
};

test("first-time username setup uses page navigation", async ({ page }) => {
  await seedMockIdentity(page, null);
  await page.goto("/");

  await expect(page).toHaveURL(/\/welcome\?next=%2F$/);
  await expect(page.getByRole("heading", { name: "Choose your username" })).toBeVisible();
  await expect(page.locator('[role="dialog"]')).toHaveCount(0);

  await page.getByRole("textbox", { name: "Username" }).fill("Playwright Trainer");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page).toHaveURL("/");
  await expect(page.getByText("Joining as")).toContainText("Playwright Trainer");
  const storedUsername = await page.evaluate((key) => {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value).username : null;
  }, identityKey);
  expect(storedUsername).toBe("Playwright Trainer");
});

test("settings and developer controls use normal page flow", async ({ page }) => {
  await seedMockIdentity(page, "Playwright Trainer");
  await page.goto("/");
  const settingsLink = page.getByRole("link", { name: "Open settings" });
  await expect(settingsLink).toHaveAttribute("href", "/settings");
  await settingsLink.focus();
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL("/settings");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.locator('[role="dialog"]')).toHaveCount(0);

  const developerSettings = page.locator(".developer-settings");
  await expect(developerSettings).not.toHaveAttribute("open", "");
  await developerSettings.locator("summary").click();
  await expect(page.getByRole("textbox", { name: "Developer ID" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Email" })).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
});

test("identity initializes on the 127.0.0.1 development origin", async ({ page }) => {
  await seedMockIdentity(page, "Playwright Trainer");
  await page.goto("http://127.0.0.1:3000/settings");

  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.locator(".identity-loading")).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Username" })).toHaveValue(
    "Playwright Trainer",
  );
});

test("Free Mode reveals the answer and advances", async ({ page }) => {
  await seedMockIdentity(page, "Playwright Trainer");
  await page.goto("/play");

  const choices = page.getByRole("button", { name: /^Choose / });
  await expect(choices).toHaveCount(4);
  const originalEntry = await page.locator(".free-entry-panel blockquote").innerText();

  await choices.first().click();
  await expect(page.locator(".free-answer-reveal")).toBeVisible();
  await expect(page.locator(".free-answer-copy")).toContainText("This Pokédex entry comes from Pokémon");
  await expect(page.locator(".free-choice:disabled")).toHaveCount(4);

  await page.getByRole("button", { name: "Next entry" }).click();
  await expect(page.locator(".free-round-meta")).toContainText("Round 2");
  await expect(page.locator(".free-entry-panel blockquote")).not.toHaveText(originalEntry);
  await expect(page.locator(".free-choice:disabled")).toHaveCount(0);
});

test("home makes the host and join flows visually distinct", async ({ page }) => {
  await seedMockIdentity(page, "Playwright Trainer");
  await page.goto("/");

  const roomSetup = page.getByLabel("Room setup options");
  await expect(roomSetup.getByRole("link", { name: "Host" })).toBeVisible();
  await expect(roomSetup.getByRole("textbox", { name: "Room code" })).toBeVisible();
  await expect(roomSetup.getByRole("button", { name: "Join" })).toBeVisible();
});

test("home fits a phone viewport without overflow", async ({ page }) => {
  await seedMockIdentity(page, "Playwright Trainer");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Read. Guess. Reveal." })).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    viewportHeight: document.documentElement.clientHeight,
    pageHeight: document.documentElement.scrollHeight,
    viewportWidth: document.documentElement.clientWidth,
    pageWidth: document.documentElement.scrollWidth,
  }));

  expect(dimensions.pageHeight).toBeLessThanOrEqual(dimensions.viewportHeight);
  expect(dimensions.pageWidth).toBe(dimensions.viewportWidth);
});

test("home fits a standard desktop viewport without vertical overflow", async ({ page }) => {
  await seedMockIdentity(page, "Playwright Trainer");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await expect(page.getByRole("link", { name: /Free Mode/i })).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    viewportHeight: document.documentElement.clientHeight,
    pageHeight: document.documentElement.scrollHeight,
  }));

  expect(dimensions.pageHeight).toBeLessThanOrEqual(dimensions.viewportHeight);
});

test("host setup offers multiple game sources as checkboxes", async ({ page }) => {
  await seedMockIdentity(page, "Playwright Trainer");
  await page.goto("/host");

  const gameSources = page.getByRole("group", { name: "Source games" });
  await expect(gameSources.getByRole("checkbox")).toHaveCount(11);
  await expect(gameSources.getByRole("checkbox", { name: "Generation I", exact: true })).toBeChecked();
  await expect(gameSources.getByRole("checkbox", { name: "Generation IX", exact: true })).toBeVisible();
  await gameSources.getByRole("checkbox", { name: "Select all generations" }).check();
  await expect(gameSources.getByRole("checkbox", { name: "Generation IX", exact: true })).toBeChecked();
});