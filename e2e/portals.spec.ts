import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const apiUrl = process.env.E2E_API_URL || 'http://127.0.0.1:8003/api/v1';
const storage = process.env.E2E_STORAGE_PATH;
test.skip(
  !storage,
  'Requires an isolated local API, worker, and E2E_STORAGE_PATH for invitation previews.',
);

async function setup(request: APIRequestContext, stamp: string) {
  const response = await request.post(apiUrl + '/auth/onboard', {
    data: {
      name: 'Portal Owner',
      email: `owner.${stamp}@example.com`,
      password: 'Browser-test-password-2026!',
      school_name: 'Portal School ' + stamp,
      school_email: `school.${stamp}@example.com`,
    },
  });
  expect(response.status()).toBe(201);
  const tokens = await response.json();
  const headers = { Authorization: 'Bearer ' + tokens.access_token };
  const create = async (resource: string, data: object) => {
    const r = await request.post(apiUrl + '/records/' + resource, { headers, data });
    expect(r.status()).toBe(201);
    return r.json();
  };
  const level = await create('class-levels', { name: 'SS1' });
  const a = await create('classes', { name: 'A', level_id: level.id });
  const b = await create('classes', { name: 'B', level_id: level.id });
  const subject = await create('subjects', { name: 'Mathematics', code: 'MTH' });
  const first = await create('students', {
    first_name: 'Ada',
    last_name: 'Okafor',
    class_id: a.id,
  });
  const second = await create('students', {
    first_name: 'Tunde',
    last_name: 'Okafor',
    class_id: b.id,
  });
  return { tokens, headers, create, a, b, subject, first, second };
}

async function adminPage(page: Page, tokens: Record<string, string>, route: string) {
  await page.goto('/login');
  await page.evaluate((t) => {
    sessionStorage.setItem('ile-iwe.access', t.access_token);
    sessionStorage.setItem('ile-iwe.refresh', t.refresh_token);
  }, tokens);
  await page.goto(route);
}

async function invitation(
  request: APIRequestContext,
  headers: Record<string, string>,
  account: Record<string, string>,
) {
  const response = await request.get(apiUrl + '/records/notifications?page_size=100', { headers });
  const job = (await response.json()).items.find((r: Record<string, string>) =>
    r.event_key.startsWith(`invite:${account.id}:`),
  );
  let body = '';
  await expect
    .poll(
      async () => {
        try {
          body = await readFile(
            path.join(storage!, job.school_id, 'outbox', job.id + '.eml'),
            'utf8',
          );
          return true;
        } catch {
          return false;
        }
      },
      { timeout: 20000 },
    )
    .toBe(true);
  return body.match(/Temporary password: ([^\r\n]+)/)![1];
}

