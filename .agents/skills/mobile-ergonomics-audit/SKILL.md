---
name: mobile-ergonomics-audit
description: >-
  Audits and enforces mobile-first UX ergonomics, 1-thumb touch controls, and clean layout balance across all viewports.
  Use when designing, refactoring, or verifying mobile views, navigation bars, modals, or responsive UI components.
---

# Mobile-First Ergonomics & Layout Audit Skill

This skill enforces strict mobile-first design principles, thumb-driven ergonomics, and layout harmony for the PowerView IoT Energy platform.

## 1. Single Source of Navigation on Mobile
- **Rule:** On mobile screens (`sm:hidden`), primary navigation and action buttons (Logout, Sync, Settings, Admin Switch) MUST exist ONLY in the Sticky Bottom Navigation Bar.
- **Header Check:** Mobile headers must be minimal (`hidden sm:flex` for desktop-only controls). Never display duplicate Logout or Settings buttons in page headers.
- **Bottom Navigation Bar:**
  - Must use equal-width grid distribution (`grid-cols-4` or `grid-cols-5`).
  - Must include iOS/Android Safe Area padding: `pb-[calc(env(safe-area-inset-bottom,0px)+8px)]`.
  - Must provide active haptic tactile feedback (`active:scale-95`).

## 2. Touch Targets & Ergonomics
- Minimum touch target size is 44×44px for primary interactive elements.
- Primary interaction zones must be reachable within natural thumb radius (bottom 60% of viewport).
- Avoid overcrowding text or placing actionable icons too close to screen edges without padding (`px-3` or `px-4`).

## 3. Modals & Popups: Bottom-Sheet Architecture
- All modals and popups on mobile must follow bottom-sheet styling:
  - Top border radius: `rounded-t-[32px] sm:rounded-3xl`
  - Backdrop: `backdrop-blur-md bg-black/80`
  - Include drag handle or clearly visible close button (`X`)
  - Floating status notifications must use floating toast cards that do not obstruct core instruments.

## 4. Typography & Font Integrity
- Google Font `Prompt` must be preserved across all components.
- Monospace font is reserved strictly for engineering readings (`kWh`, `W`, `V`, `A`, `PF`) and monetary figures.

## Verification Checklist
- [ ] No duplicate action buttons between top header and bottom nav on mobile.
- [ ] Safe Area inset applied to bottom bar.
- [ ] Modals slide up smoothly as bottom sheets or centered cards with backdrop blur.
- [ ] Production build passes with zero JSX/CSS warnings.
