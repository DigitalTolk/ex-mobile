import { App, type URLOpenListenerEvent } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import type { User } from '../types';
import { apiFetch } from './api';
import { apiUrl, authCallbackUrl } from './url';

export interface MobileAuthResult {
  token: string;
  user: User;
}

export function authUrl(serverUrl: string): string {
  const login = new URL(apiUrl(serverUrl, '/auth/oidc/login'));
  login.searchParams.set('redirect_to', authCallbackUrl());
  return login.toString();
}

export async function beginSSO(serverUrl: string): Promise<void> {
  await Browser.open({ url: authUrl(serverUrl), presentationStyle: 'fullscreen' });
}

export function tokenFromCallback(url: string): string | null {
  const parsed = new URL(url);
  if (parsed.protocol !== 'ex:' || parsed.host !== 'app' || parsed.pathname !== '/auth/callback') {
    return null;
  }
  return parsed.searchParams.get('token');
}

export async function completeMobileAuth(serverUrl: string, token: string): Promise<MobileAuthResult> {
  const user = await apiFetch<User>(serverUrl, token, '/api/v1/users/me');
  return { token, user };
}

export function listenForAuthCallback(
  onToken: (token: string) => void,
): Promise<{ remove: () => Promise<void> }> {
  return App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
    const token = tokenFromCallback(event.url);
    if (token) {
      void Browser.close();
      onToken(token);
    }
  });
}
