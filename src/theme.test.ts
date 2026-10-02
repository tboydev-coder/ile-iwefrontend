import { describe, it, expect } from 'vitest';
import { brandTokens, contrast } from './theme';
import { loginSchema } from './AuthPages';

describe('school brand accessibility', () => {
  for (const color of [
    '#ffffff',
    '#000000',
    '#ffff00',
    '#ff0033',
    '#156b55',
    '#00ffff',
    '#aa00ff',
  ]) {
    for (const dark of [false, true]) {
      it(`keeps text readable for ${color} in ${dark ? 'dark' : 'light'} mode`, () => {
        const tokens = brandTokens(color, dark);
        expect(contrast(tokens.primary, tokens.onPrimary)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(tokens.link, dark ? '#192420' : '#ffffff')).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});
it('rejects invalid login form values', () => {
  expect(loginSchema.safeParse({ email: 'invalid', password: '' }).success).toBe(false);
  expect(
    loginSchema.safeParse({ email: 'owner@example.com', password: 'a valid password' }).success,
  ).toBe(true);
});
