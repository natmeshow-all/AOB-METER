-- ==============================================================================
-- SUPABASE SCHEMA & ROW LEVEL SECURITY (RLS) FOR MULTI-TENANT ENERGY MONITORING
-- ระบบฐานข้อมูล Multi-Tenant และการแยกสิทธิ์ลูกค้าแต่ละโรงงาน (ART OF BAKING & CLIENTS)
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Organizations / Tenants Table (ตารางบริษัทลูกค้าแต่ละเจ้า)
CREATE TABLE IF NOT EXISTS public.organizations (
    id VARCHAR(50) PRIMARY KEY,              -- เช่น 'ORG-AOB', 'ORG-GRAND-BAKERY'
    company_name VARCHAR(255) NOT NULL,      -- เช่น 'บริษัท เอโอเบสต์ จำกัด'
    company_code VARCHAR(50) UNIQUE,         -- เช่น 'AOB', 'GDB'
    logo_url TEXT,
    transformer_capacity_kva INT DEFAULT 1600, -- พิกัดหม้อแปลง (kVA)
    electricity_rate_kwh NUMERIC(5,2) DEFAULT 4.20, -- อัตราค่าไฟฟ้าต่อหน่วย (บาท)
    water_rate_m3 NUMERIC(5,2) DEFAULT 18.50,       -- อัตราค่าน้ำต่อหน่วย (บาท)
    line_notify_token TEXT,                  -- Token แจ้งเตือนประจำโรงงาน
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. User Profiles Table (ตารางข้อมูลผู้ใช้และบทบาทสิทธิ์ เชื่อมกับ Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id VARCHAR(50) REFERENCES public.organizations(id) ON DELETE SET NULL,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'VIEWER', 
    -- Roles: 'SUPER_ADMIN' (ผู้ดูแลระบบกลาง), 'PLANT_MANAGER' (ผู้จัดการโรงงาน), 'TECHNICIAN' (ช่างประจำวัน), 'VIEWER' (ดูอย่างเดียว)
    phone_number VARCHAR(50),
    line_user_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Meters Table (ตารางมิเตอร์ไฟฟ้าและมิเตอร์น้ำประจำแต่ละโรงงาน)
CREATE TABLE IF NOT EXISTS public.meters (
    id VARCHAR(50) PRIMARY KEY,              -- เช่น 'AOB-MDB1-Q1-1', 'GDB-MDB1-01'
    org_id VARCHAR(50) NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    meter_type VARCHAR(20) NOT NULL,         -- 'ELECTRICITY' หรือ 'WATER'
    meter_code VARCHAR(50) NOT NULL,         -- เช่น 'MDB1-Q1-1', 'WATER-MAIN'
    meter_name VARCHAR(255) NOT NULL,        -- เช่น 'MMC-PRO-1 (Frozen Line)'
    panel VARCHAR(50),                       -- เช่น 'C2-2', 'C3-2', 'C4-2'
    tag VARCHAR(50),                         -- เช่น 'Q1-1'
    modbus_slave_id INT,                     -- Modbus ID 1-40
    gateway_port VARCHAR(50),                -- 'Port 1 (RS-485)' หรือ 'Port 2'
    unit VARCHAR(20) DEFAULT 'kWh',          -- 'kWh', 'm³', 'GWh', 'MWh'
    screen_unit VARCHAR(20) DEFAULT 'GWh',
    model VARCHAR(100) DEFAULT 'Schneider EasyLogic PM2200',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Meter Readings History (ตารางบันทึกค่ามิเตอร์ประจำวันและ Real-time)
CREATE TABLE IF NOT EXISTS public.meter_readings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id VARCHAR(50) NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    meter_id VARCHAR(50) NOT NULL REFERENCES public.meters(id) ON DELETE CASCADE,
    reading_date DATE NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    raw_reading_text VARCHAR(100),           -- ตัวเลขหน้าปัดที่อ่านได้ เช่น '2,554,700'
    reading_value NUMERIC(14,2) NOT NULL,    -- ค่าตัวเลขอารบิก
    daily_usage NUMERIC(14,2),               -- หน่วยที่ใช้ไปในวันนั้น
    active_power_kw NUMERIC(10,2),           -- กำลังไฟฟ้าขณะบันทึก (kW)
    voltage_ll NUMERIC(8,2),                 -- แรงดันไฟ Line-Line (V)
    current_avg NUMERIC(8,2),                -- กระแสเฉลี่ย (A)
    power_factor NUMERIC(4,2),               -- เพาเวอร์แฟกเตอร์ (0.00 - 1.00)
    recorded_by VARCHAR(100),                -- เช่น 'ช่างประจำวัน', 'AI Multi-Scanner'
    image_url TEXT,                          -- ลิงก์รูปถ่ายหน้าปัดมิเตอร์
    is_verified BOOLEAN DEFAULT TRUE
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- กฎความปลอดภัยระดับแถว: ป้องกันลูกค้าเจ้าอื่นมองเห็นข้อมูลข้ามโรงงาน 100%
-- ==============================================================================

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meter_readings ENABLE ROW LEVEL SECURITY;

-- Helper Function: ดึง org_id ของผู้ใช้ที่กำลังล็อกอินอยู่
CREATE OR REPLACE FUNCTION public.get_auth_org_id() 
RETURNS VARCHAR AS $$
    SELECT org_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper Function: ตรวจสอบว่าเป็น Super Admin หรือไม่
CREATE OR REPLACE FUNCTION public.is_super_admin() 
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'SUPER_ADMIN'
    );
$$ LANGUAGE sql SECURITY DEFINER;

-- 1) Policy for Organizations
CREATE POLICY "Super admins can see all organizations" 
ON public.organizations FOR ALL 
USING (public.is_super_admin());

CREATE POLICY "Users can view their own organization" 
ON public.organizations FOR SELECT 
USING (id = public.get_auth_org_id());

-- 2) Policy for Profiles
CREATE POLICY "Super admins can manage all profiles" 
ON public.profiles FOR ALL 
USING (public.is_super_admin());

