-- ============================================================================
-- PowerView: 24/7 Home Solar Inverter Historical & Realtime Database Schema
-- 100% Idempotent (Safe to run multiple times in Supabase SQL Editor)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.solar_history_logs (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  recorded_date DATE NOT NULL,
  device_sn TEXT DEFAULT 'SAJ-H2-6K-LS2',
  pv_generation_kwh NUMERIC(12, 2) DEFAULT 0,
  load_electricity_kwh NUMERIC(12, 2) DEFAULT 0,
  import_kwh NUMERIC(12, 2) DEFAULT 0,
  export_kwh NUMERIC(12, 2) DEFAULT 0,
  charge_battery_kwh NUMERIC(12, 2) DEFAULT 0,
  discharge_battery_kwh NUMERIC(12, 2) DEFAULT 0,
  peak_pv_power_w NUMERIC(12, 1) DEFAULT 0,
  saved_baht NUMERIC(12, 2) DEFAULT 0,
  hourly_curve_json JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_solar_history_org_date
  ON public.solar_history_logs (org_id, recorded_date DESC);

ALTER TABLE public.solar_history_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read solar_history_logs for authenticated and anon" ON public.solar_history_logs;
CREATE POLICY "Allow read solar_history_logs for authenticated and anon"
  ON public.solar_history_logs
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow upsert solar_history_logs for collector" ON public.solar_history_logs;
CREATE POLICY "Allow upsert solar_history_logs for collector"
  ON public.solar_history_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);
