# ex-mobile

Capacitor + TypeScript + React mobile client for the `ex` internal chat server.

## Development

```sh
npm install
npm run dev
```

The app asks for the chat server URL on first launch, stores it in Capacitor Preferences, and signs in through the system browser using the server's allowlisted `ex://mobile/auth/callback` redirect.

## Native notifications

The app initializes OneSignal on iOS/Android when `VITE_ONESIGNAL_APP_ID` is set:

```sh
VITE_ONESIGNAL_APP_ID=your-onesignal-app-id
```

The OneSignal app ID is safe to expose in the mobile build. Add it as a GitHub Actions variable or secret for CI builds. The native client tags the subscription with `app=ex-mobile` and `server_url=<selected server URL>` after the user selects or loads a server.

Before TestFlight/App Store push notifications work, enable Push Notifications for `com.digitaltolk.ex.mobile` in Apple Developer, regenerate the App Store provisioning profile, and update `IOS_PROVISIONING_PROFILE_BASE64`. In OneSignal, configure Apple APNs credentials for iOS and Firebase Cloud Messaging credentials for Android.

This is the base native push integration. Rich iOS notification images, Confirmed Delivery, and OneSignal badge features also require adding a Notification Service Extension and App Group in Xcode.

`@onesignal/capacitor-plugin` currently declares a Capacitor 7 peer dependency while the app uses Capacitor 8. The project `.npmrc` keeps `legacy-peer-deps=true` so CI installs match the current OneSignal package until its peer range catches up.

## Native projects

```sh
npm run build
npx capacitor sync
```

The source icon assets live in `resources/`:

- `resources/ex.icon` is the iOS source icon provided for Apple platforms.
- `resources/android-icon.svg` is the Android source icon.
- `resources/icon.svg` is the shared fallback used by Capacitor asset generation.

## CI release secrets

GitHub Actions expects these secrets for TestFlight/App Store delivery:

- `COVERALLS_REPO_TOKEN`
- `APP_STORE_CONNECT_API_KEY_ID`
- `APP_STORE_CONNECT_ISSUER_ID`
- `APP_STORE_CONNECT_API_KEY`
- `IOS_CERTIFICATE_P12_BASE64`
- `IOS_CERTIFICATE_PASSWORD`
- `IOS_PROVISIONING_PROFILE_BASE64`

Pull requests run lint, tests, coverage, and upload a TestFlight build when iOS signing secrets are present. Tags matching `vN.N.N` upload an App Store build for iOS.
