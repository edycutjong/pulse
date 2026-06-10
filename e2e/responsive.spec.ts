import { test, expect } from '@playwright/test';

test('layout is responsive', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/');
  
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  // Checking basic load on different viewports
});
