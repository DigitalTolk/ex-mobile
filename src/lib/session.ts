import { Preferences } from '@capacitor/preferences';

const SERVER_URL_KEY = 'server-url';

export interface StoredSession {
  serverUrl: string | null;
}

export async function loadStoredSession(): Promise<StoredSession> {
  const server = await Preferences.get({ key: SERVER_URL_KEY });
  return {
    serverUrl: server.value,
  };
}

export async function storeServerUrl(serverUrl: string): Promise<void> {
  await Preferences.set({ key: SERVER_URL_KEY, value: serverUrl });
}

export async function resetSession(): Promise<void> {
  await Preferences.remove({ key: SERVER_URL_KEY });
}
