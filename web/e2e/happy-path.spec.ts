import { test, expect } from "@playwright/test";

test.describe("Gospel RAG happy path", () => {
  test("full chat flow: question → streaming → citation → reload", async ({ page }) => {
    // 1. Visit root — should redirect to /new → /c/{id}
    await page.goto("/");
    await page.waitForURL(/\/c\/[0-9a-f-]{36}/, { timeout: 15_000 });

    const convId = page.url().split("/c/")[1];
    expect(convId).toMatch(/^[0-9a-f-]{36}$/);

    // 2. Type and submit a question
    const textarea = page.getByPlaceholder(/Ask a question/i);
    await textarea.fill("Who carried Jesus's cross?");
    await textarea.press("Enter");

    // 3. Wait for streaming to complete (indicator disappears)
    // The streaming indicator is a blinking cursor that only shows while streaming
    await expect(page.locator('[aria-label="Generating response"]')).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.locator('[aria-label="Generating response"]')).not.toBeVisible({
      timeout: 60_000,
    });

    // 4. Assert at least one citation chip is visible
    const citationChips = page.locator("button").filter({ hasText: /[A-Z]{3}\s+\d+:\d+/ });
    await expect(citationChips.first()).toBeVisible({ timeout: 5_000 });

    // 5. Click the first citation chip → side panel should open
    await citationChips.first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 3_000 });

    // Side panel should show a book name
    const panelText = await page.getByRole("dialog").textContent();
    expect(panelText).toMatch(/Matthew|Mark|Luke|John/);

    // 6. Close the panel
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 2_000 });

    // 7. Reload — conversation should still exist in sidebar
    await page.reload();
    await page.waitForURL(/\/c\/[0-9a-f-]{36}/);

    // Sidebar should list the conversation (auto-titled or "New chat")
    const sidebarItem = page.locator("aside").locator("text=/Who|Jesus|cross|New chat/i").first();
    await expect(sidebarItem).toBeVisible({ timeout: 5_000 });
  });

  test("/compare slash command renders side-by-side panel", async ({ page }) => {
    await page.goto("/new");
    await page.waitForURL(/\/c\//);

    const textarea = page.getByPlaceholder(/Ask a question/i);
    await textarea.fill("/compare MAT 5:3-12 KJV WEB");
    await textarea.press("Enter");

    // Wait for the compare panel to appear
    await expect(page.locator("text=Side-by-side comparison")).toBeVisible({ timeout: 30_000 });
    // Both translations should be visible
    await expect(page.locator("text=KJV")).toBeVisible();
    await expect(page.locator("text=WEB")).toBeVisible();
  });
});
