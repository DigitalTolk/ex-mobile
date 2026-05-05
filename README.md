# ex-mobile

Capacitor + TypeScript + React mobile client for the `ex` internal chat server.

## Development

```sh
npm install
npm run dev
```

The app asks for the chat server URL on first launch, stores it in Capacitor Preferences, and signs in through the system browser using the server's existing allowlisted `ex://app/auth/callback` redirect.

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
