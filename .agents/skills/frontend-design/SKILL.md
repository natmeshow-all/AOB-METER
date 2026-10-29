---
name: frontend-design
description: "Design distinctive, production-ready frontend interfaces, dashboards, components, and pages with a committed aesthetic point of view. Use when building or styling web UI components, layouts, or redesigning visual elements to avoid generic AI-slop."
---

# Frontend Design: High-Craft Production UI

## Purpose
Produce distinctive, high-end, production-grade frontend interfaces that feel hand-crafted by an award-winning design director. Defeat generic "AI slop" (cliché centered cards, gratuitous purple/neon gradients, bland system fonts, and unconsidered spacing).

## Core Principles

1. **Ground in the Subject Domain:**
   - Anchor the design directly in the real-world domain (e.g. for IoT Energy: technical precision, dark tactile glass, calibrated data density, real electrical units, engineering accents).
   - Draw visual motifs, badges, and status cues from genuine hardware or domain instruments.

2. **Token System First:**
   - Define a tight palette: 1 background base, 1 elevated card surface, 1 high-contrast text color, 1-2 intentional accent colors with semantic meaning.
   - Set typographic roles: display, headings, body, and tabular monospace data (`font-mono`) with distinct visual weight and letter-spacing (`tracking-tight`).

3. **Anti-Cliché Elimination:**
   - Reject arbitrary full-screen gradients and template SaaS cards.
   - Replace generic buttons with intentional, tactile action pills with explicit active/hover states.
   - Use subtle borders (`border-slate-800/80`), layered backdrop blur (`backdrop-blur-md`), and precise inner borders rather than heavy drop-shadows.

4. **1-Thumb Mobile Ergonomics & Responsiveness:**
   - Every interface must be fluid and rock-solid from 360px mobile viewports up to 4K ultra-wide monitors.
   - Primary interactions on mobile must sit within the 1-thumb reach zone at the bottom of the screen.

5. **State Completeness:**
   - Always design the full lifecycle: loading skeletons, empty states with clear calls-to-action, active interactions, error fallbacks, and micro-toasts.
