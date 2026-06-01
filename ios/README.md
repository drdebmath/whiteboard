# Whiteboard — iOS app

A thin native wrapper around the existing no-build web app. It runs the **exact
same** `index.html` / `.jsx` / `styles.css` files inside a full-screen
`WKWebView`; there is no separate codebase and no JavaScript build step.

## How it works

- **`WebSchemeHandler.swift`** registers a custom `app://board/` scheme and serves
  the bundled web files. We use a scheme handler rather than `file://` so the page
  gets a real, stable origin — which is what makes `localStorage` (the board's
  whole datastore) persist and lets the in-browser Babel loader fetch the `.jsx`
  files, exactly as under `python3 -m http.server`. (This is the same approach
  Capacitor uses for `capacitor://localhost`.)
- **`WebViewController.swift`** hosts the web view full-screen and loads
  `app://board/index.html`.
- The **"Copy Web Assets"** build phase mirrors the repo's web files
  (`index.html`, `*.jsx`, `styles.css`, `vendor/`) from the repo root into the
  app bundle's `web/` folder at build time — so editing the web app is all you
  ever need to do; the next build picks the changes up.
- **`vendor/`** (in the repo root) holds React, ReactDOM, Babel Standalone and the
  Google Fonts locally, so the app launches and runs fully offline. Gist sync to
  `api.github.com` still uses the network when available.

Nothing about the web app's architecture changed: `index.html` was only repointed
from CDN URLs to the local `vendor/` copies, and it still works identically when
served with `python3 -m http.server 8080`.

## Requirements

- **Full Xcode** (not just Command Line Tools). Install it from the App Store, then:
  ```bash
  sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
  ```

## Build & run

Open in Xcode:
```bash
open ios/MyBoard.xcodeproj
```
Pick the **Whiteboard** scheme + a simulator (or your device) and press Run.

Or from the command line (simulator):
```bash
cd ios
xcodebuild -project MyBoard.xcodeproj -scheme Whiteboard \
  -destination 'platform=iOS Simulator,name=iPhone 15' build
```

To run on a physical device or ship to the App Store, set your own
**Signing Team** and a unique **Bundle Identifier** (currently
`com.debasish.whiteboard`) under *Target → Signing & Capabilities*.

## Debugging

Safari can inspect the web view: enable *Safari ▸ Settings ▸ Advanced ▸ Show
features for web developers*, then *Develop ▸ <your device/simulator> ▸ Whiteboard*.
(`WKWebView.isInspectable` is already enabled in `WebViewController.swift`.)
