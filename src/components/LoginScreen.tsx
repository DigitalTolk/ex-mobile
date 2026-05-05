import { LogIn, Server } from 'lucide-react';
import type { User } from '../types';

interface LoginScreenProps {
  serverUrl: string;
  user: User | null;
  busy: boolean;
  error: string | null;
  onLogin: () => void;
  onChangeServer: () => void;
}

export function LoginScreen({
  serverUrl,
  user,
  busy,
  error,
  onLogin,
  onChangeServer,
}: LoginScreenProps) {
  return (
    <main className="login-screen">
      <div className="login-panel">
        <img className="brand-logo" src="/logo.svg" alt="DigitalTolk chat" />
        <h1>{user ? `Welcome, ${user.displayName}` : 'Sign in'}</h1>
        <p className="server-line">{serverUrl}</p>
        {error && <p className="form-error">{error}</p>}
        <button type="button" onClick={onLogin} disabled={busy}>
          <LogIn size={18} />
          {busy ? 'Opening SSO...' : 'Sign in with SSO'}
        </button>
        <button type="button" className="secondary-button" onClick={onChangeServer}>
          <Server size={18} />
          Change server
        </button>
      </div>
    </main>
  );
}
