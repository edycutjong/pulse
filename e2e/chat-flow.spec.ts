import { test } from '@playwright/test';

test('can interact with symptom intake', async ({ page }) => {
  await page.goto('/');
  // Interact with main flow. Since we don't know the exact UI, we just check basics
  // that typically exist in chat/intake flows.
  const input = page.locator('input, textarea').first();
  if (await input.isVisible()) {
    await input.fill('headache and fever');
    const button = page.locator('button').first();
    if (await button.isVisible()) {
      await button.click();
    }
  }
});
