# Antigravity Pair Programming Guidelines & Project Memory

This repository contains the **PowerView Multi-Tenant IoT Energy Intelligence Platform**.
All coding assistants and agents working on this project MUST strictly follow the memory and guidelines defined below and in `PROJECT_MEMORY.md`.

## Core System Invariants & Unbreakable Rules

1. **Authentication & Multi-Tenant Login Gate:**
   - When `currentUser` is `null`, `src/App.jsx` MUST display `<LoginPortal />`.
   - Never initialize `currentUser` to a default demo user in `src/context/AuthContext.jsx`. It must initialize to `null` if no valid `AOB_ACTIVE_USER` session exists in `localStorage`.
   - The `logout()` function must purge `localStorage`, `sessionStorage`, call `supabase.auth.signOut()`, and immediately reset `currentUser` to `null`.

2. **Super Admin Designation:**
   - Owner/Super Admin email: `natshownolimit@gmail.com` (คุณณัฐพงษ์).
   - In frontend code (`AuthContext.jsx`), ALWAYS ensure `natshownolimit@gmail.com` is granted `role: 'SUPER_ADMIN'`.
   - Super Admin has full multi-tenant switcher capability across all factories (`ORG-AOB`, `ORG-GRAND`, `ORG-SIAMCOLD`).
   - Normal tenant users are isolated to their own company by Supabase RLS and cannot view other tenants' meters.

3. **Mobile-First Experience (Primary User Constraint):**
   - The user operates primarily from a mobile smartphone.
   - Maintain the sticky bottom navigation bar with 1-thumb ergonomics.
   - Ensure the mobile logout button (`🚪 ออกจากระบบ`) is prominently visible and accessible.
   - Font must remain Google Font `Prompt` across all components.

4. **PowerShell on Windows:**
   - The active development shell is Windows PowerShell.
   - NEVER use `&&` to chain commands (which throws `The token '&&' is not a valid statement separator`).
   - Always use `;` as statement separator (e.g. `npm run build ; git status`).

5. **SQL & Supabase Scripts:**
   - All SQL scripts provided to the user must be 100% idempotent and self-contained with `IF NOT EXISTS` and `DROP POLICY IF EXISTS`.

See full details in `PROJECT_MEMORY.md`.
