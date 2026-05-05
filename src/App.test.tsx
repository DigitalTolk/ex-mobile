import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from './types';
import App from './App';
import { beginSSO, completeMobileAuth, listenForAuthCallback } from './lib/mobile-auth';
import { clearAuth, loadStoredSession, resetSession, storeAuth, storeServerUrl } from './lib/session';
import { SplashScreen } from '@capacitor/splash-screen';

const user: User = {
  id: 'u-1',
  email: 'me@example.com',
  displayName: 'Me',
};

vi.mock('@capacitor/splash-screen', () => ({
  SplashScreen: {
    hide: vi.fn(),
  },
}));

vi.mock('./lib/session', () => ({
  loadStoredSession: vi.fn(),
  storeServerUrl: vi.fn(),
  storeAuth: vi.fn(),
  clearAuth: vi.fn(),
  resetSession: vi.fn(),
}));

vi.mock('./lib/mobile-auth', () => ({
  beginSSO: vi.fn(),
  completeMobileAuth: vi.fn(),
  listenForAuthCallback: vi.fn(),
}));

vi.mock('./components/SetupScreen', () => ({
  SetupScreen: ({ initialUrl, onSave }: { initialUrl?: string; onSave: (url: string) => Promise<void> }) => (
    <section>
      <h1>Setup {initialUrl}</h1>
      <button type="button" onClick={() => void onSave('https://chat.example.com')}>
        Save server
      </button>
    </section>
  ),
}));

vi.mock('./components/LoginScreen', () => ({
  LoginScreen: ({
    serverUrl,
    busy,
    error,
    onLogin,
    onChangeServer,
  }: {
    serverUrl: string;
    busy: boolean;
    error: string | null;
    onLogin: () => void;
    onChangeServer: () => void;
  }) => (
    <section>
      <h1>Login {serverUrl}</h1>
      <span>busy:{String(busy)}</span>
      {error && <p>{error}</p>}
      <button type="button" onClick={onLogin}>
        Login now
      </button>
      <button type="button" onClick={onChangeServer}>
        Change server
      </button>
    </section>
  ),
}));

vi.mock('./components/ChatShell', () => ({
  ChatShell: ({
    serverUrl,
    accessToken,
    user,
    onLogout,
    onChangeServer,
  }: {
    serverUrl: string;
    accessToken: string;
    user: User;
    onLogout: () => void;
    onChangeServer: () => void;
  }) => (
    <section>
      <h1>
        Chat {serverUrl} {accessToken} {user.displayName}
      </h1>
      <button type="button" onClick={onLogout}>
        Logout now
      </button>
      <button type="button" onClick={onChangeServer}>
        Change chat server
      </button>
    </section>
  ),
}));

describe('App', () => {
  let authCallback: ((token: string) => void) | null;
  const removeListener = vi.fn();

  beforeEach(() => {
    authCallback = null;
    vi.mocked(loadStoredSession).mockReset();
    vi.mocked(storeServerUrl).mockReset().mockResolvedValue(undefined);
    vi.mocked(storeAuth).mockReset().mockResolvedValue(undefined);
    vi.mocked(clearAuth).mockReset().mockResolvedValue(undefined);
    vi.mocked(resetSession).mockReset().mockResolvedValue(undefined);
    vi.mocked(beginSSO).mockReset();
    vi.mocked(completeMobileAuth).mockReset();
    vi.mocked(listenForAuthCallback).mockReset().mockImplementation(async (handler) => {
      authCallback = handler;
      return { remove: removeListener };
    });
    vi.mocked(SplashScreen.hide).mockReset();
    removeListener.mockReset();
  });

  it('loads empty state, saves a server, and opens SSO', async () => {
    vi.mocked(loadStoredSession).mockResolvedValue({ serverUrl: null, accessToken: null, user: null });
    vi.mocked(beginSSO).mockResolvedValue(undefined);

    render(<App />);

    expect(screen.getByText('ex')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Setup' })).toBeInTheDocument();
    expect(SplashScreen.hide).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: 'Save server' }));
    expect(storeServerUrl).toHaveBeenCalledWith('https://chat.example.com');
    expect(await screen.findByRole('heading', { name: 'Login https://chat.example.com' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Login now' }));
    expect(beginSSO).toHaveBeenCalledWith('https://chat.example.com');
  });

  it('shows login errors and can reset the server', async () => {
    vi.mocked(loadStoredSession).mockResolvedValue({
      serverUrl: 'https://chat.example.com',
      accessToken: null,
      user: null,
    });
    vi.mocked(beginSSO).mockRejectedValue(new Error('browser blocked'));

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Login https://chat.example.com' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Login now' }));
    expect(await screen.findByText('browser blocked')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Change server' }));
    expect(resetSession).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('heading', { name: 'Setup' })).toBeInTheDocument();
  });

  it('uses fallback login errors for non-Error failures', async () => {
    vi.mocked(loadStoredSession).mockResolvedValue({
      serverUrl: 'https://chat.example.com',
      accessToken: null,
      user: null,
    });
    vi.mocked(beginSSO).mockRejectedValue('blocked');

    render(<App />);

    await screen.findByRole('heading', { name: 'Login https://chat.example.com' });
    await userEvent.click(screen.getByRole('button', { name: 'Login now' }));
    expect(await screen.findByText('Unable to open SSO.')).toBeInTheDocument();
  });

  it('restores chat, logs out, and changes server', async () => {
    vi.mocked(loadStoredSession).mockResolvedValue({
      serverUrl: 'https://chat.example.com',
      accessToken: 'token-1',
      user,
    });

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Chat https://chat.example.com token-1 Me' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Logout now' }));
    expect(clearAuth).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('heading', { name: 'Login https://chat.example.com' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Change server' }));
    expect(resetSession).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('heading', { name: 'Setup' })).toBeInTheDocument();
  });

  it('finishes auth from the deep-link callback', async () => {
    vi.mocked(loadStoredSession).mockResolvedValue({
      serverUrl: 'https://chat.example.com',
      accessToken: null,
      user: null,
    });
    vi.mocked(completeMobileAuth).mockResolvedValue({ token: 'token-2', user });

    render(<App />);

    await screen.findByRole('heading', { name: 'Login https://chat.example.com' });
    authCallback?.('token-2');

    await waitFor(() => expect(storeAuth).toHaveBeenCalledWith('token-2', user));
    expect(await screen.findByRole('heading', { name: 'Chat https://chat.example.com token-2 Me' })).toBeInTheDocument();
  });

  it('shows callback failures on the login screen', async () => {
    vi.mocked(loadStoredSession).mockResolvedValue({
      serverUrl: 'https://chat.example.com',
      accessToken: null,
      user: null,
    });
    vi.mocked(completeMobileAuth).mockRejectedValue('nope');

    render(<App />);

    await screen.findByRole('heading', { name: 'Login https://chat.example.com' });
    authCallback?.('bad-token');

    expect(await screen.findByText('Unable to finish sign in.')).toBeInTheDocument();
  });

  it('removes the deep-link listener on unmount', async () => {
    vi.mocked(loadStoredSession).mockResolvedValue({
      serverUrl: 'https://chat.example.com',
      accessToken: null,
      user: null,
    });

    const { unmount } = render(<App />);
    await screen.findByRole('heading', { name: 'Login https://chat.example.com' });

    unmount();
    await waitFor(() => expect(removeListener).toHaveBeenCalled());
  });
});
