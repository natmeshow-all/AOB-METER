---
name: bundle-performance-optimizer
description: "Vite build optimization, JavaScript chunk code-splitting, tree-shaking, lazy-loading heavy charts and modals, and Core Web Vitals acceleration for mobile web apps."
---

# Bundle & Performance Optimizer

## Purpose
Eliminates heavy JavaScript bloat, breaks large monolithic chunks into lean lazy-loaded modules, accelerates initial page paint (< 1.2s on 4G mobile), and resolves Vite bundle warnings (`Some chunks are larger than 500 kB`).

---

## When to Trigger
- Vite build produces warnings about chunk size exceeding 500 kB
- Initial mobile page load feels sluggish or Time to Interactive (TTI) is high
- Adding heavy third-party libraries (Recharts, GSAP, Lucide icons, PDF/Excel generators)
- Analyzing `npm run build` output or configuring `vite.config.js` `manualChunks`
- Implementing `React.lazy()` and `Suspense` for heavy modals and secondary views

---

## Performance Patterns & Solutions

### 1. Vite Manual Chunks Configuration
In `vite.config.js`, configure `rollupOptions.output.manualChunks` to isolate vendor dependencies:
```javascript
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('recharts')) return 'vendor-recharts';
            if (id.includes('lucide-react')) return 'vendor-lucide';
            if (id.includes('@supabase')) return 'vendor-supabase';
            return 'vendor-core';
          }
        }
      }
    },
    chunkSizeWarningLimit: 600
  }
});
```

### 2. Component Lazy-Loading & Code-Splitting
- Defer loading modals, deep-dive reports, and export tools until triggered by user interaction:
  ```javascript
  import React, { Suspense, lazy } from 'react';

  const MonthlySolarPvBarChart = lazy(() => import('./MonthlySolarPvBarChart'));
  const PeaBillModal = lazy(() => import('./PeaBillModal'));
  const PasswordManagementModal = lazy(() => import('./PasswordManagementModal'));
  ```
- Use lightweight shimmer or micro-spinners for fallbacks:
  ```jsx
  <Suspense fallback={<div className="h-48 rounded-2xl bg-white/5 animate-pulse" />}>
    <MonthlySolarPvBarChart />
  </Suspense>
  ```

### 3. Icon Tree-Shaking Discipline
- Avoid barrel imports if a package includes hundreds of icons:
  - Prefer specific named imports: `import { Sun, Battery, Zap } from 'lucide-react';`
  - Ensure bundler tree-shakes unused icons cleanly.

### 4. Re-render Prevention in Real-Time Telemetry
- Prevent high-frequency telemetry updates (every 5-10s) from re-rendering the entire component tree.
- Use `React.memo` on static UI cards and pass memoized selectors.
- Separate volatile real-time metrics (Watt, Ampere, Volt) from stable historical charts.

---

## Verification Checklist
- [ ] `npm run build` completes with 0 chunk size warnings.
- [ ] Main entry bundle (`index-*.js`) is kept under 300 kB gzipped.
- [ ] No layout shifts (CLS < 0.05) when lazy-loaded charts render.
- [ ] Real-time tick updates do not cause lag or dropped animation frames.
