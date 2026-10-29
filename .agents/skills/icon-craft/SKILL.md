---
name: icon-craft
description: "Mastery of modern iconography, SVG vector geometry, optical alignment, and aesthetic icon styling. Automatically triggers when adding, styling, or auditing icons, glyphs, badges, and telemetry indicators in UI components."
---

# Icon Craft: Elite Iconography & Visual Geometry

## Purpose
Elevate UI components with world-class, award-winning iconography. Eliminate disjointed icon sizes, mismatched stroke weights, unconsidered optical alignment, and amateur emoji clutter. Deliver crisp, harmonious, tactile visual symbols that feel crafted by an elite design director.

---

## Core Invariants & Rules

### 1. Optical Size & Bounding Box Hierarchy
Never use arbitrary icon dimensions. Strictly adhere to standard visual scale:

| Token Size | Icon Size | Container Size | Use Case |
|------------|-----------|----------------|----------|
| `xs` | `w-3 h-3` (12px) | Inline badge / micro tag | Sub-metrics, timestamps, status indicators |
| `sm` | `w-3.5 h-3.5` (14px) | `p-1.5` (24px) | Quick navigation, secondary button actions |
| `md` | `w-4 h-4` (16px) | `p-2` (32px) | Standard UI buttons, menu items, card headers |
| `lg` | `w-5 h-5` (20px) | `p-2.5` (40px) | Main section headers, key telemetry metrics |
| `xl` | `w-6 h-6` (24px) | `p-3` (48px) | Station identity, hero badges, empty states |

- **Optical Centering:** Geometric center does not always equal visual center (e.g. `Play`, `ArrowRight`, `Zap`). Manually adjust margins (`-translate-y-[0.5px]` or `ml-0.5`) when an asymmetric icon feels optically off-center.
- **Always preserve aspect ratio:** Use `shrink-0` on icon containers to prevent flexbox distortion on small mobile screens.

---

### 2. Stroke Weight Harmony
- **Standard UI:** Default to `strokeWidth={1.5}` or `1.75` for technical, modern, high-precision dashboards.
- **Avoid Heavy Clutter:** Never use thick `strokeWidth={2.5}` or `3` alongside delicate text.
- **Consistency Rule:** All icons within the same container, navigation bar, or card row MUST share identical stroke weights.

---

### 3. Tactile Frosted Icon Containers (The "Badge Frame" Formula)
Icons must never float bare and unsupported against dark backgrounds. Frame them with layered, comfortable matte badges:

```jsx
// Elite Frosted Badge Formula
<div className="w-8 h-8 rounded-xl bg-slate-900/60 border border-slate-800/60 flex items-center justify-center text-sky-400 shadow-sm shrink-0 group-hover:border-slate-700/80 transition-colors">
  <Sun className="w-4 h-4" strokeWidth={1.5} />
</div>
```

- **Semantic Color Tinting:**
  - **Solar / Active Energy:** `text-amber-400 bg-amber-500/10 border-amber-500/20`
  - **Battery / Clean Storage:** `text-emerald-400 bg-emerald-500/10 border-emerald-500/20`
  - **Grid / Transmission / Load:** `text-sky-400 bg-sky-500/10 border-sky-500/20`
  - **Alerts / High Temp:** `text-rose-400 bg-rose-500/10 border-rose-500/20`
  - **System / Machine / Specs:** `text-slate-300 bg-slate-800/60 border-slate-700/60`

---

### 4. Emoji vs Vector Discipline
- **Zero Raw OS Emoji in Primary Navigation:** Never use mismatched OS emojis (e.g. 🏠, 🗼, ⚡, 🔋) in production button rows or navigation bars where operating systems render drastically different cartoon styles (Apple 3D vs Android flat vs Windows flat).
- **Vector Icons Win:** Use vectorized Lucide React SVGs (`<Home />`, `<Sun />`, `<Battery />`, `<Zap />`, `<Radio />`) for 100% vector sharpness, dark mode adaptability, and crisp rendering at any pixel density.
- **National Flags Exception:** Country flags (🇹🇭 TH, 🇬🇧 EN) in language pickers are acceptable with explicit `leading-none` and `drop-shadow-sm`.

---

### 5. Semantic Taxonomy for Energy & IoT
Always match the exact icon metaphor to the physical reality:

- **Solar Array Generation:** `Sun` or `Zap`
- **Inverter Unit:** `Cpu` or `Activity`
- **Battery Storage & BMS:** `Battery` or `BatteryCharging`
- **Home / Facility Load:** `Home` or `Building2`
- **Grid / AC Transmission:** `Radio` (telemetry beacon) or `UtilityPole` / `Activity`
- **PEA Electricity Billing:** `FileText` or `Receipt`
- **Efficiency & ROI:** `TrendingUp` or `Leaf`
- **Time-Machine / History:** `Clock` or `Calendar`
- **System Administration:** `ShieldCheck` or `Sliders`

---

### 6. Kinetic Micro-Interactions
Icons should communicate responsiveness without jarring motion:
- **Active / Live Telemetry:** Subtle rhythmic pulse (`animate-pulse`) or slow continuous rotation on rotating equipment (`animate-spin-slow` at 12s+).
- **Interactive Buttons:** Gentle scale-up on container hover: `group-hover:scale-105 transition-transform duration-200`.
- **Status Beacons:** Radial ping ring for live gateways:
  ```jsx
  <span className="relative flex h-2 w-2">
    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
  </span>
  ```

---

### 7. Accessibility
- All purely decorative icons must include `aria-hidden="true"`.
- Standalone icon-only buttons MUST provide an accessible `title`, `aria-label`, or screen-reader text (`<span className="sr-only">Description</span>`).
