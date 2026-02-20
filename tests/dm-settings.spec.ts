import { test, expect } from "@playwright/test";

/**
 * Helper: create a room via API and register an init script that sets
 * localStorage BEFORE the React app hydrates.
 */
async function createRoomAndSetup(
  page: import("@playwright/test").Page,
  playerName: string
): Promise<string> {
  const res = await page.request.post("http://localhost:8787/api/rooms/create");
  const { roomCode } = await res.json();

  await page.addInitScript(
    (name) => {
      localStorage.setItem("playerName", name);
    },
    playerName
  );

  return roomCode;
}

/** Wait for room to fully load (room code visible in sidebar). */
async function waitForRoom(
  page: import("@playwright/test").Page,
  roomCode: string
) {
  await expect(page.getByText(roomCode).first()).toBeVisible({
    timeout: 15_000,
  });
}

test.describe("DM Settings", () => {
  test("host sees DM Settings section in sidebar", async ({ page }) => {
    const roomCode = await createRoomAndSetup(page, "HostDM");
    await page.goto(`/rooms/${roomCode}`);
    await waitForRoom(page, roomCode);

    await expect(page.getByText("DM Settings")).toBeVisible();
  });

  test("non-host player does not see DM Settings", async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const host = await ctx1.newPage();
    const player = await ctx2.newPage();

    const res = await host.request.post(
      "http://localhost:8787/api/rooms/create"
    );
    const { roomCode } = await res.json();

    await host.addInitScript(() => {
      localStorage.setItem("playerName", "TheHost");
    });
    await player.addInitScript(() => {
      localStorage.setItem("playerName", "ThePlayer");
    });

    // Host joins first
    await host.goto(`http://localhost:3000/rooms/${roomCode}`);
    await waitForRoom(host, roomCode);
    await expect(host.getByText("DM Settings")).toBeVisible();

    // Player joins
    await player.goto(`http://localhost:3000/rooms/${roomCode}`);
    await waitForRoom(player, roomCode);

    // Player should NOT see DM Settings
    await expect(player.getByText("DM Settings")).not.toBeVisible();

    await ctx1.close();
    await ctx2.close();
  });

  test("pacing dropdown defaults to Balanced and can be changed", async ({
    page,
  }) => {
    const roomCode = await createRoomAndSetup(page, "PaceHost");
    await page.goto(`/rooms/${roomCode}`);
    await waitForRoom(page, roomCode);

    // DM Settings should be expanded by default
    const pacingSelect = page.locator("select").filter({ has: page.locator('option[value="story-heavy"]') });
    await expect(pacingSelect).toBeVisible();
    await expect(pacingSelect).toHaveValue("balanced");

    // Change pacing to story-heavy
    await pacingSelect.selectOption("story-heavy");

    // Activity log should show the pacing change
    await expect(
      page.getByText("Pacing set to story-heavy", { exact: false })
    ).toBeVisible({ timeout: 5_000 });
  });

  test("encounter length dropdown defaults to Standard and can be changed", async ({
    page,
  }) => {
    const roomCode = await createRoomAndSetup(page, "LengthHost");
    await page.goto(`/rooms/${roomCode}`);
    await waitForRoom(page, roomCode);

    const lengthSelect = page.locator("select").filter({ has: page.locator('option[value="epic"]') });
    await expect(lengthSelect).toBeVisible();
    await expect(lengthSelect).toHaveValue("standard");

    // Change to epic
    await lengthSelect.selectOption("epic");

    // Activity log should show the change
    await expect(
      page.getByText("encounter length: epic", { exact: false })
    ).toBeVisible({ timeout: 5_000 });
  });

  test("system prompt shows Default badge initially", async ({ page }) => {
    const roomCode = await createRoomAndSetup(page, "BadgeHost");
    await page.goto(`/rooms/${roomCode}`);
    await waitForRoom(page, roomCode);

    // Should show "Default" badge
    await expect(
      page.getByText("Default", { exact: true })
    ).toBeVisible();

    // Edit button should be present
    await expect(page.getByText("Edit", { exact: true })).toBeVisible();

    // Reset button should NOT be visible when default
    await expect(page.getByText("Reset", { exact: true })).not.toBeVisible();
  });

  test("can open and close system prompt modal", async ({ page }) => {
    const roomCode = await createRoomAndSetup(page, "ModalHost");
    await page.goto(`/rooms/${roomCode}`);
    await waitForRoom(page, roomCode);

    // Click Edit to open modal
    await page.getByText("Edit", { exact: true }).click();

    // Modal should be visible
    await expect(
      page.getByRole("heading", { name: "DM System Prompt" })
    ).toBeVisible();

    // Textarea should contain the default prompt text
    const textarea = page.locator("textarea");
    await expect(textarea).toBeVisible();
    const value = await textarea.inputValue();
    expect(value).toContain("You are an experienced and creative Dungeon Master");

    // Character count should be visible (e.g. "1,827 characters")
    await expect(page.getByText(/^\d[\d,]+ characters$/)).toBeVisible();

    // Cancel closes without saving
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(
      page.getByRole("heading", { name: "DM System Prompt" })
    ).not.toBeVisible();
  });

  test("can save a custom system prompt", async ({ page }) => {
    const roomCode = await createRoomAndSetup(page, "CustomHost");
    await page.goto(`/rooms/${roomCode}`);
    await waitForRoom(page, roomCode);

    // Open modal
    await page.getByText("Edit", { exact: true }).click();
    await expect(page.locator("textarea")).toBeVisible();

    // Clear and type custom prompt
    await page.locator("textarea").fill("You are a pirate DM. Arr!");

    // Save
    await page.getByRole("button", { name: "Save" }).click();

    // Modal should close
    await expect(
      page.getByRole("heading", { name: "DM System Prompt" })
    ).not.toBeVisible();

    // Badge should now show "Custom"
    await expect(page.getByText("Custom", { exact: true })).toBeVisible();

    // Activity log should show update
    await expect(
      page.getByText("System prompt updated.", { exact: false })
    ).toBeVisible({ timeout: 5_000 });

    // Reset button should now be visible
    await expect(page.getByText("Reset", { exact: true })).toBeVisible();
  });

  test("can reset custom system prompt to default", async ({ page }) => {
    const roomCode = await createRoomAndSetup(page, "ResetHost");
    await page.goto(`/rooms/${roomCode}`);
    await waitForRoom(page, roomCode);

    // First set a custom prompt
    await page.getByText("Edit", { exact: true }).click();
    await page.locator("textarea").fill("Custom DM prompt");
    await page.getByRole("button", { name: "Save" }).click();

    // Verify it's custom
    await expect(page.getByText("Custom", { exact: true })).toBeVisible();

    // Click Reset
    await page.getByText("Reset", { exact: true }).click();

    // Badge should revert to Default
    await expect(page.getByText("Default", { exact: true })).toBeVisible({
      timeout: 5_000,
    });

    // Activity log should show reset message
    await expect(
      page.getByText("System prompt reset to default.", { exact: false })
    ).toBeVisible({ timeout: 5_000 });
  });

  test("Escape key closes the system prompt modal", async ({ page }) => {
    const roomCode = await createRoomAndSetup(page, "EscHost");
    await page.goto(`/rooms/${roomCode}`);
    await waitForRoom(page, roomCode);

    // Open modal
    await page.getByText("Edit", { exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "DM System Prompt" })
    ).toBeVisible();

    // Press Escape
    await page.keyboard.press("Escape");

    // Modal should close
    await expect(
      page.getByRole("heading", { name: "DM System Prompt" })
    ).not.toBeVisible();
  });

  test("DM Settings section is collapsible", async ({ page }) => {
    const roomCode = await createRoomAndSetup(page, "CollapseHost");
    await page.goto(`/rooms/${roomCode}`);
    await waitForRoom(page, roomCode);

    // Pacing select should be visible initially
    const pacingSelect = page.locator("select").filter({ has: page.locator('option[value="story-heavy"]') });
    await expect(pacingSelect).toBeVisible();

    // Click DM Settings header to collapse
    await page.getByText("DM Settings").click();

    // Pacing select should now be hidden
    await expect(pacingSelect).not.toBeVisible();

    // Click again to expand
    await page.getByText("DM Settings").click();
    await expect(pacingSelect).toBeVisible();
  });

  test("settings persist on reconnect via game_state_sync", async ({
    page,
  }) => {
    const roomCode = await createRoomAndSetup(page, "PersistHost");
    await page.goto(`/rooms/${roomCode}`);
    await waitForRoom(page, roomCode);

    // Change pacing to combat-heavy
    const pacingSelect = page.locator("select").filter({ has: page.locator('option[value="story-heavy"]') });
    await pacingSelect.selectOption("combat-heavy");
    await expect(
      page.getByText("Pacing set to combat-heavy", { exact: false })
    ).toBeVisible({ timeout: 5_000 });

    // Change encounter length to quick
    const lengthSelect = page.locator("select").filter({ has: page.locator('option[value="epic"]') });
    await lengthSelect.selectOption("quick");
    await expect(
      page.getByText("encounter length: quick", { exact: false })
    ).toBeVisible({ timeout: 5_000 });

    // Set a custom prompt
    await page.getByText("Edit", { exact: true }).click();
    await page.locator("textarea").fill("You are a dark and brooding DM.");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Custom", { exact: true })).toBeVisible();

    // Reload page to simulate reconnect
    await page.reload();
    await waitForRoom(page, roomCode);

    // Verify pacing and encounter length are restored
    const pacingAfter = page.locator("select").filter({ has: page.locator('option[value="story-heavy"]') });
    await expect(pacingAfter).toHaveValue("combat-heavy", { timeout: 5_000 });

    const lengthAfter = page.locator("select").filter({ has: page.locator('option[value="epic"]') });
    await expect(lengthAfter).toHaveValue("quick");

    // Custom prompt badge should persist
    await expect(page.getByText("Custom", { exact: true })).toBeVisible();
  });

  test("modal Reset to Default button restores text in textarea", async ({
    page,
  }) => {
    const roomCode = await createRoomAndSetup(page, "ModalResetHost");
    await page.goto(`/rooms/${roomCode}`);
    await waitForRoom(page, roomCode);

    // Open modal and type custom text
    await page.getByText("Edit", { exact: true }).click();
    await page.locator("textarea").fill("Custom text here");

    // Click Reset to Default within the modal
    await page.getByRole("button", { name: "Reset to Default" }).click();

    // Textarea should now contain default prompt
    const value = await page.locator("textarea").inputValue();
    expect(value).toContain("You are an experienced and creative Dungeon Master");
  });
});
