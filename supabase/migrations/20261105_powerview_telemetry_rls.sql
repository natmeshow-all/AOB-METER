-- ==============================================================================
-- POWERVIEW IOT PLATFORM: IDEMPOTENT SQL MIGRATION & RLS GUARDIAN
-- File: supabase/migrations/20261105_powerview_telemetry_rls.sql
-- Description: 100% Idempotent schema, High-Frequency Telemetry Indexes & RLS Security
-- ==============================================================================

-- 1. UUID & Core Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Organizations Table (Tenants & Solar Home Sites)
CREATE TABLE IF NOT EXISTS public.organizations (
    id VARCHAR(50) PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    company_code VARCHAR(50) UNIQUE,
    logo_url TEXT,
    site_type VARCHAR(50) DEFAULT 'INDUSTRIAL', -- 'INDUSTRIAL' | 'HOME_SOLAR'
    transformer_capacity_kva INT DEFAULT 1600,
    electricity_rate_kwh NUMERIC(5,2) DEFAULT 4.20,
    water_rate_m3 NUMERIC(5,2) DEFAULT 18.50,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure site_type column exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='organizations' AND column_name='site_type'
    ) THEN
        ALTER TABLE public.organizations ADD COLUMN site_type VARCHAR(50) DEFAULT 'INDUSTRIAL';
    END IF;
END $$;

-- 3. Inverter & Meters Table
CREATE TABLE IF NOT EXISTS public.meters (
    id VARCHAR(50) PRIMARY KEY,
    org_id VARCHAR(50) NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    meter_type VARCHAR(20) NOT NULL DEFAULT 'ELECTRICITY', -- 'ELECTRICITY' | 'SOLAR_INVERTER'
    meter_code VARCHAR(50) NOT NULL,
    meter_name VARCHAR(255) NOT NULL,
    serial_number VARCHAR(100),
    rated_capacity_kw NUMERIC(10,2) DEFAULT 0,
    modbus_slave_id INT,
    gateway_port VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. High-Frequency Real-Time Telemetry Table (Inverter & Power Meter Samples)
CREATE TABLE IF NOT EXISTS public.inverter_telemetry (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id VARCHAR(50) NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    serial_number VARCHAR(100) NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    pv_power_w NUMERIC(10,2) DEFAULT 0,
    pv1_volt NUMERIC(8,2) DEFAULT 0,
    pv1_curr NUMERIC(8,2) DEFAULT 0,
    pv2_volt NUMERIC(8,2) DEFAULT 0,
    pv2_curr NUMERIC(8,2) DEFAULT 0,
    load_power_w NUMERIC(10,2) DEFAULT 0,
    grid_power_w NUMERIC(10,2) DEFAULT 0,
    battery_power_w NUMERIC(10,2) DEFAULT 0,
    battery_soc INT DEFAULT 0,
    inverter_temp_c NUMERIC(6,2) DEFAULT 0,
    battery_temp_c NUMERIC(6,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Historical Daily Solar & Energy Logs Table
CREATE TABLE IF NOT EXISTS public.historical_daily_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id VARCHAR(50) NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    serial_number VARCHAR(100),
    log_date DATE NOT NULL,
    total_pv_kwh NUMERIC(10,2) DEFAULT 0,
    total_load_kwh NUMERIC(10,2) DEFAULT 0,
    grid_import_kwh NUMERIC(10,2) DEFAULT 0,
    grid_export_kwh NUMERIC(10,2) DEFAULT 0,
    battery_charge_kwh NUMERIC(10,2) DEFAULT 0,
    battery_discharge_kwh NUMERIC(10,2) DEFAULT 0,
    estimated_saving_thb NUMERIC(10,2) DEFAULT 0,
    raw_telemetry JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_org_date_serial UNIQUE (org_id, log_date, serial_number)
);

-- 6. Performance Indexes for Sub-Second Analytics
CREATE INDEX IF NOT EXISTS idx_telemetry_sn_timestamp 
    ON public.inverter_telemetry (serial_number, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_telemetry_org_time 
    ON public.inverter_telemetry (org_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_daily_logs_org_date 
    ON public.historical_daily_logs (org_id, log_date DESC);

CREATE INDEX IF NOT EXISTS idx_meters_org 
    ON public.meters (org_id);

-- 7. Row Level Security (RLS) Activation
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inverter_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historical_daily_logs ENABLE ROW LEVEL SECURITY;

-- 8. Idempotent RLS Policies (Super Admin All-Access + Tenant Isolation)

-- Organizations RLS
DROP POLICY IF EXISTS "Tenant view own organization" ON public.organizations;
CREATE POLICY "Tenant view own organization" ON public.organizations
    FOR SELECT
    USING (
        id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
        OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'
        OR auth.email() = 'natshownolimit@gmail.com'
    );

-- Meters RLS
DROP POLICY IF EXISTS "Tenant view own meters" ON public.meters;
CREATE POLICY "Tenant view own meters" ON public.meters
    FOR SELECT
    USING (
        org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
        OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'
        OR auth.email() = 'natshownolimit@gmail.com'
    );

-- Inverter Telemetry RLS
DROP POLICY IF EXISTS "Tenant view own telemetry" ON public.inverter_telemetry;
CREATE POLICY "Tenant view own telemetry" ON public.inverter_telemetry
    FOR SELECT
    USING (
        org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
        OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'
        OR auth.email() = 'natshownolimit@gmail.com'
    );

-- Daily Logs RLS
DROP POLICY IF EXISTS "Tenant view own daily logs" ON public.historical_daily_logs;
CREATE POLICY "Tenant view own daily logs" ON public.historical_daily_logs
    FOR SELECT
    USING (
        org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
        OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'
        OR auth.email() = 'natshownolimit@gmail.com'
    );

-- Service Role full access for background telemetry ingestion
DROP POLICY IF EXISTS "Service role full access on telemetry" ON public.inverter_telemetry;
CREATE POLICY "Service role full access on telemetry" ON public.inverter_telemetry
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');
