import { useEffect, useRef, useState } from 'react';
import { SplashScreen } from '@capacitor/splash-screen';
import { SetupScreen } from './components/SetupScreen';
import { navigateToServer } from './lib/navigation';
import { loadStoredSession, resetSession, storeServerUrl } from './lib/session';

type View = 'loading' | 'setup' | 'redirecting';
const STORED_SERVER_REDIRECT_DELAY_MS = 750;

export default function App() {
  const [view, setView] = useState<View>('loading');
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadStoredSession()
      .then((stored) => {
        if (cancelled) return;
        const storedServerUrl = stored.serverUrl;
        setServerUrl(storedServerUrl);
        if (storedServerUrl) {
          setView('redirecting');
          redirectTimerRef.current = setTimeout(() => {
            void navigateToServer(storedServerUrl);
          }, STORED_SERVER_REDIRECT_DELAY_MS);
          return;
        }
        setView('setup');
      })
      .finally(() => {
        void SplashScreen.hide();
      });
    return () => {
      cancelled = true;
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, []);

  async function saveServer(nextServerUrl: string) {
    await storeServerUrl(nextServerUrl);
    setServerUrl(nextServerUrl);
    setView('redirecting');
    await navigateToServer(nextServerUrl);
  }

  async function changeServer() {
    if (redirectTimerRef.current) {
      clearTimeout(redirectTimerRef.current);
      redirectTimerRef.current = null;
    }
    await resetSession();
    setServerUrl(null);
    setView('setup');
  }

  if (view === 'loading') return <main className="loading-screen" aria-label="Loading" />;
  if (view === 'setup') return <SetupScreen initialUrl={serverUrl ?? ''} onSave={saveServer} />;
  return (
    <main className="loading-screen" aria-label="Opening server">
      <button type="button" className="top-left-button link-button" onClick={() => void changeServer()}>
        Change server
      </button>
    </main>
  );
}
