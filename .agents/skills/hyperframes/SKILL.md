---
name: hyperframes
description: "Author, animate, preview, and render deterministic HTML/CSS/GSAP videos, motion graphics, animated explainer clips, kinetic typography, and transitions. Use when the user requests video creation, animation workflows, motion graphics, or video rendering from code."
---

# HyperFrames: Agent-Native HTML-to-Video & Motion Framework

## Purpose
Author deterministic, broadcast-quality motion graphics and video compositions using web standards (HTML5, CSS3, JavaScript, GSAP timelines, Canvas, SVG). Videos are rendered frame-by-frame via headless Chromium and FFmpeg to guarantee frame-accurate, identical output every run.

## Core Architecture & Workflow

1. **Deterministic Timeline Structure:**
   - Define scenes and composition timings using explicit duration and step counters rather than wall-clock `setInterval` or `requestAnimationFrame`.
   - Use GSAP (`TimelineMax` / `gsap.timeline({ paused: true })`) to orchestrate all entrances, movements, rotations, scales, and exits.
   - Any animation must be seekable via `timeline.seek(timeInSeconds)`.

2. **DOM Video Composition:**
   - Composition container: standard 16:9 (`1920x1080` or `1280x720`) or 9:16 mobile reel (`1080x1920`) with fixed pixel bounds.
   - Use absolute coordinate positioning, hardware-accelerated CSS transforms (`translate3d`, `scale`, `rotate`), and SVG graphics for razor-sharp rendering at any resolution.
   - Layer audio tracks, sound effects, or speech narration with millisecond time stamps.

3. **Motion Design Standards:**
   - Kinetic Typography: staggered text reveals, character-level split animations, smooth cubic-bezier easing (`power3.out`, `expo.out`).
   - Visual Data Transitions: animated graphs, pulsing energy indicators, counter ticks, telemetry dials.
   - Transitions: seamless camera pans, slide wipes, layered masks, and cinematic depth blurs.

4. **Rendering & Validation:**
   - Preview compositions in browser artifacts or local live previews.
   - Render to deterministic MP4 clips using `npx hyperframes render` or headless capture scripts.
   - Verify zero dropped frames, complete audio-visual sync, and visual contrast compliance.
