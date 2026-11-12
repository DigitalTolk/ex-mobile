import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CHANGE_SERVER_URL, RETRY_URL, initErrorPage } from './error';

function setup() {
  document.body.innerHTML = '<button id="retry">Try again</button><button id="change-server">Change server</button>';
  const listeners: Record<string, () => void> = {};
  const win = {
    location: { replace: vi.fn() },
    addEventListener: vi.fn((type: string, listener: () => void) => {
      listeners[type] = listener;
    }),
  };
  initErrorPage(document, win);
  return { win, listeners };
}

describe('error page', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('Try again reopens the server through the shell', () => {
    const { win } = setup();
    document.getElementById('retry')!.click();
    expect(win.location.replace).toHaveBeenCalledWith(RETRY_URL);
    expect(RETRY_URL).toBe('/');
  });

  it('Change server opens the server field', () => {
    const { win } = setup();
    document.getElementById('change-server')!.click();
    expect(win.location.replace).toHaveBeenCalledWith(CHANGE_SERVER_URL);
    expect(CHANGE_SERVER_URL).toBe('/?change-server');
  });

  it('tries again by itself, once, when the device comes back online', () => {
    const { win, listeners } = setup();
    expect(win.addEventListener).toHaveBeenCalledWith('online', expect.any(Function), { once: true });
    listeners.online();
    expect(win.location.replace).toHaveBeenCalledWith(RETRY_URL);
  });

  it('tolerates a page without the buttons', () => {
    const win = { location: { replace: vi.fn() }, addEventListener: vi.fn() };
    expect(() => initErrorPage(document, win)).not.toThrow();
  });
});
