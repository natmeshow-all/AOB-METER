# Antigravity Pair Programming Guidelines & Project Memory

This repository contains the **PowerView Multi-Tenant IoT Energy Intelligence Platform**.
All coding assistants and agents working on this project MUST strictly follow the memory and guidelines defined below and in `PROJECT_MEMORY.md`.

## Core System Invariants & Unbreakable Rules

1. **Authentication & Multi-Tenant Login Gate:**
   - When `currentUser` is `null`, `src/App.jsx` MUST display `<LoginPortal />`.
   - `LoginPortal.jsx` MUST ONLY show clean, enterprise Username/Email and Password fields. NEVER display customer company names, client logos, or 1-click demo login cards on the public login page.
   - NEVER allow 1-click login buttons, URL query auto-login (`?site=...`), or empty password fallbacks on the public login page.
   - Strict password validation is enforced for all accounts (Super Admin and Client users): an invalid or empty password MUST be rejected.
   - Never initialize `currentUser` to a default demo user in `src/context/AuthContext.jsx`. It must initialize to `null` if no valid `AOB_ACTIVE_USER` session exists in `localStorage`.
   - The `logout()` function must purge `localStorage`, `sessionStorage`, call `supabase.auth.signOut()`, and immediately reset `currentUser` to `null`.

2. **Super Admin Designation & Super Admin Console:**
   - Owner/Super Admin email: `natshownolimit@gmail.com` or username `superadmin` (คุณณัฐพงษ์).
   - When Super Admin logs in, they land on `<SuperAdminConsole />` (`activeTab === 'super-admin'`), where they can view all client companies, manage IoT Gateways & meters, onboard new client companies after hardware installation, and create/manage client login credentials (Username & Password) through the professional `<PasswordManagementModal />` (Super Admin Password Vault).
   - Normal tenant users are isolated to their own company and never see the Super Admin Console or other clients' names.

3. **Mobile-First Experience & Clean 3-Menu Electricity Architecture (Primary User Constraint):**
   - The user operates primarily from a mobile smartphone and wants a clean, uncluttered interface focused **100% on Electricity Power Meters** (NO water meters, NO solar clutter, NO wiring/SOP clutter on the client dashboard).
   - Customer Dashboard MUST strictly follow the 3-Menu Mobile-App layout:
     1. **`overview` (1. ภาพรวมมิเตอร์ทั้งหมด):** First screen after login showing company-wide real-time power summary and cards for all electricity meters of that company.
     2. **`meter-detail` (2. เจาะลึกรายมิเตอร์):** Deep dive into a single selected meter (3-Phase Voltage, 3-Phase Current, Active/Apparent/Reactive Power, PF, and 24-hour load curve of that meter).
     3. **`report` (3. รายงาน & ปรับแผนการผลิต):** Daily / Monthly / Yearly electricity report with On-Peak vs Off-Peak breakdown, 4-shift production analysis, and actionable load-shifting recommendations for production planning.
   - Maintain the sticky bottom navigation bar with 1-thumb ergonomics and prominent logout button (`ออก / ออกจากระบบ`).
   - Font must remain Google Font `Prompt` across all components.

4. **PowerShell on Windows:**
   - The active development shell is Windows PowerShell.
   - NEVER use `&&` to chain commands (which throws `The token '&&' is not a valid statement separator`).
   - Always use `;` as statement separator (e.g. `npm run build ; git status`).

5. **SQL & Supabase Scripts:**
   - All SQL scripts provided to the user must be 100% idempotent and self-contained with `IF NOT EXISTS` and `DROP POLICY IF EXISTS`.

