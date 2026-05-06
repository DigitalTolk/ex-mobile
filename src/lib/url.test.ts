import { describe, expect, it } from 'vitest';
import { apiUrl, authCallbackUrl, normalizeServerUrl } from './url';

describe('url helpers', () => {
  it('normalizes server URLs', () => {
    expect(normalizeServerUrl('chat.example.com/')).toBe('https://chat.example.com');
    expect(normalizeServerUrl('http://localhost:8080///')).toBe('http://localhost:8080');
    expect(normalizeServerUrl('https://chat.example.com/team?x=1#top')).toBe('https://chat.example.com/team');
  });

  it('builds absolute API URLs', () => {
    expect(apiUrl('https://chat.example.com/', '/api/v1/channels')).toBe(
      'https://chat.example.com/api/v1/channels',
    );
    expect(apiUrl('https://chat.example.com', 'api/v1/channels')).toBe(
      'https://chat.example.com/api/v1/channels',
    );
  });

  it('uses the allowlisted mobile callback URL', () => {
    expect(authCallbackUrl()).toBe('ex://app/auth/callback');
  });
});
