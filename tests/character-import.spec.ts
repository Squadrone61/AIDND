import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const WORKER_URL = "http://localhost:8787";

/** Load a parsed character fixture from .testing/ */
function loadFixture(name: string) {
  const filePath = path.resolve(__dirname, "..", ".testing", name);
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

test.describe("Character Import", () => {
  test("JSON paste: invalid JSON shows error in UI", async ({ page }) => {
    await page.goto("/characters/create");
    await expect(page.getByText("Import Character")).toBeVisible({
      timeout: 10_000,
    });

    // Expand JSON mode
    await page.getByText("Or paste character JSON...").click();

    // Paste invalid JSON
    await page
      .getByPlaceholder("Paste D&D Beyond character JSON here...")
      .fill("{ not valid json");
    await page.getByRole("button", { name: "Parse JSON" }).click();

    // Should show an error
    await expect(page.getByText("Invalid JSON")).toBeVisible({
      timeout: 5_000,
    });
  });

  test("JSON paste: successful import redirects to character page", async ({
    page,
  }) => {
    const fixture = loadFixture("kael_sunforge_import.json");

    // Mock the API endpoint to return our fixture directly
    await page.route(`${WORKER_URL}/api/character/import`, (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(fixture),
      });
    });

    await page.goto("/characters/create");
    await expect(page.getByText("Import Character")).toBeVisible({
      timeout: 10_000,
    });

    // Expand JSON mode and paste something (content doesn't matter — API is mocked)
    await page.getByText("Or paste character JSON...").click();
    await page
      .getByPlaceholder("Paste D&D Beyond character JSON here...")
      .fill('{"data":{}}');
    await page.getByRole("button", { name: "Parse JSON" }).click();

    // Should redirect to character detail page
    await expect(page).toHaveURL(/\/characters\/[a-z0-9-]+/, {
      timeout: 10_000,
    });

    // Character name should appear on the detail page
    await expect(
      page.getByText("Sir Aldric Brightshield")
    ).toBeVisible({ timeout: 5_000 });
  });

  test("imported character persists in character library", async ({
    page,
  }) => {
    const fixture = loadFixture("kael_sunforge_import.json");

    await page.route(`${WORKER_URL}/api/character/import`, (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(fixture),
      });
    });

    await page.goto("/characters/create");
    await expect(page.getByText("Import Character")).toBeVisible({
      timeout: 10_000,
    });

    // Import via JSON paste
    await page.getByText("Or paste character JSON...").click();
    await page
      .getByPlaceholder("Paste D&D Beyond character JSON here...")
      .fill('{"data":{}}');
    await page.getByRole("button", { name: "Parse JSON" }).click();

    // Wait for redirect to character detail page
    await expect(page).toHaveURL(/\/characters\/[a-z0-9-]+/, {
      timeout: 10_000,
    });

    // Verify character is in localStorage library (may need a tick to flush)
    await page.waitForFunction(
      () => {
        const raw = localStorage.getItem("character_library");
        if (!raw) return false;
        const lib = JSON.parse(raw);
        return lib.length > 0;
      },
      null,
      { timeout: 5_000 }
    );
    const stored = await page.evaluate(() =>
      localStorage.getItem("character_library")
    );
    const library = JSON.parse(stored!);
    expect(library[0].character.static.name).toBe(
      "Sir Aldric Brightshield"
    );
  });

  test("API endpoint: JSON mode returns parsed character", async ({
    page,
  }) => {
    // Test the endpoint directly via API call
    const res = await page.request.post(`${WORKER_URL}/api/character/import`, {
      data: { mode: "json", json: { notValidDDB: true } },
    });

    // Should get a 422 PARSE_ERROR (not 404 — the endpoint exists)
    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(body.code).toBe("PARSE_ERROR");
  });

  test("API endpoint: missing JSON returns 400", async ({ page }) => {
    const res = await page.request.post(`${WORKER_URL}/api/character/import`, {
      data: { mode: "json" },
    });

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("MISSING_JSON");
  });

  test("API endpoint: invalid mode returns 400", async ({ page }) => {
    const res = await page.request.post(`${WORKER_URL}/api/character/import`, {
      data: { mode: "invalid" },
    });

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("INVALID_MODE");
  });
});
