import React, { useState } from 'react';
import { 
  Bell, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Send, 
  Smartphone, 
  Layers, 
  X, 
  MessageSquare,
  Sparkles
} from 'lucide-react';
import { COMPANY_INFO } from '../data/mockData';

export const LineBotSimulator = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const [activeScenario, setActiveScenario] = useState('cutoff-alert'); // 'batch-reply' | 'cutoff-alert' | 'morning-report'

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-600 rounded-lg text-white">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <span>LINE Official Account & Automation Simulator</span>
                <span className="text-[11px] px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-full border border-emerald-500/30">
                  LINE OA Webhook Ready
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                จำลองการส่งรูปพร้อมกัน, ระบบแจ้งเตือนตัดรอบ 06:30 น., และรายงานสรุป 08:00 น.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Controls */}
        <div className="p-3 bg-slate-800/80 border-b border-slate-700/60 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400">เลือกสถานการณ์จำลอง:</span>
            <button
              onClick={() => setActiveScenario('cutoff-alert')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                activeScenario === 'cutoff-alert'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              ⏰ เตือนตัดรอบ 06:30 น. (กรณีส่งไม่ครบ)
            </button>

            <button
              onClick={() => setActiveScenario('batch-reply')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                activeScenario === 'batch-reply'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              📋 ข้อความตอบกลับชุดภาพ (Single Checklist)
            </button>

            <button
              onClick={() => setActiveScenario('morning-report')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                activeScenario === 'morning-report'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              📊 รายงาน 08:00 น. เข้ากลุ่มหัวหน้างาน
            </button>
          </div>
        </div>

        {/* Chat Mock Area */}
        <div className="p-6 overflow-y-auto bg-slate-950 flex-1 flex justify-center">
          <div className="w-full max-w-md bg-[#728892] rounded-3xl p-4 shadow-2xl border-4 border-slate-700 flex flex-col justify-between min-h-[480px]">
            {/* LINE Top Bar */}
            <div className="flex items-center justify-between pb-3 border-b border-white/20 text-white text-xs">
              <div className="flex items-center gap-2 font-semibold">
                <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full inline-block" />
                <span>บอทบันทึกมิเตอร์ AOB (LINE OA)</span>
              </div>
              <span className="text-[11px] text-slate-200 font-mono">06:30 น.</span>
            </div>

            {/* Chat Body */}
            <div className="py-4 space-y-4 flex-1">
              {/* SCENARIO 1: Cutoff Alert 06:30 */}
              {activeScenario === 'cutoff-alert' && (
                <div className="space-y-3">
                  {/* System Time Pill */}
                  <div className="text-center">
                    <span className="px-3 py-1 bg-black/30 text-white/80 rounded-full text-[10px]">
                      06:30 น. (เวลาตัดรอบระบบ)
                    </span>
                  </div>

                  {/* Warning Flex Card */}
                  <div className="bg-white rounded-2xl p-4 shadow-lg text-slate-800 text-xs space-y-2.5 border-l-4 border-rose-500">
                    <div className="flex items-center justify-between border-b pb-2">
                      <span className="font-bold text-rose-600 flex items-center gap-1.5 text-sm">
                        <AlertTriangle className="w-4 h-4 text-rose-500" />
                        แจ้งเตือนตัดรอบ 06:30 น.
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">FM-EN-000</span>
                    </div>

                    <p className="text-slate-700 leading-relaxed">
                      ⚠️ <strong>ยังส่งรูปมิเตอร์ไม่ครบถ้วน!</strong><br />
                      บันทึกข้อมูลประจำวันที่ <strong>01/09/2569</strong> ยังขาดอีก <strong>2 จุด</strong> ดังนี้:
                    </p>

                    <div className="bg-rose-50 p-2.5 rounded-lg border border-rose-200 text-[11px] text-rose-800 space-y-1">
                      <div>• <strong>มิเตอร์น้ำ:</strong> ระบบ Soft (WATER-SOFT)</div>
                      <div>• <strong>มิเตอร์ไฟ:</strong> MDB-2 Q1-1 (Refrigeration Plant)</div>
                    </div>

                    <p className="text-[11px] text-slate-500">
                      ⚡ <em>กรุณาถ่ายรูปส่งเข้า LINE ด่วนที่สุดก่อน 07:30 น. เพื่อให้หัวหน้างานนำเข้าที่ประชุมตอน 08:00 น. ครับ</em>
                    </p>

                    <button className="w-full py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs rounded-lg transition-all shadow cursor-pointer">
                      📸 ถ่ายรูปและส่ง 2 จุดที่ขาดทันที
                    </button>
                  </div>
                </div>
              )}

              {/* SCENARIO 2: Single Checklist Flex Message */}
              {activeScenario === 'batch-reply' && (
                <div className="space-y-3">
                  <div className="text-center">
                    <span className="px-3 py-1 bg-black/30 text-white/80 rounded-full text-[10px]">
                      06:20 น. (ช่างส่งรูป 8 รูปพร้อมกัน)
                    </span>
                  </div>

                  <div className="bg-white rounded-2xl p-4 shadow-lg text-slate-800 text-xs space-y-3 border-l-4 border-emerald-500">
                    <div className="flex items-center justify-between border-b pb-2">
                      <span className="font-bold text-emerald-700 flex items-center gap-1.5 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        สรุปการสแกนมิเตอร์ (AI)
                      </span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                        สแกนเสร็จใน 2.8s
                      </span>
                    </div>

                    <div className="text-slate-700 space-y-1">
                      <div className="text-xs font-semibold text-slate-800">
                        🟢 อ่านสำเร็จครบถ้วน (15 / 17 จุด):
                      </div>
                      <div className="text-[11px] text-slate-600 pl-2">
                        • มิเตอร์น้ำหลัก: 206,378.7 m³<br />
                        • มิเตอร์น้ำ EVAP: 77,593.1 m³<br />
                        • ตู้ไฟ C4-2 (4 จุด): Q1-3, Q1-6, Q1-7, Q1-8<br />
                        • ตู้ไฟ C3-2 แดง (5 จุด): Q1-2 ถึง Q1-6 (ข้าม Q1-1 ตามกำหนด)
                      </div>
                    </div>

                    <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-200 text-[11px] text-amber-900 space-y-1">
                      <div className="font-bold text-amber-800">🟡 ตรวจพบจุดที่ต้องตรวจสอบ:</div>
                      <div>• <strong>มิเตอร์น้ำ Soft:</strong> แสงสะท้อนบนหน้าปัด (ขอส่งใหม่อีก 1 รูป)</div>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button className="flex-1 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold text-[11px] rounded-lg cursor-pointer">
                        ถ่ายแก้ 1 รูป
                      </button>
                      <button className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] rounded-lg shadow cursor-pointer">
                        ✅ ยืนยันบันทึกข้อมูล
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* SCENARIO 3: Morning Report 08:00 */}
              {activeScenario === 'morning-report' && (
                <div className="space-y-3">
                  <div className="text-center">
                    <span className="px-3 py-1 bg-black/30 text-white/80 rounded-full text-[10px]">
                      07:50 น. (รายงานอัตโนมัติก่อน 08:00 น.)
                    </span>
                  </div>

                  <div className="bg-white rounded-2xl p-4 shadow-lg text-slate-800 text-xs space-y-3 border-l-4 border-blue-600">
                    <div className="flex items-center justify-between border-b pb-2">
                      <span className="font-bold text-blue-800 flex items-center gap-1.5 text-sm">
                        📊 สรุปพลังงาน & สาธารณูปโภค
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">01/09/2569</span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between bg-blue-50 p-2 rounded">
                        <span className="text-slate-700">💧 <strong>น้ำประปารวม:</strong></span>
                        <span className="font-bold text-blue-700 font-mono">951.1 m³ (~17,595 บ.)</span>
                      </div>

                      <div className="flex items-center justify-between bg-amber-50 p-2 rounded">
                        <span className="text-slate-700">⚡ <strong>ไฟฟ้ารวม (14 จุด):</strong></span>
                        <span className="font-bold text-amber-800 font-mono">22,869 kWh (~96,050 บ.)</span>
                      </div>

                      <div className="flex items-center justify-between bg-emerald-50 p-2 rounded">
                        <span className="text-slate-700">☀️ <strong>โซลาร์เซลล์ผลิตได้:</strong></span>
                        <span className="font-bold text-emerald-700 font-mono">+3,850 kWh (ประหยัด 16,170 บ.)</span>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-600 border-t pt-2">
                      สถานะ: <strong className="text-emerald-600">บันทึกลง Google Sheet & AppSheet เรียบร้อย</strong><br />
                      ผู้ตรวจสอบ: นายสมชาย (Maintenance Supervisor)
                    </div>

                    <button className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-lg transition-all shadow cursor-pointer">
                      📱 เปิดดูแดชบอร์ดเต็มใน AppSheet
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Input Preview */}
            <div className="pt-2 text-[10px] text-white/60 text-center border-t border-white/20">
              เชื่อมต่อโดยตรงกับ LINE Messaging API Webhook
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
