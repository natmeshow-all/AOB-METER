---
name: pwa-mobile-offline
description: "Progressive Web App (PWA) architecture, mobile home-screen installability, offline telemetry caching, and Service Worker lifecycle management for mobile-first IoT dashboards."
---

# PWA Mobile & Offline Telemetry Guardian

## Purpose
Ensures the PowerView IoT Energy platform operates seamlessly as an installable, mobile-first Progressive Web App (PWA). Provides offline telemetry viewing, Service Worker lifecycle handling, smart background sync, and native-feeling 1-thumb touch ergonomics when installed on iOS and Android home screens.

---

## When to Trigger
- Adding or modifying Web App Manifest (`manifest.json` or `manifest.webmanifest`), icons, or splash screens
- Implementing, debugging, or updating Service Workers (`sw.js` or Workbox / Vite PWA plugin)
- Adding offline data caching (IndexedDB, LocalStorage, CacheStorage) for solar & battery telemetry
- Handling network disconnects, offline indicator toasts, and automatic telemetry re-sync on reconnection
- Enhancing mobile standalone experience (status bar theme-color, safe-area-inset, pull-to-refresh prevention)

---

## Architecture Standards & Invariants

### 1. Web App Manifest Spec
```json
{
  "name": "PowerView Energy Intelligence",
  "short_name": "PowerView",
  "description": "ระบบติดตามพลังงานโซลาร์และแบตเตอรี่อัจฉริยะ",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0f1d",
  "theme_color": "#0a0f1d",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

### 2. Cache Strategy for IoT Telemetry
- **Static Assets (HTML/JS/CSS/Fonts):** `Stale-While-Revalidate` or `Cache-First` with version hashing.
- **Real-Time Telemetry API:** `Network-First` with fallback to last cached 24h telemetry snapshot.
  - Never show a blank screen or broken UI when network drops.
  - When offline, display subtle top toast: `📡 ออฟไลน์ — กำลังแสดงข้อมูลล่าสุดที่บันทึกไว้`.
  - When connection restores, trigger background silent re-sync and update with toast: `⚡ เชื่อมต่อแล้ว — อัปเดตข้อมูลล่าสุดเรียบร้อย`.

### 3. iOS & Android Standalone Polish
- Include Apple Mobile Web App tags in `index.html`:
  ```html
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="PowerView" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
  ```
- Always respect `env(safe-area-inset-bottom)` and `env(safe-area-inset-top)` in navigation bars and bottom sheets.
- Prevent unwanted double-tap zoom and elastic pull-to-refresh conflicts:
  ```css
  html, body {
    overscroll-behavior-y: none;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
  }
  ```

---

## Verification Checklist
- [ ] Manifest file is valid JSON and referenced with `<link rel="manifest" href="...">`.
- [ ] Icons of sizes 192x192 and 512x512 exist and pass maskable testing.
- [ ] Service Worker registers successfully without blocking initial page paint.
- [ ] Network tab in DevTools simulated as "Offline" allows viewing recent 24h solar graphs without crashes.
- [ ] Bottom navigation bar respects device home indicators on iOS and Android.
