import { FormEvent, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { normalizeServerUrl } from '../lib/url';

interface SetupScreenProps {
  initialUrl?: string;
  onSave: (serverUrl: string) => Promise<void>;
}

export function SetupScreen({ initialUrl = '', onSave }: SetupScreenProps) {
  const [value, setValue] = useState(initialUrl);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSave(normalizeServerUrl(value));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enter a valid chat server URL.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="setup-screen">
      <div className="setup-brand" aria-hidden="true">
        <MessageCircle size={30} />
      </div>
      <h1>ex</h1>
      <form onSubmit={submit} className="setup-form">
        <label htmlFor="server-url">Chat server</label>
        <input
          id="server-url"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          placeholder="https://chat.company.com"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        {error && <p className="form-error">{error}</p>}
        <button type="submit" disabled={saving || !value.trim()}>
          {saving ? 'Saving...' : 'Continue'}
        </button>
      </form>
    </main>
  );
}
