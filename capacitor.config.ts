import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.digitaltolk.ex.mobile',
  appName: 'ex',
  webDir: 'dist',
  server: {
    // The chat server is user-configured at runtime; native navigation guards keep non-server links external.
    allowNavigation: ['*'],
    // Android: a server page that fails to load shows this retry screen instead
    // of the WebView's own error page. iOS opts out in BridgeViewController.
    errorPath: 'error.html',
  },
  ios: {
    // iPadOS defaults WKWebView to desktop-class browsing (Macintosh UA, meta viewport
    // ignored so narrow Split View windows get a scaled 980px layout); keep the
    // responsive mobile content mode on iPad too.
    preferredContentMode: 'mobile',
    allowsLinkPreview: false,
    handleApplicationNotifications: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#231F20',
    },
    // Android: MainActivity keeps the WebView inside the system bars itself, so
    // the page never draws under the navigation bar (see keepWebViewInsideSystemBars).
    SystemBars: {
      insetsHandling: 'disable',
    },
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
    },
  },
};

export default config;