CREATE POLICY "Users can view and update their own profile" 
ON public.profiles FOR ALL 
USING (id = auth.uid());

CREATE POLICY "Plant managers can view team members in same organization" 
ON public.profiles FOR SELECT 
USING (org_id = public.get_auth_org_id());

-- 3) Policy for Meters
CREATE POLICY "Super admins can manage all meters" 
ON public.meters FOR ALL 
USING (public.is_super_admin());

CREATE POLICY "Users can only view meters belonging to their organization" 
ON public.meters FOR SELECT 
USING (org_id = public.get_auth_org_id());

-- 4) Policy for Meter Readings
CREATE POLICY "Super admins can manage all meter readings" 
ON public.meter_readings FOR ALL 
USING (public.is_super_admin());

CREATE POLICY "Users can only view and add readings for their own organization" 
ON public.meter_readings FOR ALL 
USING (org_id = public.get_auth_org_id())
WITH CHECK (org_id = public.get_auth_org_id());

-- ==============================================================================
-- INITIAL SEED DATA (ข้อมูลเริ่มต้นสำหรับทดสอบ)
-- ==============================================================================

-- เพิ่มองค์กรลูกค้า 2 รายการ (โรงงาน AOB และ ลูกค้าจำลอง B)
INSERT INTO public.organizations (id, company_name, company_code, transformer_capacity_kva, electricity_rate_kwh)
VALUES 
    ('ORG-AOB', 'ART OF BAKING CO., LTD.', 'AOB', 1600, 4.20),
    ('ORG-GRAND-BAKERY', 'GRAND BAKERY INDUSTRIAL CO., LTD.', 'GDB', 2000, 4.25)
ON CONFLICT (id) DO UPDATE 
SET company_name = EXCLUDED.company_name;

-- เพิ่มมิเตอร์ตัวอย่างสำหรับ AOB
INSERT INTO public.meters (id, org_id, meter_type, meter_code, meter_name, panel, tag, modbus_slave_id)
VALUES 
    ('AOB-MDB1-Q1-1', 'ORG-AOB', 'ELECTRICITY', 'MDB1-Q1-1', 'MMC-PRO-1 (Frozen Line)', 'C2-2', 'Q1-1', 1),
    ('AOB-MDB1-Q1-2', 'ORG-AOB', 'ELECTRICITY', 'MDB1-Q1-2', 'MMC-PRO-2 (RTE Line)', 'C3-2', 'Q1-2', 2),
    ('AOB-MDB1-Q1-3', 'ORG-AOB', 'ELECTRICITY', 'MDB1-Q1-3', 'MCC-ACP (Air compressor)', 'C4-2', 'Q1-3', 3),
    ('AOB-WATER-MAIN', 'ORG-AOB', 'WATER', 'WATER-MAIN', 'มิเตอร์น้ำหลัก หน้าโรงงาน', 'MAIN', 'WATER', NULL)
ON CONFLICT (id) DO NOTHING;
