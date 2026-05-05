import { Preferences } from '@capacitor/preferences';
import type { User } from '../types';

const SERVER_URL_KEY = 'server-url';
const ACCESS_TOKEN_KEY = 'access-token';
const USER_KEY = 'user';

export interface StoredSession {
  serverUrl: string | null;
  accessToken: string | null;
  user: User | null;
}

export async function loadStoredSession(): Promise<StoredSession> {
  const [server, token, user] = await Promise.all([
    Preferences.get({ key: SERVER_URL_KEY }),
    Preferences.get({ key: ACCESS_TOKEN_KEY }),
    Preferences.get({ key: USER_KEY }),
  ]);

  return {
    serverUrl: server.value,
    accessToken: token.value,
    user: user.value ? (JSON.parse(user.value) as User) : null,
  };
}

export async function storeServerUrl(serverUrl: string): Promise<void> {
  await Preferences.set({ key: SERVER_URL_KEY, value: serverUrl });
}

export async function storeAuth(accessToken: string, user: User): Promise<void> {
  await Promise.all([
    Preferences.set({ key: ACCESS_TOKEN_KEY, value: accessToken }),
    Preferences.set({ key: USER_KEY, value: JSON.stringify(user) }),
  ]);
}

export async function clearAuth(): Promise<void> {
  await Promise.all([
    Preferences.remove({ key: ACCESS_TOKEN_KEY }),
    Preferences.remove({ key: USER_KEY }),
  ]);
}

export async function resetSession(): Promise<void> {
  await Promise.all([
    Preferences.remove({ key: SERVER_URL_KEY }),
    Preferences.remove({ key: ACCESS_TOKEN_KEY }),
    Preferences.remove({ key: USER_KEY }),
  ]);
}
