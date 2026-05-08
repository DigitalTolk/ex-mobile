import { useEffect, useRef, useState } from 'react';
import { SplashScreen } from '@capacitor/splash-screen';
import { SetupScreen } from './components/SetupScreen';
import { navigateToServer } from './lib/navigation';
import { clearNativeNotificationContext, enableNativeNotificationsForServer } from './lib/onesignal';
import { loadStoredSession, resetSession, storeServerUrl } from './lib/session';

type View = 'loading' | 'setup' | 'redirecting';
const STORED_SERVER_REDIRECT_DELAY_MS = 750;
const SERVER_RECOVERY_DELAY_MS = 15000;

export default function App() {
  const [view, setView] = useState<View>('loading');
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [showServerRecovery, setShowServerRecovery] = useState(false);
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
          void enableNativeNotificationsForServer(storedServerUrl);
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

  useEffect(() => {
    setShowServerRecovery(false);
    if (view !== 'redirecting') return undefined;
    const timer = setTimeout(() => setShowServerRecovery(true), SERVER_RECOVERY_DELAY_MS);
    return () => clearTimeout(timer);
  }, [view]);

  async function saveServer(nextServerUrl: string) {
    await storeServerUrl(nextServerUrl);
    setServerUrl(nextServerUrl);
    setView('redirecting');
    void enableNativeNotificationsForServer(nextServerUrl);
    await navigateToServer(nextServerUrl);
  }

  async function changeServer() {
    if (redirectTimerRef.current) {
      clearTimeout(redirectTimerRef.current);
      redirectTimerRef.current = null;
    }
    await resetSession();
    void clearNativeNotificationContext();
    setServerUrl(null);
    setView('setup');
  }

  function renderLoading(label: string) {
    return (
      <main className="loading-screen" aria-label={label}>
        <img className="brand-logo loading-logo" src="/logo.svg" alt="DigitalTolk chat" />
        {view === 'redirecting' && showServerRecovery && (
          <button type="button" className="loading-recovery-button link-button" onClick={() => void changeServer()}>
            Change server
          </button>
        )}
      </main>
    );
  }

  if (view === 'loading') return renderLoading('Loading');
  if (view === 'setup') return <SetupScreen initialUrl={serverUrl ?? ''} onSave={saveServer} />;
  return renderLoading('Opening server');
}
