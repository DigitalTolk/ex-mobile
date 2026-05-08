import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.digitaltolk.ex.mobile',
  appName: 'ex',
  webDir: 'dist',
  server: {
    allowNavigation: ['*'],
  },
  ios: {
    allowsLinkPreview: false,
    handleApplicationNotifications: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#231F20',
    },
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
    },
  },
};

export default config;
