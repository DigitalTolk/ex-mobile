import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../types';
import { apiFetch } from './api';
import { authUrl, beginSSO, completeMobileAuth, launchAuthToken, listenForAuthCallback, tokenFromCallback } from './mobile-auth';

const mocks = vi.hoisted(() => ({
  browserOpen: vi.fn(),
  browserClose: vi.fn(),
  addListener: vi.fn(),
  getLaunchUrl: vi.fn(),
}));

vi.mock('@capacitor/browser', () => ({
  Browser: {
    open: mocks.browserOpen,
    close: mocks.browserClose,
  },
}));

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: mocks.addListener,
    getLaunchUrl: mocks.getLaunchUrl,
  },
}));

vi.mock('./api', () => ({
  apiFetch: vi.fn(),
}));

describe('mobile auth', () => {
  beforeEach(() => {
    mocks.browserOpen.mockReset();
    mocks.browserClose.mockReset();
    mocks.addListener.mockReset();
    mocks.getLaunchUrl.mockReset();
    vi.mocked(apiFetch).mockReset();
  });

  it('starts SSO with the ex app callback', () => {
    expect(authUrl('https://chat.example.com')).toBe(
      'https://chat.example.com/auth/oidc/login?redirect_to=ex%3A%2F%2Fapp%2Fauth%2Fcallback',
    );
  });

  it('opens SSO in the system browser', async () => {
    mocks.browserOpen.mockResolvedValue(undefined);

    await beginSSO('https://chat.example.com');

    expect(mocks.browserOpen).toHaveBeenCalledWith({
      url: 'https://chat.example.com/auth/oidc/login?redirect_to=ex%3A%2F%2Fapp%2Fauth%2Fcallback',
      presentationStyle: 'fullscreen',
    });
  });

  it('extracts tokens only from the expected callback route', () => {
    expect(tokenFromCallback('ex://app/auth/callback?token=abc')).toBe('abc');
    expect(tokenFromCallback('ex://app/other?token=abc')).toBeNull();
    expect(tokenFromCallback('https://chat.example.com/auth/callback?token=abc')).toBeNull();
  });

  it('completes auth by loading the current user', async () => {
    const user: User = { id: 'u-1', email: 'me@example.com', displayName: 'Me' };
    vi.mocked(apiFetch).mockResolvedValue(user);

    await expect(completeMobileAuth('https://chat.example.com', 'token-1')).resolves.toEqual({
      token: 'token-1',
      user,
    });
    expect(apiFetch).toHaveBeenCalledWith('https://chat.example.com', 'token-1', '/api/v1/users/me');
  });

  it('listens for auth callbacks and ignores unrelated app URLs', async () => {
    const remove = vi.fn();
    let handler!: (event: { url: string }) => void;
    mocks.addListener.mockImplementation(async (_event, nextHandler) => {
      handler = nextHandler;
      return { remove };
    });
    const onToken = vi.fn();

    await expect(listenForAuthCallback(onToken)).resolves.toEqual({ remove });
    handler({ url: 'https://example.com/nope?token=bad' });
    expect(onToken).not.toHaveBeenCalled();

    handler({ url: 'ex://app/auth/callback?token=good' });
    expect(mocks.browserClose).toHaveBeenCalledTimes(1);
    expect(onToken).toHaveBeenCalledWith('good');
  });

  it('extracts an auth token from a cold launch URL', async () => {
    mocks.getLaunchUrl.mockResolvedValue({ url: 'ex://app/auth/callback?token=launch-token' });

    await expect(launchAuthToken()).resolves.toBe('launch-token');
    expect(mocks.browserClose).toHaveBeenCalledTimes(1);
  });

  it('ignores unrelated cold launch URLs', async () => {
    mocks.getLaunchUrl.mockResolvedValue({ url: 'https://example.com/nope?token=bad' });

    await expect(launchAuthToken()).resolves.toBeNull();
    expect(mocks.browserClose).not.toHaveBeenCalled();
  });
});
