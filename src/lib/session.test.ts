import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../types';

const store = new Map<string, string>();

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn(async ({ key }: { key: string }) => ({ value: store.get(key) ?? null })),
    set: vi.fn(async ({ key, value }: { key: string; value: string }) => {
      store.set(key, value);
    }),
    remove: vi.fn(async ({ key }: { key: string }) => {
      store.delete(key);
    }),
  },
}));

describe('session storage', () => {
  beforeEach(() => {
    store.clear();
  });

  it('loads an empty session', async () => {
    const { loadStoredSession } = await import('./session');

    await expect(loadStoredSession()).resolves.toEqual({
      serverUrl: null,
      accessToken: null,
      user: null,
    });
  });

  it('stores and clears server/auth state', async () => {
    const { clearAuth, loadStoredSession, resetSession, storeAuth, storeServerUrl } = await import('./session');
    const user: User = {
      id: 'u-1',
      email: 'me@example.com',
      displayName: 'Me',
    };

    await storeServerUrl('https://chat.example.com');
    await storeAuth('token-1', user);

    await expect(loadStoredSession()).resolves.toEqual({
      serverUrl: 'https://chat.example.com',
      accessToken: 'token-1',
      user,
    });

    await clearAuth();
    await expect(loadStoredSession()).resolves.toMatchObject({
      serverUrl: 'https://chat.example.com',
      accessToken: null,
      user: null,
    });

    await storeAuth('token-2', user);
    await resetSession();
    await expect(loadStoredSession()).resolves.toEqual({
      serverUrl: null,
      accessToken: null,
      user: null,
    });
  });
});
