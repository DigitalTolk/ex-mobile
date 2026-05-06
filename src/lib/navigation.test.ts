import { describe, expect, it, vi } from 'vitest';
import { Capacitor } from '@capacitor/core';
import { navigateToServer } from './navigation';

const plugin = vi.hoisted(() => ({
  open: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => false),
  },
  registerPlugin: vi.fn(() => plugin),
}));

describe('navigation', () => {
  it('replaces the current WebView URL with the selected server', () => {
    const location = { replace: vi.fn() };

    void navigateToServer('https://chat.example.com', location);

    expect(location.replace).toHaveBeenCalledWith('https://chat.example.com');
  });

  it('uses the native navigation plugin on iOS and Android', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    plugin.open.mockResolvedValue(undefined);
    const location = { replace: vi.fn() };

    await navigateToServer('https://chat.example.com', location);

    expect(plugin.open).toHaveBeenCalledWith({ url: 'https://chat.example.com' });
    expect(location.replace).not.toHaveBeenCalled();
  });
});
