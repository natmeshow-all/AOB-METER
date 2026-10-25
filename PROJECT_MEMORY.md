# 🧠 POWERVIEW IOT ENERGY PLATFORM - PROJECT MEMORY & GUIDELINES
> **บันทึกความจำถาวรของโครงการ กฎเหล็ก และบทเรียนการแก้ไขจุดผิดพลาด (Lessons Learned)**
> *อัปเดตล่าสุด: 25 ตุลาคม 2026 | ผู้ดูแลระบบหลัก (Super Admin): คุณณัฐพงษ์ (`natshownolimit@gmail.com`)*

---

## 📌 สารบัญความจำโครงการ
1. [ข้อมูลระบบและสถาปัตยกรรมหลัก](#1-ข้อมูลระบบและสถาปัตยกรรมหลัก)
2. [บทเรียนข้อผิดพลาดในอดีตและกฎเหล็กป้องกัน (Never Repeat)](#2-บทเรียนข้อผิดพลาดในอดีตและกฎเหล็กป้องกัน-never-repeat)
3. [ระบบความปลอดภัยและสิทธิ์ผู้ใช้ (Multi-Tenant & Super Admin)](#3-ระบบความปลอดภัยและสิทธิ์ผู้ใช้-multi-tenant--super-admin)
4. [มาตรฐานการออกแบบสำหรับมือถือ (Mobile-First Ergonomics)](#4-มาตรฐานการออกแบบสำหรับมือถือ-mobile-first-ergonomics)
5. [การเชื่อมต่อ Supabase & ฐานข้อมูล RLS](#5-การเชื่อมต่อ-supabase--ฐานข้อมูล-rls)
6. [การเชื่อมต่อฮาร์ดแวร์ Power Meter & IoT Gateway](#6-การเชื่อมต่อฮาร์ดแวร์-power-meter--iot-gateway)

---

## 1. ข้อมูลระบบและสถาปัตยกรรมหลัก
- **ชื่อโครงการ:** PowerView Cloud Energy Intelligence System (Multi-Tenant IoT Platform)
- **สถาปัตยกรรม:** React (Vite) + Tailwind CSS + Lucide Icons + Supabase (PostgreSQL + RLS + Auth)
- **รูปแบบระบบ:** Multi-Tenant แยกข้อมูลโรงงานลูกค้าเด็ดขาด (Tenant Isolation 100%)
- **ฟอนต์หลัก:** Google Font `Prompt` ทุกหน้าและทุกองค์ประกอบ
- **รายชื่อโรงงานลูกค้าปัจจุบัน:**
  1. `ORG-AOB`: บริษัท เอโอเบสต์ จำกัด (ART OF BAKING) - หม้อแปลง 1,600 kVA, 17 จุดมิเตอร์
  2. `ORG-GRAND`: บริษัท แกรนด์ เบเกอรี่ อินดัสทรี จำกัด (GDB) - หม้อแปลง 2,000 kVA, 12 จุดมิเตอร์
  3. `ORG-SIAMCOLD`: บริษัท สยาม โคลด์ สตอเรจ จำกัด (SCS) - หม้อแปลง 2,500 kVA, 14 จุดมิเตอร์

---

## 2. บทเรียนข้อผิดพลาดในอดีตและกฎเหล็กป้องกัน (Never Repeat)

### ⚠️ บทเรียนที่ 1: บั๊กล็อกอิน/ล็อกเอาต์ค้าง หรือไม่เด้งกลับหน้า Login Portal
- **ข้อผิดพลาดเดิม:** ใน `AuthContext.jsx` กำหนดให้ค่าเริ่มต้นของ `currentUser` หากไม่มีข้อมูลใน `localStorage` ให้ fallback ไปเป็น `DEMO_USERS[0]` อัตโนมัติ ส่งผลให้:
  - ผู้ใช้กด Logout แล้ว ระบบลบข้อมูล แต่พอมารันใหม่ก็ดีดกลับมาเป็นล็อกอินอยู่ดี
  - หน้าแรกของเว็บไม่ยอมแสดง `LoginPortal`
- **กฎเหล็กถาวร:**
  - `currentUser` เริ่มต้นต้องเป็น `savedUser ? JSON.parse(savedUser) : null` เสมอ
  - หาก `!currentUser` หน้า `App.jsx` จะต้อง Guard และเรนเดอร์ `<LoginPortal />` เป็นหน้าแรกทันที
  - ฟังก์ชัน `logout()` ต้องเคลียร์ทั้ง `localStorage`, `sessionStorage`, รัน `supabase.auth.signOut()` และเซ็ต `setCurrentUser(null)` เด็ดขาด

---

### ⚠️ บทเรียนที่ 2: สิทธิ์ Super Admin ไม่ถูกกำหนด หรือหลุดเป็น Viewer
- **ข้อผิดพลาดเดิม:** เมื่อสมัครหรือล็อกอินผ่าน Supabase Auth อีเมล `natshownolimit@gmail.com` บันทึกไปที่ `auth.users` แต่ไม่ได้ถูกอัปเดตสิทธิ์ใน `public.profiles` ทำให้กลายเป็นบทบาททั่วไป (`VIEWER`) และไม่เห็นดรอปดาวน์สลับโรงงาน
- **กฎเหล็กถาวร:**
  - **ในโค้ด Frontend (`AuthContext.jsx`):** มีฟังก์ชัน `isSuperAdminEmail(email)` ตรวจจับอีเมล `natshownolimit@gmail.com` เสมอ หากล็อกอินด้วยอีเมลนี้ ให้ยัดสิทธิ์ `role = 'SUPER_ADMIN'` อัตโนมัติทันที แม้ฐานข้อมูลจะยังไม่สร้างแถว
  - **ในฐานข้อมูล Supabase:** ต้องมี Trigger `on_auth_user_created` ดักจับเมื่อมี User ใหม่ หากเป็น `natshownolimit@gmail.com` ให้ใส่ `role = 'SUPER_ADMIN'` อัตโนมัติ

---

### ⚠️ บทเรียนที่ 3: Error รัน SQL ใน Supabase (`relation does not exist` หรือ `policy already exists`)
- **ข้อผิดพลาดเดิม:**
  - นำเฉพาะท่อน `CREATE POLICY` ไปรันโดยที่ตาราง `public.organizations` ยังไม่ได้สร้าง
  - หรือรันซ้ำแล้วติด Error ว่าชื่อ Policy ซ้ำ
- **กฎเหล็กถาวร:**
  - ไฟล์ `supabase/schema.sql` ต้องเป็นสคริปต์แบบ **Idempotent** (รันกี่รอบก็ได้ผลลัพธ์เดิมไม่ Error)
  - ทุกคำสั่ง `CREATE POLICY` ต้องมี `DROP POLICY IF EXISTS ...` ดักไว้ก่อนหน้าเสมอ
  - ทุกตารางต้องเรียงลำดับการสร้างจาก Parent -> Child (`uuid-ossp` -> `organizations` -> `profiles` -> `meters` -> `meter_readings`)

---

### ⚠️ บทเรียนที่ 4: Error คำสั่ง PowerShell บน Windows (`&&` syntax error)
- **ข้อผิดพลาดเดิม:** รันคำสั่ง Git แบบ Bash เช่น `git add . && git commit` บน Windows PowerShell ทำให้ติด Error `The token '&&' is not a valid statement separator`
- **กฎเหล็กถาวร:**
  - บน Windows PowerShell ต้องใช้เครื่องหมาย `;` ในการคั่นคำสั่งเสมอ เช่น:
    ```powershell
    git add . ; git commit -m "..." ; git push origin main
    ```

---

### ⚠️ บทเรียนที่ 5: การใช้งานบนมือถือ (Mobile Usability)
- **ข้อผิดพลาดเดิม:** ปุ่มออกจากระบบซ่อนอยู่ในเมนูขนาดเล็ก หรือตารางข้อมูลตกขอบจอ ทำให้ผู้ใช้บนมือถือใช้งานไม่สะดวก
- **กฎเหล็กถาวร:**
  - ผู้ใช้ระบุชัดเจนว่า **"ใช้งานบนมือถือเป็นหลัก"**
  - ต้องมี Mobile Sticky Bottom Navigation เสมอ และมีปุ่ม "🚪 ออกจากระบบ" ที่เข้าถึงได้ด้วยนิ้วโป้งเดียว
  - กราฟและตารางต้องมี `overflow-x-auto` หรือการ์ดสรุปย่อที่อ่านง่ายไม่ต้องซูม

---

## 3. ระบบความปลอดภัยและสิทธิ์ผู้ใช้ (Multi-Tenant & Super Admin)

### โครงสร้างระดับสิทธิ์ (Role Hierarchy):
1. **👑 SUPER_ADMIN (`natshownolimit@gmail.com`):**
   - มีสิทธิ์สลับดูข้อมูลได้ทุกโรงงาน (AOB, Grand Bakery, Siam Cold Storage)
   - สามารถจัดการมิเตอร์, ลบ/แก้ไขข้อมูล, และตั้งค่า Gateway ส่วนกลางได้
2. **👔 PLANT_MANAGER:**
   - ดูข้อมูลเฉพาะโรงงานของตนเองเท่านั้น (ถูกจำกัดด้วย `org_id` ผ่าน Supabase RLS)
   - เพิ่ม/แก้ไข บันทึกค่ามิเตอร์ประจำวัน และอ่านรายงานได้
3. **🔧 TECHNICIAN:**
   - ถ่ายรูปสแกนมิเตอร์ บันทึกค่าประจำวัน และส่งรายงานทาง LINE Bot
4. **👁️ VIEWER:**
   - ดูข้อมูลแดชบอร์ดเฉพาะโรงงานตนเอง แบบอ่านอย่างเดียว (Read-Only)

---

## 4. มาตรฐานการออกแบบสำหรับมือถือ (Mobile-First Ergonomics)
- **ฟอนต์:** ใช้ Google Font `Prompt` (สไตล์คมชัด อ่านตัวเลขและภาษาไทยสบายตา)
- **แถบเมนูด้านล่าง (Sticky Bottom Nav):**
  - ⚡ **สด IoT:** ดูโหลดกิโลวัตต์และกำลังไฟฟ้าเรียลไทม์
  - 📈 **ย้อนหลัง:** ดูกราฟวิเคราะห์ 4 มิติ (รายชั่วโมง 24 ชม., รายวัน 1-31 วัน, รายเดือน 12 เดือน, รายปี)
  - 📷 **สแกน AI (ปุ่มตรงกลางเด่น):** ถ่ายรูปมิเตอร์เพื่อให้อ่านค่า OCR อัตโนมัติ
  - 🔌 **มิเตอร์ไฟ:** แสดงลิสต์การกินไฟแยกจุด MMC / โหลดแช่แข็ง
  - 🚪 **ออกจากระบบ:** ปุ่มสีแดงสดใส แตะแล้วกลับหน้าเลือกบริษัททันที

---

## 5. การเชื่อมต่อ Supabase & ฐานข้อมูล RLS
- **Helper Functions หลักใน PostgreSQL:**
  - `public.get_auth_org_id()`: ดึง `org_id` ของผู้ใช้ที่กำลังล็อกอินอยู่
  - `public.is_super_admin()`: ตรวจสอบว่าผู้ใช้มีบทบาทเป็น `SUPER_ADMIN` หรือไม่
- **การแยก Tenant:**
  ```sql
  -- นโยบายจำกัดให้ผู้ใช้เห็นเฉพาะโรงงานของตนเอง เว้นแต่เป็น Super Admin
  CREATE POLICY "Users can only view meters belonging to their organization" 
  ON public.meters FOR SELECT 
  USING (org_id = public.get_auth_org_id() OR public.is_super_admin());
  ```

---

## 6. การเชื่อมต่อฮาร์ดแวร์ Power Meter & IoT Gateway

### อุปกรณ์ฮาร์ดแวร์:
1. **Power Meter:** Schneider EasyLogic PM2200 (หรือ PM5350 / ยี่ห้อที่รองรับ RS485 Modbus RTU)
2. **IoT Gateway:** Waveshare RS485 to Ethernet/WiFi/4G (หรือ ESP32 + MAX485)
3. **สายสัญญาณ:** สายบิดเกลียวคู่มีชีลด์ (Shielded Twisted Pair: STP Belden 9841 หรือ CAT6 Shield)

### ขั้นตอนและกฎการ Wiring:
1. ต่อขั้ว **D+ (A)** ของมิเตอร์ทุกตัวขนานกันเข้า Gateway Pin A
2. ต่อขั้ว **D- (B)** ของมิเตอร์ทุกตัวขนานกันเข้า Gateway Pin B
3. ต่อสายชีลด์ (Shield) ลงกราวด์ที่จุดเดียว (Single-point Ground) ที่ตู้ MDB ห้ามต่อหัวท้ายวนลูป
4. ใส่ตัวต้านทานปิดหัวท้ายสาย **120 Ohm (Terminating Resistor)** ที่ตัวสุดท้ายของลูป RS485
5. กำหนด Modbus Slave ID ไม่ให้ซ้ำกัน (เช่น ตัวที่ 1 = ID: 1, ตัวที่ 2 = ID: 2, Baud Rate: 9600 bps, Parity: None, Stop bit: 1)

---

## 7. คำสัญญาและการทำงานในอนาคต (Agent Pledge)
ทุกครั้งที่ AI ผู้ช่วยเข้ามาพัฒนาต่อใน Repository นี้:
1. **ต้องอ่านและยึดถือกฎใน `PROJECT_MEMORY.md` และ `GEMINI.md` อย่างเคร่งครัด**
2. **ห้ามเปลี่ยนโค้ดที่ทำให้ระบบ Login/Logout ดีดกลับไปค้าง**
3. **ห้ามลดสิทธิ์ของคุณณัฐพงษ์ (`natshownolimit@gmail.com`) ออกจากตำแหน่ง Super Admin**
4. **ต้องรักษาความเข้ากันได้ของการใช้งานบนมือถือ (Mobile-First) และฟอนต์ Prompt เสมอ**
5. **ทุกการรัน build (`npm run build`) จะต้องผ่าน 100% ไม่มีข้อผิดพลาดก่อนส่งมอบงาน**
