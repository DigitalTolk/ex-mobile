import OneSignal from '@onesignal/capacitor-plugin';
import { Capacitor } from '@capacitor/core';
import { registerNativeNotificationRouting } from './navigation';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(),
  },
}));

vi.mock('@onesignal/capacitor-plugin', () => ({
  LogLevel: {
    Warn: 3,
  },
  default: {
    Debug: {
      setLogLevel: vi.fn(),
    },
    Notifications: {
      addEventListener: vi.fn(),
      canRequestPermission: vi.fn(),
      requestPermission: vi.fn(),
    },
    User: {
      addTags: vi.fn(),
      removeTags: vi.fn(),
    },
    initialize: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
  },
}));

vi.mock('./navigation', () => ({
  registerNativeNotificationRouting: vi.fn(),
}));

describe('OneSignal native notification integration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.resetModules();
    vi.mocked(Capacitor.isNativePlatform).mockReset();
    vi.mocked(OneSignal.initialize).mockReset().mockResolvedValue(undefined);
    vi.mocked(OneSignal.login).mockReset().mockResolvedValue(undefined);
    vi.mocked(OneSignal.logout).mockReset().mockResolvedValue(undefined);
    vi.mocked(OneSignal.Debug.setLogLevel).mockReset();
    vi.mocked(OneSignal.Notifications.addEventListener).mockReset();
    vi.mocked(OneSignal.Notifications.canRequestPermission).mockReset().mockResolvedValue(false);
    vi.mocked(OneSignal.Notifications.requestPermission).mockReset().mockResolvedValue(false);
    vi.mocked(OneSignal.User.addTags).mockReset().mockResolvedValue(undefined);
    vi.mocked(OneSignal.User.removeTags).mockReset().mockResolvedValue(undefined);
    vi.mocked(registerNativeNotificationRouting).mockReset().mockResolvedValue(undefined);
  });

  it('does nothing when no OneSignal app ID is configured', async () => {
    const { initializeNativeNotifications, oneSignalAppId } = await import('./onesignal');
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);

    expect(oneSignalAppId()).toBe('');
    await expect(initializeNativeNotifications('')).resolves.toEqual({
      enabled: false,
      reason: 'missing-app-id',
    });

    expect(OneSignal.initialize).not.toHaveBeenCalled();
  });

  it('reads the OneSignal app ID from Vite env', async () => {
    vi.stubEnv('VITE_ONESIGNAL_APP_ID', ' onesignal-env-app-id ');
    const { oneSignalAppId } = await import('./onesignal');

    expect(oneSignalAppId()).toBe('onesignal-env-app-id');
  });

  it('does nothing outside native Capacitor runtimes', async () => {
    const { initializeNativeNotifications } = await import('./onesignal');
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);

    await expect(initializeNativeNotifications('onesignal-app-id')).resolves.toEqual({
      enabled: false,
      reason: 'not-native',
    });

    expect(OneSignal.initialize).not.toHaveBeenCalled();
  });

  it('initializes once, tags the selected server, and requests permission when possible', async () => {
    const { enableNativeNotificationsForServer } = await import('./onesignal');
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(OneSignal.Notifications.canRequestPermission).mockResolvedValue(true);
    vi.mocked(OneSignal.Notifications.requestPermission).mockResolvedValue(true);

    await expect(enableNativeNotificationsForServer('https://chat.example.com', 'onesignal-app-id')).resolves.toEqual({
      enabled: true,
    });
    await expect(enableNativeNotificationsForServer('https://chat.example.com', 'onesignal-app-id')).resolves.toEqual({
      enabled: true,
    });

    expect(OneSignal.initialize).toHaveBeenCalledTimes(1);
    expect(OneSignal.initialize).toHaveBeenCalledWith('onesignal-app-id');
    expect(registerNativeNotificationRouting).toHaveBeenCalledTimes(1);
    expect(OneSignal.User.addTags).toHaveBeenCalledWith({
      app: 'ex-mobile',
      server_url: 'https://chat.example.com',
    });
    expect(OneSignal.Notifications.requestPermission).toHaveBeenCalledWith(false);
  });

  it('does not request permission when the native prompt is unavailable', async () => {
    const { enableNativeNotificationsForServer } = await import('./onesignal');
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(OneSignal.Notifications.canRequestPermission).mockResolvedValue(false);

    await expect(enableNativeNotificationsForServer('https://chat.example.com', 'onesignal-app-id')).resolves.toEqual({
      enabled: true,
    });

    expect(OneSignal.Notifications.requestPermission).not.toHaveBeenCalled();
  });

  it('does not tag subscriptions when enabling is unavailable', async () => {
    const { enableNativeNotificationsForServer } = await import('./onesignal');
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);

    await expect(enableNativeNotificationsForServer('https://chat.example.com', 'onesignal-app-id')).resolves.toEqual({
      enabled: false,
      reason: 'not-native',
    });

    expect(OneSignal.User.addTags).not.toHaveBeenCalled();
  });

  it('logs in and tags the native subscription with the authenticated user', async () => {
    const { identifyNativeNotificationUser } = await import('./onesignal');
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);

    await expect(
      identifyNativeNotificationUser('https://chat.example.com', ' user-123 ', 'onesignal-app-id'),
    ).resolves.toEqual({
      enabled: true,
    });

    expect(OneSignal.login).toHaveBeenCalledWith('user-123');
    expect(OneSignal.User.addTags).toHaveBeenCalledWith({
      app: 'ex-mobile',
      server_url: 'https://chat.example.com',
      user_id: 'user-123',
    });
  });

  it('rejects empty native notification user IDs', async () => {
    const { identifyNativeNotificationUser } = await import('./onesignal');
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);

    await expect(identifyNativeNotificationUser('https://chat.example.com', ' ', 'onesignal-app-id')).resolves.toEqual({
      enabled: false,
      reason: 'invalid-user-id',
    });

    expect(OneSignal.initialize).not.toHaveBeenCalled();
    expect(OneSignal.login).not.toHaveBeenCalled();
  });

  it('reports initialization failures without leaving the SDK permanently stuck', async () => {
    const { initializeNativeNotifications } = await import('./onesignal');
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(OneSignal.initialize).mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(undefined);
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(initializeNativeNotifications('onesignal-app-id')).resolves.toEqual({
      enabled: false,
      reason: 'initialization-failed',
    });
    await expect(initializeNativeNotifications('onesignal-app-id')).resolves.toEqual({
      enabled: true,
    });

    expect(OneSignal.initialize).toHaveBeenCalledTimes(2);
    expect(consoleWarn).toHaveBeenCalledWith(
      '[OneSignal] Native notification initialization failed',
      expect.any(Error),
    );
    consoleWarn.mockRestore();
  });

  it('dispatches notification click URLs for app-level routing', async () => {
    const { initializeNativeNotifications } = await import('./onesignal');
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    await initializeNativeNotifications('onesignal-app-id');

    const listener = vi.mocked(OneSignal.Notifications.addEventListener).mock.calls[0]?.[1];
    listener?.({
      result: { url: 'https://chat.example.com/channels/general' },
      notification: {
        body: '',
        rawPayload: {},
        additionalData: {},
        notificationId: 'notification-id',
        display: vi.fn(),
      },
    });

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ex-mobile:notification-url',
        detail: { url: 'https://chat.example.com/channels/general' },
      }),
    );
  });

  it('dispatches notification launch URLs when the click result has no URL', async () => {
    const { initializeNativeNotifications } = await import('./onesignal');
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    await initializeNativeNotifications('onesignal-app-id');

    const listener = vi.mocked(OneSignal.Notifications.addEventListener).mock.calls[0]?.[1];
    listener?.({
      result: {},
      notification: {
        body: '',
        launchURL: 'https://chat.example.com/threads/thread-id',
        rawPayload: {},
        additionalData: {},
        notificationId: 'notification-id',
        display: vi.fn(),
      },
    });

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ex-mobile:notification-url',
        detail: { url: 'https://chat.example.com/threads/thread-id' },
      }),
    );
  });

  it('dispatches notification data URLs before falling back to launch URLs', async () => {
    const { initializeNativeNotifications } = await import('./onesignal');
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    await initializeNativeNotifications('onesignal-app-id');

    const listener = vi.mocked(OneSignal.Notifications.addEventListener).mock.calls[0]?.[1];
    listener?.({
      result: {},
      notification: {
        body: '',
        launchURL: 'https://chat.example.com/browser-fallback',
        rawPayload: {},
        additionalData: {
          url: 'https://chat.example.com/channels/general',
        },
        notificationId: 'notification-id',
        display: vi.fn(),
      },
    });

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ex-mobile:notification-url',
        detail: { url: 'https://chat.example.com/channels/general' },
      }),
    );
  });

  it('dispatches notification data URLs before click result URLs', async () => {
    const { initializeNativeNotifications } = await import('./onesignal');
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    await initializeNativeNotifications('onesignal-app-id');

    const listener = vi.mocked(OneSignal.Notifications.addEventListener).mock.calls[0]?.[1];
    listener?.({
      result: { url: 'https://chat.example.com/browser-fallback' },
      notification: {
        body: '',
        rawPayload: {},
        additionalData: {
          url: 'https://chat.example.com/channels/general',
        },
        notificationId: 'notification-id',
        display: vi.fn(),
      },
    });

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ex-mobile:notification-url',
        detail: { url: 'https://chat.example.com/channels/general' },
      }),
    );
  });

  it('dispatches raw payload data URLs when additional data is unavailable', async () => {
    const { initializeNativeNotifications } = await import('./onesignal');
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    await initializeNativeNotifications('onesignal-app-id');

    const listener = vi.mocked(OneSignal.Notifications.addEventListener).mock.calls[0]?.[1];
    listener?.({
      result: {},
      notification: {
        body: '',
        rawPayload: {
          url: 'https://chat.example.com/threads/thread-id',
        },
        additionalData: {},
        notificationId: 'notification-id',
        display: vi.fn(),
      },
    });

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ex-mobile:notification-url',
        detail: { url: 'https://chat.example.com/threads/thread-id' },
      }),
    );
  });

  it('ignores notification clicks without a URL', async () => {
    const { initializeNativeNotifications } = await import('./onesignal');
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    await initializeNativeNotifications('onesignal-app-id');

    const listener = vi.mocked(OneSignal.Notifications.addEventListener).mock.calls[0]?.[1];
    listener?.({
      result: {},
      notification: {
        body: '',
        rawPayload: {},
        additionalData: {},
        notificationId: 'notification-id',
        display: vi.fn(),
      },
    });

    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it('ignores blank and non-string notification data URLs', async () => {
    const { initializeNativeNotifications } = await import('./onesignal');
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    await initializeNativeNotifications('onesignal-app-id');

    const listener = vi.mocked(OneSignal.Notifications.addEventListener).mock.calls[0]?.[1];
    listener?.({
      result: {},
      notification: {
        body: '',
        rawPayload: {
          url: 123,
        },
        additionalData: {
          url: ' ',
        },
        notificationId: 'notification-id',
        display: vi.fn(),
      },
    });

    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it('ignores missing notification data objects', async () => {
    const { initializeNativeNotifications } = await import('./onesignal');
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    await initializeNativeNotifications('onesignal-app-id');

    const listener = vi.mocked(OneSignal.Notifications.addEventListener).mock.calls[0]?.[1];
    listener?.({
      result: {},
      notification: {
        body: '',
        rawPayload: undefined as unknown as object,
        additionalData: undefined as unknown as object,
        notificationId: 'notification-id',
        display: vi.fn(),
      },
    });

    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it('removes the server tag when changing server', async () => {
    const { clearNativeNotificationContext } = await import('./onesignal');
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);

    await clearNativeNotificationContext('onesignal-app-id');

    expect(OneSignal.logout).toHaveBeenCalledTimes(1);
    expect(OneSignal.User.removeTags).toHaveBeenCalledWith(['server_url', 'user_id']);
  });

  it('does not remove server tags when clearing is unavailable', async () => {
    const { clearNativeNotificationContext } = await import('./onesignal');
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);

    await expect(clearNativeNotificationContext('')).resolves.toEqual({
      enabled: false,
      reason: 'missing-app-id',
    });

    expect(OneSignal.User.removeTags).not.toHaveBeenCalled();
  });
});
