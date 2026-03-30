---
name: webxr-pwa-quest
description: PWA manifest for Meta Quest Browser, service worker, installability requirements, Quest-specific manifest extensions (ovr_*), Bubblewrap TWA packaging for Horizon Store. Use when building installable WebXR PWAs for Quest or packaging for the Horizon Store.
---

# WebXR PWA for Meta Quest

## Quick Start

```json
// manifest.json — minimum viable Quest PWA
{
  "name": "My XR Experience",
  "short_name": "My XR",
  "description": "A WebXR experience for Meta Quest",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#000000",
  "theme_color": "#000000",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ],
  "ovr_package_name": "com.example.myxrapp"
}
```

```html
<!-- index.html -->
<link rel="manifest" href="/manifest.json">
<meta name="mobile-web-app-capable" content="yes">
<meta name="theme-color" content="#000000">
```

```js
// service-worker.js — register in main JS
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
```

## Manifest Fields

### Required for Quest PWA Installability

| Field | Requirement | Notes |
|-------|-------------|-------|
| `name` | Required | LTR language only (no RTL) |
| `display` | `"standalone"` or `"minimal-ui"` | `"fullscreen"` NOT supported on Quest |
| `icons` | Min 192×192 | PNG or WebP |

### Optional (but Recommended)

| Field | Default | Notes |
|-------|---------|-------|
| `start_url` | Current page | Optional on Quest; required in Chrome |
| `short_name` | — | Used in Horizon app library |
| `description` | — | Shown on Horizon Store |
| `background_color` | `#000000` | Splash screen |
| `theme_color` | — | System UI accent |
| `orientation` | — | `"landscape"` or `"portrait"` |
| `lang` | — | BCP 47 language tag |

### Quest-Specific Manifest Extensions (`ovr_*`)

These are Meta proprietary fields — ignored by other browsers.

```json
{
  "ovr_package_name": "in.walkinto.vr",
  "ovr_multi_tab_enabled": true,
  "ovr_scope_extensions": [
    { "origin": "https://cdn.walkinto.in" }
  ]
}
```

| Field | Type | Purpose |
|-------|------|---------|
| `ovr_package_name` | string (reverse-domain) | Stable identity for Horizon Store TWA. Format: `in.walkinto.vr`. Required for store packaging; optional for browser-only install. |
| `ovr_multi_tab_enabled` | boolean | Allow multiple tabs of the app in the Horizon browser. Default `false`. |
| `ovr_scope_extensions` | array of `{origin}` | Extend the PWA scope to additional origins (e.g. CDN). |

### Launching Directly into Immersive Mode

For a PWA that should enter XR immediately on launch (not show a 2D UI first):

```js
// Call requestSession immediately after DOMContentLoaded — no button required
// This works because PWA launch from Horizon counts as a user gesture
window.addEventListener('DOMContentLoaded', () => {
  if (navigator.xr) {
    navigator.xr.requestSession('immersive-vr', {
      requiredFeatures: ['local-floor'],
    }).then(onSessionStarted);
  }
});
```

```json
// manifest.json — indicate XR capability to the browser
{
  "display": "standalone",
  "xr_compatible": true
}
```

## Service Worker

Minimal service worker for offline XR asset caching:

```js
// sw.js
const CACHE_NAME = 'xr-app-v1';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/app.js',
  '/assets/scene.glb',
  '/assets/environment.hdr',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
```

## Quest Browser PWA Differences from Chrome

| Behaviour | Chrome | Quest Browser |
|-----------|--------|---------------|
| `start_url` | Required | Optional |
| `display: fullscreen` | Supported | NOT supported — use `standalone` |
| `display: standalone` | Supported | Supported (recommended) |
| Install prompt | `beforeinstallprompt` event | Triggered by long-press → "Add to Library" |
| RTL `name`/`short_name` | Supported | NOT supported |
| Splash screen | Generated from manifest | Shown during app load |

## Horizon Store Distribution (Bubblewrap TWA)

To distribute as a native-feeling app via Meta Horizon Store, package the PWA as a TWA (Trusted Web Activity):

```bash
# Install meta-quest/bubblewrap
npm install -g @meta-quest/bubblewrap

# Init from manifest URL
bubblewrap init --manifest https://yourdomain.com/manifest.json

# Build APK
bubblewrap build

# Output: app-release-signed.apk → submit to Horizon Store
```

**Requirements for TWA validation:**
1. `ovr_package_name` in manifest must match the TWA package name
2. Digital Asset Links file at `/.well-known/assetlinks.json`:
```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "in.walkinto.vr",
    "sha256_cert_fingerprints": ["AA:BB:CC:..."]
  }
}]
```
3. Site must be served over HTTPS with a valid certificate

**Distribution paths:**

| Path | Method | Notes |
|------|--------|-------|
| Browser install | User adds via Quest Browser "Add to Library" | No store approval needed |
| Sideload | ADB install APK | Dev/test only |
| Horizon Store | Bubblewrap APK → store submission | Full distribution |

## Quest-Specific Gotchas

**`display: fullscreen` breaks installability.** Quest Browser does not support `fullscreen` display mode for PWA installation. Always use `"standalone"`.

**`ovr_package_name` format.** Must be reverse-domain notation: `com.company.appname` or `in.walkinto.vr`. Inconsistent naming between manifest and Bubblewrap config causes TWA validation to fail.

**HTTPS is mandatory.** WebXR and service workers both require a secure context. Use a real certificate (not self-signed) in production; mkcert for local dev.

**PWA launch from Horizon Home counts as a user gesture.** When a user opens your PWA from the Quest home library, the initial page load is treated as a user interaction, allowing `requestSession` to be called without an explicit button click.

**Large GLB/HDR assets.** Pre-cache key XR assets in the service worker. Quest has limited storage; keep total cache under ~500 MB. Use Draco compression for GLB files.

## See Also

- `webxr-session` — `requestSession` from PWA launch
- `webxr-rendering` — renderer setup for immersive-vr/ar
