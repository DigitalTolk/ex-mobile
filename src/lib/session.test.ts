import { beforeEach, describe, expect, it, vi } from 'vitest';

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
    });
  });

  it('stores and clears server state', async () => {
    const { loadStoredSession, resetSession, storeServerUrl } = await import('./session');
    await storeServerUrl('https://chat.example.com');

    await expect(loadStoredSession()).resolves.toEqual({
      serverUrl: 'https://chat.example.com',
    });

    await resetSession();
    await expect(loadStoredSession()).resolves.toEqual({
      serverUrl: null,
    });
  });
});
