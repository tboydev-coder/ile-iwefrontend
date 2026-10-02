import { test, expect } from '@playwright/test';

test('onboard a school and manage a real student from the interface', async ({
  page,
}, testInfo) => {
  const stamp = Date.now() + '-' + testInfo.project.name;
  await page.goto('/onboard', { waitUntil: 'domcontentloaded' });
  await page.getByLabel('School name', { exact: true }).fill('Browser Test Academy ' + stamp);
  await page.getByLabel('School email', { exact: true }).fill(`school.${stamp}@example.com`);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByLabel('Academic session', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByLabel('Your full name', { exact: true }).fill('Browser School Owner');
  await page.getByLabel('Your work email', { exact: true }).fill(`owner.${stamp}@example.com`);
  await page.getByLabel('Create a password', { exact: true }).fill('Browser-test-password-2026');
  await page.getByRole('button', { name: 'Show password' }).click();
  await expect(page.getByLabel('Create a password', { exact: true })).toHaveAttribute(
    'type',
    'text',
  );
  await page.getByRole('button', { name: 'Hide password' }).click();
  await expect(page.getByLabel('Create a password', { exact: true })).toHaveAttribute(
    'type',
    'password',
  );
  const onboarding = page.waitForResponse(
    (response) =>
      response.url().endsWith('/auth/onboard') && response.request().method() === 'POST',
    { timeout: 30_000 },
  );
  await page.getByRole('button', { name: 'Create school workspace' }).click();
  expect((await onboarding).status()).toBe(201);
  await expect(page.getByRole('heading', { name: 'Hello, Browser.' })).toBeVisible();
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-dashboard.png`,
    fullPage: true,
  });
  await page.getByRole('link', { name: 'Add student', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('First Name', { exact: true }).fill('Ada');
  await dialog.getByLabel('Last Name', { exact: true }).fill('Okafor');
  await dialog.getByRole('button', { name: 'Save record' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Open Ada Okafor', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Search Students' }).fill('Ada');
  await expect(page.getByText('IW-', { exact: false }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Open Ada Okafor', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Ada Okafor' })).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-students-dark.png`,
    fullPage: true,
  });
  const width = await page.evaluate(() => ({
    viewport: innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(width.document).toBeLessThanOrEqual(width.viewport);
  if (testInfo.project.name === 'mobile')
    await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('button', { name: /Browser School Owner/ }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
  await page
    .getByLabel('Email address or username', { exact: true })
    .fill(`owner.${stamp}@example.com`);
  await page.getByLabel('Password', { exact: true }).fill('Browser-test-password-2026');
  const login = page.waitForResponse(
    (response) => response.url().endsWith('/auth/login') && response.request().method() === 'POST',
    { timeout: 30_000 },
  );
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  expect((await login).status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Hello, Browser.' })).toBeVisible();
});

test('login validation gives useful feedback', async ({ page }) => {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText('Enter your email address or username.')).toBeVisible();
  await expect(page.getByText('Enter your password.')).toBeVisible();
  await page.getByLabel('Password', { exact: true }).fill('Private-password-2026!');
  await page.getByRole('button', { name: 'Show password' }).click();
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Hide password' }).click();
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'password');
  await page.screenshot({
    path: `test-results/login-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test('reset links and route changes present the correct form state', async ({ page }) => {
  await page.goto('/reset-password', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('alert')).toContainText('This reset link is incomplete.');
  await expect(page.getByRole('button', { name: 'Update password' })).toBeDisabled();
  await page.getByRole('link', { name: 'Request a new reset link' }).click();
  await expect(page.getByLabel('Email address')).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Send reset link' })).toBeEnabled();
  await page.goto('/reset-password?token=browser-test-token');
  await page.getByLabel('New password').fill('Private-password-2026!');
  await page.getByRole('button', { name: 'Show password' }).click();
  await expect(page.getByLabel('New password')).toHaveAttribute('type', 'text');
  await page.getByRole('link', { name: 'Set up your school' }).click();
  await expect(page.getByLabel('School name', { exact: true })).toHaveValue('');
});
