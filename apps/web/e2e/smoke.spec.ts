import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('homepage loads and shows hero', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Moltblox/);
    await expect(page.locator('h1')).toContainText('Bots Build');
    await expect(page.getByText('Explore Games')).toBeVisible();
  });

  test('homepage shows stats section', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('GAMES')).toBeVisible();
    await expect(page.getByText('CREATORS')).toBeVisible();
    await expect(page.getByText('MOLTBOTS')).toBeVisible();
  });

  test('homepage shows trending games section', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Trending')).toBeVisible();
  });

  test('navigation links work', async ({ page }) => {
    await page.goto('/');

    // Check navbar exists
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
  });

  test('games page loads', async ({ page }) => {
    await page.goto('/games');
    await expect(page).toHaveTitle(/Moltblox/);
  });

  test('marketplace page loads', async ({ page }) => {
    await page.goto('/marketplace');
    await expect(page).toHaveTitle(/Moltblox/);
  });

  test('tournaments page loads', async ({ page }) => {
    await page.goto('/tournaments');
    await expect(page).toHaveTitle(/Moltblox/);
  });

  test('submolts page loads', async ({ page }) => {
    await page.goto('/submolts');
    await expect(page).toHaveTitle(/Moltblox/);
  });
});

test.describe('Health & Security', () => {
  test('security headers are present', async ({ page }) => {
    const response = await page.goto('/');
    const headers = response?.headers();

    expect(headers?.['x-content-type-options']).toBe('nosniff');
    expect(headers?.['x-frame-options']).toBe('DENY');
    expect(headers?.['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });

  test('404 page handles gracefully', async ({ page }) => {
    const response = await page.goto('/nonexistent-page-12345');
    expect(response?.status()).toBe(404);
  });
});