async function firstLogin(page: Page, username: string, password: string, role: string) {
  await page.evaluate(() => sessionStorage.clear());
  await page.goto('/login');
  await page.getByLabel('Email address or username', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Choose your own password' })).toBeVisible();
  await page.goto(`/${role}/dashboard`);
  await expect(page.getByRole('heading', { name: 'Choose your own password' })).toBeVisible();
  await page.getByLabel('Current password', { exact: true }).fill(password);
  await page.getByLabel('New password', { exact: true }).fill('Browser-permanent-password-2026!');
  await page
    .getByLabel('Confirm new password', { exact: true })
    .fill('Browser-permanent-password-2026!');
  await page.getByRole('button', { name: 'Change password', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/${role}/dashboard$`));
}

test('admin creates teacher, assigns two classes, and teacher completes first login', async ({
  page,
  request,
}, info) => {
  const stamp = Date.now() + '-' + info.project.name;
  const school = await setup(request, stamp);
  await adminPage(page, school.tokens, '/staff');
  await page.getByRole('button', { name: 'Create staff account', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('First Name', { exact: true }).fill('Ada');
  await dialog.getByLabel('Last Name', { exact: true }).fill('Teacher');
  await dialog.getByLabel('Email', { exact: true }).fill(`teacher.${stamp}@example.com`);
  await dialog.getByLabel('Profile photo', { exact: true }).setInputFiles({
    name: 'staff.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFElEQVR4nGMUSdnCgA0wYRUdtBIA7nABPHABx5QAAAAASUVORK5CYII=',
      'base64',
    ),
  });
  await dialog.getByRole('button', { name: 'Add subject and class' }).click();
  await dialog.getByLabel('Class 1', { exact: true }).selectOption(school.a.id);
  await dialog.getByLabel('Subject 1', { exact: true }).selectOption(school.subject.id);
  await dialog.getByRole('button', { name: 'Add subject and class' }).click();
  await dialog.getByLabel('Class 2', { exact: true }).selectOption(school.b.id);
  await dialog.getByLabel('Subject 2', { exact: true }).selectOption(school.subject.id);
  await dialog.getByLabel('SS1 A', { exact: true }).check();
  await dialog.getByLabel('SS1 B', { exact: true }).check();
  const created = page.waitForResponse(
    (r) => r.url().endsWith('/accounts/staff') && r.request().method() === 'POST',
  );
  await dialog.getByRole('button', { name: 'Create account', exact: true }).click();
  const response = await created;
  expect(response.status()).toBe(201);
  const createdAccount = await response.json();
  const account = createdAccount.user;
  await expect(dialog).not.toBeVisible();
  const photo = await request.get(`${apiUrl}/staff/${createdAccount.staff.id}/photo`, {
    headers: school.headers,
  });
  expect(photo.status()).toBe(200);
  expect(photo.headers()['content-type']).toContain('image/jpeg');
  await firstLogin(
    page,
    account.username,
    await invitation(request, school.headers, account),
    'teacher',
  );
  await page.goto('/teacher/classes');
  await expect(page.getByRole('heading', { name: 'SS1 A', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'SS1 B', exact: true })).toBeVisible();
  await page.goto('/teacher/students');
  await expect(page.getByText('Ada Okafor', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'View profile' }).first().click();
  await expect(page.getByRole('dialog', { name: 'Student profile' })).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.goto('/teacher/attendance');
  await expect(page.getByRole('heading', { name: 'Attendance', exact: true })).toBeVisible();
  await page.screenshot({
    path: `test-results/${info.project.name}-teacher-portal.png`,
    fullPage: true,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('parent switches children and school saves multiple interface colors', async ({
  page,
  request,
}, info) => {
  const stamp = Date.now() + '-' + info.project.name;
  const school = await setup(request, stamp);
  await adminPage(page, school.tokens, '/settings');
  await page.getByLabel('Primary color hex').fill('#123456');
  await page.getByLabel('Secondary color hex').fill('#ba7c19');
  await page.getByLabel('Accent color hex').fill('#7952b3');
  await page.getByRole('button', { name: 'Save school settings' }).click();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.style.getPropertyValue('--accent-primary')),
    )
    .toBe('#7952b3');
  await page.goto('/parents');
  await page.getByRole('button', { name: 'Create parent account', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name', { exact: true }).fill('Ngozi Parent');
  await dialog.getByLabel('Email', { exact: true }).fill(`parent.${stamp}@example.com`);
  await dialog.getByLabel('Child 1', { exact: true }).selectOption(school.first.id);
  await dialog.getByRole('button', { name: 'Link another child' }).click();
  await dialog.getByLabel('Child 2', { exact: true }).selectOption(school.second.id);
  const created = page.waitForResponse(
    (r) => r.url().endsWith('/accounts/parents') && r.request().method() === 'POST',
  );
  await dialog.getByRole('button', { name: 'Create account', exact: true }).click();
  const response = await created;
  expect(response.status()).toBe(201);
  const account = (await response.json()).user;
  await expect(dialog).not.toBeVisible();
  await firstLogin(
    page,
    account.username,
    await invitation(request, school.headers, account),
    'parent',
  );
  await expect(page.getByLabel('Selected child')).toHaveValue(school.first.id);
  await page.getByLabel('Selected child').selectOption(school.second.id);
  await expect(
    page.locator('#main-content').getByText('Tunde Okafor · SS1 B', { exact: true }),
  ).toBeVisible();
  await page.goto('/parent/fees');
  await expect(page.getByRole('heading', { name: 'Fees & balances' })).toBeVisible();
  await page.getByLabel('Selected child').selectOption(school.second.id);
  await expect(
    page.locator('#main-content').getByText('Tunde Okafor · SS1 B', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await page.screenshot({
    path: `test-results/${info.project.name}-parent-portal.png`,
    fullPage: true,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