6. **SAJ Cloud & Inverter Invariants:**
   - Persistent `sessionTicket` in DB and `localStorage` ensures zero repeated password prompts.
   - Stepped tariff (0–200 units @ 3฿, 201–400 @ 4.22฿, 401+ @ 4.42฿, Export @ 2.20฿) MUST calculate per calendar month, never aggregated into a single lump sum.
   - PEA Electricity Bill calculation MUST include Base Energy + Ft Charge (0.1623฿/kWh ตามบิล ก.ย. 69 - ธ.ค. 69) + Monthly Service Fee (24.62฿) + 7% VAT, providing exact penny-level parity with official PEA invoices and authentic PEA invoice replica view (`<PeaBillModal />`).
   - All modals and popups must strictly follow mobile bottom-sheet architecture (`rounded-t-[32px]`, `backdrop-blur-md`, safe area insets) with floating status toasts for sync notifications.

7. **Single Source of Navigation on Mobile & Enterprise Security Hardening:**
   - On mobile screens, all primary navigation and actions (Sync, Settings, Logout, Admin toggle, Tabs) MUST live exclusively in the Sticky Bottom Navigation Bar (`sm:hidden`).
   - NEVER duplicate Logout or Admin buttons in the top navbar or in-page headers on mobile (`hidden sm:flex` for desktop-only controls).
   - API endpoints (`api/saj-sync.js`) must enforce enterprise security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection`, `Referrer-Policy`) and input size bounds checking.

8. **Superpowers Skill-First Discipline (Strict User Mandate):**
   - Whenever the user issues any task, command, or request, ALWAYS invoke the Superpowers framework (`using-superpowers`) BEFORE any response or action.
   - Follow the Superpowers discipline strictly:
     - Process skills come first: `brainstorming` before new features/plans, `systematic-debugging` before fixing bugs.
     - Announce "Using [skill] to [purpose]" and maintain a checklist/task artifact for multi-step tasks.
     - Follow TDD (`test-driven-development`), plan execution (`executing-plans`), and evidence verification (`verification-before-completion`) before marking complete.
     - Never bypass or rationalize skipping this workflow.

9. **Automatic Contextual Skill Orchestration Pipeline (Zero-Manual-Order Discipline):**
   - The user never needs to manually specify which skill to run first or last. The agent automatically detects the task context and executes skills in the following strict order:
     1. **`grill-me` (Requirements & Architecture Stress-Testing):** Triggers automatically on new feature requests, architecture discussions, or plan proposals. Relentlessly walks the decision tree one question at a time (offering recommended options) and explores the codebase before asking questions.
     2. **`systematic-debugging`:** Triggers automatically on bugs, mismatches, or unexpected errors to find root cause before fixing.
     3. **`frontend-design` (Production UI & Domain Aesthetics):** Triggers automatically when building, structuring, or restyling frontend components, dashboards, and layouts to ensure domain grounding and eliminate generic AI-slop.
     4. **`icon-craft` (Elite Iconography & Visual Geometry):** Triggers automatically when adding, selecting, styling, or auditing icons, glyphs, badges, or telemetry symbols in components, enforcing optical bounding-box balance, stroke-weight harmony (1.5px-2px), duotone frosted badge containers, semantic icon-to-metric pairing, and crisp vector geometry.
     5. **`hyperframes` (Deterministic HTML-to-Video & Motion Graphics):** Triggers automatically when creating animations, video clips, animated explainers, kinetic typography, or frame-by-frame renders using seekable HTML/CSS/GSAP timelines.
     6. **`impeccable` (Post-Task Aesthetic Craft & Novelty Audit):** Triggers automatically upon completion of any UI modification to inspect typography, contrast, 1-thumb touch targets, and visual elegance.

10. **Impeccable Aesthetic Audit & Modern Craft Polish (Post-Task Workflow):**
   - Whenever completing UI/frontend implementation or modification, ALWAYS invoke skill `impeccable` to audit and polish visual craft, elegance, typography, subtle micro-interactions, and fresh modern aesthetics.
   - Balance high-end visual novelty with mobile-first 1-thumb ergonomics, clean hierarchy, and strict avoidance of clutter.
   - Adhere to `reference/craft-floor.md` standards: eliminate bland default styling, elevate contrast, refine spacing, and deliver an award-winning IoT dashboard feel.

See full details in `PROJECT_MEMORY.md`.
