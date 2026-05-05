import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.digitaltolk.ex.mobile',
  appName: 'ex',
  webDir: 'dist',
  plugins: {
    App: {
      appUrlOpen: true,
    },
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#231F20',
    },
  },
  ios: {
    scheme: 'ex',
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
    },
  },
};

export default config;
