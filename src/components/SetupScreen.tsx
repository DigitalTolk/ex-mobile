import { FormEvent, useState } from 'react';
import { BrandLogo } from './BrandLogo';
import { normalizeServerUrl } from '../lib/url';

interface SetupScreenProps {
  initialUrl?: string;
  onSave: (serverUrl: string) => Promise<void>;
}

export function SetupScreen({ initialUrl = '', onSave }: SetupScreenProps) {
  const [value, setValue] = useState(initialUrl);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function normalizeInputValue() {
    const trimmed = value.trim();
    if (!trimmed || /^https?:\/\//i.test(trimmed)) return;
    setValue(`https://${trimmed}`);
  }

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
      <BrandLogo />
      <h1>Connect to your chat server</h1>
      <form onSubmit={submit} className="setup-form">
        <label htmlFor="server-url">Chat server</label>
        <input
          id="server-url"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          placeholder="chat.company.com"
          value={value}
          onBlur={normalizeInputValue}
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
