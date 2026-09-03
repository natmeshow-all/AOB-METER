import React, { useState } from 'react';
import { 
  Zap, 
  CheckCircle2, 
  Maximize2, 
  SlidersHorizontal, 
  Layers, 
  TrendingUp, 
  Info,
  X
} from 'lucide-react';
import { ELECTRICITY_METERS, COMPANY_INFO } from '../data/mockData';

export const ElectricityMeterView = ({ currentDayData, timeframe }) => {
  const [selectedGroup, setSelectedGroup] = useState('ALL'); // 'ALL' | 'MDB1' | 'MDB2'
  const [selectedImage, setSelectedImage] = useState(null);

  const mdb1Meters = ELECTRICITY_METERS.filter(m => m.group.includes('MDB-1'));
  const mdb2Meters = ELECTRICITY_METERS.filter(m => m.group.includes('MDB-2'));

  const displayedMeters = selectedGroup === 'MDB1' 
    ? mdb1Meters 
    : selectedGroup === 'MDB2' 
      ? mdb2Meters 
      : ELECTRICITY_METERS;

  // Calculate Group Totals for Day 1
  let mdb1DayTotal = 0;
  mdb1Meters.forEach(m => {
    mdb1DayTotal += (currentDayData?.electricity?.[m.id]?.consumption || (m.readingSep01 - m.baselineAug31));
  });

  let mdb2DayTotal = 0;
  mdb2Meters.forEach(m => {
    mdb2DayTotal += (currentDayData?.electricity?.[m.id]?.consumption || (m.readingSep01 - m.baselineAug31));
  });

  return (
    <div className="space-y-6">
      {/* Top Banner with Stats & Filter */}
      <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-lg">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">
              ระบบมิเตอร์ไฟฟ้าโรงงาน Schneider Electric EasyLogic™ PM2200 (14 จุด)
            </h2>
            <p className="text-xs text-slate-400">
              อ่านค่าบรรทัด <span className="text-cyan-400 font-mono">E Del</span> แปลงหน่วย GWh/MWh เป็น kWh ลงแบบฟอร์มค่าไฟฟ้าอัตโนมัติ
            </p>
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedGroup('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              selectedGroup === 'ALL'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            ทุกลูป (14 จุด)
          </button>
          <button
            onClick={() => setSelectedGroup('MDB1')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              selectedGroup === 'MDB1'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            MDB-1 TR1 (8 จุด)
          </button>
          <button
            onClick={() => setSelectedGroup('MDB2')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              selectedGroup === 'MDB2'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            MDB-2 TR2 (6 จุด)
          </button>
        </div>
      </div>

      {/* Group KPI Summaries */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/60">
          <span className="text-xs text-slate-400 block">⚡ MDB-1 TR1 @ 1,600 kVA</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold text-white font-mono">{mdb1DayTotal.toLocaleString()}</span>
            <span className="text-xs text-amber-400">kWh/วัน</span>
          </div>
          <span className="text-xs text-slate-400 mt-1 block">8 วงจรย่อย (Frozen, RTE, Air Comp, Silo...)</span>
        </div>

        <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/60">
          <span className="text-xs text-slate-400 block">⚡ MDB-2 TR2 @ 1,600 kVA</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold text-white font-mono">{mdb2DayTotal.toLocaleString()}</span>
            <span className="text-xs text-amber-400">kWh/วัน</span>
          </div>
          <span className="text-xs text-slate-400 mt-1 block">6 วงจรย่อย (Refrigeration Plant, AS/RS...)</span>
        </div>

        <div className="bg-slate-800/80 p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/5">
          <span className="text-xs text-amber-300 block font-medium">⚡ รวมการใช้ไฟฟ้าทั้งโรงงาน</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold text-amber-400 font-mono">{(mdb1DayTotal + mdb2DayTotal).toLocaleString()}</span>
            <span className="text-xs text-amber-300">kWh/วัน</span>
          </div>
          <span className="text-xs text-slate-300 mt-1 block">~{((mdb1DayTotal + mdb2DayTotal) * COMPANY_INFO.electricityRatePerUnit).toLocaleString()} บาท/วัน</span>
        </div>
      </div>

      {/* Grid of Electricity Meters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {displayedMeters.map((meter, index) => {
          const readingInfo = currentDayData?.electricity?.[meter.id] || {
            current: meter.readingSep01,
            previous: meter.baselineAug31,
            consumption: meter.readingSep01 - meter.baselineAug31,
          };

          const cost = Math.round(readingInfo.consumption * COMPANY_INFO.electricityRatePerUnit);

          return (
            <div 
              key={meter.id}
              className="bg-slate-800/80 rounded-xl border border-slate-700/60 overflow-hidden shadow-md flex flex-col justify-between hover:border-amber-500/40 transition-all"
            >
              <div className="p-4">
                {/* Header with Panel Tag and Meter Tag */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-700/60">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 bg-slate-900 text-amber-400 font-mono font-bold text-xs rounded border border-amber-500/30">
                      {meter.tag}
                    </span>
                    <span className="text-xs font-mono text-slate-300 bg-slate-700/50 px-2 py-0.5 rounded">
                      ตู้: {meter.panel}
                    </span>
                  </div>

                  <button
                    onClick={() => setSelectedImage({ src: meter.sampleImage, title: `${meter.tag} - ${meter.location}`, panel: meter.panel })}
                    className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 bg-cyan-950/40 hover:bg-cyan-950/60 px-2 py-1 rounded border border-cyan-800/50 transition-all cursor-pointer"
                    title="คลิกดูรูปมิเตอร์ตัวจริงที่ AI ตรวจจับ"
                  >
                    <Maximize2 className="w-3 h-3" />
                    <span>ดูรูปถ่าย</span>
                  </button>
                </div>

                {/* Location / Machine Name */}
                <div className="mt-3">
                  <h3 className="text-sm font-semibold text-white truncate" title={meter.location}>
                    {meter.location}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {meter.group}
                  </p>
                </div>

                {/* Meter Reading Comparison */}
                <div className="mt-3.5 grid grid-cols-2 gap-2 text-xs bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                  <div>
                    <span className="text-slate-400 block">31 ส.ค. 2569</span>
                    <span className="text-slate-300 font-mono text-sm font-semibold">
                      {readingInfo.previous?.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-amber-400 block font-medium">1 ก.ย. 2569</span>
                    <span className="text-amber-300 font-mono text-sm font-semibold">
                      {readingInfo.current?.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Daily Consumption Card */}
                <div className="mt-3 bg-amber-950/20 border border-amber-800/30 p-2.5 rounded-lg flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-400 block">หน่วยที่ใช้ประจำวัน</span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-lg font-bold text-white font-mono">
                        +{readingInfo.consumption?.toLocaleString()}
                      </span>
                      <span className="text-xs text-amber-300">kWh</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-slate-400 block">คิดเป็นเงินประมาณ</span>
                    <span className="text-sm font-semibold text-emerald-400 font-mono">
                      ~{cost.toLocaleString()} บ.
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Footer */}
              <div className="px-4 py-2 bg-slate-900/40 border-t border-slate-700/40 text-xs flex items-center justify-between text-slate-400">
                <span className="text-slate-400 font-mono">Schneider PM2200</span>
                <span className="text-emerald-400 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3 h-3" /> ยืนยันแล้ว
                </span>
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
                <p className="text-xs text-amber-400 font-mono">แผงตู้: {selectedImage.panel}</p>
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
              <span>ภาพถ่ายหน้าตู้สวิตช์บอร์ดที่ช่างส่งผ่าน LINE</span>
              <span className="text-emerald-400 font-medium">AI สกัดค่า E Del เรียบร้อย</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
