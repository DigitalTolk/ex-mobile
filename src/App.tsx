import { useCallback, useEffect, useState } from 'react';
import { SplashScreen } from '@capacitor/splash-screen';
import { ChatShell } from './components/ChatShell';
import { LoginScreen } from './components/LoginScreen';
import { SetupScreen } from './components/SetupScreen';
import { clearAuth, loadStoredSession, resetSession, storeAuth, storeServerUrl } from './lib/session';
import { beginSSO, completeMobileAuth, listenForAuthCallback } from './lib/mobile-auth';
import type { User } from './types';

type View = 'loading' | 'setup' | 'login' | 'chat';

export default function App() {
  const [view, setView] = useState<View>('loading');
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadStoredSession()
      .then((stored) => {
        if (cancelled) return;
        setServerUrl(stored.serverUrl);
        setAccessToken(stored.accessToken);
        setUser(stored.user);
        setView(stored.serverUrl ? (stored.accessToken && stored.user ? 'chat' : 'login') : 'setup');
      })
      .finally(() => {
        void SplashScreen.hide();
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const finishAuth = useCallback(
    async (token: string) => {
      if (!serverUrl) return;
      setBusy(true);
      setError(null);
      try {
        const result = await completeMobileAuth(serverUrl, token);
        await storeAuth(result.token, result.user);
        setAccessToken(result.token);
        setUser(result.user);
        setView('chat');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to finish sign in.');
        setView('login');
      } finally {
        setBusy(false);
      }
    },
    [serverUrl],
  );

  useEffect(() => {
    let handle: { remove: () => Promise<void> } | null = null;
    listenForAuthCallback((token) => {
      void finishAuth(token);
    }).then((next) => {
      handle = next;
    });
    return () => {
      void handle?.remove();
    };
  }, [finishAuth]);

  async function saveServer(nextServerUrl: string) {
    await storeServerUrl(nextServerUrl);
    setServerUrl(nextServerUrl);
    setView('login');
  }

  async function login() {
    if (!serverUrl) return;
    setBusy(true);
    setError(null);
    try {
      await beginSSO(serverUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to open SSO.');
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await clearAuth();
    setAccessToken(null);
    setUser(null);
    setView('login');
  }

  async function changeServer() {
    await resetSession();
    setServerUrl(null);
    setAccessToken(null);
    setUser(null);
    setView('setup');
  }

  if (view === 'loading') return <main className="loading-screen">ex</main>;
  if (view === 'setup') return <SetupScreen initialUrl={serverUrl ?? ''} onSave={saveServer} />;
  if (view === 'login' || !accessToken || !user || !serverUrl) {
    return (
      <LoginScreen
        serverUrl={serverUrl ?? ''}
        user={user}
        busy={busy}
        error={error}
        onLogin={login}
        onChangeServer={changeServer}
      />
    );
  }
  return (
    <ChatShell
      serverUrl={serverUrl}
      accessToken={accessToken}
      user={user}
      onLogout={logout}
      onChangeServer={changeServer}
    />
  );
}
