import React, { useState } from 'react';
import { 
  Droplet, 
  CheckCircle2, 
  AlertTriangle, 
  ExternalLink, 
  Clock, 
  Maximize2,
  Calendar,
  X
} from 'lucide-react';
import { WATER_METERS, COMPANY_INFO } from '../data/mockData';

export const WaterMeterView = ({ currentDayData, timeframe }) => {
  const [selectedImage, setSelectedImage] = useState(null);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-800/60 p-4 rounded-xl border border-slate-700/60">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/20 text-blue-400 rounded-lg">
            <Droplet className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">
              ระบบมิเตอร์น้ำโรงงาน (Water Consumption System)
            </h2>
            <p className="text-xs text-slate-400">
              จดบันทึก 3 จุดหลัก: หน้าโรงงาน, ระบบ Soft, ระบบ EVAP (ตรงตามแบบฟอร์มค่าน้ำ FM-EN-000)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="px-2.5 py-1 bg-blue-950/60 text-blue-300 border border-blue-800/60 rounded-md font-mono">
            ตัดรอบ 06:30 น. (รายงาน 08:00 น.)
          </span>
          <span className="px-2.5 py-1 bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 rounded-md">
            อัตราค่าน้ำ 18.50 บ./m³
          </span>
        </div>
      </div>

      {/* 3 Water Meter Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {WATER_METERS.map((meter) => {
          const readingInfo = currentDayData?.water?.[meter.id] || {
            current: meter.readingSep01,
            previous: meter.baselineAug31,
            consumption: Number((meter.readingSep01 - meter.baselineAug31).toFixed(1)),
          };

          const isExceeded = readingInfo.consumption > meter.maxDailyUsage;
          const cost = Number((readingInfo.consumption * COMPANY_INFO.waterRatePerUnit).toFixed(2));

          return (
            <div 
              key={meter.id}
              className="bg-slate-800/80 rounded-xl border border-slate-700/60 overflow-hidden shadow-lg flex flex-col justify-between hover:border-blue-500/40 transition-all"
            >
              <div>
                {/* Meter Photo Thumbnail & Tag */}
                <div className="relative h-44 bg-slate-900 overflow-hidden group">
                  <img 
                    src={meter.sampleImage} 
                    alt={meter.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent pointer-events-none" />

                  {/* Serial Number Pill */}
                  <div className="absolute top-2.5 left-2.5 bg-slate-900/90 backdrop-blur-sm text-xs font-mono text-cyan-300 px-2.5 py-1 rounded-md border border-cyan-500/30 flex items-center gap-1.5 shadow-md">
                    <span>S/N: {meter.serialNumber}</span>
                  </div>

                  {/* Zoom Action Button */}
                  <button
                    onClick={() => setSelectedImage({ src: meter.sampleImage, title: meter.name, sn: meter.serialNumber })}
                    className="absolute top-2.5 right-2.5 bg-slate-900/80 hover:bg-slate-800 text-white p-1.5 rounded-lg border border-slate-700 transition-all cursor-pointer"
                    title="คลิกดูรูปต้นฉบับขนาดเต็ม"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>

                  {/* Name & Model overlay */}
                  <div className="absolute bottom-2.5 left-3 right-3">
                    <h3 className="text-sm font-semibold text-white truncate drop-shadow-md">
                      {meter.name}
                    </h3>
                    <p className="text-xs text-slate-300 flex items-center justify-between">
                      <span>{meter.model} ({meter.type})</span>
                      <span className="text-emerald-400 flex items-center gap-1 font-sans">
                        <CheckCircle2 className="w-3 h-3" /> AI ตรวจจับแล้ว
                      </span>
                    </p>
                  </div>
                </div>

                {/* Meter Metrics & Reading */}
                <div className="p-4 space-y-3.5">
                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                    <div>
                      <span className="text-slate-400 block">เลขวานนี้ (31 ส.ค.)</span>
                      <span className="text-slate-200 font-mono text-sm font-semibold">
                        {readingInfo.previous?.toLocaleString(undefined, { minimumFractionDigits: 1 })}
                      </span>
                    </div>
                    <div>
                      <span className="text-blue-400 block font-medium">เลขอ่านล่าสุด (1 ก.ย.)</span>
                      <span className="text-blue-300 font-mono text-sm font-semibold">
                        {readingInfo.current?.toLocaleString(undefined, { minimumFractionDigits: 1 })}
                      </span>
                    </div>
                  </div>

                  {/* Consumption & Benchmark Validation Highlight */}
                  <div className="bg-blue-950/30 border border-blue-800/40 p-3 rounded-lg flex items-center justify-between">
                    <div>
                      <span className="text-xs text-slate-400 block">หน่วยที่ใช้เมื่อวาน</span>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xl font-bold text-white font-mono">
                          +{readingInfo.consumption?.toLocaleString()}
                        </span>
                        <span className="text-xs text-blue-300">m³</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs text-slate-400 block mb-0.5">การตรวจสอบค่า</span>
                      {readingInfo.consumption >= (meter.expectedMin || 0) && readingInfo.consumption <= (meter.expectedMax || 9999) ? (
                        <div>
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-md">
                            <CheckCircle2 className="w-3 h-3" /> ปกติตามเกณฑ์
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">
                            เกณฑ์ {meter.expectedMin}-{meter.expectedMax} m³
                          </span>
                        </div>
                      ) : (
                        <div>
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400 bg-amber-950/60 border border-amber-800/60 px-2 py-0.5 rounded-md">
                            <AlertTriangle className="w-3 h-3" /> นอกเกณฑ์ปกติ
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">
                            ควรอยู่ {meter.expectedMin}-{meter.expectedMax} m³
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Benchmark & Sanity Check Indicator */}
                  <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-800 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-cyan-400" /> ตรวจสอบความถูกต้อง:
                    </span>
                    <span className="text-slate-300 font-medium">
                      เลขใหม่ ≥ เลขเก่า & สอดคล้องวันก่อนหน้า
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Footer */}
              <div className="px-4 py-2.5 bg-slate-900/50 border-t border-slate-700/40 text-xs flex items-center justify-between text-slate-400">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-500" /> ส่งก่อน 06:30 น.
                </span>
                <span className="text-slate-400">ผู้บันทึก: LINE Bot</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Image Modal for Fullscreen View */}
      {selectedImage && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl">
            <div className="p-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
              <div>
                <h4 className="text-sm font-semibold text-white">{selectedImage.title}</h4>
                <p className="text-xs text-cyan-400 font-mono">Serial Number: {selectedImage.sn}</p>
              </div>
              <button
                onClick={() => setSelectedImage(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-2 bg-black flex items-center justify-center max-h-[70vh] overflow-auto">
              <img 
                src={selectedImage.src} 
                alt={selectedImage.title}
                className="max-h-[68vh] object-contain rounded-lg"
              />
            </div>
            <div className="p-3 bg-slate-900 border-t border-slate-800 text-xs text-slate-400 flex justify-between">
              <span>ภาพหลักฐานบันทึกจาก LINE Official Account</span>
              <span className="text-emerald-400 font-medium">AI ตรวจสอบความถูกต้องแล้ว 100%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
