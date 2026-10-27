---
name: iot-security-and-tariff-audit
description: >-
  Audits multi-tenant authentication security, token isolation, and exact PEA electricity bill calculation parity.
  Use when modifying login portals, authentication contexts, API endpoints, or electricity calculation algorithms.
---

# IoT Security & PEA Tariff Verification Skill

This skill enforces strict multi-tenant security boundaries, zero-bypass authentication, and penny-perfect PEA electricity invoice calculations.

## 1. Authentication Security Invariants
- **Zero 1-Click Bypass:** NEVER allow 1-click demo login buttons, auto-login URL query parameters (`?site=...`), or empty password fallbacks on `LoginPortal.jsx`.
- **Strict Password Verification:** All user accounts (Super Admin and Client Users) MUST supply their verified password. An empty or invalid password must be rejected immediately.
- **Tenant Isolation:**
  - `currentUser` must initialize to `null` if no valid `AOB_ACTIVE_USER` session exists in `localStorage`.
  - Super Admin (`natshownolimit@gmail.com` / `superadmin`) has exclusive access to `SuperAdminConsole`.
  - Client users are isolated to their own organization via Supabase RLS.
- **API Security Headers (`api/saj-sync.js`):**
  - Enforce `X-Content-Type-Options: nosniff`
  - Enforce `X-Frame-Options: DENY`
  - Enforce `X-XSS-Protection: 1; mode=block`
  - Input size bounds checking on all incoming JSON payloads.

## 2. Official PEA Electricity Calculation Rules
- **Monthly Tier Separation:** Electricity tariffs MUST calculate per calendar month, never aggregated into a single lump sum across multiple months.
- **Official Tariff Rates (ก.ย. 69 - ธ.ค. 69):**
  - Base Tier 1 (1–200 kWh): `3.0000 ฿/kWh`
  - Base Tier 2 (201–400 kWh): `4.2200 ฿/kWh`
  - Base Tier 3 (401+ kWh): `4.4200 ฿/kWh`
  - PEA Ft Rate: `0.1623 ฿/kWh`
  - Monthly Service Charge: `24.62 ฿/month`
  - Value Added Tax: `7.00%`
- **Calculation Formula (`calcFullPeaBill`):**
  1. `Base Energy` = Sum of tiered consumption units × tier rate
  2. `Total Base Amount` = Base Energy + Service Charge (24.62 ฿)
  3. `Ft Charge` = Total Units × 0.1623 ฿
  4. `Subtotal` = Total Base Amount + Ft Charge
  5. `VAT` = Subtotal × 0.07
  6. `Grand Total` = Subtotal + VAT (exact to 0.01 ฿)

## Verification Checklist
- [ ] `LoginPortal.jsx` has NO hardcoded demo buttons or auto-login URL parameters.
- [ ] Inverter settings never auto-popup on mount.
- [ ] 195.00 units calculation yields exactly ฿686.16 total.
- [ ] `npm run build` succeeds with zero errors.
