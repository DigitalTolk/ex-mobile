import { describe, expect, it } from 'vitest';
import { apiUrl, authCallbackUrl, isSameServerUrl, normalizeServerUrl } from './url';

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
    expect(authCallbackUrl()).toBe('ex://mobile/auth/callback');
  });

  it('matches URLs that belong to the configured server', () => {
    expect(isSameServerUrl('https://chat.example.com', 'https://chat.example.com/channels/general')).toBe(true);
    expect(isSameServerUrl('https://chat.example.com', 'https://CHAT.example.com:443/threads/1')).toBe(true);
    expect(isSameServerUrl('http://localhost:8080', 'http://localhost:8080/channels/general')).toBe(true);
    expect(isSameServerUrl('http://chat.example.com', 'http://chat.example.com/channels/general')).toBe(true);
  });

  it('rejects URLs outside the configured server', () => {
    expect(isSameServerUrl('https://chat.example.com', 'https://evil.example.com/channels/general')).toBe(false);
    expect(isSameServerUrl('https://chat.example.com', 'http://chat.example.com/channels/general')).toBe(false);
    expect(isSameServerUrl('https://chat.example.com', 'https://chat.example.com:8443/channels/general')).toBe(false);
  });

  it('does not invent default ports for custom URL schemes', () => {
    expect(isSameServerUrl('custom://chat.example.com', 'custom://chat.example.com/channels/general')).toBe(true);
  });
});
