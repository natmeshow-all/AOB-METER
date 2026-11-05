---
name: supabase-sql-guardian
description: "Idempotent SQL migration authoring, Supabase Row-Level Security (RLS) enforcement, multi-tenant credential isolation, and high-frequency IoT telemetry query index optimization."
---

# Supabase & SQL Architecture Guardian

## Purpose
Guarantees 100% idempotent, bulletproof database migrations, strict multi-tenant Row Level Security (RLS), and sub-second query performance for millions of IoT telemetry points across all client organizations.

---

## When to Trigger
- Writing, modifying, or reviewing SQL schema migrations for Supabase / PostgreSQL
- Creating or editing tables (`organizations`, `meters`, `inverter_telemetry`, `historicalDailyLogs`, `user_accounts`)
- Writing or auditing Row Level Security (RLS) policies for tenant data isolation
- Adding indexes for time-series date filters, inverter serial numbers, or organization IDs
- Handling Supabase Auth, JWT claims, service role bypass prevention, or RPC database functions

---

## Core Invariants & Rules

### 1. 100% Idempotent SQL Migrations
Every SQL script MUST be safe to run multiple times without throwing errors:
```sql
-- Safe Table Creation
CREATE TABLE IF NOT EXISTS public.meters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  serial_number TEXT UNIQUE NOT NULL,
  meter_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Safe Column Addition
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='meters' AND column_name='rated_capacity_kw'
  ) THEN
    ALTER TABLE public.meters ADD COLUMN rated_capacity_kw NUMERIC DEFAULT 0;
  END IF;
END $$;
```

### 2. Multi-Tenant Row Level Security (RLS) Isolation
- All client tables MUST enable RLS:
  ```sql
  ALTER TABLE public.historical_daily_logs ENABLE ROW LEVEL SECURITY;
  ```
- Always drop existing policy before recreating to avoid duplicate policy errors:
  ```sql
  DROP POLICY IF EXISTS "Tenant Isolation for Daily Logs" ON public.historical_daily_logs;

  CREATE POLICY "Tenant Isolation for Daily Logs" ON public.historical_daily_logs
    FOR ALL
    USING (
      organization_id = (SELECT organization_id FROM public.users WHERE id = auth.uid())
      OR
      (SELECT is_super_admin FROM public.users WHERE id = auth.uid()) = TRUE
    );
  ```
- Super Admin (`natshownolimit@gmail.com` or `is_super_admin = true`) has global oversight; regular tenant users are strictly scoped to their own `organization_id`.

### 3. High-Frequency IoT Index Optimization
- For telemetry tables queried by date ranges and serial numbers:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_telemetry_serial_timestamp 
    ON public.inverter_telemetry (serial_number, recorded_at DESC);

  CREATE INDEX IF NOT EXISTS idx_daily_logs_org_date 
    ON public.historical_daily_logs (organization_id, log_date DESC);
  ```

---

## Verification Checklist
- [ ] Script runs without errors on both fresh databases and existing databases.
- [ ] `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` is present on all tenant data tables.
- [ ] No plaintext passwords or credentials stored; auth tokens and hashed passwords only.
- [ ] Indexes exist on foreign keys (`organization_id`, `meter_id`) and timestamp columns.
- [ ] All timestamps use `TIMESTAMPTZ` with timezone awareness (BKK UTC+7).
