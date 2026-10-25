-- ==============================================================================
-- SUPABASE COMPLETE SCHEMA & ROW LEVEL SECURITY (RLS) FOR MULTI-TENANT ENERGY
-- ระบบฐานข้อมูล Multi-Tenant และความปลอดภัย RLS (รันซ้ำได้ไม่ Error 100%)
-- ==============================================================================

-- 1. เปิดส่วนขยาย UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. สร้างตารางองค์กร / โรงงานลูกค้า (Organizations)
CREATE TABLE IF NOT EXISTS public.organizations (
    id VARCHAR(50) PRIMARY KEY,              -- เช่น 'ORG-AOB', 'ORG-GRAND'
    company_name VARCHAR(255) NOT NULL,      -- เช่น 'บริษัท เอโอเบสต์ จำกัด'
    company_code VARCHAR(50) UNIQUE,         -- เช่น 'AOB', 'GDB'
    logo_url TEXT,
    transformer_capacity_kva INT DEFAULT 1600,
    electricity_rate_kwh NUMERIC(5,2) DEFAULT 4.20,
    water_rate_m3 NUMERIC(5,2) DEFAULT 18.50,
    line_notify_token TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. สร้างตารางโปรไฟล์ผู้ใช้ (Profiles เชื่อมโยงกับ auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id VARCHAR(50) REFERENCES public.organizations(id) ON DELETE SET NULL,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'VIEWER', 
    phone_number VARCHAR(50),
    line_user_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. สร้างตารางมิเตอร์ประจำโรงงาน (Meters)
CREATE TABLE IF NOT EXISTS public.meters (
    id VARCHAR(50) PRIMARY KEY,
    org_id VARCHAR(50) NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    meter_type VARCHAR(20) NOT NULL,         -- 'ELECTRICITY' หรือ 'WATER'
    meter_code VARCHAR(50) NOT NULL,         -- เช่น 'MDB1-Q1-1', 'WATER-MAIN'
    meter_name VARCHAR(255) NOT NULL,        -- เช่น 'MMC-PRO-1 (Frozen Line)'
    panel VARCHAR(50),                       -- เช่น 'C2-2', 'C3-2', 'C4-2'
    tag VARCHAR(50),                         -- เช่น 'Q1-1'
    modbus_slave_id INT,
    gateway_port VARCHAR(50),
    unit VARCHAR(20) DEFAULT 'kWh',
    screen_unit VARCHAR(20) DEFAULT 'GWh',
    model VARCHAR(100) DEFAULT 'Schneider EasyLogic PM2200',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. สร้างตารางบันทึกค่ามิเตอร์ (Meter Readings)
CREATE TABLE IF NOT EXISTS public.meter_readings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id VARCHAR(50) NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    meter_id VARCHAR(50) NOT NULL REFERENCES public.meters(id) ON DELETE CASCADE,
    reading_date DATE NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    raw_reading_text VARCHAR(100),
    reading_value NUMERIC(14,2) NOT NULL,
    daily_usage NUMERIC(14,2),
    active_power_kw NUMERIC(10,2),
    voltage_ll NUMERIC(8,2),
    current_avg NUMERIC(8,2),
    power_factor NUMERIC(4,2),
    recorded_by VARCHAR(100),
    image_url TEXT,
    is_verified BOOLEAN DEFAULT TRUE
);

-- 6. เปิดใช้งานระบบ Row Level Security (RLS)
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meter_readings ENABLE ROW LEVEL SECURITY;

-- 7. Helper Functions
CREATE OR REPLACE FUNCTION public.get_auth_org_id() 
RETURNS VARCHAR AS $$
    SELECT org_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_super_admin() 
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'SUPER_ADMIN'
    );
$$ LANGUAGE sql SECURITY DEFINER;

-- 8. ลบ Policies เดิมออกก่อนเพื่อป้องกัน Error "policy already exists"
DROP POLICY IF EXISTS "Super admins can see all organizations" ON public.organizations;
DROP POLICY IF EXISTS "Users can view their own organization" ON public.organizations;

DROP POLICY IF EXISTS "Super admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view and update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Plant managers can view team members in same organization" ON public.profiles;

DROP POLICY IF EXISTS "Super admins can manage all meters" ON public.meters;
DROP POLICY IF EXISTS "Users can only view meters belonging to their organization" ON public.meters;

DROP POLICY IF EXISTS "Super admins can manage all meter readings" ON public.meter_readings;
DROP POLICY IF EXISTS "Users can only view and add readings for their own organization" ON public.meter_readings;

-- 9. สร้าง Policies ใหม่ที่สมบูรณ์
-- 9.1 Organizations
CREATE POLICY "Super admins can see all organizations" 
ON public.organizations FOR ALL 
USING (public.is_super_admin());

CREATE POLICY "Users can view their own organization" 
ON public.organizations FOR SELECT 
USING (id = public.get_auth_org_id());

-- 9.2 Profiles
CREATE POLICY "Super admins can manage all profiles" 
ON public.profiles FOR ALL 
USING (public.is_super_admin());

CREATE POLICY "Users can view and update their own profile" 
ON public.profiles FOR ALL 
USING (id = auth.uid());

CREATE POLICY "Plant managers can view team members in same organization" 
ON public.profiles FOR SELECT 
USING (org_id = public.get_auth_org_id());

-- 9.3 Meters
CREATE POLICY "Super admins can manage all meters" 
ON public.meters FOR ALL 
USING (public.is_super_admin());

CREATE POLICY "Users can only view meters belonging to their organization" 
ON public.meters FOR SELECT 
USING (org_id = public.get_auth_org_id());

-- 9.4 Meter Readings
CREATE POLICY "Super admins can manage all meter readings" 
ON public.meter_readings FOR ALL 
USING (public.is_super_admin());

CREATE POLICY "Users can only view and add readings for their own organization" 
ON public.meter_readings FOR ALL 
USING (org_id = public.get_auth_org_id())
WITH CHECK (org_id = public.get_auth_org_id());

-- 10. ข้อมูลเริ่มต้น (Seed Data)
INSERT INTO public.organizations (id, company_name, company_code, transformer_capacity_kva, electricity_rate_kwh)
VALUES 
    ('ORG-AOB', 'ART OF BAKING CO., LTD.', 'AOB', 1600, 4.20),
    ('ORG-GRAND', 'GRAND BAKERY INDUSTRIAL CO., LTD.', 'GDB', 2000, 4.25)
ON CONFLICT (id) DO UPDATE 
SET company_name = EXCLUDED.company_name;

INSERT INTO public.meters (id, org_id, meter_type, meter_code, meter_name, panel, tag, modbus_slave_id)
VALUES 
    ('AOB-MDB1-Q1-1', 'ORG-AOB', 'ELECTRICITY', 'MDB1-Q1-1', 'MMC-PRO-1 (Frozen Line)', 'C2-2', 'Q1-1', 1),
    ('AOB-MDB1-Q1-2', 'ORG-AOB', 'ELECTRICITY', 'MDB1-Q1-2', 'MMC-PRO-2 (RTE Line)', 'C3-2', 'Q1-2', 2),
    ('AOB-MDB1-Q1-3', 'ORG-AOB', 'ELECTRICITY', 'MDB1-Q1-3', 'MCC-ACP (Air compressor)', 'C4-2', 'Q1-3', 3),
    ('AOB-WATER-MAIN', 'ORG-AOB', 'WATER', 'WATER-MAIN', 'มิเตอร์น้ำหลัก หน้าโรงงาน', 'MAIN', 'WATER', NULL)
ON CONFLICT (id) DO NOTHING;
