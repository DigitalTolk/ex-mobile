import { Capacitor } from '@capacitor/core';
import OneSignal, { LogLevel } from '@onesignal/capacitor-plugin';

export type NativeNotificationResult =
  | { enabled: true }
  | { enabled: false; reason: 'missing-app-id' | 'not-native' | 'initialization-failed' };

let initializationPromise: Promise<NativeNotificationResult> | null = null;
let notificationClickListenerRegistered = false;

export function oneSignalAppId(): string {
  return (import.meta.env.VITE_ONESIGNAL_APP_ID ?? '').trim();
}

export async function initializeNativeNotifications(appId = oneSignalAppId()): Promise<NativeNotificationResult> {
  const trimmedAppId = appId.trim();

  if (!trimmedAppId) return { enabled: false, reason: 'missing-app-id' };
  if (!Capacitor.isNativePlatform()) return { enabled: false, reason: 'not-native' };

  initializationPromise ??= OneSignal.initialize(trimmedAppId)
    .then(() => {
      OneSignal.Debug.setLogLevel(LogLevel.Warn);
      registerNotificationClickListener();
      return { enabled: true } as const;
    })
    .catch((error: unknown) => {
      initializationPromise = null;
      console.warn('[OneSignal] Native notification initialization failed', error);
      return { enabled: false, reason: 'initialization-failed' } as const;
    });

  return initializationPromise;
}

export async function enableNativeNotificationsForServer(
  serverUrl: string,
  appId = oneSignalAppId(),
): Promise<NativeNotificationResult> {
  const result = await initializeNativeNotifications(appId);
  if (!result.enabled) return result;

  await OneSignal.User.addTags({
    app: 'ex-mobile',
    server_url: serverUrl,
  });

  if (await OneSignal.Notifications.canRequestPermission()) {
    await OneSignal.Notifications.requestPermission(false);
  }

  return result;
}

export async function clearNativeNotificationContext(appId = oneSignalAppId()): Promise<NativeNotificationResult> {
  const result = await initializeNativeNotifications(appId);
  if (!result.enabled) return result;

  await OneSignal.User.removeTags(['server_url']);
  return result;
}

function registerNotificationClickListener(): void {
  if (notificationClickListenerRegistered) return;
  notificationClickListenerRegistered = true;

  OneSignal.Notifications.addEventListener('click', (event) => {
    const url = event.result.url ?? event.notification.launchURL;
    if (!url) return;

    window.dispatchEvent(new CustomEvent('ex-mobile:notification-url', { detail: { url } }));
  });
}
