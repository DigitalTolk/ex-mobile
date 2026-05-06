import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SplashScreen } from '@capacitor/splash-screen';
import App from './App';
import { navigateToServer } from './lib/navigation';
import { loadStoredSession, resetSession, storeServerUrl } from './lib/session';

vi.mock('@capacitor/splash-screen', () => ({
  SplashScreen: {
    hide: vi.fn(),
  },
}));

vi.mock('./lib/navigation', () => ({
  navigateToServer: vi.fn(),
}));

vi.mock('./lib/session', () => ({
  loadStoredSession: vi.fn(),
  resetSession: vi.fn(),
  storeServerUrl: vi.fn(),
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

describe('App', () => {
  beforeEach(() => {
    vi.mocked(loadStoredSession).mockReset();
    vi.mocked(resetSession).mockReset().mockResolvedValue(undefined);
    vi.mocked(storeServerUrl).mockReset().mockResolvedValue(undefined);
    vi.mocked(navigateToServer).mockReset();
    vi.mocked(SplashScreen.hide).mockReset();
    vi.useRealTimers();
  });

  it('shows local setup when no server URL is stored', async () => {
    vi.mocked(loadStoredSession).mockResolvedValue({ serverUrl: null });

    render(<App />);

    expect(screen.getByLabelText('Loading')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Setup' })).toBeInTheDocument();
    expect(navigateToServer).not.toHaveBeenCalled();
    expect(SplashScreen.hide).toHaveBeenCalledTimes(1);
  });

  it('redirects the WebView when a server URL is already stored', async () => {
    vi.mocked(loadStoredSession).mockResolvedValue({
      serverUrl: 'https://chat.example.com',
    });

    render(<App />);

    expect(await screen.findByLabelText('Opening server')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change server' })).toBeInTheDocument();
    expect(navigateToServer).not.toHaveBeenCalled();

    await waitFor(() => expect(navigateToServer).toHaveBeenCalledWith('https://chat.example.com'));
    expect(SplashScreen.hide).toHaveBeenCalledTimes(1);
  });

  it('can return to setup before opening a stored server', async () => {
    vi.mocked(loadStoredSession).mockResolvedValue({
      serverUrl: 'https://bad.example.com',
    });

    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: 'Change server' }));

    expect(resetSession).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('heading', { name: 'Setup' })).toBeInTheDocument();

    await new Promise((resolve) => setTimeout(resolve, 850));
    expect(navigateToServer).not.toHaveBeenCalled();
  });

  it('stores a server URL and redirects the WebView', async () => {
    vi.mocked(loadStoredSession).mockResolvedValue({ serverUrl: null });

    render(<App />);

    await screen.findByRole('heading', { name: 'Setup' });
    await userEvent.click(screen.getByRole('button', { name: 'Save server' }));

    expect(storeServerUrl).toHaveBeenCalledWith('https://chat.example.com');
    expect(navigateToServer).toHaveBeenCalledWith('https://chat.example.com');
    expect(screen.getByLabelText('Opening server')).toBeInTheDocument();
  });

  it('keeps loading state when initialization is cancelled before session resolves', async () => {
    let resolveSession!: (value: Awaited<ReturnType<typeof loadStoredSession>>) => void;
    vi.mocked(loadStoredSession).mockReturnValue(
      new Promise((resolve) => {
        resolveSession = resolve;
      }),
    );

    const { unmount } = render(<App />);
    unmount();
    resolveSession({ serverUrl: 'https://chat.example.com' });

    await waitFor(() => expect(SplashScreen.hide).toHaveBeenCalledTimes(1));
    expect(navigateToServer).not.toHaveBeenCalled();
  });
});
