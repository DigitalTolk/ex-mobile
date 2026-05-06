import { Capacitor, registerPlugin } from '@capacitor/core';

interface LocationLike {
  replace(url: string): void;
}

interface ServerNavigationPlugin {
  open(options: { url: string }): Promise<void>;
}

const ServerNavigation = registerPlugin<ServerNavigationPlugin>('ServerNavigation');

export async function navigateToServer(serverUrl: string, location: LocationLike = window.location): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await ServerNavigation.open({ url: serverUrl });
    return;
  }

  location.replace(serverUrl);
}
