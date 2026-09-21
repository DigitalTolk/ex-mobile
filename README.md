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

## Native projects

```sh
npm run build
npx capacitor sync
```

The source icon assets live in `resources/`:

- `resources/ex.icon` is the iOS source icon provided for Apple platforms.
- `resources/android-icon.svg` is the Android source icon.
- `resources/icon.svg` is the shared fallback used by Capacitor asset generation.

## iPad

The iOS target is universal (`TARGETED_DEVICE_FAMILY = "1,2"`), so iPad runs the app at its native size instead of the scaled iPhone compatibility mode. The chat server's web UI picks its layout from the window width, so iPad windows get the tablet/desktop layout, and narrow Split View or Stage Manager windows fall back to the phone layout.

- iPad windows rotate freely and support Split View, Slide Over and Stage Manager. `BridgeViewController` overrides Capacitor's orientation mask, because Capacitor only reads the iPhone orientation list.
- The WebView uses `preferredContentMode: 'mobile'`. iPadOS would otherwise default to desktop-class browsing, which ignores the viewport meta tag and gives narrow windows a scaled 980px layout.
- `UIApplicationSupportsIndirectInputEvents` makes a trackpad or mouse behave like a pointer (hover, right-click) instead of simulated touches.
- The native shell tells the page which input devices are in use:
  - `window.__EX_HARDWARE_KEYBOARD__` plus the `ex-mobile:hardware-keyboard` window event. With a hardware keyboard, Return sends and Shift+Return adds a newline. The on-screen keyboard's Return always adds a newline.
  - `window.__EX_POINTER_DEVICE__` plus the `ex-mobile:pointer-device` window event, from a connected mouse or Magic Keyboard trackpad. The web app then shows its hover affordances (message toolbar, sidebar row actions, drag-to-reorder) instead of the touch stand-ins, while touch gestures keep working.
- Run it on a simulator with `make ios-ipad` (override `IPAD_SIMULATOR` to pick another device).

Before the first App Store release that includes iPad, upload 13-inch iPad screenshots in App Store Connect. The release lane skips screenshot upload, and App Review submission fails without them. TestFlight builds do not need screenshots. Once a version with iPad support is live, later versions cannot drop it, and fastlane refuses to upload a build that is no longer universal.

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
