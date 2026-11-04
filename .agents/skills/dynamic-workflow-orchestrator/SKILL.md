---
name: dynamic-workflow-orchestrator
description: "Autonomous dynamic workflow router that classifies incoming user requests and orchestrates the optimal specialized skills and pipelines automatically based on task intent and expertise."
---

# Dynamic Workflow Orchestrator

## Purpose
Empowers the agent to automatically classify every incoming user task and trigger the optimal skill chain without requiring the user to specify workflows manually. Automatically routes tasks to the specialized skill best suited for the job.

---

## Autonomous Skill Routing Matrix (ความเชี่ยวชาญตามความถนัด)

| ประเภทงาน (Task Intent) | ทริกเกอร์ตรวจจับอัตโนมัติ (Keywords / Context) | Skill Pipeline ที่ทำงานอัตโนมัติตามลำดับ |
|---|---|---|
| **1. ฟีเจอร์ใหม่ / วางระบบ / สถาปัตยกรรม** | "เพิ่ม", "ทำระบบ", "อยากได้", "วางแผน", "ปรับโครงสร้าง" | `brainstorming` ➔ `grill-me` ➔ `writing-plans` ➔ `executing-plans` |
| **2. แก้บัก / ค่าไม่ตรง / เออเร่อร์ / จอดำ** | "ไม่ตรง", "บั๊ก", "error", "จอดำ", "คลิกไม่ได้", "พัง" | `systematic-debugging` ➔ `test-driven-development` ➔ `verification-before-completion` |
| **3. หน้าเว็บ / จัด UI / ปรับเลย์เอาต์** | "หน้าตา", "จัดหน้า", "ธีม", "สี", "ตัวอักษร", "แดชบอร์ด", "มือถือ" | `frontend-design` ➔ `mobile-ergonomics-audit` ➔ `impeccable` |
| **4. ไอคอน / สัญลักษณ์ / โลโก้ / Badge** | "ไอคอน", "icon", "สัญลักษณ์", "โลโก้", "lucide", "simple icons" | `icon-craft` ➔ `frontend-design` |
| **5. ค่าไฟ / PEA / ความปลอดภัย Inverter** | "ค่าไฟ", "กฟภ", "PEA", "แบตเตอรี่", "แผง", "อินเวอร์เตอร์", "ความปลอดภัย" | `iot-security-and-tariff-audit` ➔ `systematic-debugging` |
| **6. แอนิเมชัน / วิดีโอ / โมชันกราฟิก** | "อนิเมชั่น", "วิดีโอ", "ขยับ", "motion", "เฟรม" | `hyperframes` |
| **7. ปิดท้ายทุกงาน UI ก่อนส่งมอบ** | ทุกครั้งที่มีการแก้ไข UI หรือหน้าจอเสร็จสิ้น | `verification-before-completion` ➔ `impeccable` |

---

## กฎการทำงานอัตโนมัติ (Execution Discipline)
1. **Zero-Manual-Order:** ผู้ใช้ไม่ต้องสั่งระบุชื่อ skill ระบบจะวิเคราะห์บริบทงานและประกาศ:
   `"Using [skill] to [purpose]"` โดยอัตโนมัติ
2. **Deterministic Evidence:** ต้องรันคำสั่งตรวจสอบ (Linter, Build, Tests) ผ่านจริงก่อนยืนยันความสำเร็จเสมอ
3. **Ergonomics & Typography Invariant:** รักษามาตรฐานฟอนต์ `Prompt` และการควบคุมแบบ 1-thumb บนมือถือตลอดเวลา
