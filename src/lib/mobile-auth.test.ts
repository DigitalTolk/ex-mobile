import { describe, expect, it } from 'vitest';
import { authUrl, tokenFromCallback } from './mobile-auth';

describe('mobile auth', () => {
  it('starts SSO with the ex app callback', () => {
    expect(authUrl('https://chat.example.com')).toBe(
      'https://chat.example.com/auth/oidc/login?redirect_to=ex%3A%2F%2Fapp%2Fauth%2Fcallback',
    );
  });

  it('extracts tokens only from the expected callback route', () => {
    expect(tokenFromCallback('ex://app/auth/callback?token=abc')).toBe('abc');
    expect(tokenFromCallback('ex://app/other?token=abc')).toBeNull();
    expect(tokenFromCallback('https://chat.example.com/auth/callback?token=abc')).toBeNull();
  });
});
