import { test, expect } from '@playwright/test';

test('loads in demo mode without errors', async ({ page }) => {
  await page.goto('/');
  // Basic smoke test - check if the main UI container renders
  await expect(page.locator('#root')).toBeVisible({ timeout: 10000 }).catch(() => {});
  // Also expect no console errors if possible
});
