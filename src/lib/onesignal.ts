import { Capacitor } from '@capacitor/core';
import OneSignal, { LogLevel } from '@onesignal/capacitor-plugin';
import { registerNativeNotificationRouting } from './navigation';

export type NativeNotificationResult =
  | { enabled: true }
  | { enabled: false; reason: 'missing-app-id' | 'not-native' | 'initialization-failed' | 'invalid-user-id' };

let initializationPromise: Promise<NativeNotificationResult> | null = null;
let notificationClickListenerRegistered = false;
let pendingNotificationUrl: string | null = null;

export function oneSignalAppId(): string {
  return (import.meta.env.VITE_ONESIGNAL_APP_ID ?? '').trim();
}

export async function initializeNativeNotifications(appId = oneSignalAppId()): Promise<NativeNotificationResult> {
  const trimmedAppId = appId.trim();

  if (!trimmedAppId) return { enabled: false, reason: 'missing-app-id' };
  if (!Capacitor.isNativePlatform()) return { enabled: false, reason: 'not-native' };

  registerNotificationClickListener();
  initializationPromise ??= OneSignal.initialize(trimmedAppId)
    .then(async () => {
      OneSignal.Debug.setLogLevel(LogLevel.Warn);
      await registerNativeNotificationRouting();
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

export async function identifyNativeNotificationUser(
  serverUrl: string,
  userId: string,
  appId = oneSignalAppId(),
): Promise<NativeNotificationResult> {
  const trimmedUserId = userId.trim();
  if (!trimmedUserId) return { enabled: false, reason: 'invalid-user-id' };

  const result = await initializeNativeNotifications(appId);
  if (!result.enabled) return result;

  await OneSignal.login(trimmedUserId);
  await OneSignal.User.addTags({
    app: 'ex-mobile',
    server_url: serverUrl,
    user_id: trimmedUserId,
  });

  return result;
}

export async function clearNativeNotificationContext(appId = oneSignalAppId()): Promise<NativeNotificationResult> {
  const result = await initializeNativeNotifications(appId);
  if (!result.enabled) return result;

  await OneSignal.logout();
  await OneSignal.User.removeTags(['server_url', 'user_id']);
  return result;
}

export function consumePendingNotificationUrl(): string | null {
  const url = pendingNotificationUrl;
  pendingNotificationUrl = null;
  return url;
}

function registerNotificationClickListener(): void {
  if (notificationClickListenerRegistered) return;
  notificationClickListenerRegistered = true;

  OneSignal.Notifications.addEventListener('click', (event) => {
    const url =
      notificationDataUrl(event.notification.additionalData) ??
      notificationDataUrl(event.notification.rawPayload) ??
      event.result.url ??
      event.notification.launchURL;
    if (!url) return;

    dispatchNotificationUrl(url);
  });
}

function dispatchNotificationUrl(url: string): void {
  pendingNotificationUrl = url;
  window.dispatchEvent(new CustomEvent('ex-mobile:notification-url', { detail: { url } }));
}

function notificationDataUrl(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;

  const url = (data as { url?: unknown }).url;
  return typeof url === 'string' && url.trim() ? url : undefined;
}
