# Terrain Gen test app (iPhone / Android)

This wraps the web app in a native shell with [Capacitor](https://capacitorjs.com) so it installs like a real app and uses **native haptics** (the app detects the native shell and calls `@capacitor/haptics`).

## iPhone (needs a Mac with Xcode)

1. Install Node.js 18+ and Xcode from the App Store.
2. In this folder:
   ```bash
   npm install
   npx cap add ios        # first time only
   npm run ios            # builds the web app into www/, syncs, opens Xcode
   ```
3. In Xcode: select the **App** target → *Signing & Capabilities* → pick your Apple ID team and change the bundle id (`com.example.terraingen`) to something unique.
4. Plug in your iPhone, choose it as the run destination, press ▶. On the phone, trust the developer in *Settings → General → VPN & Device Management*.
   - A free Apple ID works for 7 days at a time on your own phone.
   - **TestFlight** (share with testers, 90-day builds) needs the paid Apple Developer Program: *Product → Archive → Distribute App → TestFlight*.

## Android

```bash
npm install
npx cap add android    # first time only
npm run android        # opens Android Studio → Run
```

## Updating

After changing the web app, run `npm run ios` (or `android`) again; it rebuilds `www/` and syncs.

## Without building anything

The GitHub Pages site (see `.github/workflows/strata-pages.yml`) is an installable PWA: open it in Safari → Share → **Add to Home Screen**. It runs full screen and works offline. On iOS 18+ Safari the app also produces light haptic ticks through the system switch control; full haptics need this native wrapper.
