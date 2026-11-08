import React from 'react';
import { Sun, BatteryCharging, Battery, Zap, Home, ArrowRight, ArrowLeft } from 'lucide-react';

/**
 * AnimatedEnergyFlow
 * Next-Gen Interactive Energy Flow Diagram (Sankey-style with pulsing SVG energy conduits)
 * Visualizes real-time power transfers between Solar, Grid, Inverter, Battery, and Facility Load.
 */
export function AnimatedEnergyFlow({
  pvPowerW = 5420,
  gridPowerW = -1200, // positive = import from PEA, negative = export to PEA
  batteryPowerW = 2800, // positive = charging, negative = discharging
  batterySOC = 78,
  loadPowerW = 3820,
  isHomeSolar = true
}) {
  const isExportingGrid = gridPowerW < 0;
  const isImportingGrid = gridPowerW > 0;
  const isChargingBattery = batteryPowerW > 0;
  const isDischargingBattery = batteryPowerW < 0;

  const absGridW = Math.abs(gridPowerW);
  const absBatW = Math.abs(batteryPowerW);

  return (
    <div className="bg-gradient-to-b from-[#0e1628] to-[#070b14] border border-slate-800/80 rounded-3xl p-4 sm:p-6 shadow-2xl relative overflow-hidden">
      {/* Background ambient mesh */}
      <div className="absolute inset-0 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:24px_24px] opacity-10 pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800/60 relative z-10 mb-4 sm:mb-6">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Zap className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              แผนผังสายธารพลังงานแบบมีชีวิต (Live Energy Flow)
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Real-Time Flow
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              ทิศทางการไหลของไฟฟ้าจากโซลาร์, แบตเตอรี่, ไฟหลวง เข้าสู่สายการผลิต
            </p>
          </div>
        </div>

        <div className="text-right hidden sm:block">
          <div className="text-xs text-slate-400">โหลดการใช้งานจริง</div>
          <div className="text-base font-black font-mono text-rose-400">
            {(loadPowerW / 1000).toFixed(2)} kW
          </div>
        </div>
      </div>

      {/* Flow Canvas Layout */}
      <div className="relative z-10 max-w-2xl mx-auto py-2">
        {/* Top Tier: Sources (Solar PV & PEA Grid) */}
        <div className="grid grid-cols-2 gap-4 sm:gap-8 mb-8 sm:mb-12">
          {/* Source 1: Solar PV */}
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-950/40 border-2 border-amber-500/40 flex flex-col items-center justify-center text-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.2)] transition-transform hover:scale-105">
              <Sun className="w-7 h-7 sm:w-8 sm:h-8 animate-[spin_12s_linear_infinite]" />
              <span className="text-[9px] font-bold mt-1 text-amber-200">โซลาร์ PV</span>
            </div>
            <div className="mt-2 text-center">
              <span className="text-sm sm:text-base font-black font-mono text-amber-300">
                {(pvPowerW / 1000).toFixed(2)} kW
              </span>
              <span className="block text-[10px] text-amber-400/80 font-medium">กำลังผลิต</span>
            </div>
          </div>

          {/* Source 2: PEA Grid */}
          <div className="flex flex-col items-center">
            <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex flex-col items-center justify-center shadow-lg transition-transform hover:scale-105 border-2 ${
              isExportingGrid 
                ? 'bg-gradient-to-br from-emerald-500/20 to-emerald-950/40 border-emerald-500/40 text-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.2)]'
                : 'bg-gradient-to-br from-sky-500/20 to-sky-950/40 border-sky-500/40 text-sky-400 shadow-[0_0_25px_rgba(56,189,248,0.2)]'
            }`}>
              <Zap className="w-7 h-7 sm:w-8 sm:h-8" />
              <span className="text-[9px] font-bold mt-1">ไฟหลวง PEA</span>
            </div>
            <div className="mt-2 text-center">
              <span className={`text-sm sm:text-base font-black font-mono ${isExportingGrid ? 'text-emerald-400' : 'text-sky-300'}`}>
                {isExportingGrid ? `-${(absGridW / 1000).toFixed(2)}` : `+${(absGridW / 1000).toFixed(2)}`} kW
              </span>
              <span className="block text-[10px] text-slate-400 font-medium">
                {isExportingGrid ? 'ขายไฟคืน' : 'ดึงไฟหลวง'}
              </span>
            </div>
          </div>
        </div>

        {/* Central Core: Hybrid Inverter / Main MDB */}
        <div className="flex justify-center my-2 sm:my-4">
          <div className="relative">
            {/* Glowing ring animation */}
            <div className="absolute inset-0 rounded-3xl bg-indigo-500/20 blur-xl animate-pulse" />
            <div className="relative px-6 py-4 rounded-3xl bg-gradient-to-b from-[#1e293b] to-[#0f172a] border-2 border-indigo-500/50 shadow-2xl flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-300 font-black">
                MDB
              </div>
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  ศูนย์กลางจ่ายไฟ & อินเวอร์เตอร์
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                </div>
                <div className="text-[11px] text-indigo-300 font-mono mt-0.5">
                  ประสิทธิภาพจ่ายไฟ: 97.8% (Synchronized)
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Tier: Storage & Consumers (Battery & Factory/Home Load) */}
        <div className="grid grid-cols-2 gap-4 sm:gap-8 mt-8 sm:mt-12">
          {/* Consumer 1: Battery Storage */}
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-950/40 border-2 border-emerald-500/40 flex flex-col items-center justify-center text-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.2)] transition-transform hover:scale-105">
              {isChargingBattery ? (
                <BatteryCharging className="w-7 h-7 sm:w-8 sm:h-8 animate-bounce" />
              ) : (
                <Battery className="w-7 h-7 sm:w-8 sm:h-8" />
              )}
              <span className="text-[9px] font-bold mt-1 text-emerald-200">แบต {batterySOC}%</span>
            </div>
            <div className="mt-2 text-center">
              <span className="text-sm sm:text-base font-black font-mono text-emerald-300">
                {(absBatW / 1000).toFixed(2)} kW
              </span>
              <span className="block text-[10px] text-slate-400 font-medium">
                {isChargingBattery ? 'กำลังชาร์จเข้า' : isDischargingBattery ? 'กำลังจ่ายออก' : 'สแตนด์บาย'}
              </span>
            </div>
          </div>

          {/* Consumer 2: Factory/Home Load */}
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-rose-500/20 to-rose-950/40 border-2 border-rose-500/40 flex flex-col items-center justify-center text-rose-400 shadow-[0_0_25px_rgba(244,63,94,0.2)] transition-transform hover:scale-105">
              <Home className="w-7 h-7 sm:w-8 sm:h-8" />
              <span className="text-[9px] font-bold mt-1 text-rose-200">
                {isHomeSolar ? 'โหลดในบ้าน' : 'เครื่องจักรโรงงาน'}
              </span>
            </div>
            <div className="mt-2 text-center">
              <span className="text-sm sm:text-base font-black font-mono text-rose-300">
                {(loadPowerW / 1000).toFixed(2)} kW
              </span>
              <span className="block text-[10px] text-slate-400 font-medium">กำลังบริโภคไฟ</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
