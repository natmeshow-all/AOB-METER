# Agent Guidelines & Memory Reference

Please refer to:
- [PROJECT_MEMORY.md](file:///c:/Users/natsh/Documents/AOB/NEW-AI/PROJECT_MEMORY.md) for full project memory, history of bugs, and prevention rules.
- [GEMINI.md](file:///c:/Users/natsh/Documents/AOB/NEW-AI/GEMINI.md) for active pair programming invariants.

Key Invariants:
1. `natshownolimit@gmail.com` is permanently designated as `SUPER_ADMIN`.
2. Login/Logout must gate on `!currentUser` to show `LoginPortal`.
3. Mobile-first ergonomics with font `IBM Plex Sans Thai` (paired with `IBM Plex Sans` and `JetBrains Mono`) must be preserved.
4. Shell commands on Windows PowerShell must use `;` instead of `&&`.
5. **Superpowers Skill-First Discipline:** Always invoke `using-superpowers` before any response or action for every user task.
6. **Dynamic Workflow Orchestrator (Autonomous Skill Routing by Specialization):**
   - Automatically classify every user request and trigger the dedicated specialist skills in order:
     - **Architecture & New Features:** `brainstorming` ➔ `grill-me` (decision tree interview) ➔ `writing-plans` ➔ `executing-plans`
     - **Bug Fixes & Inconsistencies:** `systematic-debugging` ➔ `test-driven-development` ➔ `verification-before-completion`
     - **Frontend Dashboard & Polish:** `frontend-design` ➔ `mobile-ergonomics-audit` ➔ `impeccable`
     - **Iconography & Badges:** `icon-craft` (Lucide React & Simple Icons)
     - **IoT Energy, BMS & PEA Tariff:** `iot-security-and-tariff-audit`
     - **Video, Animations & Timelines:** `hyperframes`
     - **PWA Mobile & Offline Caching:** `pwa-mobile-offline` ➔ `mobile-ergonomics-audit`
     - **Supabase & Idempotent SQL:** `supabase-sql-guardian` ➔ `verification-before-completion`
     - **Vite Bundle & Performance:** `bundle-performance-optimizer` ➔ `verification-before-completion`
     - **Hardware Modbus & Inverter API:** `iot-modbus-protocol-debugger` ➔ `systematic-debugging`
     - **Web Scraping & Live Web Extraction:** `firecrawl`
     - **Browser Automation & E2E Testing:** `playwright-skill` ➔ `verification-before-completion`
     - **Bilingual i18n & Localization Parity:** `i18n-guardian` ➔ `verification-before-completion`
     - **Post-Task Quality Gate:** Always run `verification-before-completion` and audit with `impeccable` on any UI task.
